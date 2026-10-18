/* hoops96-teddy: the game. The scene and the arcade camera, the players and the ball drawn from the engine's state
   (js/sim.js), engine events turned into effects, sounds and banners, the HUD, the screens, touch, the main loop,
   and the window.game test hooks. A CPU-vs-CPU demo plays behind the menus. */
(function () {
  'use strict';
  const T = THREE;
  const Kit = window.Kit;
  const People = Kit.people;
  const H = window.Hoops;
  const S = H.sim;
  const TEAMS = H.teams;
  const { RIM, DT, COMBO_T, SWEET } = S;
  const { holds, rimDist, fwd, clamp, lerp } = S.util;
  const Pose = window.HoopsPose;
  const Input = window.HoopsInput;
  const $ = (id) => document.getElementById(id);
  const TITLE = window.HOOPS_TITLE || 'Street Hoops';

  const TREATS = [['🍦', 'ICE CREAM'], ['💧', 'WATER'], ['🧃', 'JUICE BOX'], ['🍪', 'COOKIE'], ['🍉', 'WATERMELON'], ['🍌', 'BANANA']];
  const MARK = ['#3d8bff', '#ff4b5c']; // 1P blue, 2P red
  const VS_COLORS = ['#3d8bff', '#ff4b5c'];
  const BALL_VR = 0.16; // the ball is drawn a little bigger than a real one, so little eyes can follow it

  let renderer, scene, camera, court, fx, ballMesh, ballShadow;
  let thumbs = {};
  const LOOK = {}; // id -> roster entry (the kit roster plus ZOMBO)

  const G = {
    screen: 'loading', mode: '1p', level: 'easy', clearRule: false, rival: 0, partners: [0, 1],
    match: null, demo: false, paused: false, hold: false, autoPause: true, acc: 0, overT: -1, touch: false,
    views: new Map(), timers: [], gameTime: 0,
    cam: { pos: new T.Vector3(4, 10, 27), look: new T.Vector3(0, 1.1, 7), shake: 0, zoom: 1 },
    ball: { pos: new T.Vector3(0, 1, 8), off: new T.Vector3(), key: '', dph: 0, lastDb: 1, db: 1 },
    treat: { sprite: null, flyT: -1, holdT: 0, from: new T.Vector3(), to: null },
    meterFor: null, gradeT: 0, hintKey: '',
  };
  const tmp = new T.Vector3(), tmp2 = new T.Vector3();
  const sfx = (name, ...a) => {
    if (!G.demo && window.HoopsSfx[name]) window.HoopsSfx[name](...a);
  };

  // ------------------------------------------------------------------ roster and looks

  function initRoster() {
    for (const e of Kit.roster.list) LOOK[e.id] = e;
    const z = Kit.roster.get('zombie');
    // the second zombie: a recoloured copy, spiky-haired and in orange
    LOOK.zombo = {
      id: 'zombo', name: 'ZOMBO', tag: '#c8ff9a',
      look: Object.assign({}, z.look, { skin: '#a6cf7a', hair: 'spiky', hairColor: '#3a2f4a', top: '#d0703a', bottom: '#33465a', shoes: '#2f2f3a' }),
    };
    const entries = Object.values(LOOK).map((e) => ({ id: e.id, look: e.look, pose: e.pose }));
    thumbs = Kit.portraits(entries, { size: 152 });
  }
  const nameOf = (id) => (LOOK[id] && LOOK[id].name) || TEAMS.stats(id).name;

  // ------------------------------------------------------------------ the ball

  function ballTexture() {
    const [c, g] = Kit.gfx.makeCanvas(512, 256);
    g.fillStyle = '#e8732a';
    g.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 6000; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.09)' : 'rgba(255,220,180,0.08)';
      g.fillRect(Math.random() * 512, Math.random() * 256, 2, 2);
    }
    g.strokeStyle = '#26130a';
    g.lineWidth = 7;
    g.beginPath(); g.moveTo(0, 128); g.lineTo(512, 128); g.stroke();
    for (const x of [0, 256, 512]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
    for (const cx of [128, 384]) {
      g.beginPath();
      for (let y = 0; y <= 256; y += 4) {
        const x = cx + Math.sin((y / 256) * Math.PI) * 70 * (cx < 256 ? 1 : -1);
        if (y === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
    return Kit.gfx.toTexture(c);
  }

  function makeBall() {
    ballMesh = new T.Mesh(new T.SphereGeometry(BALL_VR, 28, 18), Kit.gfx.std('#ffffff', { map: ballTexture(), roughness: 0.6 }));
    ballMesh.castShadow = true;
    scene.add(ballMesh);
    const tex = Kit.gfx.radialTexture(64, [[0, 'rgba(0,0,0,0.55)'], [0.7, 'rgba(0,0,0,0.25)'], [1, 'rgba(0,0,0,0)']]);
    ballShadow = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    ballShadow.rotation.x = -Math.PI / 2;
    scene.add(ballShadow);
    G.treat.sprite = new T.Sprite(new T.SpriteMaterial({ map: Kit.gfx.emojiTexture('🍦'), depthWrite: false }));
    G.treat.sprite.visible = false;
    scene.add(G.treat.sprite);
  }

  // ------------------------------------------------------------------ players

  const markerCache = {};
  function markerTexture(idx) {
    if (markerCache[idx]) return markerCache[idx];
    const [c, g] = Kit.gfx.makeCanvas(128, 112);
    g.fillStyle = MARK[idx];
    Kit.gfx.roundRect(g, 14, 6, 100, 56, 22);
    g.fill();
    g.beginPath(); g.moveTo(44, 60); g.lineTo(84, 60); g.lineTo(64, 100); g.closePath(); g.fill();
    g.lineWidth = 6;
    g.strokeStyle = '#14121f';
    Kit.gfx.roundRect(g, 14, 6, 100, 56, 22);
    g.stroke();
    g.font = `40px ${Kit.gfx.FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#fff';
    g.fillText(`${idx + 1}P`, 64, 37);
    return (markerCache[idx] = Kit.gfx.toTexture(c));
  }

  const bubbleTex = {}; // one per language
  function bubbleTexture() {
    const word = Kit.lang ? Kit.lang.t('PASS!') : 'PASS!';
    if (bubbleTex[word]) return bubbleTex[word];
    const [c, g] = Kit.gfx.makeCanvas(192, 112);
    g.fillStyle = '#fff';
    g.strokeStyle = '#14121f';
    g.lineWidth = 6;
    Kit.gfx.roundRect(g, 8, 8, 176, 70, 30);
    g.fill(); g.stroke();
    g.beginPath(); g.moveTo(80, 76); g.lineTo(96, 104); g.lineTo(108, 76); g.closePath(); g.fill(); g.stroke();
    g.fillRect(78, 66, 32, 12);
    g.font = `40px ${Kit.gfx.FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#14121f';
    g.fillText(word, 96, 45);
    return (bubbleTex[word] = Kit.gfx.toTexture(c));
  }
  // switching language mid-game repaints the speech bubbles already on the players
  if (Kit.lang) {
    Kit.lang.onChange(() => {
      for (const v of G.views.values()) {
        v.bubble.material.map = bubbleTexture();
        v.bubble.material.needsUpdate = true;
      }
    });
  }

  function makeView(p, m) {
    const entry = LOOK[p.id] || LOOK.zoom;
    const person = People.build(entry.look);
    const root = person.root;
    if (p.mini) root.scale.setScalar(entry.buddyScale || 0.8);
    scene.add(root);
    const color = m.teams[p.team].color;
    const ring = new T.Mesh(new T.RingGeometry(0.42, 0.56, 32), new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    scene.add(ring);
    const marker = new T.Sprite(new T.SpriteMaterial({ map: markerTexture(0), depthTest: false, depthWrite: false, transparent: true }));
    marker.scale.set(0.62, 0.54, 1);
    marker.renderOrder = 6;
    marker.visible = false;
    scene.add(marker);
    // his name tag: shown for the companion during the combo, and always on a bonus passer
    const tagColor = m.cfg.mode === 'vs' ? VS_COLORS[p.team] : entry.tag || '#ffb02e';
    const tag = Kit.gfx.nameTag(entry.name, tagColor);
    tag.position.y = 2.75;
    tag.visible = !!p.mini;
    root.add(tag);
    const dizzy = HoopsFx.dizzy();
    person.head.add(dizzy);
    const bubble = new T.Sprite(new T.SpriteMaterial({ map: bubbleTexture(), depthWrite: false, transparent: true }));
    bubble.scale.set(0.95, 0.55, 1);
    bubble.position.y = 3.05;
    bubble.visible = false;
    root.add(bubble);
    return { p, person, root, ring, marker, tag, dizzy, bubble, bubbleT: 0, ph: Math.random() * 6, mode: '', lastY: 0 };
  }

  function dropView(v) {
    scene.remove(v.root, v.ring, v.marker);
    v.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
  }

  function clearViews() {
    for (const v of G.views.values()) dropView(v);
    G.views.clear();
  }

  function poseMode(m, p) {
    switch (p.act) {
      case 'shoot': return 'jumpshot';
      case 'jump': return 'block';
      case 'dunk': return 'dunk';
      case 'oop': return p.y > 0.05 ? 'dunk' : 'run';
      case 'hang': return 'hang';
      case 'fall': return 'fall';
      case 'land': return 'land';
      case 'stun': return 'stun';
      case 'pass': return 'pass';
      case 'steal': return 'steal';
      case 'celebrate': return p.cele || 'cheer';
    }
    if (holds(m, p)) return m.phase === 'live' || p.speed > 0.5 ? 'dribble' : 'hold';
    const b = m.ball;
    const theirs = (b.mode === 'held' && b.holder.team !== p.team) || (b.mode === 'pass' && b.pass.from.team !== p.team);
    if (theirs && m.phase === 'live') return 'defend';
    return p.speed > 0.7 ? 'run' : 'idle';
  }

  function syncViews(dt) {
    const m = G.match;
    for (const p of m.players) if (!G.views.has(p.uid)) G.views.set(p.uid, makeView(p, m));
    for (const [uid, v] of G.views) {
      if (!m.players.includes(v.p)) {
        dropView(v);
        G.views.delete(uid);
      }
    }
    const k = 1 - Math.exp(-18 * dt);
    for (const v of G.views.values()) {
      const p = v.p;
      v.root.position.set(p.x, p.y, p.z);
      v.root.rotation.y = p.face;
      const mode = poseMode(m, p);
      const fast = mode === 'celebrate' || mode === 'boxing' || mode === 'peace' || mode === 'cheer';
      v.ph += dt * (fast ? 6 : 2.5 + p.speed * 1.7);
      let u = 0, style = '';
      if (p.act === 'dunk' || p.act === 'oop') {
        const f = p.fly;
        const raw = clamp(p.t / f.T, 0, 1);
        u = f.uLeap ? clamp((raw - f.uLeap) / (1 - f.uLeap), 0, 1) : raw;
        style = f.style;
      } else if (p.act === 'pass') u = p.t / 0.22;
      else if (p.act === 'steal') u = p.t / 0.38;
      Pose.apply(v.person, mode, { ph: v.ph, mv: clamp(p.speed / 6, 0, 1), db: G.ball.db, u, style }, mode === v.mode ? k : Math.min(1, k * 1.6));
      if (mode !== v.mode && mode === 'dunk' && style === 'spin') v.person.rig.rotation.y = 0;
      v.mode = mode;
      // the floor ring: brighter and pulsing for a player a kid is steering
      v.ring.position.set(p.x, 0.025, p.z);
      const mine = p.human >= 0;
      v.ring.material.opacity = mine ? 0.95 : 0.5;
      v.ring.scale.setScalar((p.mini ? 0.8 : 1) * (mine ? 1.15 + Math.sin(G.gameTime * 8) * 0.06 : 1));
      v.marker.visible = mine && !G.demo;
      if (mine) {
        v.marker.material.map = markerTexture(p.human);
        v.marker.position.set(p.x, p.y + (p.mini ? 2.4 : 2.8) + Math.sin(G.gameTime * 5) * 0.06, p.z);
      }
      const c = m.teams[p.team].combo;
      v.tag.visible = p.mini || (c.on && c.helper === p);
      if (v.tag.visible) v.tag.position.y = mine ? 3.6 : 2.75;
      v.dizzy.visible = p.act === 'stun';
      if (v.dizzy.visible) v.dizzy.spin(G.gameTime);
      if (v.bubbleT > 0) {
        v.bubbleT -= dt;
        v.bubble.visible = v.bubbleT > 0;
      }
      // ON FIRE: flames round his feet; dust when a flyer lands
      if (p.fire) fx.fire(p.x + (Math.random() - 0.5) * 0.7, 0.15 + p.y + Math.random() * 1.2, p.z + (Math.random() - 0.5) * 0.7, 2);
      if (v.lastY > 0.3 && p.y === 0) fx.puff(p.x, p.z, 10);
      v.lastY = p.y;
      // a star trail behind a flying dunk
      if ((p.act === 'dunk' || p.act === 'oop') && p.y > 0.3) fx.sparkle(p.x, p.y + 1.2, p.z, 1, ['#ffd400', '#ffffff', '#18d4ff']);
    }
  }

  // ------------------------------------------------------------------ the ball, drawn

  function syncBall(dt) {
    const m = G.match, b = m.ball, bv = G.ball;
    const h = b.mode === 'held' ? b.holder : null;
    const target = tmp.set(b.x, b.y, b.z);
    let db = 1;
    if (h) {
      const v = G.views.get(h.uid);
      if (v) {
        v.root.updateMatrixWorld(true);
        const f = fwd(h);
        if (v.mode === 'dribble') {
          bv.dph += dt * (h.speed > 1 ? 9.5 : 7);
          db = Math.abs(Math.cos(bv.dph));
          People.handWorld(v.person, 1, target);
          const top = target.y - BALL_VR;
          target.x += f.x * 0.12;
          target.z += f.z * 0.12;
          target.y = BALL_VR + (top - BALL_VR) * db;
          if (db < 0.2 && bv.lastDb >= 0.2 && m.phase === 'live') sfx('dribble', 0.7);
        } else {
          People.handWorld(v.person, 1, target);
          People.handWorld(v.person, -1, tmp2);
          const oneHand = v.mode === 'dunk' && (h.fly && (h.fly.style === 'windmill' || h.fly.style === 'tomahawk'));
          if (!oneHand) target.lerp(tmp2, 0.5);
          const up = v.mode === 'jumpshot' || v.mode === 'dunk' ? 0.1 : -0.02;
          target.x += f.x * 0.14;
          target.z += f.z * 0.14;
          target.y += up;
        }
      }
    }
    bv.lastDb = db;
    bv.db = db;
    // smooth the hand-offs between a hand and the engine's flying ball
    const key = b.mode + (h ? h.uid : '');
    if (key !== bv.key) {
      bv.off.copy(bv.pos).sub(target);
      if (bv.off.length() > 2.5) bv.off.set(0, 0, 0);
      bv.key = key;
    }
    bv.off.multiplyScalar(Math.exp(-dt * 18));
    bv.pos.copy(target).add(bv.off);
    if (!Number.isFinite(bv.pos.x)) bv.pos.set(0, 1, 8);
    ballMesh.position.copy(bv.pos);
    if (b.mode === 'shot' || b.mode === 'pass') ballMesh.rotation.x -= dt * 14;
    else if (b.mode === 'loose' || b.mode === 'dead') ballMesh.rotation.x -= dt * Math.hypot(b.vx, b.vz) * 5;
    else ballMesh.rotation.x -= dt * 4;
    const hgt = Math.max(0, bv.pos.y);
    ballShadow.position.set(bv.pos.x, 0.03, bv.pos.z);
    ballShadow.scale.setScalar(0.55 * (1 - Math.min(0.55, hgt / 8)));
    ballShadow.material.opacity = 0.9 - Math.min(0.6, hgt / 7);
    // a ball on fire
    const owner = h || (b.mode === 'shot' ? b.shot.by : null);
    if (owner && owner.fire) fx.fire(bv.pos.x, bv.pos.y, bv.pos.z, 2);
  }

  // ------------------------------------------------------------------ the treat

  function giveTreat(from, to) {
    const [emoji, label] = TREATS[Math.floor(Math.random() * TREATS.length)];
    const tr = G.treat;
    tr.sprite.material.map = Kit.gfx.emojiTexture(emoji);
    tr.sprite.material.needsUpdate = true;
    const fv = G.views.get(from.uid);
    if (fv) {
      fv.root.updateMatrixWorld(true);
      People.handWorld(fv.person, 1, tr.from);
    } else tr.from.set(from.x, 1.5, from.z);
    scene.add(tr.sprite);
    tr.sprite.position.copy(tr.from);
    tr.sprite.scale.setScalar(0.6);
    tr.sprite.visible = true;
    tr.flyT = 0;
    tr.to = to;
    toast(`${emoji} ${label} FROM ${nameOf(from.id)}!`);
    sfx('treat');
  }

  function updateTreat(dt) {
    const tr = G.treat;
    if (tr.flyT >= 0) {
      const v = tr.to && G.views.get(tr.to.uid);
      if (!v) return dropTreat();
      tr.flyT += dt / 0.55;
      v.root.updateMatrixWorld(true);
      v.person.armL.localToWorld(tmp.set(0, -0.72, 0));
      const k = Math.min(1, tr.flyT);
      tr.sprite.position.lerpVectors(tr.from, tmp, k);
      tr.sprite.position.y += Math.sin(k * Math.PI) * 1.3;
      if (k >= 1) {
        tr.flyT = -1;
        tr.holdT = 5;
        v.person.armL.add(tr.sprite);
        tr.sprite.position.set(-0.14, -0.82, 0.18);
        tr.sprite.scale.setScalar(0.55);
        fx.sparkle(tmp.x, tmp.y, tmp.z, 12);
      }
    } else if (tr.holdT > 0) {
      tr.holdT -= dt;
      if (tr.holdT <= 0) dropTreat();
    }
  }
  function dropTreat() {
    const tr = G.treat;
    tr.flyT = -1;
    tr.holdT = 0;
    tr.sprite.visible = false;
    scene.add(tr.sprite);
  }

  // ------------------------------------------------------------------ camera

  function updateCamera(dt) {
    const m = G.match;
    const bp = G.ball.pos;
    let fxp = bp.x * 0.72, fzp = lerp(bp.z, RIM.z, 0.3);
    let zoom = G.cam.zoom;
    const flyer = m.players.find((p) => (p.act === 'dunk' || p.act === 'oop' || p.act === 'hang') && p.y > 0.1);
    if (flyer) zoom *= 0.86;
    if (m.phase === 'over') zoom *= 0.9;
    fxp = clamp(fxp, -4.6, 4.6);
    fzp = clamp(fzp, 2.8, 12.5);
    const k = 1 - Math.exp(-4 * dt);
    G.cam.look.x += (fxp - G.cam.look.x) * k;
    G.cam.look.z += (fzp - G.cam.look.z) * k;
    G.cam.look.y = 1.1;
    const want = tmp.set(G.cam.look.x + 3.6 * zoom, 8.2 * zoom, G.cam.look.z + 11 * zoom);
    G.cam.pos.lerp(want, 1 - Math.exp(-3 * dt));
    camera.position.copy(G.cam.pos);
    if (G.cam.shake > 0.01) {
      camera.position.x += (Math.random() - 0.5) * G.cam.shake;
      camera.position.y += (Math.random() - 0.5) * G.cam.shake;
      G.cam.shake *= Math.exp(-dt * 8);
    }
    camera.lookAt(G.cam.look.x, G.cam.look.y, G.cam.look.z - 1.4);
    camera.updateMatrixWorld();
  }

  // A stick on screen (right, up) -> a direction on the court, seen from where the camera is.
  function worldInput(s) {
    const fx0 = G.cam.look.x - G.cam.pos.x, fz0 = G.cam.look.z - 1.4 - G.cam.pos.z;
    const l = Math.hypot(fx0, fz0) || 1;
    const f = { x: fx0 / l, z: fz0 / l }, r = { x: -f.z, z: f.x };
    return { mx: r.x * s.sx + f.x * s.sy, mz: r.z * s.sx + f.z * s.sy, shoot: s.shoot, pass: s.pass, steal: s.steal, call: s.call };
  }

  // ------------------------------------------------------------------ HUD helpers (timed in game time)

  function later(sec, fn) { G.timers.push({ t: sec, fn }); }
  function flash(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }
  function banner(text, cls, dur, sub) {
    const b = $('banner'), s = $('sub');
    b.className = 'banner ' + (cls || '');
    b.textContent = text;
    flash(b, 'show');
    s.textContent = sub || '';
    s.classList.toggle('show', !!sub);
    G.bannerId = (G.bannerId || 0) + 1;
    const id = G.bannerId;
    later(dur || 1.4, () => {
      if (G.bannerId !== id) return;
      b.classList.remove('show');
      s.classList.remove('show');
    });
  }
  function callout(side, text, color) {
    const el = $('call' + side);
    el.textContent = text;
    el.style.color = color || '';
    flash(el, 'show');
  }
  function toast(text, dur) {
    const el = $('toast');
    el.textContent = text;
    el.classList.add('show');
    G.toastId = (G.toastId || 0) + 1;
    const id = G.toastId;
    later(dur || 2.4, () => { if (G.toastId === id) el.classList.remove('show'); });
  }
  function hint(html, dur, key) {
    const el = $('hint');
    el.innerHTML = html;
    el.classList.add('show');
    G.hintKey = key || html;
    G.hintId = (G.hintId || 0) + 1;
    const id = G.hintId;
    later(dur || 3, () => {
      if (G.hintId === id) {
        el.classList.remove('show');
        G.hintKey = '';
      }
    });
  }
  const sideOf = (team) => (team === 0 ? 0 : 1);

  // ------------------------------------------------------------------ engine events -> effects

  function onEvent(m, e) {
    const p = e.p;
    switch (e.type) {
      case 'check':
        if (e.intro) {
          banner(G.demo ? '' : 'GAME ON!', '', 1.5, G.demo ? '' : `FIRST TO ${m.cfg.rules.target}`);
          sfx('whistle');
        }
        break;
      case 'pass': sfx('pass'); break;
      case 'catch': sfx('catch'); break;
      case 'shootStart':
        if (p.human >= 0 && !p.shot.auto) G.meterFor = p;
        sfx('jump');
        break;
      case 'release':
        if (p.human >= 0 && !e.auto) {
          const q = e.q;
          const late = p.shot.meter > SWEET;
          grade(p, q >= 1 ? 'PERFECT!' : q > 0.6 ? 'GOOD!' : late ? 'LATE!' : 'EARLY!', q >= 1 ? '#7dff5a' : q > 0.6 ? '#ffd400' : '#ff9a8a');
        }
        if (e.sure && !G.demo) callout(sideOf(p.team), `${nameOf(p.id)}: SURE SHOT!`, '#7dff5a');
        break;
      case 'swish':
        sfx('swish');
        HoopsCourt.swish(court, false);
        fx.burst(e.three ? 'THREE!' : Math.random() < 0.5 ? 'SWISH!' : 'NICE!', RIM.x, RIM.y + 1.0, RIM.z + 0.5, e.three ? '#18d4ff' : '#ffd400', e.three ? 1.4 : 1.1);
        fx.sparkle(RIM.x, RIM.y - 0.3, RIM.z, 16);
        break;
      case 'rim':
        sfx('clank');
        court.hoop.net.kick = 0.4;
        break;
      case 'board': sfx('board'); break;
      case 'bounce': if (e.v > 3) sfx('dribble', Math.min(1, e.v / 8)); break;
      case 'fence': break;
      case 'dunkStart': sfx('jump'); break;
      case 'oopStart':
        banner('ALLEY-OOP!', 'oop', 1.3);
        sfx('combo');
        break;
      case 'slam':
        sfx('slam');
        HoopsCourt.swish(court, true);
        G.cam.shake = 0.5;
        fx.burst(e.oop ? 'ALLEY-OOP!' : 'SLAM!', RIM.x - 0.8, RIM.y + 1.2, RIM.z + 0.8, e.oop ? '#18d4ff' : '#ff5a1f', 2.1);
        fx.stars(RIM.x, RIM.y + 0.2, RIM.z + 0.5, 14, 4.5);
        fx.confetti(RIM.x, RIM.y + 0.5, RIM.z + 0.5, 40);
        break;
      case 'block':
        sfx('block');
        G.cam.shake = 0.3;
        fx.burst('BLOCKED!', e.x, e.y + 0.5, e.z, '#ff3d7f', 1.2);
        fx.stars(e.x, e.y, e.z, 7, 3);
        callout(sideOf(p.team), `${nameOf(p.id)} BLOCK!`, '#ff9ad5');
        break;
      case 'steal':
        sfx('steal');
        fx.burst('STEAL!', p.x, 2.6, p.z, '#7dff5a', 0.8);
        callout(sideOf(p.team), `${nameOf(p.id)} STEAL!`, '#7dff5a');
        break;
      case 'whiff': if (p.human >= 0) sfx('whiff'); break;
      case 'juke':
        sfx('squeak');
        fx.puff(p.x, p.z, 6);
        break;
      case 'bump': if (Math.random() < 0.4) sfx('squeak'); break;
      case 'jump': if (p.human >= 0) sfx('jump'); break;
      case 'land': sfx('land'); break;
      case 'score': {
        const el = document.querySelectorAll('.board .score')[e.team];
        el.textContent = m.teams[e.team].score;
        flash(el, 'pop');
        fx.floatText('+' + e.pts, RIM.x + 1.3, RIM.y + 0.2, RIM.z + 0.8, e.pts === 3 ? '#18d4ff' : '#ffd400');
        sfx('score', e.pts);
        sfx('cheer', e.kind !== 'jump' || e.pts === 3);
        break;
      }
      case 'fire':
        banner(`${p.st.he}'S ON FIRE!`, 'fire', 1.6, `🔥 ${nameOf(p.id)} 🔥`);
        sfx('fire');
        break;
      case 'fireOut': callout(sideOf(p.team), `${nameOf(p.id)} COOLED OFF`, '#8cc2ff'); break;
      case 'gamePoint': callout(sideOf(e.team), 'GAME POINT!', '#ffd400'); break;
      case 'win': {
        const t = m.teams[e.team];
        const champ = !G.demo && G.mode !== 'vs' && e.team === 0 && TEAMS.LADDER[G.rival].final;
        banner(champ ? 'CHAMPIONS!' : `${t.name} WIN!`, 'win', 3.2);
        sfx(e.team === 0 || G.mode === 'vs' ? 'win' : 'lose');
        fx.confetti(RIM.x, 4, RIM.z + 3, 120);
        G.overT = 3.4;
        break;
      }
      case 'shotClock':
        banner('SHOT CLOCK!', 'clock', 1.3);
        sfx('buzzer');
        break;
      case 'turnover':
        if (m.cfg.clearRule && !m.cleared && m.teams[e.team].human && !G.demo) hint('↩️ CLEAR IT! Take it past the 3-point line', 2.5, 'clear');
        break;
      case 'clearIt':
        if (p.human >= 0 && G.hintKey !== 'clear') hint('↩️ CLEAR IT! Take it past the 3-point line first', 2.2, 'clear');
        sfx('nope');
        break;
      case 'cleared': if (m.teams[p.team].human && !G.demo) callout(sideOf(p.team), 'CLEARED ✓', '#7dff5a'); break;
      case 'combo': {
        const hp = e.helper;
        const nm = nameOf(hp.id);
        callout(sideOf(e.team), m.cfg.mode === 'vs' ? `${nm} IS HERE!` : 'ALLEY-OOP TIME!', '#ffd400');
        if (!G.demo) {
          if (m.cfg.mode === 'vs') toast(`${nm} JOINS ${m.teams[e.team].name}: PASS TO ${nm}!`);
          else if (!holds(m, e.caller) || rimDist(e.caller) > S.COURT.oopRange) toast(`${nm}: PASS ME THE BALL!`);
        }
        sfx('combo');
        const v = G.views.get(hp.uid);
        if (v) fx.sparkle(hp.x, 2.2, hp.z, 20, ['#ffd400', '#ffffff']);
        break;
      }
      case 'treat': if (e.from && e.to) giveTreat(e.from, e.to); break;
      case 'save': {
        const nm = nameOf(e.helper.id);
        banner(`${nm} SAVED IT!`, 'oop', 1.5);
        sfx('save');
        fx.sparkle(e.victim.x, 1.5, e.victim.z, 24, ['#7dff5a', '#ffffff', '#ffd400']);
        fx.stars(e.attacker.x, 2.2, e.attacker.z, 5, 2);
        break;
      }
      case 'comboRest': {
        const el = document.querySelector('.bud.b' + (e.team === 0 ? 0 : 1));
        if (el) flash(el, 'no');
        flash($('budBtn'), 'no');
        sfx('nope');
        break;
      }
      case 'callForPass': {
        const v = G.views.get(p.uid);
        if (v) {
          v.bubbleT = 0.9;
          v.bubble.visible = true;
        }
        break;
      }
      case 'rescue': console.warn('ball rescued (should not happen)'); break;
    }
  }

  function grade(p, text, color) {
    const el = $('grade');
    el.textContent = text;
    el.style.color = color;
    const sp = screenPos(p.x, p.y + 2.6, p.z);
    el.style.left = `${sp.x + 30}px`;
    el.style.top = `${sp.y - 70}px`;
    flash(el, 'show');
    $('meter').classList.add('done');
    later(0.4, () => {
      if (G.meterFor === p) G.meterFor = null;
      $('meter').classList.remove('done');
    });
  }

  function screenPos(x, y, z) {
    tmp2.set(x, y, z).project(camera);
    return { x: (tmp2.x * 0.5 + 0.5) * window.innerWidth, y: (-tmp2.y * 0.5 + 0.5) * window.innerHeight };
  }

  // ------------------------------------------------------------------ HUD

  function setupHud() {
    const m = G.match;
    const root = document.documentElement;
    root.style.setProperty('--t0', m.teams[0].color);
    root.style.setProperty('--t1', m.teams[1].color);
    m.teams.forEach((t, i) => {
      const side = document.querySelector('.side.s' + i);
      side.querySelector('.tname').textContent = t.name;
      side.querySelector('.score').textContent = t.score;
      side.querySelectorAll('.faces img').forEach((img, k) => (img.src = thumbs[t.ids[k]] || ''));
    });
    $('target').textContent = `FIRST TO ${m.cfg.rules.target}`;
    const b0 = document.querySelector('.bud.b0'), b1 = document.querySelector('.bud.b1');
    b0.classList.toggle('hidden', !m.teams[0].canCall);
    b1.classList.toggle('hidden', !m.teams[1].canCall);
    b0.querySelector('.k').textContent = m.cfg.mode === 'coop' ? 'T · ENTER' : 'T';
    b1.querySelector('.k').textContent = 'ENTER';
    b0.querySelector('.lbl').firstChild.textContent = m.cfg.mode === 'vs' ? 'BUDDY' : 'ALLEY-OOP';
  }

  // The brother who would come: in versus the captain's brother; otherwise the one you're not steering.
  function helperId(m, ti) {
    const t = m.teams[ti];
    if (t.combo.on && t.combo.helper) return t.combo.helper.id;
    if (m.cfg.mode === 'vs') return t.captain === 'tommy' ? 'teddy' : 'tommy';
    const own = m.players.filter((p) => p.team === ti && !p.mini);
    if (m.cfg.mode === 'coop') return 'tommy';
    const notMe = own.find((p) => p.human < 0);
    return notMe ? notMe.id : 'tommy';
  }

  function updateHud() {
    const m = G.match;
    const clock = $('clock');
    const sc = Math.ceil(m.shotClock);
    clock.textContent = m.phase === 'over' ? '–' : sc;
    clock.classList.toggle('low', m.phase === 'live' && m.shotClock < 4);
    m.teams.forEach((t, i) => {
      const imgs = document.querySelectorAll(`.side.s${i} .faces img`);
      const ps = m.players.filter((p) => p.team === i && !p.mini);
      imgs.forEach((img, k) => img.classList.toggle('fire', !!(ps[k] && ps[k].fire)));
      if (!t.canCall) return;
      const el = document.querySelector('.bud.b' + i);
      const c = t.combo;
      const fill = c.on ? 1 - c.t / COMBO_T : c.rest > 0 ? 1 - c.rest / (c.restMax || 1) : 1;
      el.style.setProperty('--fill', fill.toFixed(3));
      el.classList.toggle('on', c.on);
      el.classList.toggle('rest', !c.on && c.rest > 0);
      const hid = helperId(m, i);
      const img = el.querySelector('img');
      if (img.dataset.id !== hid) {
        img.dataset.id = hid;
        img.src = thumbs[hid] || '';
        el.querySelector('.lbl b').textContent = nameOf(hid);
      }
      if (i === 0) {
        const bb = $('budBtn');
        bb.style.setProperty('--fill', fill.toFixed(3));
        bb.classList.toggle('on', c.on);
        bb.classList.toggle('rest', !c.on && c.rest > 0);
        const bi = bb.querySelector('img');
        if (bi.dataset.id !== hid) {
          bi.dataset.id = hid;
          bi.src = thumbs[hid] || '';
          bb.querySelector('small').textContent = nameOf(hid);
        }
      }
    });
    // the shot meter beside a kid's shooter
    const mp = G.meterFor;
    const meter = $('meter');
    if (mp && mp.shot && (mp.act === 'shoot' || mp.act === 'land')) {
      const sp = screenPos(mp.x, mp.y + 1.6, mp.z);
      meter.style.left = `${sp.x + 34}px`;
      meter.style.top = `${sp.y - 60}px`;
      meter.querySelector('.fill').style.height = `${clamp(mp.shot.meter / 1.3, 0, 1) * 100}%`;
      meter.classList.add('show');
    } else {
      meter.classList.remove('show');
      if (mp && mp.act !== 'shoot' && mp.act !== 'land') G.meterFor = null;
    }
    // touch buttons say what they do right now
    if (G.touch) {
      const me = m.players.find((p) => p.human === 0);
      if (me) {
        const b = m.ball;
        const mineBall = holds(m, me);
        const theirs = (b.mode === 'held' && b.holder.team !== me.team) || (b.mode === 'pass' && b.pass.from.team !== me.team);
        const set = (sel, ic, label) => {
          const el = document.querySelector('.tb.' + sel);
          if (el.dataset.l === label) return;
          el.dataset.l = label;
          el.querySelector('.ic').textContent = ic;
          el.querySelector('small').textContent = label;
        };
        if (mineBall) {
          set('shoot', rimDist(me) < S.COURT.dunkRange ? '💥' : '🏀', rimDist(me) < S.COURT.dunkRange ? 'DUNK' : 'SHOOT');
          set('pass', '👐', 'PASS');
          set('steal', '💨', 'JUKE');
        } else if (theirs) {
          set('shoot', '🙌', 'JUMP');
          set('pass', '🔄', 'SWITCH');
          set('steal', '✋', 'STEAL');
        } else {
          set('shoot', '🙌', 'JUMP');
          set('pass', '📣', 'CALL');
          set('steal', '✋', 'STEAL');
        }
      }
    }
  }

  function layoutMeter() {
    const z = $('meter');
    const zone = z.querySelector('.zone'), good = z.querySelector('.good');
    const toPct = (v) => (v / 1.3) * 100;
    zone.style.bottom = `${toPct(SWEET - 0.07)}%`;
    zone.style.height = `${toPct(0.14)}%`;
    good.style.bottom = `${toPct(SWEET - 0.25)}%`;
    good.style.height = `${toPct(0.5)}%`;
  }

  // ------------------------------------------------------------------ screens and flow

  function show(id) {
    for (const s of ['title', 'select', 'pause', 'results']) $(s).classList.toggle('hidden', s !== id);
    $('menuMute').classList.toggle('hidden', !id);
    if (G.match && !G.demo) $('touch').classList.toggle('hidden', !!id || !G.touch); // no game buttons behind a menu
    G.screen = id || 'play';
  }

  function startDemo() {
    const rival = TEAMS.LADDER[Math.floor(Math.random() * TEAMS.LADDER.length)];
    G.match = S.createMatch({ teams: [TEAMS.BROTHERS, rival], mode: 'demo', level: 'normal' });
    G.match.events.length = 0;
    G.demo = true;
    G.overT = -1;
    clearViews();
    dropTreat();
    $('hud').classList.add('hidden');
    $('touch').classList.add('hidden');
  }

  function showTitle() {
    show('title');
    if (!G.demo || !G.match) startDemo();
    G.paused = false;
    Kit.sound.music('title');
    refreshTitle();
  }

  function refreshTitle() {
    document.querySelectorAll('.opt[data-level]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.level === G.level)));
    $('clearOpt').setAttribute('aria-checked', String(G.clearRule));
    $('clearSmall').textContent = G.clearRule ? 'on: after a steal or rebound, take it past the arc first' : 'off: after a steal or rebound, just go!';
  }

  function showSelect(mode) {
    G.mode = mode;
    show('select');
    buildCards();
    refreshSelect();
  }

  function buildCards() {
    const box = $('cards');
    box.innerHTML = '';
    if (G.mode === 'vs') {
      TEAMS.PARTNERS.forEach((id, i) => {
        const c = document.createElement('button');
        c.className = 'card solo';
        c.dataset.i = i;
        c.innerHTML = `<span class="tg t0">1P</span><span class="tg t1">2P</span><span class="duo"><img alt="" src="${thumbs[id]}"></span><span class="nm">${nameOf(id)}</span><span class="boo">BOO!</span>`;
        c.addEventListener('click', () => {
          // a tap picks for whichever side still matches this card least recently: 1P first, then 2P
          const side = G.partners[0] === i ? 1 : G.partners[1] === i ? 0 : G.lastPick === 0 ? 1 : 0;
          pickPartner(side, i);
        });
        box.appendChild(c);
      });
    } else {
      TEAMS.LADDER.forEach((t, i) => {
        const c = document.createElement('button');
        c.className = 'card';
        c.dataset.i = i;
        c.innerHTML = `<span class="st ${t.final ? 'fin' : ''}">${t.final ? '★ FINAL' : 'GAME ' + (i + 1)}</span><span class="duo"><img alt="" src="${thumbs[t.ids[0]]}"><img alt="" src="${thumbs[t.ids[1]]}"></span><span class="nm">${t.name}</span><span class="bl">${t.blurb}</span><span class="boo">BOO!</span>`;
        c.addEventListener('click', () => pickRival(i));
        box.appendChild(c);
      });
    }
  }

  function pickRival(i) {
    G.rival = (i + TEAMS.LADDER.length) % TEAMS.LADDER.length;
    sfx('click');
    if (TEAMS.LADDER[G.rival].final) zombieScare(G.rival);
    refreshSelect();
  }
  function pickPartner(side, i) {
    const n = TEAMS.PARTNERS.length;
    i = (i + n) % n;
    if (G.partners[1 - side] === i) i = (i + (i >= G.partners[side] ? 1 : -1) + n) % n; // no twins
    G.partners[side] = i;
    G.lastPick = side;
    sfx('click');
    if (TEAMS.PARTNERS[i] === 'zombie') zombieScare(i);
    refreshSelect();
  }
  // picking the zombies: a (harmless) groan and a BOO!
  function zombieScare(i) {
    Kit.sound.groan();
    const c = document.querySelector(`.card[data-i="${i}"] .boo`);
    if (c) setTimeout(() => flash(c, 'show'), 2450);
  }

  function refreshSelect() {
    const vs = G.mode === 'vs';
    $('selTitle').textContent = vs ? 'PICK YOUR PARTNERS' : 'PICK YOUR RIVALS';
    const fill = (box, ids, name, who, pal) => {
      const imgs = box.querySelectorAll('.duo img');
      imgs[0].src = thumbs[ids[0]];
      imgs[1].src = thumbs[ids[1]];
      box.querySelector('.nm').textContent = name;
      box.querySelector('.who').textContent = who;
      const pl = box.querySelector('.pal');
      pl.style.display = pal ? '' : 'none';
      if (pal) {
        pl.querySelector('img').src = thumbs[pal];
        pl.querySelector('span').innerHTML = `${vs ? 'bonus passer' : 'alley-oop combo'}<b>${nameOf(pal)}</b>`;
      }
    };
    if (vs) {
      const a = TEAMS.PARTNERS[G.partners[0]], b = TEAMS.PARTNERS[G.partners[1]];
      fill($('box0'), ['teddy', a], `TEDDY & ${nameOf(a)}`, '1P', 'tommy');
      fill($('box1'), ['tommy', b], `TOMMY & ${nameOf(b)}`, '2P', 'teddy');
      $('box0').querySelector('.bl').textContent = 'W A S D · F G H · T';
      $('box1').querySelector('.bl').textContent = '← ↑ → ↓ · J K L · Enter';
      document.querySelectorAll('.card').forEach((c) => {
        const i = +c.dataset.i;
        c.classList.toggle('c0', G.partners[0] === i);
        c.classList.toggle('c1', G.partners[1] === i);
      });
      $('selHint').innerHTML = 'Tap a partner · 1P <kbd>A</kbd><kbd>D</kbd> · 2P <kbd>←</kbd><kbd>→</kbd> · <kbd>Enter</kbd> play · <kbd>Esc</kbd> back';
    } else {
      const r = TEAMS.LADDER[G.rival];
      fill($('box0'), ['teddy', 'tommy'], 'TEDDY & TOMMY', G.mode === 'coop' ? '1P + 2P' : 'YOU', null);
      $('box0').querySelector('.bl').textContent = G.mode === 'coop' ? 'P1 Teddy · P2 Tommy' : 'you play whoever has the ball';
      fill($('box1'), r.ids, r.name, 'CPU', null);
      $('box1').querySelector('.bl').textContent = r.blurb;
      document.querySelectorAll('.card').forEach((c) => c.classList.toggle('on', +c.dataset.i === G.rival));
      $('selHint').innerHTML = 'Tap a team · <kbd>A</kbd><kbd>D</kbd> or <kbd>←</kbd><kbd>→</kbd> · <kbd>Enter</kbd> play · <kbd>Esc</kbd> back';
    }
  }

  function startMatch(opts) {
    const o = opts || {};
    const teams = G.mode === 'vs'
      ? [
        { name: 'TEAM TEDDY', ids: ['teddy', TEAMS.PARTNERS[G.partners[0]]], color: VS_COLORS[0] },
        { name: 'TEAM TOMMY', ids: ['tommy', TEAMS.PARTNERS[G.partners[1]]], color: VS_COLORS[1] },
      ]
      : [TEAMS.BROTHERS, TEAMS.LADDER[G.rival]];
    G.match = S.createMatch({ teams, mode: G.mode, level: G.level, clearRule: G.clearRule, seed: o.seed });
    G.demo = false;
    G.overT = -1;
    G.paused = false;
    G.meterFor = null;
    $('meter').classList.remove('show');
    G.timers.length = 0;
    clearViews();
    dropTreat();
    Input.clear();
    Input.setTwoPlayer(G.mode !== '1p');
    setupHud();
    show(null);
    $('hud').classList.remove('hidden');
    $('touch').classList.toggle('hidden', !G.touch);
    Kit.sound.music('play');
    if (!G.touch) {
      const text = G.mode === 'vs'
        ? 'Call your bonus passer: 1P <kbd>T</kbd> · 2P <kbd>Enter</kbd>. Pass to him and he passes right back!'
        : G.mode === 'coop'
          ? '1P <kbd>G</kbd> shoot <kbd>F</kbd> pass · 2P <kbd>K</kbd> shoot <kbd>J</kbd> pass · <kbd>T</kbd> / <kbd>Enter</kbd> ALLEY-OOP combo!'
          : '<kbd>G</kbd> shoot · <kbd>F</kbd> pass · <kbd>H</kbd> steal · <kbd>T</kbd> call your brother for an ALLEY-OOP!';
      later(1.9, () => hint(text, 6));
    }
    G.match.events.forEach((e) => onEvent(G.match, e));
    G.match.events.length = 0;
  }

  function pause() {
    if (G.screen !== 'play' || G.demo) return;
    G.paused = true;
    show('pause');
    Kit.sound.music('pause');
  }
  function resume() {
    if (G.screen !== 'pause') return;
    G.paused = false;
    show(null);
    Input.clear();
    Kit.sound.music('play');
  }

  function showResults() {
    const m = G.match;
    const w = m.winner;
    const won = G.mode === 'vs' || w === 0;
    const final = G.mode !== 'vs' && TEAMS.LADDER[G.rival].final;
    show('results');
    Kit.sound.music('over');
    const faces = $('resFaces');
    faces.innerHTML = m.teams[w].ids.map((id) => `<img alt="" src="${thumbs[id]}">`).join('');
    let title = `${m.teams[w].name} WIN!`;
    if (G.mode !== 'vs' && w === 0) title = final ? '🏆 CHAMPIONS!' : 'YOU WIN!';
    $('resTitle').textContent = title;
    const sc = `${m.teams[0].score} – ${m.teams[1].score}`;
    $('resSub').textContent = G.mode === 'vs' ? sc : won
      ? (final ? `${sc} · You beat every team on the street!` : `${sc} · Next up: ${TEAMS.LADDER[G.rival + 1].name}`)
      : `${sc} · So close! Have another go!`;
    const rows = m.players.filter((p) => !p.mini).map((p) => {
      const s = p.stats;
      return `<tr class="t${p.team}"><td>${nameOf(p.id)}</td><td>${s.pts}</td><td>${s.dunks + s.oops}</td><td>${s.threes}</td><td>${s.steals}</td><td>${s.blocks}</td></tr>`;
    });
    $('resStats').innerHTML = '<tr><th></th><th>PTS</th><th>DUNKS</th><th>3s</th><th>STEALS</th><th>BLOCKS</th></tr>' + rows.join('');
    const next = $('nextBtn');
    next.style.display = G.mode !== 'vs' && w === 0 && !final ? '' : 'none';
    $('againBtn').textContent = won ? '↻ REMATCH' : '↻ TRY AGAIN';
  }

  // ------------------------------------------------------------------ the loop

  function tick() {
    const m = G.match;
    // (tests: game.autoplay() lets the headless test bots press the keys)
    const inputs = G.demo ? null : m.humans.map((h) => (G.bots ? G.bots[h.idx](m, h) : worldInput(Input.snapshot(h.idx))));
    S.step(m, inputs);
    const evs = m.events;
    m.events = [];
    for (const e of evs) onEvent(m, e);
  }

  function update(dt) {
    G.gameTime += dt;
    for (let i = G.timers.length - 1; i >= 0; i--) {
      const t = G.timers[i];
      t.t -= dt;
      if (t.t <= 0) {
        G.timers.splice(i, 1);
        t.fn();
      }
    }
    syncViews(dt);
    syncBall(dt);
    updateTreat(dt);
    HoopsCourt.update(court, dt);
    fx.update(dt);
    updateCamera(dt);
    if (!G.demo) updateHud();
    if (G.overT > 0) {
      G.overT -= dt;
      if (G.overT <= 0) {
        if (G.demo) startDemo();
        else if (G.screen === 'play') showResults();
      }
    }
    if (G.demo && G.match.phase === 'over' && G.overT < 0) G.overT = 3;
  }

  function draw() { renderer.render(scene, camera); }

  let last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, last ? (now - last) / 1000 : 0.016);
    last = now;
    if (G.hold || !G.match) return;
    const running = !G.paused && (G.screen === 'play' || G.demo);
    if (running) {
      G.acc += dt;
      let n = 0;
      while (G.acc >= DT && n < 8) {
        tick();
        G.acc -= DT;
        n++;
      }
      if (n >= 8) G.acc = 0;
    }
    update(running ? dt : 0);
    draw();
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 1 ? 58 : 46;
    camera.updateProjectionMatrix();
    G.cam.zoom = w / h < 0.8 ? 1.45 : w / h < 1.25 ? 1.2 : 1;
  }

  // ------------------------------------------------------------------ UI wiring

  function initUI() {
    // the logo: the first O becomes a bouncing ball, and a TT (if the name has one) lights up
    $('logoText').innerHTML = TITLE.toUpperCase().replace('TT', '<em>TT</em>').replace('O', '<span class="ball">🏀</span>');
    document.title = TITLE;
    $('tagline').textContent = window.HOOPS_TAGLINE || '';
    layoutMeter();
    const tap = (el, fn) => el.addEventListener('click', (e) => {
      e.preventDefault();
      Kit.sound.init();
      fn(e);
    });
    document.querySelectorAll('[data-mode]').forEach((b) => tap(b, () => { sfx('click'); showSelect(b.dataset.mode); }));
    document.querySelectorAll('.opt[data-level]').forEach((b) => tap(b, () => { G.level = b.dataset.level; save(); refreshTitle(); }));
    tap($('clearOpt'), () => { G.clearRule = !G.clearRule; save(); refreshTitle(); });
    tap($('selBack'), () => showTitle());
    tap($('selGo'), () => startMatch());
    tap($('pauseBtn'), () => pause());
    document.querySelectorAll('.muteBtn').forEach((b) => tap(b, () => { Kit.sound.toggleMute(); refreshMute(); }));
    tap($('resumeBtn'), () => resume());
    tap($('quitBtn'), () => showTitle());
    tap($('nextBtn'), () => { G.rival = Math.min(G.rival + 1, TEAMS.LADDER.length - 1); startMatch(); });
    tap($('againBtn'), () => startMatch());
    tap($('menuBtn'), () => showTitle());
    Input.bindTouch($('stick'), $('stick').querySelector('.knob'), document.querySelectorAll('#touch .tb'));
    refreshMute();

    window.addEventListener('pointerdown', (e) => {
      Kit.sound.init();
      if (e.pointerType === 'touch' && !G.touch) {
        G.touch = true;
        if (G.screen === 'play') $('touch').classList.remove('hidden');
      }
    }, true);
    if (window.matchMedia && matchMedia('(hover: none) and (pointer: coarse)').matches) G.touch = true;
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (G.autoPause) pause();
        Kit.sound.suspend();
      } else Kit.sound.resume();
    });
  }

  function refreshMute() {
    document.querySelectorAll('.muteBtn').forEach((b) => (b.textContent = Kit.sound.isMuted() ? '🔇' : '🔊'));
  }

  function save() {
    try { localStorage.setItem('hoops96.settings', JSON.stringify({ level: G.level, clearRule: G.clearRule })); } catch (e) { /* storage blocked */ }
  }
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem('hoops96.settings') || '{}');
      if (s.level === 'easy' || s.level === 'normal') G.level = s.level;
      G.clearRule = !!s.clearRule;
    } catch (e) { /* storage blocked */ }
  }

  function onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    Kit.sound.init();
    const k = e.code;
    if (k === 'KeyM') {
      Kit.sound.toggleMute();
      refreshMute();
      return;
    }
    if (e.repeat) return;
    switch (G.screen) {
      case 'title':
        if (k === 'Enter' || k === 'Digit1' || k === 'Space') showSelect('1p');
        else if (k === 'Digit2') showSelect('coop');
        else if (k === 'Digit3') showSelect('vs');
        else if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'KeyA' || k === 'KeyD') { G.level = G.level === 'easy' ? 'normal' : 'easy'; save(); refreshTitle(); sfx('click'); }
        else if (k === 'KeyC') { G.clearRule = !G.clearRule; save(); refreshTitle(); }
        break;
      case 'select':
        if (k === 'Escape') showTitle();
        else if (k === 'Enter' || k === 'Space') startMatch();
        else if (G.mode === 'vs') {
          if (k === 'KeyA') pickPartner(0, G.partners[0] - 1);
          if (k === 'KeyD') pickPartner(0, G.partners[0] + 1);
          if (k === 'ArrowLeft') pickPartner(1, G.partners[1] - 1);
          if (k === 'ArrowRight') pickPartner(1, G.partners[1] + 1);
        } else {
          if (k === 'KeyA' || k === 'ArrowLeft') pickRival(G.rival - 1);
          if (k === 'KeyD' || k === 'ArrowRight') pickRival(G.rival + 1);
          if (k === 'KeyF' || k === 'KeyG' || k === 'KeyJ' || k === 'KeyK') startMatch();
        }
        break;
      case 'play':
        if (k === 'KeyP' || k === 'Escape') pause();
        break;
      case 'pause':
        if (k === 'KeyP' || k === 'Escape' || k === 'Space') resume();
        else if (k === 'KeyQ') showTitle();
        break;
      case 'results':
        if (k === 'Enter' || k === 'Space') ($('nextBtn').style.display === 'none' ? $('againBtn') : $('nextBtn')).click();
        else if (k === 'Escape') showTitle();
        else if (k === 'KeyC') showSelect(G.mode);
        break;
    }
  }

  // ------------------------------------------------------------------ boot

  function boot() {
    renderer = new T.WebGLRenderer({ canvas: $('game'), antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    scene = new T.Scene();
    scene.background = new T.Color('#5b2f86');
    camera = new T.PerspectiveCamera(46, 1, 0.1, 700);
    court = HoopsCourt.build(scene);
    fx = HoopsFx.create(scene);
    makeBall();
    initRoster();
    load();
    initUI();
    resize();
    window.addEventListener('resize', resize);
    showTitle();
    $('loading').classList.add('hidden');
    requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------------ test hooks

  function me() {
    return G.match && G.match.players.find((p) => p.human === 0);
  }

  // Stage a moment for a screenshot: 'dunk', 'jumpshot' (with the meter), 'oop' (the companion combo), 'block'
  function setup(kind) {
    const m = G.match;
    if (!m || G.demo) return 'start a game first';
    m.phase = 'live';
    m.phaseT = 0;
    const p = me();
    const own = m.players.filter((q) => q.team === p.team && q !== p && !q.mini);
    const opp = m.players.filter((q) => q.team !== p.team && !q.mini);
    const place = (q, x, z) => Object.assign(q, { x, z, y: 0, vx: 0, vz: 0, act: 'free', t: 0, fly: null, shot: null });
    place(p, kind === 'dunk' ? 1.4 : kind === 'jumpshot' ? -3.6 : -2.2, kind === 'dunk' ? 4.3 : kind === 'jumpshot' ? 6.6 : 6.4);
    if (own[0]) place(own[0], 3.6, 5.2);
    place(opp[0], kind === 'block' ? p.x + 0.4 : p.x - 1.6, kind === 'block' ? p.z - 1.0 : p.z - 2.6);
    if (opp[1]) place(opp[1], 4.6, 7.5);
    S.act.catchBall(m, p);
    p.face = S.util.angleTo(p, RIM.x, RIM.z);
    m.offense = p.team;
    m.shotClock = m.cfg.rules.shotClock;
    m.cleared = true;
    if (kind === 'dunk') S.act.startShot(m, p, { auto: true });
    if (kind === 'jumpshot') S.act.startShot(m, p, { auto: false });
    if (kind === 'oop') {
      const c = m.teams[p.team].combo;
      c.rest = 0;
      c.on = false;
      S.act.callCompanion(m, p.team, p);
    }
    if (kind === 'block') {
      S.act.startShot(m, p, { auto: true });
      S.act.jump(m, opp[0]);
    }
    return state();
  }

  function state() {
    const m = G.match;
    if (!m) return { screen: G.screen };
    const b = m.ball;
    return {
      screen: G.screen, demo: G.demo, mode: m.cfg.mode, level: m.cfg.level, phase: m.phase, time: +m.time.toFixed(2),
      score: m.teams.map((t) => t.score), offense: m.offense, shotClock: +m.shotClock.toFixed(1),
      ball: { mode: b.mode, holder: b.holder ? b.holder.id : null, x: +b.x.toFixed(2), y: +b.y.toFixed(2), z: +b.z.toFixed(2) },
      players: m.players.map((p) => ({ id: p.id, team: p.team, act: p.act, human: p.human, mini: p.mini, x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), fire: p.fire })),
      combo: m.teams.map((t) => ({ on: t.combo.on, t: +t.combo.t.toFixed(1), rest: +t.combo.rest.toFixed(1), helper: t.combo.helper && t.combo.helper.id })),
    };
  }

  window.game = {
    // jump straight into a game: { mode: '1p' | 'coop' | 'vs', level, rival: 0-2, partners: [i, j], clearRule, seed }
    start(o) {
      const opts = o || {};
      if (opts.mode) G.mode = opts.mode;
      if (opts.level) G.level = opts.level;
      if (opts.rival !== undefined) G.rival = opts.rival;
      if (opts.partners) G.partners = opts.partners.slice();
      if (opts.clearRule !== undefined) G.clearRule = !!opts.clearRule;
      startMatch(opts);
      return state();
    },
    // advance the game by `sec` seconds right now and draw it (for a hidden, throttled browser tab)
    step(sec) {
      const n = Math.max(1, Math.round((sec || DT) / DT));
      for (let i = 0; i < n; i++) {
        if (!G.paused && (G.screen === 'play' || G.demo)) tick();
        update(DT);
      }
      draw();
      return state();
    },
    hold(on) { G.hold = !!on; },
    // let test bots play the kids' side: autoplay('kid') or autoplay('good'); autoplay(false) gives it back
    autoplay(skill) { G.bots = skill ? [H.bots.bot(skill), H.bots.bot(skill)] : null; },
    set autoPause(v) { G.autoPause = !!v; },
    get autoPause() { return G.autoPause; },
    state, setup,
    title: showTitle,
    select: showSelect,
    results: showResults,
    pause, resume,
    call(team) { const m = G.match; return S.act.callCompanion(m, team || 0, m.players.find((p) => p.human === (team || 0)) || null); },
    soak: (n, o) => H.soak(n, o),
    versus: (skill, level, n, o) => H.versus(skill, level, n, o),
    match: () => G.match,
    three: () => ({ scene, camera, renderer, fx }),
    G,
  };

  try {
    boot();
  } catch (err) {
    $('loading').textContent = 'Oops, something broke: ' + err.message;
    throw err;
  }
})();
