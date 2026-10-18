/* hoops96-teddy: the CPU players. Every player nobody is steering runs one of these each tick:
   handler (has the ball), offBall (a teammate has it), defend (the other team has it), rebound (loose or in the air)
   and mini (the bonus passer in 2-player versus). They only set p.want (where to run) and call the engine's
   actions (shoot, pass, steal, jump), the same ones the keyboard uses. How quick and sharp they are comes from
   p.brain (LEVELS in sim.js). */
(function (root) {
  'use strict';
  const H = root.Hoops;
  const S = H.sim;
  const { COURT, RIM, DT, SWEET } = S;
  const { clamp, hdist, rimDist, holds, mates, teamPlayers, wrap } = S.util;
  const A = S.act;

  // Where an off-ball player waits for a pass: the top, wings, corners, low blocks and elbows.
  const SPOTS = [[0, 9.2], [-4.9, 6.9], [4.9, 6.9], [-6.6, 2.0], [6.6, 2.0], [-2.6, 3.0], [2.6, 3.0], [-3.4, 5.4], [3.4, 5.4]];

  function gauss(m) {
    const u = Math.max(1e-6, m.rng()), v = m.rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // Run towards (x, z), easing off for the last metre. Returns the distance left.
  function moveTo(p, x, z, k, sharp) {
    const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
    if (d < 0.12) {
      p.want.x = p.want.z = 0;
      return d;
    }
    const s = Math.min(1, d / (sharp ? 0.35 : 0.9)) * (k || 1);
    p.want.x = (dx / d) * s;
    p.want.z = (dz / d) * s;
    return d;
  }

  function nearestOpp(m, p) {
    let best = null, bd = 1e9;
    for (const o of m.players) {
      if (o.team === p.team || o.mini) continue;
      const d = hdist(o, p);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }
  const openness = (m, p) => {
    const o = nearestOpp(m, p);
    return o ? hdist(o, p) : 9;
  };
  // Is the defender between the player and the hoop?
  function inFront(p, o) {
    const d = rimDist(p) || 1;
    const dd = hdist(p, o) || 1;
    return ((o.x - p.x) * (RIM.x - p.x) + (o.z - p.z) * (RIM.z - p.z)) / (d * dd) > 0.25;
  }

  function drive(m, p) {
    if (p.mini) return mini(m, p);
    const b = m.ball;
    if (b.mode === 'held' && b.holder === p) return handler(m, p);
    if (b.mode === 'loose' || b.mode === 'shot') return rebound(m, p);
    const owner = b.mode === 'held' ? b.holder.team : b.mode === 'pass' ? b.pass.from.team : -1;
    if (owner === p.team) return offBall(m, p);
    if (owner >= 0) return defend(m, p);
  }

  // ------------------------------------------------------------------ offence

  function handler(m, p) {
    const team = m.teams[p.team], c = team.combo;
    if (p.act !== 'free' && p.act !== 'juke') return;
    // the companion during the combo: the engine hands it straight back to the caller (comboHandoff in sim.js)
    if (c.on && c.helper === p && c.caller && c.caller !== p) return;
    // the demo game behind the menus shows the brothers' combo off now and then
    if (m.cfg.mode === 'demo' && team.canCall && !c.on && c.rest <= 0 && m.rng() < DT / 14) {
      A.callCompanion(m, p.team, p);
      return;
    }
    const d = rimDist(p);
    const def = nearestOpp(m, p);
    const dd = def ? hdist(def, p) : 9;
    if (m.cfg.clearRule && !m.cleared) {
      // take it back beyond the arc first
      const k = (COURT.three + 0.9) / (d || 1);
      moveTo(p, clamp(RIM.x + (p.x - RIM.x) * k, -6.8, 6.8), clamp(RIM.z + (p.z - RIM.z) * k, 2.2, 14));
      return;
    }
    p.ai.think -= DT;
    if (p.ai.think <= 0) {
      p.ai.think = p.brain.think * (0.7 + m.rng() * 0.6);
      if (decide(m, p, d, def, dd)) return;
    }
    const g = p.ai.goal || (p.ai.goal = driveGoal(m, p, def));
    if (moveTo(p, g.x, g.z) < 0.4) p.ai.goal = null;
  }

  function decide(m, p, d, def, dd) {
    const held = m.time - p.catchT;
    const front = def && inFront(p, def);
    const sc = m.shotClock;
    // dunk when the lane is open; with a man in the way, mostly pull up, pass or shake him first
    if (d < COURT.dunkRange) {
      if (dd > 1.4 || !front || sc < 3) return shoot(m, p);
      const r = m.rng();
      if (r < 0.15) return shoot(m, p);
    }
    if (sc < 2.2) return shoot(m, p);
    const open = dd > 1.9 || !front;
    // a sharp CPU (Normal) attacks an open lane instead of settling for a jumper
    const lane = p.brain.drive && open && d > COURT.dunkRange && d < 7.5 && m.rng() < 0.45;
    if (lane) {
      p.ai.goal = { x: RIM.x + ((p.x - RIM.x) / (d || 1)) * 1.6, z: RIM.z + ((p.z - RIM.z) / (d || 1)) * 1.6 };
      return false;
    }
    if (held > 0.3 && d < 7.6) {
      let want = open ? (d < 4.5 ? 0.55 : d < COURT.three ? 0.5 : 0.45 * p.st.three) : dd > 1.25 && d > 3.5 ? 0.22 : 0;
      if (d < COURT.dunkRange + 1.2 && front && dd < 1.4) want = Math.max(want, 0.2); // pull up over him
      if (held > 2 || sc < 5) want = Math.max(want, 0.35); // he's had it a while: put it up
      if (m.rng() < want) return shoot(m, p);
    }
    // an open teammate (the bonus passer counts as open)
    let best = null, bo = 0;
    for (const q of mates(m, p)) {
      if (q.act !== 'free' && q.act !== 'juke') continue;
      const o = openness(m, q) + (q.mini ? 1.5 : 0);
      if (o > bo) { bo = o; best = q; }
    }
    if (best && held > 0.45 && bo > 2.0 && m.rng() < (dd < 1.3 ? 0.45 : 0.18)) return A.wantPass(m, p, best);
    if (dd < 1.2 && m.rng() < 0.45) A.juke(m, p);
    p.ai.goal = driveGoal(m, p, def);
    return false;
  }

  function shoot(m, p) {
    return A.startShot(m, p, { auto: true, aim: clamp(SWEET + gauss(m) * p.brain.aim, 0.35, 1.25) });
  }

  // A spot nearer the hoop, around the defender's other side.
  function driveGoal(m, p, def) {
    const d = rimDist(p);
    let a = Math.atan2(p.x - RIM.x, p.z - RIM.z); // 0 = straight out from the hoop towards half court
    if (def) {
      const ad = Math.atan2(def.x - RIM.x, def.z - RIM.z);
      a += (wrap(a - ad) >= 0 ? 1 : -1) * (0.35 + m.rng() * 0.4);
    } else a += (m.rng() - 0.5) * 0.6;
    a = clamp(a, -1.45, 1.45);
    // sometimes swing round the arc instead of driving in, so the defence has to move
    const r = m.rng() < 0.35 && d > 4.5 ? d : Math.max(1.2, d - 1.2 - m.rng() * 1.4);
    return { x: clamp(RIM.x + Math.sin(a) * r, -6.9, 6.9), z: clamp(RIM.z + Math.cos(a) * r, 0.8, 14) };
  }

  function offBall(m, p) {
    const b = m.ball;
    if (p.act !== 'free') return;
    if (b.mode === 'pass' && b.pass.to === p) return; // it's coming: stay put
    const holder = b.mode === 'held' ? b.holder : b.pass.to;
    const c = m.teams[p.team].combo;
    if (c.on && c.helper === p) {
      // the companion waits on the near wing for the give-and-go
      moveTo(p, (holder.x <= 0 ? 1 : -1) * 3.8, 4.6);
      return;
    }
    if (c.on && c.caller === p && c.helper === holder) {
      // the caller cuts to the hoop for the alley-oop
      moveTo(p, (p.x < 0 ? -1 : 1) * 2.2, 3.4);
      return;
    }
    p.ai.spotT -= DT;
    const cur = p.ai.spot >= 0 ? SPOTS[p.ai.spot] : null;
    if (!cur || p.ai.spotT <= 0 || Math.hypot(cur[0] - holder.x, cur[1] - holder.z) < 3.2) pickSpot(m, p, holder);
    const s = SPOTS[p.ai.spot];
    moveTo(p, s[0], s[1]);
  }

  function pickSpot(m, p, holder) {
    let best = 0, bs = -1e9;
    for (let i = 0; i < SPOTS.length; i++) {
      const [x, z] = SPOTS[i];
      const dh = Math.hypot(x - holder.x, z - holder.z);
      if (dh < 3.4) continue;
      let sc = -Math.abs(dh - 5.5) * 0.5 + m.rng() * 2.5 + (i === p.ai.spot ? 0.5 : 0);
      for (const o of m.players) if (o.team !== p.team && !o.mini) sc += Math.min(3, Math.hypot(x - o.x, z - o.z)) * 0.5;
      if (sc > bs) { bs = sc; best = i; }
    }
    p.ai.spot = best;
    p.ai.spotT = 1.5 + m.rng() * 2;
  }

  // ------------------------------------------------------------------ defence

  // Man-to-man: pair each defender with the nearer attacker (both teams, so it's ready either way).
  function assign(m) {
    for (const t of [0, 1]) {
      const D = teamPlayers(m, t), O = teamPlayers(m, 1 - t);
      if (D.length < 2 || O.length < 2) {
        D.forEach((p) => (p.ai.man = O[0] || null));
        continue;
      }
      const straight = hdist(D[0], O[0]) + hdist(D[1], O[1]);
      const crossed = hdist(D[0], O[1]) + hdist(D[1], O[0]);
      D[0].ai.man = straight <= crossed ? O[0] : O[1];
      D[1].ai.man = straight <= crossed ? O[1] : O[0];
    }
  }

  function ballMan(m) {
    const b = m.ball;
    return b.mode === 'held' ? b.holder : b.mode === 'pass' ? b.pass.to : null;
  }

  function guardSpot(m, p, man, holder) {
    if (!man) return { x: p.x, z: p.z };
    const dm = rimDist(man) || 0.01;
    const ux = (RIM.x - man.x) / dm, uz = (RIM.z - man.z) / dm;
    if (man === holder) {
      const gap = dm > 8.5 ? 2.0 : dm > 6.8 ? 1.5 : 1.15;
      return { x: man.x + ux * gap, z: man.z + uz * gap };
    }
    // off the ball: between his man and the hoop, sagging towards the ball
    const k = Math.min(2.2, dm * 0.3);
    let x = man.x + ux * k, z = man.z + uz * k;
    if (holder) {
      x += (holder.x - x) * 0.15;
      z += (holder.z - z) * 0.15;
      // help: the ball handler got past his man near the hoop
      const hd = rimDist(holder);
      const mate = m.players.find((q) => q.team === p.team && q !== p && !q.mini);
      if (hd < 3.6 && mate && rimDist(mate) > hd + 0.4) {
        x = holder.x + (RIM.x - holder.x) * 0.45;
        z = holder.z + (RIM.z - holder.z) * 0.45;
      }
    }
    return { x, z };
  }

  function validMan(m, p) {
    const man = p.ai.man;
    if (!man || man.team === p.team || man.mini || !m.players.includes(man)) assign(m);
    return p.ai.man;
  }

  // For Easy: where a kid's idle defender should drift (sim.js asks for this).
  function guardWant(m, p) {
    const holder = ballMan(m);
    const w = guardSpot(m, p, validMan(m, p) || holder, holder);
    const dx = w.x - p.x, dz = w.z - p.z, d = Math.hypot(dx, dz);
    if (d < 0.15) return { x: 0, z: 0 };
    const s = Math.min(1, d / 0.9);
    return { x: (dx / d) * s, z: (dz / d) * s };
  }

  function defend(m, p) {
    if (p.act !== 'free') return;
    const b = m.ball;
    const holder = ballMan(m);
    const man = validMan(m, p) || holder;
    const w = guardSpot(m, p, man, holder);
    moveTo(p, w.x, w.z, 1, man === holder); // on the ball: stay right in front of him
    // a shot or dunk: jump to block after a reaction delay
    const shooter = holder && holds(m, holder) && (holder.act === 'shoot' || holder.act === 'dunk' || holder.act === 'oop') ? holder : null;
    if (shooter) {
      if (!p.ai.blockAt) p.ai.blockAt = m.time + p.brain.react * (0.7 + m.rng() * 0.6);
      if (shooter.act !== 'shoot') moveTo(p, RIM.x + (shooter.x - RIM.x) * 0.5, RIM.z + (shooter.z - RIM.z) * 0.5);
      if (m.time >= p.ai.blockAt && hdist(p, shooter) < (shooter.act === 'shoot' ? 2.0 : 1.9)) {
        A.jump(m, p);
        p.ai.blockAt = 0;
      }
    } else p.ai.blockAt = 0;
    if (b.mode === 'held' && holder && holder.team !== p.team && !holder.mini && hdist(p, holder) < 1.45 &&
      (holder.act === 'free' || holder.act === 'juke') && m.rng() < p.brain.stealRate * DT) A.tryStealBy(m, p);
  }

  // ------------------------------------------------------------------ rebounds

  // Where the ball will be low enough to grab (or where it's rolling to).
  function predict(m) {
    const b = m.ball;
    if (b.y < 0.2 && Math.abs(b.vy) < 0.2) return { x: b.x + b.vx * 0.3, z: b.z + b.vz * 0.3 };
    let x = b.x, y = b.y, z = b.z, vx = b.vx, vy = b.vy, vz = b.vz;
    const W = COURT.wallX - 0.12;
    for (let i = 0; i < 150; i++) {
      vy -= S.GRAV * DT;
      x += vx * DT; y += vy * DT; z += vz * DT;
      if (y < 0.12) { y = 0.12; vy = -vy * 0.62; }
      if (Math.abs(x) > W) { x = clamp(x, -W, W); vx = -vx * 0.55; }
      if (z < 0.25) { z = 0.25; vz = -vz * 0.55; }
      if (vy < 0 && y < 2.3) break;
    }
    return { x: clamp(x, COURT.minX, COURT.maxX), z: clamp(z, COURT.minZ, COURT.maxZ) };
  }

  function rebound(m, p) {
    if (p.act !== 'free' && p.act !== 'juke') return;
    const b = m.ball;
    const own = teamPlayers(m, p.team).filter((q) => q.human < 0);
    if (b.mode === 'shot') {
      // box out: the one nearer the hoop crashes the glass, the other holds back
      const near = own.reduce((a, q) => (rimDist(q) < rimDist(a) ? q : a), own[0]) === p;
      const d = rimDist(p) || 1;
      const r = near ? 2.0 : b.shot.by.team === p.team ? 6.6 : 3.2;
      moveTo(p, RIM.x + ((p.x - RIM.x) / d) * r, Math.max(1.2, RIM.z + ((p.z - RIM.z) / d) * r));
      return;
    }
    const land = predict(m);
    const nearest = own.reduce((a, q) => (Math.hypot(q.x - land.x, q.z - land.z) < Math.hypot(a.x - land.x, a.z - land.z) ? q : a), own[0]);
    if (nearest === p || Math.hypot(p.x - b.x, p.z - b.z) < 3) {
      moveTo(p, land.x, land.z, 1);
      if (Math.hypot(b.x - p.x, b.z - p.z) < 1.1 && b.y > 2.3 && b.y < 3.4 && b.vy < 1) A.jump(m, p);
    } else {
      // the other one gets back: to the top if his team shot it, under the hoop if not
      const top = b.lastTeam === p.team;
      moveTo(p, top ? 0 : (p.x < 0 ? -1.5 : 1.5), top ? 8.5 : 3.6);
    }
  }

  // ------------------------------------------------------------------ the bonus passer (2-player versus)

  function mini(m, p) {
    if (p.leaving) {
      if (holds(m, p)) return passBack(m, p);
      moveTo(p, p.side * 9, p.z);
      if (Math.abs(p.x) > 8.3) p.gone = true;
      return;
    }
    if (holds(m, p)) {
      if (m.time - p.catchT > 0.3) passBack(m, p);
      return;
    }
    moveTo(p, p.ai.spot[0], p.ai.spot[1]);
  }

  function passBack(m, p) {
    if (p.act !== 'free') return;
    const own = teamPlayers(m, p.team).filter((q) => q.act === 'free' || q.act === 'juke');
    if (!own.length) return;
    const to = own.reduce((a, q) => (rimDist(q) < rimDist(a) ? q : a), own[0]);
    const oop = rimDist(to) < COURT.oopRange && to.act === 'free' && (!m.cfg.clearRule || m.cleared);
    A.startPass(m, p, to, oop ? 'oop' : 'chest', true);
  }

  H.ai = { drive, assign, guardWant, predict, SPOTS };
})(typeof window !== 'undefined' ? window : globalThis);
