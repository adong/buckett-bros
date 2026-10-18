/* hoops96-teddy: basketball poses on top of Kit.people.pose. dribble, hold, defend, pass, steal, block, dunk (four
   styles), the alley-oop catch, hanging on the rim, falling, landing, a dizzy wobble and a fist-pump cheer.
   Anything else (run, walk, jumpshot, boxing, peace, wave) goes to the kit.
   HoopsPose.apply(p, mode, o, k): o = { ph: running phase, mv: 0..1 how fast he moves, db: 0..1 dribble height
   (1 = ball in the hand), u: 0..1 through the move, style: dunk style }; k in 0..1 eases (1 snaps). */
(function () {
  'use strict';
  const People = window.Kit.people;

  // targets: ll/rl legs forward, lsp legs apart, la/ra arms forward (pi = straight up), laz/raz arms out,
  // lean (negative = forward), twist, head (negative = look up), headZ tilt, bob, rigY (crouch), spin (turns)
  const POSES = {
    idle: (o) => ({ ll: 0.06, rl: -0.06, la: 0.12, ra: 0.12, laz: 0.1, raz: 0.1, lean: -0.04, bob: Math.sin(o.ph * 0.6) * 0.012 }),
    hold: () => ({ ll: 0.12, rl: -0.12, la: 1.0, ra: 1.0, laz: -0.28, raz: -0.28, lean: -0.15, rigY: -0.03 }),
    dribble: (o) => {
      const s = Math.sin(o.ph);
      const mv = o.mv;
      return {
        ll: 0.12 + s * 0.85 * mv, rl: -0.1 - s * 0.85 * mv, la: 0.95, laz: 0.32, ra: 0.3 + 0.55 * o.db, raz: 0.18,
        lean: -0.22 - mv * 0.1, rigY: -0.05, bob: Math.abs(Math.cos(o.ph)) * 0.07 * mv, head: 0.04,
      };
    },
    defend: (o) => {
      const s = Math.sin(o.ph) * o.mv;
      return { ll: 0.2 + s * 0.35, rl: -0.2 - s * 0.35, lsp: 0.3, la: 0.75, ra: 0.75, laz: 1.05, raz: 1.05, lean: -0.24, rigY: -0.1, head: 0.04, bob: Math.abs(s) * 0.04 };
    },
    pass: (o) => {
      const e = Math.min(1, o.u * 2.2);
      return { ll: 0.35, rl: -0.25, la: 1.05 + e * 0.5, ra: 1.05 + e * 0.5, laz: -0.3 + e * 0.2, raz: -0.3 + e * 0.2, lean: -0.22, rigY: -0.04 };
    },
    steal: (o) => {
      const e = Math.sin(Math.min(1, o.u * 1.6) * Math.PI);
      return { ll: 0.8, rl: -0.45, la: 0.5, laz: 0.35, ra: 0.9 + e * 0.5, raz: -0.12, lean: -0.35 - e * 0.25, twist: 0.3 * e, rigY: -0.12, head: 0.1 };
    },
    block: () => ({ ll: 0.35, rl: -0.15, la: 3.0, ra: 3.0, laz: 0.18, raz: 0.18, lean: 0.06, head: -0.3 }),
    dunk: (o) => {
      const u = o.u;
      const t = { ll: 0.95, rl: -0.35, lean: -0.1, head: -0.25, la: 2.8, ra: 2.8, laz: 0.15, raz: 0.15 };
      if (o.style === 'tomahawk') {
        // cocked back behind the head, then down through the rim
        t.la = t.ra = u < 0.8 ? 3.5 : 2.3;
        t.laz = t.raz = 0.05;
        t.lean = u < 0.8 ? 0.15 : -0.3;
      } else if (o.style === 'windmill') {
        t.ra = 0.6 + u * Math.PI * 2.1; // a full circle with the ball
        t.la = 2.6;
        t.laz = 0.5;
      } else if (o.style === 'spin' || o.style === 'oop') {
        t.spin = o.style === 'oop' ? u * 0.5 : u;
        t.la = t.ra = u < 0.85 ? 2.9 : 2.35;
      } else {
        t.la = t.ra = u < 0.85 ? 2.95 : 2.4;
        t.ll = t.rl = 0.5;
      }
      return t;
    },
    hang: (o) => ({ ll: 0.25 + Math.sin(o.ph * 3) * 0.2, rl: 0.25 - Math.sin(o.ph * 3) * 0.2, la: 3.05, ra: 3.05, laz: 0.12, raz: 0.12, lean: 0.12, head: -0.15 }),
    fall: () => ({ ll: 0.45, rl: 0.15, la: 2.3, ra: 2.3, laz: 0.45, raz: 0.45, lean: 0.1 }),
    land: () => ({ ll: 0.3, rl: -0.12, la: 0.6, ra: 0.6, laz: 0.3, raz: 0.3, lean: -0.3, rigY: -0.14 }),
    stun: (o) => ({
      ll: 0.1, rl: -0.1, la: 0.3, ra: 0.3, laz: 0.55 + Math.sin(o.ph * 3) * 0.2, raz: 0.55 - Math.sin(o.ph * 3) * 0.2,
      head: Math.sin(o.ph * 4) * 0.15, headZ: Math.sin(o.ph * 3) * 0.28, lean: Math.sin(o.ph * 2) * 0.1, twist: Math.sin(o.ph * 1.5) * 0.25,
    }),
    cheer: (o) => {
      const s = Math.sin(o.ph * 1.6);
      return { ll: 0.1, rl: -0.1, la: 2.75 + s * 0.3, ra: 2.75 - s * 0.3, laz: 0.4, raz: 0.4, lean: 0.05, head: -0.2, bob: Math.max(0, s) * 0.12 };
    },
  };

  function drive(p, t, k) {
    const to = (o, prop, v) => { o[prop] += ((v || 0) - o[prop]) * k; };
    to(p.legL.rotation, 'x', t.ll);
    to(p.legR.rotation, 'x', t.rl);
    to(p.legL.rotation, 'z', -(t.lsp || 0));
    to(p.legR.rotation, 'z', t.lsp || 0);
    to(p.armL.rotation, 'x', t.la);
    to(p.armR.rotation, 'x', t.ra);
    to(p.armL.rotation, 'z', -(t.laz || 0));
    to(p.armR.rotation, 'z', t.raz || 0);
    to(p.hips.rotation, 'x', t.lean);
    to(p.hips.rotation, 'y', t.twist);
    to(p.head.rotation, 'x', t.head);
    to(p.head.rotation, 'z', t.headZ);
    to(p.rig.position, 'y', 0.55 + (t.rigY || 0));
    p.hips.position.y = p.hipY + (t.bob || 0);
    if (p.fingers) for (const f of p.fingers) f.visible = false;
    p.rig.scale.setScalar(p.rig.scale.x + (1 - p.rig.scale.x) * k);
  }

  // The extras the kit's pose() doesn't touch, eased back to neutral.
  function settleExtras(p, k) {
    const to = (o, prop, v) => { o[prop] += (v - o[prop]) * k; };
    to(p.legL.rotation, 'z', 0);
    to(p.legR.rotation, 'z', 0);
    to(p.head.rotation, 'z', 0);
    to(p.rig.position, 'y', 0.55);
  }

  function apply(p, mode, o, k) {
    const f = POSES[mode];
    let spin = 0;
    if (f) {
      const t = f(o);
      drive(p, t, k);
      spin = t.spin || 0;
    } else {
      People.pose(p, o.ph, mode, k);
      settleExtras(p, k);
      // standing celebrations: keep the feet planted (the kit strides while waving)
      if (mode === 'peace' || mode === 'wave' || mode === 'boxing') {
        p.legL.rotation.x *= mode === 'boxing' ? 1 : 0.3;
        p.legR.rotation.x *= mode === 'boxing' ? 1 : 0.3;
      }
    }
    // a full spin in the air for the spin dunk; otherwise unwind the shortest way
    if (spin) p.rig.rotation.y = spin * Math.PI * 2;
    else {
      const r = p.rig.rotation.y;
      p.rig.rotation.y = Math.atan2(Math.sin(r), Math.cos(r)) * (1 - Math.min(1, k * 1.5));
    }
  }

  window.HoopsPose = { apply, POSES };
})();
