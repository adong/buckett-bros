/* hoops96-teddy: the headless test runner. Plays whole games with no drawing, as fast as the computer can, and checks
   that every game finishes and the ball never gets stuck. Also test bots that play through the keyboard path.
   In the browser console: game.soak(100). From a terminal: node tools/soak.js 200 */
(function (root) {
  'use strict';
  const H = root.Hoops;
  const S = H.sim;
  const { DT, COURT, METER_T, SWEET } = S;
  const { holds, rimDist, hdist } = S.util;

  const ALL_TEAMS = () => {
    const T = H.teams;
    return [T.BROTHERS, ...T.LADDER, { name: 'TEDDY & ZOOM', ids: ['teddy', 'zoom'], color: '#3d8bff' }, { name: 'TOMMY & LUNA', ids: ['tommy', 'luna'], color: '#ff4b5c' }];
  };

  // One whole game. o: { teams, mode, level, seed, clearRule, maxTime, bots: [fn per kid] }
  function simGame(o) {
    const m = S.createMatch({ teams: o.teams, mode: o.mode || 'demo', level: o.level || 'normal', seed: o.seed, clearRule: o.clearRule });
    const maxTime = o.maxTime || 1800;
    const bots = o.bots || [];
    const counts = {};
    const bad = [];
    let possT = 0, maxPoss = 0, lastOff = m.offense, deadT = 0, maxDead = 0;
    while (m.phase !== 'over' && m.time < maxTime) {
      const inputs = m.humans.map((h) => (bots[h.idx] ? bots[h.idx](m, h) : null));
      S.step(m, inputs);
      for (const e of m.events) {
        counts[e.type] = (counts[e.type] || 0) + 1;
        if (e.type === 'block' && e.dunk) counts.dunkBlock = (counts.dunkBlock || 0) + 1;
        if (e.type === 'release') counts[e.three ? 'try3' : 'try2'] = (counts[e.three ? 'try3' : 'try2'] || 0) + 1;
        if (e.type === 'score') counts['pts' + e.pts + e.kind] = (counts['pts' + e.pts + e.kind] || 0) + 1;
      }
      m.events.length = 0;
      const b = m.ball;
      // a possession: from getting the ball until a shot goes up, a turnover or a reset
      if (m.phase !== 'live' || b.mode === 'shot' || b.mode === 'net' || m.offense !== lastOff) possT = 0;
      else possT += DT;
      lastOff = m.offense;
      maxPoss = Math.max(maxPoss, possT);
      // play must never stop for long between baskets
      deadT = m.phase === 'live' ? 0 : deadT + DT;
      maxDead = Math.max(maxDead, deadT);
      const miniBall = (b.mode === 'held' && b.holder.mini) || (b.mode === 'pass' && (b.pass.to.mini || b.pass.from.mini));
      if (!Number.isFinite(b.x + b.y + b.z) || Math.abs(b.x) > (miniBall ? 8.8 : 7.6) || b.z < -0.3 || b.z > 16 || b.y < 0 || b.y > 14) {
        if (bad.length < 5) bad.push(`ball out at t=${m.time.toFixed(1)}: ${b.mode} ${b.x.toFixed(2)},${b.y.toFixed(2)},${b.z.toFixed(2)}`);
      }
      for (const p of m.players) {
        if (!Number.isFinite(p.x + p.y + p.z) && bad.length < 5) bad.push(`player ${p.id} NaN at t=${m.time.toFixed(1)}`);
      }
    }
    return {
      finished: m.phase === 'over', winner: m.winner, score: m.teams.map((t) => t.score), names: m.teams.map((t) => t.name),
      time: m.time, counts, maxPoss, maxDead, maxLoose: m.stat.maxLoose, rescues: m.stat.rescues, bad,
      possessions: m.stat.possessions, shots: m.stat.shots, clock: m.stat.clockViolations,
    };
  }

  // Many random games. opts: { level, mode, clearRule, maxTime, seed }
  function soak(n, opts) {
    const o = opts || {};
    const teams = ALL_TEAMS();
    const out = { games: n, finished: 0, unfinished: [], problems: [], rescues: 0, maxPoss: 0, maxLoose: 0, maxDead: 0, times: [], counts: {}, shots: 0, clock: 0 };
    let seed = o.seed !== undefined ? o.seed : 1234;
    for (let i = 0; i < n; i++) {
      const a = teams[seed % teams.length];
      let bI = (seed * 7 + 3) % teams.length;
      if (teams[bI] === a) bI = (bI + 1) % teams.length;
      const level = o.level || (i % 2 ? 'easy' : 'normal');
      // in the kids' modes, bots press the keys (one sloppy, one good) so control switching and the companion get tested
      const bots = [bot(i % 2 ? 'kid' : 'good'), bot(i % 2 ? 'good' : 'kid')];
      const r = simGame({ teams: [a, teams[bI]], mode: o.mode || 'demo', level, seed, clearRule: o.clearRule !== undefined ? o.clearRule : i % 5 === 4, maxTime: o.maxTime, bots });
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      if (r.finished) out.finished++;
      else out.unfinished.push(`${r.names.join(' v ')} ${r.score.join('-')} after ${r.time.toFixed(0)} s`);
      out.problems.push(...r.bad);
      out.rescues += r.rescues;
      out.maxPoss = Math.max(out.maxPoss, r.maxPoss);
      out.maxLoose = Math.max(out.maxLoose, r.maxLoose);
      out.maxDead = Math.max(out.maxDead, r.maxDead);
      out.times.push(r.time);
      out.shots += r.shots;
      out.clock += r.clock;
      for (const k in r.counts) out.counts[k] = (out.counts[k] || 0) + r.counts[k];
    }
    const t = out.times.slice().sort((x, y) => x - y);
    out.time = { min: +t[0].toFixed(0), median: +t[t.length >> 1].toFixed(0), max: +t[t.length - 1].toFixed(0) };
    delete out.times;
    out.maxPoss = +out.maxPoss.toFixed(2);
    out.maxLoose = +out.maxLoose.toFixed(2);
    out.maxDead = +out.maxDead.toFixed(2);
    const per = (k) => +((out.counts[k] || 0) / n).toFixed(1);
    out.perGame = {
      shots: +(out.shots / n).toFixed(1), dunks: per('dunkStart'), slam: per('slam'), try2: per('try2'), try3: per('try3'),
      made2: per('pts2jump'), made3: per('pts3jump'), rim: per('rim'), block: per('block'), dunkBlock: per('dunkBlock'),
      steal: per('steal'), fire: per('fire'), shotClock: per('shotClock'), combo: per('combo'), save: per('save'), oops: per('pts2oop'),
    };
    delete out.counts;
    out.ok = out.finished === n && out.rescues === 0 && out.problems.length === 0;
    return out;
  }

  // ------------------------------------------------------------------ test bots: they press "keys" like a kid

  // skill 'kid': wanders at the hoop, holds shoot for a rough time, presses steal and jump a lot, calls his brother.
  // skill 'good': drives, times the meter well, passes, steals when close, jumps at shots.
  function bot(skill, rng, noCall) {
    const R = rng || Math.random;
    const good = skill === 'good';
    // a little kid looks up every 0.3-0.7 s, and now and then just runs somewhere else
    const st = { holdFor: 0, holding: false, nextCall: 3 + R() * 6, wig: 0, look: 0, tx: 0, tz: 0, wander: 0 };
    return function (m, h) {
      const inp = { mx: 0, mz: 0, shoot: false, pass: false, steal: false, call: false };
      const p = m.players.find((q) => q.uid === h.ctrl);
      if (!p) return inp;
      const b = m.ball;
      st.wig += DT;
      const toward = (x, z, k) => {
        const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz) || 1;
        inp.mx = (dx / d) * (k || 1);
        inp.mz = (dz / d) * (k || 1);
      };
      st.nextCall -= DT;
      if (st.nextCall <= 0 && !noCall) {
        inp.call = true;
        st.nextCall = (good ? 12 : 6) + R() * 10;
      }
      if (st.holding) {
        inp.shoot = true;
        st.holdFor -= DT;
        if (st.holdFor <= 0) st.holding = false;
        return inp;
      }
      if (holds(m, p)) {
        const d = rimDist(p);
        if (m.cfg.clearRule && !m.cleared) {
          // "CLEAR IT!": take it back past the arc first
          toward(p.x * 1.5, 9.5);
          return inp;
        }
        toward(Math.sin(st.wig * (good ? 1.3 : 2.1)) * (good ? 2 : 3.5), 2.2);
        const shootNow = d < COURT.dunkRange - 0.2 || m.shotClock < 2.5 || (good ? d < 7 && R() < 0.012 : R() < 0.006);
        if (shootNow && (p.act === 'free' || p.act === 'juke')) {
          st.holding = true;
          st.holdFor = METER_T * (SWEET + (R() - 0.5) * (good ? 0.12 : 0.6));
          inp.shoot = true;
        } else if (R() < (good ? 0.006 : 0.003)) inp.pass = true;
        else if (R() < 0.004) inp.steal = true;
        return inp;
      }
      const theirs = (b.mode === 'held' && b.holder.team !== p.team) || (b.mode === 'pass' && b.pass.from.team !== p.team);
      if (!good) {
        st.look -= DT;
        st.wander -= DT;
        if (st.wander > 0) {
          toward(st.tx, st.tz, 0.8);
          return inp;
        }
        if (st.look <= 0) {
          st.look = 0.3 + R() * 0.4;
          if (R() < 0.12) {
            st.wander = 0.6 + R();
            st.tx = (R() - 0.5) * 12;
            st.tz = 1 + R() * 11;
          }
        }
      }
      if (theirs) {
        const hd = b.mode === 'held' ? b.holder : b.pass.to;
        if (good || st.look > 0.15) toward(hd.x + (0 - hd.x) * 0.15, hd.z + (1.6 - hd.z) * 0.15);
        if (hdist(p, hd) < 1.5 && R() < (good ? 0.05 : 0.03)) inp.steal = true;
        if ((hd.act === 'shoot' || hd.act === 'dunk') && hdist(p, hd) < 2 && R() < (good ? 0.2 : 0.05)) inp.shoot = true;
      } else if (b.mode === 'loose' || b.mode === 'shot') {
        toward(b.x, b.z);
        if (!good && R() < 0.02) inp.shoot = true;
      } else if (R() < 0.01) inp.pass = true;
      return inp;
    };
  }

  // Win counts: a kid bot's team (Teddy & Tommy) against a CPU team.
  function versus(skill, level, n, opts) {
    const o = opts || {};
    const T = H.teams;
    let wins = 0, pts = 0, opp = 0, time = 0, unfinished = 0;
    for (let i = 0; i < n; i++) {
      const rival = T.LADDER[o.rival !== undefined ? o.rival : i % T.LADDER.length];
      const seed = 99 + i * 31;
      const r = simGame({ teams: [T.BROTHERS, rival], mode: o.mode || '1p', level, seed, bots: [bot(skill, null, o.noCall), bot(skill, null, o.noCall)] });
      if (!r.finished) unfinished++;
      if (r.winner === 0) wins++;
      pts += r.score[0];
      opp += r.score[1];
      time += r.time;
    }
    return { bot: skill, level, games: n, wins, unfinished, avgScore: `${(pts / n).toFixed(1)}-${(opp / n).toFixed(1)}`, avgTime: +(time / n).toFixed(0) };
  }

  H.simGame = simGame;
  H.soak = soak;
  H.versus = versus;
  H.bots = { bot };
})(typeof window !== 'undefined' ? window : globalThis);
