/* hoops96-teddy: the engine. The half court, the players, the ball, the arcade rules (2s and 3s, shot clock, first to
   21 or 11, ON FIRE) and the brothers' ALLEY-OOP combo. No Three.js in here: a match is plain state stepped at a fixed
   60 ticks a second, so the same code runs the browser game and the headless tests (js/soak.js, tools/soak.js).

   Coordinates are metres. The baseline is z = 0 and the half-court line z = 14; x runs across the court. The rim is at
   (0, 3.05, 1.575). Characters face -z (towards the hoop) when face = 0.
   The renderer reads players and the ball and drains m.events for sounds, effects and banners. */
(function (root) {
  'use strict';
  const H = (root.Hoops = root.Hoops || {});

  const DT = 1 / 60;
  const GRAV = 11; // a little more than real gravity: snappier arcade arcs
  const BALL_R = 0.12;
  const COURT = {
    halfW: 7.5, len: 14,
    minX: -7.1, maxX: 7.1, minZ: 0.35, maxZ: 15.2, // where players can run
    wallX: 7.45, wallZ0: 0.12, wallZ1: 15.8, // where the ball bounces back (the fences and the low wall)
    rim: { x: 0, y: 3.05, z: 1.575 }, rimR: 0.23,
    board: { z: 1.2, halfW: 0.9, y0: 2.9, y1: 3.95 },
    three: 6.25, keyHalfW: 2.45, keyZ: 5.8,
    dunkRange: 3.3, // closer than this, the shoot button dunks
    oopRange: 8.5, // the companion lobs an alley-oop to you from up to this far out
  };
  const RIM = COURT.rim;

  const SPEED = 6.4; // base run speed, m/s
  const SHOT_AIR = 0.82, SHOT_JUMP = 0.8; // a jump shot: time in the air, jump height
  const METER_T = 0.5, SWEET = 0.8; // the meter fills in METER_T seconds; let go at SWEET for a perfect release
  const JUMP_T = 0.72, JUMP_H = 1.0; // a block or rebound jump
  const HANG_T = 0.45; // hanging on the rim after a dunk
  const COMBO_T = 10; // the brothers' ALLEY-OOP combo lasts this long
  const LOOSE_RESCUE = 8; // a loose ball nobody picks up for this long is handed to someone (should never happen)

  // CPU brains. spd: run speed; react: seconds before a defender jumps at a shot; think: seconds between offensive
  // decisions; aim: spread around the meter's sweet spot; stealRate: steal tries per second when close;
  // steal / block / pick / dunkBlock: success chances (strip the ball, block a shot, pick off a pass, stuff a dunk).
  const LEVELS = {
    easy: { spd: 0.82, react: 0.5, think: 0.6, aim: 0.22, stealRate: 0.2, steal: 0.18, block: 0.15, pick: 0.15, dunkBlock: 0.05, drive: 0 },
    normal: { spd: 1.0, react: 0.2, think: 0.4, aim: 0.1, stealRate: 0.5, steal: 0.28, block: 0.32, pick: 0.3, dunkBlock: 0.32, drive: 1 },
  };
  // The same chances when a kid is in control.
  const HUMAN = {
    easy: { steal: 0.45, block: 0.75, pick: 0.45, dunkBlock: 0.45 },
    normal: { steal: 0.32, block: 0.6, pick: 0.35, dunkBlock: 0.35 },
  };
  // Easy: first to 11, a long shot clock, shots timed for you and the companion back after 3 s.
  const RULES = {
    easy: { target: 11, shotClock: 20, comboRest: 3, autoAim: true },
    normal: { target: 21, shotClock: 14, comboRest: 15, autoAim: false },
  };
  const VS_COMBO_REST = 20; // in 2-player versus the bonus passer needs a longer rest, for fairness

  // ------------------------------------------------------------------ helpers

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, k) => a + (b - a) * k;
  const hdist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const rimDist = (p) => Math.hypot(p.x - RIM.x, p.z - RIM.z);
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const angleTo = (p, x, z) => Math.atan2(-(x - p.x), -(z - p.z));
  const fwd = (p) => ({ x: -Math.sin(p.face), z: -Math.cos(p.face) });
  const ON_GROUND = { free: 1, juke: 1, pass: 1, steal: 1, land: 1, stun: 1, celebrate: 1 };

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // A height curve through (0, 0) and (1, yEnd) that peaks at yPk, for dunks.
  function arcY(u, yPk, yEnd) {
    const pk = Math.max(yPk, yEnd + 0.05);
    const b = 2 * pk + 2 * Math.sqrt(pk * pk - pk * yEnd);
    const a = yEnd - b;
    return a * u * u + b * u;
  }

  function ev(m, type, o) {
    const e = o || {};
    e.type = type;
    e.t = m.time;
    m.events.push(e);
    return e;
  }

  // ------------------------------------------------------------------ setup

  let uid = 1;
  function makePlayer(m, team, slot, id, opts) {
    const st = H.teams.stats(id);
    const p = {
      uid: uid++, team, slot, id, st, name: st.name,
      x: 0, z: 0, y: 0, vx: 0, vz: 0, vy: 0, face: 0, speed: 0,
      act: 'free', t: 0, want: { x: 0, z: 0 },
      human: -1, brain: null, mini: false,
      shot: null, fly: null, cele: null, stunT: 0, jukeCD: 0, catchT: 0, slow: 0,
      streak: 0, fire: false,
      stats: { pts: 0, dunks: 0, threes: 0, steals: 0, blocks: 0, oops: 0, shots: 0, makes: 0 },
      ai: { think: 0, goal: null, spot: -1, spotT: 0, man: null, blockAt: 0, idle: 0 },
    };
    Object.assign(p, opts || {});
    return p;
  }

  // o: { teams: [teamDef, teamDef], mode: '1p' | 'coop' | 'vs' | 'demo', level: 'easy' | 'normal', clearRule,
  //      seed, firstOffense }. A teamDef is { ids: [a, b], name, color, brothers, level }.
  function createMatch(o) {
    const level = o.level === 'easy' ? 'easy' : 'normal';
    const rules = Object.assign({}, RULES[level]);
    if (o.target) rules.target = o.target;
    const mode = o.mode || 'demo';
    const m = {
      cfg: { mode, level, rules, clearRule: !!o.clearRule },
      rng: mulberry32(o.seed !== undefined ? o.seed : (Math.random() * 1e9) | 0),
      time: 0, phase: 'intro', phaseT: 0, offense: 0, nextOffense: 0, shotClock: rules.shotClock, cleared: true,
      teams: [], players: [], events: [], humans: [], winner: -1, checks: 0, spots: null,
      ball: { x: 0, y: 1, z: 10, vx: 0, vy: 0, vz: 0, mode: 'held', holder: null, pass: null, shot: null, rimmed: false, looseT: 0, lastTeam: 0 },
      stat: { possessions: 0, rescues: 0, maxLoose: 0, shots: 0, turnovers: 0, clockViolations: 0 },
    };
    // who is human: 1p = one kid on team 0; coop = two kids on team 0 (P1 Teddy, P2 Tommy); vs = one kid per team
    const humanTeams = mode === '1p' ? [0] : mode === 'coop' ? [0, 0] : mode === 'vs' ? [0, 1] : [];
    o.teams.forEach((def, ti) => {
      const team = {
        idx: ti, name: def.name, color: def.color, ids: def.ids.slice(), score: 0, brothers: !!def.brothers,
        captain: def.ids[0], human: humanTeams.includes(ti), level: def.level || 1, gamePoint: false,
        // the companion: the brothers' ALLEY-OOP combo (1p / coop), or the captain's brother as a bonus passer (vs)
        canCall: mode === 'vs' || (!!def.brothers && mode !== 'vs'),
        combo: { on: false, t: 0, rest: 0, restMax: 0, helper: null, caller: null, sure: false, saved: false, treat: false },
      };
      m.teams.push(team);
      def.ids.forEach((id, slot) => m.players.push(makePlayer(m, ti, slot, id)));
    });
    humanTeams.forEach((ti, idx) => {
      const fixed = mode === 'coop' ? idx : null; // co-op: P1 is always Teddy (slot 0), P2 always Tommy (slot 1)
      m.humans.push({ idx, team: ti, fixed, ctrl: -1, prevShoot: false });
    });
    for (const p of m.players) p.brain = brainFor(m, p);
    const first = o.firstOffense !== undefined ? o.firstOffense : mode === '1p' || mode === 'coop' ? 0 : m.rng() < 0.5 ? 0 : 1;
    setupCheck(m, first, 'intro');
    return m;
  }

  // The CPU brain for a player. A kid's AI teammate gets the Normal brain, so he's a helpful teammate on Easy too.
  function brainFor(m, p) {
    const team = m.teams[p.team];
    const base = LEVELS[team.human ? 'normal' : m.cfg.level];
    const k = team.human ? 1 : team.level;
    return Object.assign({}, base, {
      react: base.react / k, think: base.think / k, aim: base.aim / k,
      steal: base.steal * k, block: base.block * k, pick: base.pick * k, dunkBlock: base.dunkBlock * k,
      stealRate: base.stealRate * k, spd: base.spd * (0.6 + 0.4 * k),
    });
  }

  const teamPlayers = (m, ti) => m.players.filter((p) => p.team === ti && !p.mini);
  // teammates you can pass to (the bonus passer only once he's on the court, and not on his way off)
  const mates = (m, p) => m.players.filter((q) => q.team === p.team && q !== p && !(q.mini && (q.leaving || Math.abs(q.x) > 7.3)));
  const holds = (m, p) => m.ball.mode === 'held' && m.ball.holder === p;
  const chances = (m, p) => (p.human >= 0 ? HUMAN[m.cfg.level] : p.brain);
  const outsideArc = (p) => rimDist(p) >= COURT.three + 0.1;

  // The check spots after a score or a turnover: the ball handler at the top, his partner on a wing, and each
  // defender between his man and the hoop.
  function checkSpots(m, off) {
    const O = teamPlayers(m, off), D = teamPlayers(m, 1 - off);
    const handler = O[m.checks % O.length];
    const side = m.rng() < 0.5 ? -1 : 1;
    const spots = new Map();
    spots.set(handler, [0, 10.6]);
    const other = O.find((p) => p !== handler);
    if (other) spots.set(other, [side * 4.8, 6.6]);
    const dOnBall = D.find((p) => p.slot === handler.slot) || D[0];
    spots.set(dOnBall, [0, 9.3]);
    const dOther = D.find((p) => p !== dOnBall);
    if (dOther) spots.set(dOther, [side * 4.1, 5.5]);
    return { handler, spots, matchups: [[dOnBall, handler], [dOther, other]] };
  }

  function setupCheck(m, off, phase) {
    const plan = m.spots && m.spots.off === off ? m.spots.plan : checkSpots(m, off);
    m.spots = null;
    m.checks++;
    m.offense = off;
    m.shotClock = m.cfg.rules.shotClock;
    m.cleared = true;
    for (const [p, [x, z]] of plan.spots) {
      Object.assign(p, { x, z, y: 0, vx: 0, vz: 0, vy: 0, act: 'free', t: 0, shot: null, fly: null, cele: null, stunT: 0 });
      p.face = p.team === off ? angleTo(p, RIM.x, RIM.z) : angleTo(p, plan.handler.x, plan.handler.z);
      p.ai.goal = null;
      p.ai.blockAt = 0;
    }
    for (const [d, o] of plan.matchups) if (d) d.ai.man = o || null;
    for (const p of m.players) if (p.mini) placeMini(m, p);
    const b = m.ball;
    Object.assign(b, { mode: 'held', holder: plan.handler, pass: null, shot: null, rimmed: false, looseT: 0, vx: 0, vy: 0, vz: 0 });
    b.lastTeam = off;
    plan.handler.catchT = m.time;
    m.phase = phase || 'check';
    m.phaseT = 0;
    m.stat.possessions++;
    for (const h of m.humans) pickControl(m, h, true);
    ev(m, 'check', { off, intro: phase === 'intro' });
  }

  // ------------------------------------------------------------------ control (which player each kid steers)

  function pickControl(m, h, force) {
    if (h.fixed !== null) {
      const p = teamPlayers(m, h.team)[h.fixed];
      setCtrl(m, h, p);
      return;
    }
    const b = m.ball;
    const holder = b.mode === 'held' ? b.holder : null;
    const cur = m.players.find((p) => p.human === h.idx);
    if (holder && holder.team === h.team && !holder.mini) {
      const c = m.teams[h.team].combo;
      // during the ALLEY-OOP combo the helper hands the ball straight back, so you stay in control of the caller
      if (!(c.on && c.helper === holder && cur && cur !== holder) || force) return setCtrl(m, h, holder);
    }
    if (force || !cur) {
      // on defence: the player nearest the ball
      const own = teamPlayers(m, h.team);
      let best = own[0], bd = 1e9;
      for (const p of own) {
        const d = hdist(p, b);
        if (d < bd) { bd = d; best = p; }
      }
      setCtrl(m, h, best);
    }
  }

  function setCtrl(m, h, p) {
    // never take a player another kid is steering
    if (!p || (p.human >= 0 && p.human !== h.idx)) return;
    for (const q of m.players) if (q.human === h.idx) q.human = -1;
    p.human = h.idx;
    // the combo's helper is always the brother you're NOT steering: if control lands on him, they swap roles
    const c = m.teams[p.team].combo;
    if (c.on && c.helper === p && !p.mini && c.caller && h.fixed === null) {
      c.helper = c.caller;
      c.caller = p;
    }
    if (h.ctrl !== p.uid) ev(m, 'control', { h: h.idx, p });
    h.ctrl = p.uid;
  }

  function switchCtrl(m, h) {
    if (h.fixed !== null) return;
    const own = teamPlayers(m, h.team);
    const cur = own.findIndex((p) => p.human === h.idx);
    for (let k = 1; k <= own.length; k++) {
      const p = own[(cur + k) % own.length];
      if (p.human < 0) return setCtrl(m, h, p);
    }
  }

  // ------------------------------------------------------------------ actions (used by kids' input and the CPU)

  function faceTo(p, x, z) { p.face = angleTo(p, x, z); }

  function startShot(m, p, opts) {
    if (!holds(m, p) || (p.act !== 'free' && p.act !== 'juke')) return false;
    if (m.cfg.clearRule && !m.cleared) {
      ev(m, 'clearIt', { p });
      return false;
    }
    if (rimDist(p) < COURT.dunkRange) return startDunk(m, p);
    p.act = 'shoot';
    p.t = 0;
    p.shot = { auto: !!opts.auto, aim: opts.aim !== undefined ? opts.aim : SWEET, released: false, meter: 0, x0: p.x, z0: p.z };
    p.vx *= 0.3;
    p.vz *= 0.3;
    faceTo(p, RIM.x, RIM.z);
    ev(m, 'shootStart', { p });
    return true;
  }

  function quality(meter) {
    const err = Math.abs(meter - SWEET);
    return err <= 0.07 ? 1 : clamp(1 - (err - 0.07) / 0.38, 0, 1);
  }

  // How likely a jump shot goes in: range, the release timing q (0..1), the shooter, and a hand in his face.
  function makeChance(m, p, d, q, three) {
    let base;
    if (d < 2.5) base = 0.78;
    else if (d < COURT.three) base = 0.74 - (d - 2.5) * 0.06;
    else base = Math.max(0.12, 0.5 - (d - COURT.three) * 0.09);
    let prob = base * p.st.shoot * (three ? p.st.three : 1) * (0.3 + 0.75 * q);
    // contest: the nearest defender between the shooter and the hoop
    const f = { x: (RIM.x - p.x) / (d || 1), z: (RIM.z - p.z) / (d || 1) };
    let contest = 1;
    for (const o of m.players) {
      if (o.team === p.team || o.mini) continue;
      const dd = hdist(o, p);
      if (dd > 1.9) continue;
      const dot = ((o.x - p.x) * f.x + (o.z - p.z) * f.z) / (dd || 1);
      if (dot < 0.2) continue;
      contest = Math.min(contest, 0.6 + 0.4 * (dd / 1.9) - (o.y > 0.25 ? 0.1 : 0));
    }
    prob *= contest;
    if (p.fire) prob = Math.max(prob, q < 0.4 ? 0.6 : 0.9);
    if (m.cfg.level === 'easy' && m.teams[p.team].human) prob *= 1.08;
    return clamp(prob, 0.04, 0.97);
  }

  function releaseShot(m, p) {
    const s = p.shot;
    if (!s || s.released) return;
    s.released = true;
    const q = s.auto ? quality(s.aim) : quality(s.meter);
    s.q = q;
    const d = rimDist(p);
    const three = Math.hypot(s.x0 - RIM.x, s.z0 - RIM.z) >= COURT.three;
    let prob = makeChance(m, p, d, q, three);
    const team = m.teams[p.team];
    const sure = team.combo.on && team.combo.sure && team.combo.caller === p;
    if (sure) {
      prob = 1;
      team.combo.sure = false;
    }
    const made = m.rng() < prob;
    const f = fwd(p);
    const b = m.ball;
    const sx = p.x + f.x * 0.25, sy = p.y + 2.45, sz = p.z + f.z * 0.25;
    let tx = RIM.x, ty = RIM.y + 0.04, tz = RIM.z;
    let theta = 0;
    if (!made) {
      // aim at a spot on the rim (mostly the front, sometimes the back) and bounce off it
      theta = Math.atan2(p.x - RIM.x, p.z - RIM.z) + (m.rng() - 0.5) * 2.4 + (m.rng() < 0.3 ? Math.PI : 0);
      tx = RIM.x + Math.sin(theta) * (COURT.rimR + 0.06);
      tz = RIM.z + Math.cos(theta) * (COURT.rimR + 0.06);
      ty = RIM.y + 0.08;
    }
    const apex = Math.max(sy, RIM.y) + 1.1 + d * 0.13;
    const vy = Math.sqrt(2 * GRAV * (apex - sy));
    const T = vy / GRAV + Math.sqrt((2 * (apex - ty)) / GRAV);
    Object.assign(b, { mode: 'shot', holder: null, x: sx, y: sy, z: sz, vx: (tx - sx) / T, vy, vz: (tz - sz) / T, lastTeam: p.team });
    b.shot = { by: p, made, pts: three ? 3 : 2, three, kind: 'jump', T, t: 0, sx, sy, sz, vy0: vy, theta, tried: [], q, prob, sure };
    p.stats.shots++;
    m.stat.shots++;
    ev(m, 'release', { p, q, three, sure, auto: s.auto, prob, d });
  }

  function startDunk(m, p) {
    const d = rimDist(p) || 0.01;
    let nx = (p.x - RIM.x) / d, nz = (p.z - RIM.z) / d;
    if (p.z < COURT.board.z + 0.1) {
      // under or behind the board: come in from the side
      nx = p.x < 0 ? -1 : 1;
      nz = 0.25;
    }
    const x1 = RIM.x + nx * 0.45, z1 = Math.max(RIM.z + nz * 0.45, COURT.board.z + 0.15);
    const dist = Math.hypot(x1 - p.x, z1 - p.z);
    const T = clamp(0.62 + dist * 0.11, 0.65, 1.0);
    const styles = ['spin', 'tomahawk', 'windmill', 'twohand'];
    p.act = 'dunk';
    p.t = 0;
    p.fly = { x0: p.x, z0: p.z, x1, z1, T, uLeap: 0, yPk: 1.65 + m.rng() * 0.3 * p.st.dunk + (p.fire ? 0.3 : 0), yEnd: 0.8, style: styles[Math.floor(m.rng() * styles.length)], tried: [] };
    faceTo(p, RIM.x, RIM.z);
    ev(m, 'dunkStart', { p, style: p.fly.style });
    return true;
  }

  // The alley-oop: the receiver runs and leaps to meet the lob at the rim, exactly when the ball gets there.
  function oopPlan(p, T) {
    const d = rimDist(p) || 0.01;
    let nx = (p.x - RIM.x) / d, nz = (p.z - RIM.z) / d;
    if (p.z < COURT.board.z + 0.1) { nx = p.x < 0 ? -1 : 1; nz = 0.25; }
    const x1 = RIM.x + nx * 0.45, z1 = Math.max(RIM.z + nz * 0.45, COURT.board.z + 0.15);
    return { x0: p.x, z0: p.z, x1, z1, T, uLeap: Math.max(0, 1 - 0.85 / T), yPk: 1.9, yEnd: 0.8, style: 'oop', tried: [] };
  }

  function startPass(m, p, to, kind, perfect) {
    if (!holds(m, p) || !to || to === p) return false;
    if (p.act !== 'free' && p.act !== 'juke') return false;
    const b = m.ball;
    faceTo(p, to.x, to.z);
    const f = fwd(p);
    const sx = p.x + f.x * 0.4, sy = p.y + 1.35, sz = p.z + f.z * 0.4;
    const d = hdist(p, to);
    let T, arc, fly = null;
    if (kind === 'oop') {
      T = clamp(0.7 + rimDist(to) * 0.07, 0.8, 1.3);
      fly = oopPlan(to, T);
      arc = 2.2;
    } else if (kind === 'lob') {
      T = 0.55 + d * 0.035;
      arc = 1.6;
    } else {
      T = clamp(d / 15, 0.16, 0.7);
      arc = 0.25 + d * 0.02;
    }
    Object.assign(b, { mode: 'pass', holder: null, x: sx, y: sy, z: sz, lastTeam: p.team });
    b.pass = { from: p, to, kind, perfect: !!perfect, t: 0, T, sx, sy, sz, arc, tried: [] };
    p.act = 'pass';
    p.t = 0;
    if (fly) {
      to.act = 'oop';
      to.t = 0;
      to.fly = fly;
      to.shot = null;
      ev(m, 'oopStart', { p: to, from: p });
    }
    ev(m, 'pass', { p, to, kind, perfect: !!perfect });
    return true;
  }

  function tryStealBy(m, p) {
    if (p.act !== 'free') return false;
    p.act = 'steal';
    p.t = 0;
    const b = m.ball;
    const h = b.mode === 'held' ? b.holder : null;
    if (h) faceTo(p, h.x, h.z);
    if (!h || h.team === p.team || h.mini || hdist(p, h) > 1.7 || (h.act !== 'free' && h.act !== 'juke')) {
      ev(m, 'whiff', { p });
      return false;
    }
    let chance = chances(m, p).steal * p.st.steal * (hdist(p, h) < 1.0 ? 1.15 : 1);
    if (m.time - (h.guardT || -9) < 0.9) chance *= 0.35; // he just felt a reach: he's protecting the ball
    h.guardT = m.time;
    if (h.act === 'juke') chance = 0; // the crossover shakes him off
    if (m.rng() >= chance) {
      p.slow = 0.6; // off balance: the dribbler can get past
      ev(m, 'whiff', { p, near: true });
      return false;
    }
    if (saveFor(m, h, p)) return false;
    p.stats.steals++;
    ev(m, 'steal', { p, from: h });
    catchBall(m, p);
    return true;
  }

  function jump(m, p) {
    if (p.act !== 'free' && p.act !== 'juke') return false;
    p.act = 'jump';
    p.t = 0;
    ev(m, 'jump', { p });
    return true;
  }

  // H with the ball: a crossover. A burst of speed, and steals miss while you do it.
  function juke(m, p) {
    if (!holds(m, p) || p.act !== 'free' || p.jukeCD > 0) return false;
    p.act = 'juke';
    p.t = 0;
    p.jukeCD = 1.2;
    ev(m, 'juke', { p });
    return true;
  }

  // The companion's save: while the combo is on, the first steal or block against his team is cancelled.
  function saveFor(m, victim, attacker) {
    const c = m.teams[victim.team].combo;
    if (!c.on || c.saved) return false;
    c.saved = true;
    attacker.act = 'stun';
    attacker.t = 0;
    attacker.stunT = 0.8;
    ev(m, 'save', { team: victim.team, helper: c.helper, victim, attacker });
    return true;
  }

  // ------------------------------------------------------------------ the companion

  function callCompanion(m, ti, caller) {
    const team = m.teams[ti];
    const c = team.combo;
    if (!team.canCall || m.phase === 'over') return false;
    if (c.on) {
      ev(m, 'comboBusy', { team: ti });
      return false;
    }
    if (c.rest > 0) {
      ev(m, 'comboRest', { team: ti });
      return false;
    }
    Object.assign(c, { on: true, t: 0, saved: false, treat: false, caller: caller || teamPlayers(m, ti)[0] });
    if (m.cfg.mode === 'vs') {
      c.helper = spawnMini(m, team);
      c.sure = false;
    } else {
      c.helper = teamPlayers(m, ti).find((p) => p !== c.caller) || null;
      c.sure = true;
    }
    ev(m, 'combo', { team: ti, caller: c.caller, helper: c.helper });
    // called with the ball near the hoop: flip it to your brother and he lobs it straight back, ALLEY-OOP!
    const cl = c.caller;
    if (!c.helper.mini && m.phase === 'live' && holds(m, cl) && (cl.act === 'free' || cl.act === 'juke') &&
      rimDist(cl) < COURT.oopRange && (!m.cfg.clearRule || m.cleared)) {
      if (startPass(m, cl, c.helper, 'chest', true)) ev(m, 'giveAndGo', { p: cl, to: c.helper });
    }
    return true;
  }

  // During the combo the helper never keeps the ball: he hands it to the caller (an alley-oop when he's in range).
  function comboHandoff(m) {
    for (const team of m.teams) {
      const c = team.combo, hp = c.helper;
      if (!c.on || !hp || hp.mini || !holds(m, hp) || hp.act !== 'free' || m.time - hp.catchT < 0.15) continue;
      if (c.caller.act === 'free' || c.caller.act === 'juke') wantPass(m, hp, c.caller);
    }
  }

  // 2-player versus: the captain's brother joins as a small sixth player who stands on a wing and only passes.
  const BROTHER = { teddy: 'tommy', tommy: 'teddy' };
  function spawnMini(m, team) {
    const id = BROTHER[team.captain] || 'tommy';
    const p = makePlayer(m, team.idx, 2, id, { mini: true });
    p.brain = brainFor(m, p);
    p.side = team.idx === 0 ? -1 : 1;
    p.x = p.side * 8.1;
    p.z = 7.2;
    p.face = angleTo(p, 0, 7.2);
    p.ai.spot = [p.side * 5.7, 7.6];
    m.players.push(p);
    return p;
  }
  function placeMini(m, p) {
    Object.assign(p, { x: p.ai.spot[0], z: p.ai.spot[1], y: 0, vx: 0, vz: 0, act: 'free', t: 0 });
  }

  function updateCombos(m) {
    for (const team of m.teams) {
      const c = team.combo;
      if (c.on) {
        c.t += DT;
        if (!c.treat && c.t > 0.6) {
          c.treat = true;
          ev(m, 'treat', { team: team.idx, from: c.helper, to: c.caller });
        }
        if (c.t >= COMBO_T || m.phase === 'over') endCombo(m, team);
      } else if (c.rest > 0) c.rest = Math.max(0, c.rest - DT);
    }
    // bonus passers leave once the ball has left their hands
    for (let i = m.players.length - 1; i >= 0; i--) {
      const p = m.players[i];
      if (p.mini && p.gone && !holds(m, p) && !(m.ball.mode === 'pass' && m.ball.pass.to === p)) {
        m.players.splice(i, 1);
        ev(m, 'miniGone', { p });
      }
    }
  }

  function endCombo(m, team) {
    const c = team.combo;
    c.on = false;
    c.sure = false;
    c.rest = c.restMax = m.cfg.mode === 'vs' ? VS_COMBO_REST : m.cfg.rules.comboRest;
    if (c.helper && c.helper.mini) c.helper.leaving = true;
    ev(m, 'comboEnd', { team: team.idx, helper: c.helper });
    c.helper = null;
  }

  // ------------------------------------------------------------------ kids' input

  const NO_INPUT = { mx: 0, mz: 0, shoot: false, pass: false, steal: false, call: false };

  function humanInput(m, inputs) {
    const live = m.phase === 'live';
    for (const h of m.humans) {
      const inp = (inputs && inputs[h.idx]) || NO_INPUT;
      if (live) pickControl(m, h, false);
      const p = m.players.find((q) => q.uid === h.ctrl);
      const pressed = inp.shoot && !h.prevShoot, released = !inp.shoot && h.prevShoot;
      h.prevShoot = !!inp.shoot;
      if (!p) continue;
      let mx = inp.mx || 0, mz = inp.mz || 0;
      const len = Math.hypot(mx, mz);
      if (len > 1) { mx /= len; mz /= len; }
      p.want.x = mx;
      p.want.z = mz;
      if (inp.call && m.phase !== 'over') callCompanion(m, h.team, p);
      if (!live) continue;
      const b = m.ball;
      const theirBall = (b.mode === 'held' && b.holder.team !== p.team) || (b.mode === 'pass' && b.pass.from.team !== p.team);
      // Easy: a defender left alone drifts to his man, so a 5-year-old can't get lost on defence
      if (len < 0.1 && theirBall && m.cfg.level === 'easy' && p.act === 'free') {
        p.ai.idle += DT;
        if (p.ai.idle > 0.6 && H.ai) {
          const w = H.ai.guardWant(m, p);
          p.want.x = w.x * 0.75;
          p.want.z = w.z * 0.75;
        }
      } else p.ai.idle = 0;
      if (p.act === 'shoot' && p.shot && !p.shot.auto && !p.shot.released && released) releaseShot(m, p);
      if (holds(m, p)) {
        if (pressed) startShot(m, p, { auto: m.cfg.rules.autoAim, aim: SWEET });
        else if (inp.pass) humanPass(m, p, mx, mz);
        else if (inp.steal) juke(m, p);
      } else {
        if (pressed) jump(m, p);
        if (inp.steal) {
          const hd = b.mode === 'held' ? b.holder : null;
          if (hd && hd.team !== p.team && hdist(hd, p) < 1.8) tryStealBy(m, p);
          else if (theirBall || b.mode === 'loose') switchCtrl(m, h);
        }
        if (inp.pass) {
          if (theirBall || b.mode === 'loose' || b.mode === 'shot') switchCtrl(m, h);
          else {
            ev(m, 'callForPass', { p });
            const hd = b.mode === 'held' ? b.holder : null;
            // an AI teammate with the ball passes when you ask for it
            if (hd && hd.team === p.team && hd.human < 0 && !hd.mini) wantPass(m, hd, p);
          }
        }
      }
    }
  }

  function wantPass(m, from, to) {
    const c = m.teams[from.team].combo;
    const oop = c.on && c.helper === from && c.caller === to && rimDist(to) < COURT.oopRange && to.act === 'free' && (!m.cfg.clearRule || m.cleared);
    return startPass(m, from, to, oop ? 'oop' : 'chest', c.on && (c.helper === from || c.helper === to));
  }

  // Pass to the teammate the stick points at (with one teammate, to him).
  function humanPass(m, p, mx, mz) {
    const list = mates(m, p);
    if (!list.length) return;
    let to = list[0];
    if (list.length > 1) {
      const f = Math.hypot(mx, mz) > 0.3 ? { x: mx, z: mz } : fwd(p);
      let best = -2;
      for (const q of list) {
        const d = hdist(p, q) || 1;
        const dot = ((q.x - p.x) * f.x + (q.z - p.z) * f.z) / d - d * 0.01;
        if (dot > best) { best = dot; to = q; }
      }
    }
    wantPass(m, p, to);
  }

  // ------------------------------------------------------------------ the ball

  function catchBall(m, p) {
    const b = m.ball;
    b.mode = 'held';
    b.holder = p;
    b.pass = null;
    b.shot = null;
    p.catchT = m.time;
    gainBall(m, p);
    ev(m, 'catch', { p });
  }

  function gainBall(m, p) {
    const b = m.ball;
    if (p.team !== m.offense) {
      m.offense = p.team;
      m.shotClock = m.cfg.rules.shotClock;
      m.cleared = !m.cfg.clearRule || outsideArc(p);
      m.stat.possessions++;
      m.stat.turnovers++;
      ev(m, 'turnover', { team: p.team, p });
      if (H.ai) H.ai.assign(m);
      for (const h of m.humans) if (h.team !== p.team) pickControl(m, h, true);
    } else if (b.rimmed) m.shotClock = m.cfg.rules.shotClock;
    b.rimmed = false;
    b.looseT = 0;
    b.lastTeam = p.team;
  }

  function looseBall(m, vx, vy, vz) {
    const b = m.ball;
    Object.assign(b, { mode: 'loose', holder: null, pass: null, shot: null, vx, vy, vz, looseT: 0 });
  }

  function updateBall(m) {
    const b = m.ball;
    if (b.mode === 'held') {
      const p = b.holder;
      const f = fwd(p);
      const high = p.act === 'dunk' || p.act === 'oop' || p.act === 'shoot';
      b.x = p.x + f.x * (high ? 0.2 : 0.35);
      b.z = p.z + f.z * (high ? 0.2 : 0.35);
      b.y = p.y + (high ? 2.5 : 1.05);
      b.vx = b.vy = b.vz = 0;
      return;
    }
    if (b.mode === 'pass') return updatePass(m);
    if (b.mode === 'shot') return updateShot(m);
    if (b.mode === 'net') {
      // through the net, slowed by the strings, then it drops to the floor
      b.t = (b.t || 0) + DT;
      b.y -= 1.8 * DT;
      if (b.t > 0.28) {
        b.mode = 'dead';
        b.vx = (m.rng() - 0.5) * 1.2;
        b.vz = 0.6 + m.rng() * 0.8;
        b.vy = -1.5;
      }
      return;
    }
    // loose or dead: plain physics
    physics(m, b);
    if (b.mode === 'loose') {
      b.looseT += DT;
      m.stat.maxLoose = Math.max(m.stat.maxLoose, b.looseT);
      if (m.phase === 'live') pickups(m);
      if (b.mode === 'loose' && (b.looseT > LOOSE_RESCUE || !Number.isFinite(b.x + b.y + b.z))) rescue(m);
    }
  }

  function physics(m, b) {
    b.vy -= GRAV * DT;
    const px = b.x, pz = b.z;
    b.x += b.vx * DT;
    b.y += b.vy * DT;
    b.z += b.vz * DT;
    if (b.y < BALL_R) {
      b.y = BALL_R;
      if (b.vy < -1.2) {
        if (b.vy < -2.5) ev(m, 'bounce', { v: -b.vy });
        b.vy = -b.vy * 0.62;
        b.vx *= 0.88;
        b.vz *= 0.88;
      } else {
        b.vy = 0;
        const k = Math.max(0, 1 - 1.4 * DT); // rolling friction
        b.vx *= k;
        b.vz *= k;
      }
    }
    const W = COURT.wallX - BALL_R;
    if (b.x < -W) { b.x = -W; b.vx = Math.abs(b.vx) * 0.55; ev(m, 'fence', {}); }
    if (b.x > W) { b.x = W; b.vx = -Math.abs(b.vx) * 0.55; ev(m, 'fence', {}); }
    if (b.z < COURT.wallZ0 + BALL_R) { b.z = COURT.wallZ0 + BALL_R; b.vz = Math.abs(b.vz) * 0.55; ev(m, 'fence', {}); }
    if (b.z > COURT.wallZ1 - BALL_R) { b.z = COURT.wallZ1 - BALL_R; b.vz = -Math.abs(b.vz) * 0.55; }
    // the backboard
    const B = COURT.board;
    if (Math.abs(b.x) < B.halfW && b.y > B.y0 && b.y < B.y1) {
      const before = pz - B.z, after = b.z - B.z;
      if ((before >= -0.02 && after < BALL_R) || (before <= 0.02 && after > -BALL_R)) {
        if (before >= -0.02 && after < BALL_R) { b.z = B.z + BALL_R; b.vz = Math.abs(b.vz) * 0.6; }
        else { b.z = B.z - BALL_R; b.vz = -Math.abs(b.vz) * 0.6; }
        ev(m, 'board', {});
      }
    }
    if (!Number.isFinite(b.x)) b.x = px;
    if (!Number.isFinite(b.z)) b.z = pz;
  }

  const CANT_GRAB = { shoot: 1, dunk: 1, oop: 1, hang: 1, fall: 1, stun: 1, celebrate: 1 };
  function pickups(m) {
    const b = m.ball;
    let best = null, bd = 0.85;
    for (const p of m.players) {
      if (p.mini || CANT_GRAB[p.act]) continue;
      if (b.y > p.y + (p.act === 'jump' ? 2.85 : 2.5)) continue;
      const d = Math.hypot(p.x - b.x, p.z - b.z);
      if (d < bd || (d === bd && m.rng() < 0.5)) { bd = d; best = p; }
    }
    if (best) {
      ev(m, 'rebound', { p: best, off: best.team === b.lastTeam });
      catchBall(m, best);
    }
  }

  // Safety net: hand a ball nobody has picked up for 8 s to the nearest player. The soak test counts these.
  function rescue(m) {
    const b = m.ball;
    if (!Number.isFinite(b.x + b.y + b.z)) Object.assign(b, { x: 0, y: 1, z: 8 });
    let best = null, bd = 1e9;
    for (const p of m.players) {
      if (p.mini) continue;
      const d = hdist(p, b);
      if (d < bd) { bd = d; best = p; }
    }
    m.stat.rescues++;
    ev(m, 'rescue', {});
    catchBall(m, best);
  }

  function updatePass(m) {
    const b = m.ball, ps = b.pass, to = ps.to;
    ps.t += DT;
    const u = Math.min(1, ps.t / ps.T);
    let ex, ey, ez;
    if (to.act === 'oop' && to.fly) {
      // meet him at the rim, in his raised hands
      ex = to.fly.x1 + (RIM.x - to.fly.x1) * 0.25;
      ez = to.fly.z1 + (RIM.z - to.fly.z1) * 0.25;
      ey = to.fly.yEnd + 2.55;
    } else {
      const f = fwd(to);
      ex = to.x + f.x * 0.3;
      ez = to.z + f.z * 0.3;
      ey = to.y + 1.3;
    }
    b.x = lerp(ps.sx, ex, u);
    b.z = lerp(ps.sz, ez, u);
    b.y = lerp(ps.sy, ey, u) + ps.arc * 4 * u * (1 - u);
    if (m.phase !== 'live') return;
    // a defender in the passing lane may pick it off
    if (!ps.perfect && u > 0.12 && u < 0.92) {
      for (const o of m.players) {
        if (o.team === ps.from.team || o.mini || ps.tried.includes(o)) continue;
        if (CANT_GRAB[o.act]) continue;
        if (Math.hypot(o.x - b.x, o.z - b.z) > 0.6 || b.y > o.y + 2.45 || b.y < o.y + 0.3) continue;
        ps.tried.push(o);
        if (m.rng() < chances(m, o).pick * o.st.steal) {
          o.stats.steals++;
          ev(m, 'steal', { p: o, from: ps.from, pick: true });
          catchBall(m, o);
          return;
        }
      }
    }
    if (u >= 1) catchBall(m, to);
  }

  function updateShot(m) {
    const b = m.ball, s = b.shot;
    s.t += DT;
    const t = Math.min(s.t, s.T);
    b.x = s.sx + ((b.vx * t));
    b.z = s.sz + ((b.vz * t));
    b.y = s.sy + s.vy0 * t - 0.5 * GRAV * t * t;
    // a defender in the air near the ball on its way up can block it
    if (s.t < 0.35 && m.phase === 'live') {
      for (const o of m.players) {
        if (o.team === s.by.team || o.mini || o.act !== 'jump' || s.tried.includes(o)) continue;
        const f = fwd(o);
        const hx = o.x + f.x * 0.25, hy = o.y + 2.6, hz = o.z + f.z * 0.25;
        if (Math.hypot(b.x - hx, b.y - hy, b.z - hz) > 0.9) continue;
        s.tried.push(o);
        if (s.sure || s.tried.length > 1) continue;
        if (m.rng() < chances(m, o).block * o.st.block) {
          if (saveFor(m, s.by, o)) continue;
          return blockShot(m, o, s.by);
        }
      }
    }
    if (s.t < s.T) return;
    if (s.made) {
      b.mode = 'net';
      b.t = 0;
      Object.assign(b, { x: RIM.x, y: RIM.y, z: RIM.z });
      s.by.stats.makes++;
      ev(m, 'swish', { p: s.by, three: s.three });
      if (m.phase === 'live') score(m, s.by, s.pts, 'jump');
    } else {
      // off the rim: away from the hoop's centre, with a random kick
      const a = s.theta + (m.rng() - 0.5) * 1.0;
      const hv = 1.8 + m.rng() * 3.2;
      b.rimmed = true;
      ev(m, 'rim', { p: s.by });
      looseBall(m, Math.sin(a) * hv, 2.0 + m.rng() * 2.5, Math.cos(a) * hv);
    }
  }

  function blockShot(m, o, shooter, dunk) {
    const b = m.ball;
    const dx = shooter.x - o.x, dz = shooter.z - o.z, d = Math.hypot(dx, dz) || 1;
    o.stats.blocks++;
    ev(m, 'block', { p: o, victim: shooter, dunk: !!dunk, x: b.x, y: b.y, z: b.z });
    looseBall(m, (dx / d) * 4 + (m.rng() - 0.5) * 2, 1.5 + m.rng(), (dz / d) * 4 + 1.5);
  }

  // ------------------------------------------------------------------ players

  function maxSpeed(m, p) {
    let s = SPEED * p.st.spd * (p.human >= 0 ? 1 : p.brain.spd);
    if (holds(m, p)) s *= 0.93;
    if (p.fire) s *= 1.1;
    if (p.mini) s *= 1.1;
    return s;
  }

  const MOVE_MUL = { free: 1, juke: 1.35, pass: 0.4, steal: 0.3, stun: 0.15, land: 0.3, celebrate: 0 };
  const TIMED = { pass: 0.22, steal: 0.38, land: 0.16, juke: 0.45 };

  function updatePlayer(m, p) {
    p.jukeCD = Math.max(0, p.jukeCD - DT);
    p.slow = Math.max(0, p.slow - DT);
    const a = p.act;
    if (ON_GROUND[a]) {
      if (TIMED[a] && p.t >= TIMED[a]) p.act = 'free';
      if (a === 'stun' && p.t >= p.stunT) p.act = 'free';
      let mul = MOVE_MUL[p.act] || 0;
      if (p.slow > 0) mul *= 0.4;
      const sp = maxSpeed(m, p) * mul;
      const k = Math.min(1, 14 * DT);
      p.vx += (p.want.x * sp - p.vx) * k;
      p.vz += (p.want.z * sp - p.vz) * k;
      p.x += p.vx * DT;
      p.z += p.vz * DT;
      p.y = 0;
      p.speed = Math.hypot(p.vx, p.vz);
      // facing: where he runs, else the hoop (with the ball) or the ball (without)
      let goal = null;
      if (p.act === 'celebrate') goal = angleTo(p, p.x + 3.6, p.z + 11); // turn to the camera: everyone sees the moves
      else if (p.speed > 0.8 && p.act !== 'steal') goal = Math.atan2(-p.vx, -p.vz);
      else if (holds(m, p)) goal = angleTo(p, RIM.x, RIM.z);
      else goal = angleTo(p, m.ball.x, m.ball.z);
      if (goal !== null) {
        const d = wrap(goal - p.face);
        p.face = wrap(p.face + clamp(d, -12 * DT, 12 * DT));
      }
      if (p.cele && p.act === 'free' && (m.phase === 'score' || m.phase === 'over')) {
        p.act = 'celebrate';
        p.t = 0;
      }
    } else if (a === 'shoot') {
      const u = p.t / SHOT_AIR;
      p.y = Math.max(0, 4 * SHOT_JUMP * u * (1 - u));
      p.x += p.vx * DT;
      p.z += p.vz * DT;
      p.vx *= 0.95;
      p.vz *= 0.95;
      const s = p.shot;
      s.meter = p.t / METER_T;
      if (!s.released && holds(m, p)) {
        if (s.auto && s.meter >= s.aim) releaseShot(m, p);
        else if (s.meter >= 1.3) releaseShot(m, p); // held too long: it goes up anyway, late
      }
      if (p.t >= SHOT_AIR) {
        if (!s.released && holds(m, p)) releaseShot(m, p);
        p.y = 0;
        p.act = 'land';
        p.t = 0;
      }
    } else if (a === 'jump') {
      const u = p.t / JUMP_T;
      p.y = Math.max(0, 4 * JUMP_H * u * (1 - u));
      p.x += p.vx * 0.6 * DT;
      p.z += p.vz * 0.6 * DT;
      if (p.t >= JUMP_T) {
        p.y = 0;
        p.act = 'land';
        p.t = 0;
      }
    } else if (a === 'dunk' || a === 'oop') {
      flyDunk(m, p);
    } else if (a === 'hang') {
      p.y = p.fly ? p.fly.yEnd - 0.25 : 0.55;
      if (p.t >= HANG_T) {
        p.act = 'fall';
        p.t = 0;
        p.vy = 0;
      }
    } else if (a === 'fall') {
      p.vy -= GRAV * DT;
      p.y += p.vy * DT;
      if (p.y <= 0) {
        p.y = 0;
        p.act = 'land';
        p.t = 0;
        ev(m, 'land', { p });
      }
    }
    const minX = p.mini ? -8.4 : COURT.minX, maxX = p.mini ? 8.4 : COURT.maxX;
    p.x = clamp(p.x, minX, maxX);
    p.z = clamp(p.z, COURT.minZ, COURT.maxZ);
  }

  function flyDunk(m, p) {
    const f = p.fly;
    const u = Math.min(1, p.t / f.T);
    p.x = lerp(f.x0, f.x1, u);
    p.z = lerp(f.z0, f.z1, u);
    p.y = u <= f.uLeap ? 0 : arcY((u - f.uLeap) / (1 - f.uLeap), f.yPk, f.yEnd);
    faceTo(p, RIM.x, RIM.z);
    // a defender up at the rim may stuff it
    // the brothers' combo: their alley-oops and the caller's next dunk can't be stuffed
    const c = m.teams[p.team].combo;
    const guaranteed = c.on && ((p.act === 'oop' && c.helper && !c.helper.mini) || (c.sure && c.caller === p));
    if (u > 0.55 && holds(m, p) && !guaranteed) {
      for (const o of m.players) {
        if (o.team === p.team || o.mini || o.act !== 'jump' || f.tried.includes(o)) continue;
        const of = fwd(o);
        if (Math.hypot(o.x + of.x * 0.25 - p.x, o.y + 2.55 - (p.y + 2.5), o.z + of.z * 0.25 - p.z) > 0.95) continue;
        f.tried.push(o);
        if (f.tried.length === 1 && m.rng() < chances(m, o).dunkBlock * o.st.block) {
          if (saveFor(m, p, o)) continue;
          blockShot(m, o, p, true);
          p.act = 'fall';
          p.t = 0;
          p.vy = 0;
          return;
        }
      }
    }
    if (u >= 1) slam(m, p);
  }

  function slam(m, p) {
    const b = m.ball;
    if (b.mode === 'pass' && b.pass.to === p) catchBall(m, p); // the alley-oop lob arrives in his hands
    const oop = p.act === 'oop';
    p.act = 'hang';
    p.t = 0;
    if (!holds(m, p)) {
      p.act = 'fall';
      p.vy = 0;
      return;
    }
    b.mode = 'net';
    b.t = 0;
    b.holder = null;
    Object.assign(b, { x: RIM.x, y: RIM.y + 0.1, z: RIM.z, lastTeam: p.team });
    p.stats.shots++;
    p.stats.makes++;
    m.stat.shots++;
    const c = m.teams[p.team].combo;
    if (c.on && c.caller === p) c.sure = false; // that was his guaranteed basket
    ev(m, 'slam', { p, oop, style: p.fly.style });
    if (m.phase === 'live') score(m, p, 2, oop ? 'oop' : 'dunk');
  }

  // Bump players apart so nobody stands inside anybody else. Flyers pass over.
  function separate(m) {
    const ps = m.players;
    const R = 0.75;
    for (let i = 0; i < ps.length; i++) {
      const a = ps[i];
      if (a.mini || a.y > 0.6) continue;
      for (let j = i + 1; j < ps.length; j++) {
        const c = ps[j];
        if (c.mini || c.y > 0.6) continue;
        const dx = c.x - a.x, dz = c.z - a.z, d = Math.hypot(dx, dz);
        if (d >= R) continue;
        const nx = d > 1e-4 ? dx / d : 1, nz = d > 1e-4 ? dz / d : 0, push = R - d;
        // a defender stands his ground: whoever has the ball gets bumped more
        const wa = holds(m, a) ? 0.75 : holds(m, c) ? 0.25 : 0.5;
        a.x -= nx * push * wa; a.z -= nz * push * wa;
        c.x += nx * push * (1 - wa); c.z += nz * push * (1 - wa);
        if (a.team !== c.team) bump(m, holds(m, a) ? a : holds(m, c) ? c : null, holds(m, a) ? c : a);
      }
    }
    for (const p of ps) {
      if (p.mini) continue;
      p.x = clamp(p.x, COURT.minX, COURT.maxX);
      p.z = clamp(p.z, COURT.minZ, COURT.maxZ);
    }
  }

  // Dribbling straight into a defender who is between you and the hoop slows you down. Go round him, or juke.
  function bump(m, h, d) {
    if (!h || h.act !== 'free' || h.slow > 0) return;
    const r = rimDist(h) || 1, dd = hdist(h, d) || 1;
    const dot = ((d.x - h.x) * (RIM.x - h.x) + (d.z - h.z) * (RIM.z - h.z)) / (r * dd);
    if (dot < 0.35) return;
    h.slow = m.cfg.level === 'normal' ? 0.45 : 0.3;
    ev(m, 'bump', { p: h, by: d });
  }

  // ------------------------------------------------------------------ rules

  function score(m, p, pts, kind) {
    const team = m.teams[p.team];
    team.score += pts;
    p.stats.pts += pts;
    if (kind === 'dunk') p.stats.dunks++;
    if (kind === 'oop') p.stats.oops++;
    if (pts === 3) p.stats.threes++;
    for (const q of m.players) {
      if (q.team === p.team) continue;
      if (q.fire) ev(m, 'fireOut', { p: q });
      q.streak = 0;
      q.fire = false;
    }
    p.streak++;
    const e = ev(m, 'score', { p, team: p.team, pts, kind, three: pts === 3, score: m.teams.map((t) => t.score) });
    if (!p.fire && p.streak >= 3) {
      p.fire = true;
      ev(m, 'fire', { p });
    }
    p.cele = celebration(p, kind, pts);
    const target = m.cfg.rules.target;
    if (team.score >= target) {
      m.winner = p.team;
      m.phase = 'over';
      m.phaseT = 0;
      for (const q of m.players) if (q.team === p.team) q.cele = q.cele || celebration(q, 'win', 0);
      ev(m, 'win', { team: p.team });
      return e;
    }
    if (!team.gamePoint && team.score >= target - 3) {
      team.gamePoint = true;
      ev(m, 'gamePoint', { team: p.team });
    }
    m.phase = 'score';
    m.phaseT = 0;
    m.nextOffense = 1 - p.team;
    m.spots = { off: m.nextOffense, plan: checkSpots(m, m.nextOffense) };
    return e;
  }

  // The signature celebrations: Teddy boxes after a dunk, Tommy does his Y after a 3-pointer.
  function celebration(p, kind, pts) {
    if (p.id === 'teddy') return kind === 'dunk' || kind === 'oop' || kind === 'win' ? 'boxing' : 'cheer';
    if (p.id === 'tommy') return pts === 3 || kind === 'win' ? 'peace' : 'cheer';
    return kind === 'win' ? 'wave' : 'cheer';
  }

  function rulesTick(m) {
    const b = m.ball;
    if (b.mode === 'held' || b.mode === 'pass') {
      m.shotClock -= DT;
      const h = b.holder;
      const busy = h && (h.act === 'shoot' || h.act === 'dunk' || h.act === 'oop');
      if (m.shotClock <= 0 && !busy) {
        m.shotClock = 0;
        m.stat.clockViolations++;
        ev(m, 'shotClock', { team: m.offense });
        const f = h ? fwd(h) : { x: 0, z: 1 };
        b.mode = 'dead';
        b.holder = null;
        b.pass = null;
        b.vx = f.x * 1.5;
        b.vz = f.z * 1.5;
        b.vy = 1;
        m.phase = 'turnover';
        m.phaseT = 0;
        m.nextOffense = 1 - m.offense;
        m.spots = { off: m.nextOffense, plan: checkSpots(m, m.nextOffense) };
        return;
      }
    }
    if (!m.cleared && b.mode === 'held' && b.holder.team === m.offense && outsideArc(b.holder)) {
      m.cleared = true;
      ev(m, 'cleared', { p: b.holder });
    }
  }

  // Between plays everyone strolls towards their spot for the next check.
  function stroll(m) {
    if (!m.spots) return;
    for (const [p, [x, z]] of m.spots.plan.spots) {
      if (p.act !== 'free') continue;
      const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
      const k = d < 0.2 ? 0 : Math.min(1, d) * 0.45;
      p.want.x = d ? (dx / d) * k : 0;
      p.want.z = d ? (dz / d) * k : 0;
    }
  }

  // ------------------------------------------------------------------ the tick

  function step(m, inputs) {
    m.time += DT;
    m.phaseT += DT;
    for (const p of m.players) {
      p.t += DT;
      p.want.x = 0;
      p.want.z = 0;
    }
    if (m.phase === 'intro' || m.phase === 'check') {
      if (m.phaseT >= (m.phase === 'intro' ? 1.8 : 0.9)) {
        m.phase = 'live';
        m.phaseT = 0;
        ev(m, 'live', {});
      }
    } else if (m.phase === 'score' || m.phase === 'turnover') {
      if (m.phaseT >= (m.phase === 'score' ? 2.1 : 1.5)) setupCheck(m, m.nextOffense);
      else stroll(m);
    }
    humanInput(m, inputs);
    if (m.phase === 'live' && H.ai) {
      for (const p of m.players) if (p.human < 0) H.ai.drive(m, p);
    } else if (m.phase === 'check' || m.phase === 'intro') {
      for (const p of m.players) { p.want.x = 0; p.want.z = 0; }
    } else if (H.ai) {
      for (const p of m.players) if (p.mini) H.ai.drive(m, p);
    }
    for (const p of m.players) updatePlayer(m, p);
    separate(m);
    updateBall(m);
    if (m.phase === 'live') {
      rulesTick(m);
      comboHandoff(m);
    }
    updateCombos(m);
  }

  H.sim = {
    DT, GRAV, BALL_R, COURT, RIM, SWEET, METER_T, SHOT_AIR, JUMP_T, COMBO_T, LEVELS, HUMAN, RULES,
    createMatch, step, quality, makeChance,
    act: { startShot, releaseShot, startPass, tryStealBy, jump, juke, callCompanion, wantPass, switchCtrl, catchBall },
    util: { clamp, lerp, hdist, rimDist, wrap, angleTo, fwd, holds, mates, teamPlayers, outsideArc, arcY },
  };
})(typeof window !== 'undefined' ? window : globalThis);
