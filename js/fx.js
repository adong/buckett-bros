/* hoops96-teddy: effects. Particles (dust, sparks, confetti, fire), comic starbursts with a word in them (SLAM!,
   BLOCKED!, SWISH!), spinning stars for dunks, floating +2 / +3, and dizzy stars round a head.
   HoopsFx.create(scene) returns the effect makers; call fx.update(dt) every frame. */
(function () {
  'use strict';
  const T = THREE;
  const Kit = window.Kit;
  const { makeCanvas, toTexture, FONT } = Kit.gfx;

  // A pool of point sprites. Each particle: position, velocity, colour, life, size, gravity, drag.
  function particlePool(scene, n, additive) {
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), alpha = new Float32Array(n);
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('color', new T.BufferAttribute(col, 3));
    geo.setAttribute('size', new T.BufferAttribute(size, 1));
    geo.setAttribute('alpha', new T.BufferAttribute(alpha, 1));
    const mat = new T.ShaderMaterial({
      uniforms: { map: { value: Kit.gfx.dotTexture() } },
      vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vColor; varying float vA;
        void main() { vColor = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * 700.0 / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D map; varying vec3 vColor; varying float vA;
        void main() { vec4 t = texture2D(map, gl_PointCoord); if (t.a < 0.02) discard; gl_FragColor = vec4(vColor, t.a * vA);
        #include <encodings_fragment>
        }`,
      transparent: true, depthWrite: false, blending: additive ? T.AdditiveBlending : T.NormalBlending,
    });
    const pts = new T.Points(geo, mat);
    pts.frustumCulled = false;
    scene.add(pts);
    const P = [];
    for (let i = 0; i < n; i++) P.push({ life: 0, max: 1, x: 0, y: -99, z: 0, vx: 0, vy: 0, vz: 0, s: 0.1, g: 0, drag: 0, c: new T.Color() });
    let next = 0;
    const tmp = new T.Color();
    return {
      emit(x, y, z, count, o) {
        o = o || {};
        for (let k = 0; k < count; k++) {
          const p = P[next];
          next = (next + 1) % n;
          const a = Math.random() * Math.PI * 2, sp = (o.speed || 2) * (0.4 + Math.random() * 0.8);
          const spr = o.spread || 0.2;
          p.x = x + (Math.random() - 0.5) * spr;
          p.y = y + (Math.random() - 0.5) * spr;
          p.z = z + (Math.random() - 0.5) * spr;
          p.vx = Math.cos(a) * sp + (o.vx || 0);
          p.vz = Math.sin(a) * sp + (o.vz || 0);
          p.vy = (o.up || 0) * (0.6 + Math.random() * 0.8);
          p.max = p.life = (o.life || 0.8) * (0.7 + Math.random() * 0.6);
          p.s = (o.size || 0.12) * (0.7 + Math.random() * 0.6);
          p.g = o.gravity !== undefined ? o.gravity : 9;
          p.drag = o.drag || 0;
          const cs = Array.isArray(o.color) ? o.color[Math.floor(Math.random() * o.color.length)] : o.color || '#ffffff';
          p.c.set(cs);
        }
      },
      update(dt) {
        for (let i = 0; i < n; i++) {
          const p = P[i];
          if (p.life <= 0) {
            size[i] = 0;
            alpha[i] = 0;
            continue;
          }
          p.life -= dt;
          p.vy -= p.g * dt;
          const d = Math.max(0, 1 - p.drag * dt);
          p.vx *= d; p.vy *= d; p.vz *= d;
          p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
          if (p.y < 0.03) { p.y = 0.03; p.vy *= -0.3; }
          pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
          const f = Math.max(0, p.life / p.max);
          tmp.copy(p.c);
          col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
          size[i] = p.s * (0.5 + 0.5 * f);
          alpha[i] = Math.min(1, f * 2.5);
        }
        geo.attributes.alpha.needsUpdate = true;
        geo.attributes.position.needsUpdate = true;
        geo.attributes.color.needsUpdate = true;
        geo.attributes.size.needsUpdate = true;
      },
    };
  }

  // A comic starburst with a word in it.
  const burstCache = {};
  function burstTexture(word, fill, ink) {
    const key = word + fill;
    if (burstCache[key]) return burstCache[key];
    const [c, g] = makeCanvas(384, 256);
    g.translate(192, 128);
    const spikes = 14;
    g.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const a = (i / (spikes * 2)) * Math.PI * 2;
      const r = i % 2 ? 0.62 : 1;
      g.lineTo(Math.cos(a) * 180 * r, Math.sin(a) * 118 * r);
    }
    g.closePath();
    g.fillStyle = fill;
    g.fill();
    g.lineWidth = 10;
    g.strokeStyle = ink || '#14121f';
    g.stroke();
    g.font = `${word.length > 7 ? 46 : word.length > 5 ? 56 : 66}px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 12;
    g.lineJoin = 'round';
    g.strokeStyle = '#14121f';
    g.strokeText(word, 0, 6);
    g.fillStyle = '#ffffff';
    g.fillText(word, 0, 6);
    return (burstCache[key] = toTexture(c));
  }

  let starTex = null;
  function starTexture() {
    if (starTex) return starTex;
    const [c, g] = makeCanvas(96, 96);
    g.translate(48, 50);
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 17 : 42, a = -Math.PI / 2 + (i * Math.PI) / 5;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath();
    g.fillStyle = '#ffd400';
    g.fill();
    g.lineWidth = 6;
    g.strokeStyle = '#14121f';
    g.stroke();
    return (starTex = toTexture(c));
  }

  const textCache = {};
  function textTexture(text, color) {
    const key = text + color;
    if (textCache[key]) return textCache[key];
    const [c, g] = makeCanvas(256, 128);
    g.font = `84px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = 16;
    g.strokeStyle = '#14121f';
    g.strokeText(text, 128, 68);
    g.fillStyle = color;
    g.fillText(text, 128, 68);
    return (textCache[key] = toTexture(c));
  }

  function create(scene) {
    const dust = particlePool(scene, 500, false);
    const glow = particlePool(scene, 900, true);
    const sprites = []; // { s, t, life, kind, vx, vy, vz, spin, base }

    function sprite(tex, x, y, z, scale, o) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: !(o && o.onTop) }));
      s.position.set(x, y, z);
      s.scale.set(scale * (tex.image.width / tex.image.height), scale, 1);
      s.renderOrder = o && o.onTop ? 10 : 2;
      scene.add(s);
      const e = Object.assign({ s, t: 0, life: 1, vx: 0, vy: 0, vz: 0, spin: 0, g: 0, base: s.scale.clone(), pop: false }, o);
      sprites.push(e);
      return e;
    }

    return {
      dust, glow,
      // a comic word burst: SLAM!, BLOCKED!, SWISH!
      burst(word, x, y, z, fill, scale) {
        sprite(burstTexture(word, fill || '#ffd400'), x, y, z, scale || 1.3, { life: 1.1, pop: true, vy: 0.5, onTop: true });
      },
      // spinning yellow stars flying out (dunks, blocks)
      stars(x, y, z, n, speed) {
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + Math.random() * 0.4, sp = (speed || 3.5) * (0.6 + Math.random() * 0.6);
          sprite(starTexture(), x, y, z, 0.55 + Math.random() * 0.3, { life: 0.9 + Math.random() * 0.4, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp * 0.6, vy: 2 + Math.random() * 3, g: 6, spin: (Math.random() - 0.5) * 12 });
        }
      },
      // +2 / +3 rising from the hoop
      floatText(text, x, y, z, color) {
        sprite(textTexture(text, color || '#ffd400'), x, y, z, 0.8, { life: 1.3, vy: 1.4, onTop: true });
      },
      // fire trail bits (ON FIRE players and balls)
      fire(x, y, z, n) {
        dust.emit(x, y, z, n || 2, { color: ['#ff4a12', '#ff8a1f', '#ffc21f', '#ffe066'], speed: 0.4, up: 1.6, gravity: -2, life: 0.5, size: 0.3, spread: 0.3 });
      },
      sparkle(x, y, z, n, color) {
        glow.emit(x, y, z, n, { color: color || ['#ffffff', '#ffd400'], speed: 3, up: 3, gravity: 6, life: 0.7, size: 0.13, spread: 0.3 });
      },
      confetti(x, y, z, n) {
        dust.emit(x, y, z, n, { color: ['#ff3d7f', '#ffd400', '#18d4ff', '#7dff5a', '#ffffff'], speed: 4, up: 6, gravity: 5, drag: 1.2, life: 2.2, size: 0.11, spread: 1.5 });
      },
      puff(x, z, n) {
        dust.emit(x, 0.1, z, n || 8, { color: '#d8cfc4', speed: 1.4, up: 0.6, gravity: 0, drag: 2.5, life: 0.5, size: 0.25, spread: 0.3 });
      },
      update(dt) {
        dust.update(dt);
        glow.update(dt);
        for (let i = sprites.length - 1; i >= 0; i--) {
          const e = sprites[i];
          e.t += dt;
          const u = e.t / e.life;
          if (u >= 1) {
            scene.remove(e.s);
            e.s.material.dispose();
            sprites.splice(i, 1);
            continue;
          }
          e.vy -= e.g * dt;
          e.s.position.x += e.vx * dt;
          e.s.position.y += e.vy * dt;
          e.s.position.z += e.vz * dt;
          e.s.material.rotation += e.spin * dt;
          const pop = e.pop ? (u < 0.12 ? 0.4 + (u / 0.12) * 0.85 : u < 0.22 ? 1.25 - ((u - 0.12) / 0.1) * 0.25 : 1) : 1;
          e.s.scale.set(e.base.x * pop, e.base.y * pop, 1);
          e.s.material.opacity = u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1;
        }
      },
    };
  }

  // Dizzy stars that circle a head (a stunned stealer): attach to a person's head group.
  function dizzy() {
    const g = new T.Group();
    for (let i = 0; i < 3; i++) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: starTexture(), depthWrite: false }));
      s.scale.setScalar(0.22);
      g.add(s);
    }
    g.visible = false;
    g.spin = function (t) {
      g.children.forEach((s, i) => {
        const a = t * 5 + (i * Math.PI * 2) / 3;
        s.position.set(Math.cos(a) * 0.38, 0.42 + Math.sin(t * 7 + i) * 0.04, Math.sin(a) * 0.38);
      });
    };
    return g;
  }

  window.HoopsFx = { create, dizzy, burstTexture, starTexture };
})();
