/* hoops96-teddy: the street court at sunset. A painted half court, a hoop on a padded pole with a chain net, chain-link
   fences, brick walls with TEDDY / TOMMY / METRO graffiti, street lamps, a city skyline and a big orange sun.
   Every texture is painted on a canvas here: no image files. HoopsCourt.build(scene) returns the bits the game
   animates (the net and the rim). */
(function () {
  'use strict';
  const T = THREE;
  const Kit = window.Kit;
  const { makeCanvas, toTexture, std, mesh, shade, roundRect, FONT } = Kit.gfx;
  const C = window.Hoops.sim.COURT;
  const RIM = C.rim;

  const COLORS = {
    court: '#2e6f96', courtWorn: '#285f82', key: '#e2553f', line: '#f6f1e4', out: '#4a4f5c', walk: '#8d8a86',
    brick: '#9c4a3a', mortar: '#d9c3a8', pole: '#22324a', pad: '#ff5a1f', rim: '#ff5a1f',
  };

  // ------------------------------------------------------------------ the painted court

  const PX = 64; // canvas pixels per metre
  const COURT_W = 15, COURT_L = 16.2;

  function courtTexture() {
    const [c, g] = makeCanvas(COURT_W * PX, Math.round(COURT_L * PX));
    const X = (x) => (x + COURT_W / 2) * PX, Z = (z) => z * PX;
    g.fillStyle = COLORS.court;
    g.fillRect(0, 0, c.width, c.height);
    // worn patches and speckles: it's an outdoor court
    for (let i = 0; i < 26; i++) {
      g.fillStyle = `rgba(20,40,60,${0.05 + Math.random() * 0.06})`;
      g.beginPath();
      g.ellipse(Math.random() * c.width, Math.random() * c.height, 30 + Math.random() * 110, 20 + Math.random() * 70, Math.random() * 3, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 5000; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
      g.fillRect(Math.random() * c.width, Math.random() * c.height, 2, 2);
    }
    // the key, painted
    g.fillStyle = COLORS.key;
    g.fillRect(X(-C.keyHalfW), Z(0), C.keyHalfW * 2 * PX, Z(C.keyZ));
    // the "TT" logo in the centre circle
    g.save();
    g.translate(X(0), Z(14));
    g.fillStyle = '#ffd400';
    g.beginPath(); g.arc(0, 0, 1.8 * PX, 0, Math.PI * 2); g.fill();
    g.fillStyle = COLORS.key;
    g.beginPath(); g.arc(0, 0, 1.45 * PX, 0, Math.PI * 2); g.fill();
    g.font = `${1.5 * PX}px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 10;
    g.strokeStyle = '#14121f';
    g.strokeText('TT', 0, 6);
    g.fillStyle = '#ffffff';
    g.fillText('TT', 0, 6);
    g.restore();
    // lines
    g.strokeStyle = COLORS.line;
    g.lineWidth = 0.07 * PX;
    g.strokeRect(X(-7.5) + 3, Z(0) + 3, COURT_W * PX - 6, c.height + 20);
    g.beginPath(); g.moveTo(X(-7.5), Z(14)); g.lineTo(X(7.5), Z(14)); g.stroke();
    g.strokeRect(X(-C.keyHalfW), Z(0), C.keyHalfW * 2 * PX, Z(C.keyZ));
    g.beginPath(); g.arc(X(0), Z(C.keyZ), 1.8 * PX, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(X(0), Z(RIM.z), 1.25 * PX, 0, Math.PI); g.stroke();
    // the 3-point arc: a circle round the rim, cut off by the baseline
    const a0 = Math.asin(RIM.z / C.three);
    g.beginPath(); g.arc(X(0), Z(RIM.z), C.three * PX, -a0, Math.PI + a0); g.stroke();
    g.beginPath(); g.arc(X(0), Z(14), 1.8 * PX, 0, Math.PI * 2); g.stroke();
    // little hash marks along the key
    for (const z of [1.75, 2.85, 3.95]) for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(X(s * C.keyHalfW), Z(z)); g.lineTo(X(s * (C.keyHalfW + 0.25)), Z(z)); g.stroke();
    }
    // cracks
    g.strokeStyle = 'rgba(10,20,30,0.35)';
    g.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      let x = Math.random() * c.width, y = Math.random() * c.height;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += (Math.random() - 0.5) * 60; y += (Math.random() - 0.3) * 50; g.lineTo(x, y); }
      g.stroke();
    }
    return toTexture(c);
  }

  function asphaltTexture() {
    const [c, g] = makeCanvas(256, 256);
    g.fillStyle = COLORS.out;
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) {
      const v = Math.random();
      g.fillStyle = v < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.12)';
      g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
    return toTexture(c, true);
  }

  // ------------------------------------------------------------------ fences, walls, graffiti

  function fenceTexture() {
    const [c, g] = makeCanvas(128, 128);
    g.strokeStyle = 'rgba(205,214,222,0.95)';
    g.lineWidth = 3;
    // chain-link diamonds
    for (let i = -2; i < 4; i++) {
      g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64 + 128, 128); g.stroke();
      g.beginPath(); g.moveTo(i * 64 + 128, 0); g.lineTo(i * 64, 128); g.stroke();
    }
    const t = toTexture(c, true);
    return t;
  }

  function fence(parent, x0, z0, x1, z1, h, tex) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const tx = tex.clone();
    tx.needsUpdate = true;
    tx.repeat.set(len / 0.6, h / 0.6);
    const mat = new T.MeshStandardMaterial({ map: tx, transparent: true, alphaTest: 0.35, side: T.DoubleSide, metalness: 0.5, roughness: 0.5 });
    const m = new T.Mesh(new T.PlaneGeometry(len, h), mat);
    m.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2);
    m.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    m.castShadow = true;
    parent.add(m);
    const postMat = std('#5f6b78', { metalness: 0.6, roughness: 0.4 });
    const n = Math.max(1, Math.round(len / 3));
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const p = mesh(new T.CylinderGeometry(0.05, 0.05, h + 0.1, 8), postMat, x0 + (x1 - x0) * k, (h + 0.1) / 2, z0 + (z1 - z0) * k, parent);
      p.castShadow = true;
    }
    const rail = mesh(new T.CylinderGeometry(0.035, 0.035, len, 6), postMat, (x0 + x1) / 2, h, (z0 + z1) / 2, parent);
    rail.rotation.z = Math.PI / 2;
    rail.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
  }

  // Brick wall with bubble-letter graffiti. words: [{ text, x (0..1), y (0..1), size, fill: [top, bottom], outline, rot }]
  function graffitiTexture(w, h, words, extras) {
    const [c, g] = makeCanvas(w, h);
    g.fillStyle = COLORS.mortar;
    g.fillRect(0, 0, w, h);
    const bw = 64, bh = 26;
    for (let row = 0, y = 0; y < h; row++, y += bh) {
      for (let x = row % 2 ? -bw / 2 : 0; x < w; x += bw) {
        g.fillStyle = shade(COLORS.brick, (Math.random() - 0.5) * 0.25);
        g.fillRect(x + 2, y + 2, bw - 4, bh - 4);
      }
    }
    // a sunset wash so the wall isn't too busy
    const wash = g.createLinearGradient(0, 0, 0, h);
    wash.addColorStop(0, 'rgba(255,160,90,0.18)');
    wash.addColorStop(1, 'rgba(40,20,60,0.25)');
    g.fillStyle = wash;
    g.fillRect(0, 0, w, h);
    for (const e of extras || []) e(g, w, h);
    for (const wd of words) {
      g.save();
      g.translate(wd.x * w, wd.y * h);
      g.rotate(wd.rot || 0);
      g.font = `${wd.size}px ${FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      // spray outline: a dark fat stroke, a white stroke, then the gradient fill
      g.lineJoin = 'round';
      g.lineWidth = wd.size * 0.28;
      g.strokeStyle = '#1b1530';
      g.strokeText(wd.text, 0, 0);
      g.lineWidth = wd.size * 0.14;
      g.strokeStyle = wd.outline || '#ffffff';
      g.strokeText(wd.text, 0, 0);
      const gr = g.createLinearGradient(0, -wd.size / 2, 0, wd.size / 2);
      gr.addColorStop(0, wd.fill[0]);
      gr.addColorStop(1, wd.fill[1]);
      g.fillStyle = gr;
      g.fillText(wd.text, 0, 0);
      // drips
      const tw = g.measureText(wd.text).width;
      g.fillStyle = wd.fill[1];
      for (let i = 0; i < 6; i++) {
        const dx = (Math.random() - 0.5) * tw * 0.9, len = wd.size * (0.15 + Math.random() * 0.35);
        roundRect(g, dx - 4, wd.size * 0.3, 8, len, 4);
        g.fill();
      }
      g.restore();
    }
    return toTexture(c);
  }

  // sparkle stars, a crown, a basketball: little tags around the big words
  const star = (x, y, r, col) => (g, w, h) => {
    g.save();
    g.translate(x * w, y * h);
    g.fillStyle = col;
    g.strokeStyle = '#1b1530';
    g.lineWidth = 5;
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 ? r * 0.45 : r, a = -Math.PI / 2 + (i * Math.PI) / 5;
      g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    g.closePath();
    g.stroke();
    g.fill();
    g.restore();
  };
  const ball = (x, y, r) => (g, w, h) => {
    g.save();
    g.translate(x * w, y * h);
    g.fillStyle = '#ff8a1f';
    g.strokeStyle = '#1b1530';
    g.lineWidth = 6;
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill(); g.stroke();
    g.lineWidth = 4;
    g.beginPath(); g.moveTo(-r, 0); g.lineTo(r, 0); g.stroke();
    g.beginPath(); g.moveTo(0, -r); g.lineTo(0, r); g.stroke();
    g.beginPath(); g.arc(-r * 1.15, 0, r * 0.75, -0.9, 0.9); g.stroke();
    g.beginPath(); g.arc(r * 1.15, 0, r * 0.75, Math.PI - 0.9, Math.PI + 0.9); g.stroke();
    g.restore();
  };

  function wall(parent, x, z, w, h, rotY, tex) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, 0.4), [std(COLORS.brick), std(COLORS.brick), std('#7d3a2e'), std(COLORS.brick), std('#ffffff', { map: tex }), std(COLORS.brick)]);
    m.position.set(x, h / 2, z);
    m.rotation.y = rotY;
    m.receiveShadow = true;
    m.castShadow = true;
    parent.add(m);
    return m;
  }

  // ------------------------------------------------------------------ the hoop

  function boardTexture() {
    const [c, g] = makeCanvas(360, 210);
    g.fillStyle = 'rgba(255,255,255,0.92)';
    g.fillRect(0, 0, 360, 210);
    g.strokeStyle = '#14121f';
    g.lineWidth = 12;
    g.strokeRect(6, 6, 348, 198);
    g.strokeStyle = COLORS.rim;
    g.lineWidth = 9;
    g.strokeRect(120, 92, 120, 90);
    g.font = `22px ${FONT}`;
    g.fillStyle = '#14121f';
    g.textAlign = 'center';
    g.fillText('TT COURT', 180, 52);
    return toTexture(c);
  }

  // A chain net: rings of points joined by straight chains, so it can stretch when the ball goes through.
  function buildNet() {
    const N = 12, RINGS = 5, H = 0.46;
    const pts = [];
    for (let r = 0; r <= RINGS; r++) {
      for (let i = 0; i < N; i++) pts.push({ r, i });
    }
    const pos = new Float32Array(N * RINGS * 2 * 2 * 3); // each ring link: vertical + diagonal, 2 points each
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    const lines = new T.LineSegments(geo, new T.LineBasicMaterial({ color: '#dfe6ee' }));
    lines.frustumCulled = false;
    const net = { lines, N, RINGS, H, kick: 0, ph: 0 };
    net.layout = function () {
      const p = (r, i) => {
        const u = r / RINGS;
        const flare = net.kick * Math.sin(u * Math.PI) * 0.06;
        const rad = 0.23 - u * 0.09 + flare;
        const a = (i / N) * Math.PI * 2 + (r % 2 ? Math.PI / N : 0) + Math.sin(net.ph + r) * net.kick * 0.08;
        const drop = u * H * (1 + net.kick * 0.35);
        return [RIM.x + Math.cos(a) * rad, RIM.y - drop, RIM.z + Math.sin(a) * rad];
      };
      let k = 0;
      for (let r = 0; r < RINGS; r++) {
        for (let i = 0; i < N; i++) {
          const a = p(r, i), b = p(r + 1, i), d = p(r + 1, (i + 1) % N);
          pos.set(a, k); pos.set(b, k + 3); k += 6;
          pos.set(a, k); pos.set(d, k + 3); k += 6;
        }
      }
      geo.attributes.position.needsUpdate = true;
    };
    net.layout();
    return net;
  }

  function buildHoop(parent) {
    const g = new T.Group();
    parent.add(g);
    const poleMat = std(COLORS.pole, { metalness: 0.4, roughness: 0.5 });
    const padMat = std(COLORS.pad, { roughness: 0.7 });
    const pz = -1.0;
    mesh(new T.BoxGeometry(0.26, 3.9, 0.26), poleMat, 0, 1.95, pz, g);
    mesh(new T.BoxGeometry(0.42, 1.9, 0.42), padMat, 0, 0.95, pz, g); // padding, kid-safe
    const arm = mesh(new T.BoxGeometry(0.16, 0.16, 2.25), poleMat, 0, 3.6, (pz + C.board.z) / 2, g);
    arm.castShadow = true;
    const brace = mesh(new T.BoxGeometry(0.1, 0.1, 1.6), poleMat, 0, 3.2, pz + 0.75, g);
    brace.rotation.x = -0.45;
    const bh = C.board.y1 - C.board.y0;
    const boardMat = new T.MeshStandardMaterial({ map: boardTexture(), transparent: true, opacity: 0.96, roughness: 0.25 });
    const board = mesh(new T.BoxGeometry(C.board.halfW * 2, bh, 0.05), [std('#14121f'), std('#14121f'), std('#14121f'), std('#14121f'), boardMat, boardMat], 0, C.board.y0 + bh / 2, C.board.z, g);
    board.receiveShadow = true;
    const rimMat = std(COLORS.rim, { metalness: 0.5, roughness: 0.35, emissive: '#5a1400', emissiveIntensity: 0.4 });
    const rim = mesh(new T.TorusGeometry(C.rimR, 0.022, 8, 28), rimMat, RIM.x, RIM.y, RIM.z, g);
    rim.rotation.x = Math.PI / 2;
    mesh(new T.BoxGeometry(0.16, 0.05, 0.16), rimMat, 0, RIM.y - 0.02, C.board.z + 0.1, g);
    const net = buildNet();
    g.add(net.lines);
    return { group: g, rim, net, board };
  }

  // ------------------------------------------------------------------ sky, sun, skyline, lamps

  function skyDome(parent) {
    const [c, g] = makeCanvas(16, 512);
    const gr = g.createLinearGradient(0, 0, 0, 512);
    gr.addColorStop(0, '#1d1650');
    gr.addColorStop(0.3, '#5b2f86');
    gr.addColorStop(0.47, '#d4537a');
    gr.addColorStop(0.53, '#ff8c5a');
    gr.addColorStop(0.58, '#ffc46a');
    gr.addColorStop(1, '#ffd98a');
    g.fillStyle = gr;
    g.fillRect(0, 0, 16, 512);
    const sky = new T.Mesh(new T.SphereGeometry(260, 32, 16), new T.MeshBasicMaterial({ map: toTexture(c), side: T.BackSide, fog: false, depthWrite: false }));
    parent.add(sky);
    // the sun, low behind the hoop, and its glow
    const sunTex = Kit.gfx.radialTexture(256, [[0, 'rgba(255,250,220,1)'], [0.18, 'rgba(255,224,140,1)'], [0.22, 'rgba(255,170,90,0.75)'], [0.55, 'rgba(255,120,80,0.22)'], [1, 'rgba(255,90,80,0)']]);
    const sun = new T.Sprite(new T.SpriteMaterial({ map: sunTex, fog: false, depthWrite: false, transparent: true }));
    sun.position.set(-38, 14, -170);
    sun.scale.setScalar(120);
    parent.add(sun);
    // a few warm clouds
    const cloudTex = Kit.gfx.radialTexture(128, [[0, 'rgba(255,190,170,0.7)'], [0.6, 'rgba(255,150,150,0.25)'], [1, 'rgba(255,150,150,0)']]);
    for (let i = 0; i < 9; i++) {
      const cl = new T.Sprite(new T.SpriteMaterial({ map: cloudTex, fog: false, depthWrite: false, transparent: true, opacity: 0.6 }));
      cl.position.set(-120 + i * 30 + Math.random() * 10, 38 + Math.random() * 30, -180 + Math.random() * 20);
      cl.scale.set(60 + Math.random() * 40, 10 + Math.random() * 6, 1);
      parent.add(cl);
    }
  }

  function windowsTexture(cols, rows, base) {
    const [c, g] = makeCanvas(cols * 16, rows * 22);
    g.fillStyle = base;
    g.fillRect(0, 0, c.width, c.height);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const lit = Math.random() < 0.35;
      g.fillStyle = lit ? (Math.random() < 0.5 ? '#ffd27a' : '#ffb35c') : 'rgba(0,0,0,0.25)';
      g.fillRect(x * 16 + 4, y * 22 + 5, 8, 12);
    }
    return toTexture(c);
  }

  function skyline(parent) {
    const g = new T.Group();
    parent.add(g);
    const bases = ['#3b2a5c', '#4a3168', '#33264f', '#553a6e'];
    for (let i = 0; i < 26; i++) {
      const w = 6 + Math.random() * 10, h = 12 + Math.random() * 34, d = 6 + Math.random() * 6;
      const x = -110 + i * 8.6 + Math.random() * 3;
      const z = -48 - Math.random() * 40;
      const base = bases[i % bases.length];
      const tex = windowsTexture(Math.max(2, Math.round(w / 1.6)), Math.max(3, Math.round(h / 2.4)), base);
      const mat = new T.MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.35, roughness: 0.9 });
      const b = new T.Mesh(new T.BoxGeometry(w, h, d), [mat, mat, std(base), std(base), mat, mat]);
      b.position.set(x, h / 2 - 0.5, z);
      g.add(b);
      if (i % 5 === 2) {
        // a water tower on top
        const wt = mesh(new T.CylinderGeometry(1.4, 1.4, 2.2, 10), std('#6b4a3a'), x, h + 1.8, z, g, false);
        mesh(new T.ConeGeometry(1.6, 1, 10), std('#4a3228'), 0, 1.6, 0, wt, false);
      }
    }
  }

  function lamp(parent, x, z) {
    const mat = std('#2b3240', { metalness: 0.5, roughness: 0.5 });
    mesh(new T.CylinderGeometry(0.09, 0.12, 6, 8), mat, x, 3, z, parent);
    const arm = mesh(new T.BoxGeometry(1.2, 0.1, 0.1), mat, x + (x < 0 ? 0.55 : -0.55), 6, z, parent);
    arm.castShadow = false;
    const bulb = mesh(new T.SphereGeometry(0.22, 12, 8), new T.MeshBasicMaterial({ color: '#fff2c4' }), x + (x < 0 ? 1.1 : -1.1), 5.85, z, parent, false);
    const glow = new T.Sprite(new T.SpriteMaterial({ map: Kit.gfx.glowTexture(), color: '#ffcf7a', transparent: true, opacity: 0.8, depthWrite: false, blending: T.AdditiveBlending }));
    glow.scale.setScalar(2.4);
    bulb.add(glow);
  }

  // ------------------------------------------------------------------ build it all

  function build(scene) {
    const root = new T.Group();
    scene.add(root);
    scene.fog = new T.Fog('#e88a78', 45, 150);

    // lights: a low orange sun behind the hoop, a soft fill from the camera side so faces read, sky bounce
    scene.add(new T.HemisphereLight('#ffc2a0', '#3b2f55', 0.75));
    const sun = new T.DirectionalLight('#ffb27a', 1.35);
    sun.position.set(-12, 14, -16);
    sun.target.position.set(0, 0, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -14; sc.right = 14; sc.top = 14; sc.bottom = -14; sc.near = 1; sc.far = 60;
    sun.shadow.bias = -0.0006;
    scene.add(sun, sun.target);
    const fill = new T.DirectionalLight('#ffe2cc', 0.55);
    fill.position.set(6, 9, 24);
    scene.add(fill);

    skyDome(root);
    skyline(root);

    // ground: asphalt around, the painted court on top
    const asphalt = asphaltTexture();
    asphalt.repeat.set(20, 20);
    const ground = new T.Mesh(new T.PlaneGeometry(90, 90), std('#ffffff', { map: asphalt, roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.01, 6);
    ground.receiveShadow = true;
    root.add(ground);
    const court = new T.Mesh(new T.PlaneGeometry(COURT_W, COURT_L), std('#ffffff', { map: courtTexture(), roughness: 0.85 }));
    court.rotation.x = -Math.PI / 2;
    court.position.set(0, 0, COURT_L / 2);
    court.receiveShadow = true;
    root.add(court);
    // a kerb round the court
    const kerb = std('#b8b2a8');
    mesh(new T.BoxGeometry(COURT_W + 0.6, 0.08, 0.3), kerb, 0, 0.04, -0.15, root, false).receiveShadow = true;
    mesh(new T.BoxGeometry(COURT_W + 0.6, 0.5, 0.3), kerb, 0, 0.25, COURT_L + 0.15, root, false).receiveShadow = true;

    // fences: behind the baseline and along both sides
    const ft = fenceTexture();
    fence(root, -9.2, -2.4, 9.2, -2.4, 4, ft);
    fence(root, -9.2, -2.4, -9.2, 17.5, 4, ft);
    fence(root, 9.2, -2.4, 9.2, 17.5, 4, ft);

    // brick walls with graffiti: behind the hoop, and down the left side
    const back = graffitiTexture(1536, 384, [
      { text: 'TEDDY', x: 0.24, y: 0.5, size: 150, fill: ['#5ec8ff', '#2a6cff'], rot: -0.06 },
      { text: 'TOMMY', x: 0.76, y: 0.52, size: 150, fill: ['#8dffb0', '#22b46a'], rot: 0.05 },
    ], [star(0.05, 0.22, 34, '#ffd400'), star(0.48, 0.2, 26, '#ff3d7f'), ball(0.5, 0.62, 52), star(0.95, 0.75, 30, '#ffd400')]);
    wall(root, 0, -4.2, 30, 5, 0, back);
    const side = graffitiTexture(1536, 384, [
      { text: 'METRO', x: 0.5, y: 0.5, size: 170, fill: ['#ffd400', '#ff6a1f'], outline: '#ff3d7f', rot: -0.04 },
    ], [star(0.1, 0.3, 30, '#5ec8ff'), star(0.88, 0.25, 36, '#8dffb0'), star(0.92, 0.78, 22, '#ffd400')]);
    wall(root, -11.4, 6, 24, 5, Math.PI / 2, side);
    const right = graffitiTexture(1536, 384, [
      { text: 'HOOPS', x: 0.3, y: 0.52, size: 140, fill: ['#ff9ad5', '#ff3d7f'], rot: 0.04 },
      { text: '★TT★', x: 0.78, y: 0.48, size: 120, fill: ['#fff3a0', '#ffb02e'], rot: -0.05 },
    ], [ball(0.56, 0.3, 40)]);
    wall(root, 11.4, 6, 24, 5, -Math.PI / 2, right);

    lamp(root, -9.8, 3);
    lamp(root, 9.8, 11);

    const hoop = buildHoop(root);
    root.traverse((o) => {
      if (o.isMesh && o !== ground && o !== court) o.receiveShadow = true;
    });
    return { root, hoop, sun };
  }

  // the net kicks when the ball goes through, then settles
  function update(court, dt) {
    const net = court.hoop.net;
    if (net.kick > 0.001) {
      net.ph += dt * 18;
      net.kick *= Math.exp(-dt * 3.2);
      net.layout();
    }
  }
  function swish(court, big) {
    court.hoop.net.kick = big ? 1.6 : 1;
    court.hoop.net.ph = 0;
  }

  window.HoopsCourt = { build, update, swish, COLORS };
})();
