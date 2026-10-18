/* hoops96-teddy: controls. The keyboard for one or two players, and an on-screen joystick and buttons for touch.
   P1: W A S D move, F pass, G shoot (hold, let go at the top), H steal / switch, T call your brother.
   P2: arrows move, J pass, K shoot, L steal / switch, Enter call (numpad 1 2 3 0 work too).
   In 1-player mode both key sets drive P1. Presses are latched until the game reads them, so a tap shorter than one
   frame still counts. snapshot(side) returns { sx, sy, shoot, pass, steal, call }: sx right, sy up the screen. */
(function () {
  'use strict';

  const KEYS = {
    KeyW: [0, 'up'], KeyA: [0, 'left'], KeyS: [0, 'down'], KeyD: [0, 'right'],
    KeyF: [0, 'pass'], KeyG: [0, 'shoot'], KeyH: [0, 'steal'], KeyT: [0, 'call'],
    ArrowUp: [1, 'up'], ArrowLeft: [1, 'left'], ArrowDown: [1, 'down'], ArrowRight: [1, 'right'],
    KeyJ: [1, 'pass'], KeyK: [1, 'shoot'], KeyL: [1, 'steal'], Enter: [1, 'call'], NumpadEnter: [1, 'call'],
    Numpad1: [1, 'pass'], Numpad2: [1, 'shoot'], Numpad3: [1, 'steal'], Numpad0: [1, 'call'],
  };
  const PRESS = { pass: 1, steal: 1, call: 1 };

  const held = [{}, {}]; // [side]['act:code'] so releasing one key doesn't cancel the same action on another
  const latched = [{}, {}];
  const touch = { sx: 0, sy: 0, shoot: false, latched: {} };
  let twoPlayer = false;
  let enabled = true;

  function setKey(code, down, repeat) {
    const m = KEYS[code];
    if (!m) return false;
    const [side, act] = m;
    if (PRESS[act]) {
      if (down && !repeat) latched[side][act] = true;
    } else {
      held[side][act + ':' + code] = down;
      if (act === 'shoot' && down && !repeat) latched[side].shootTap = true;
    }
    return true;
  }

  const heldAct = (side, act) => {
    for (const k in held[side]) if (held[side][k] && k.startsWith(act + ':')) return true;
    return false;
  };

  function snapshot(side) {
    const out = { sx: 0, sy: 0, shoot: false, pass: false, steal: false, call: false };
    if (!enabled) return out;
    const srcs = side === 0 && !twoPlayer ? [0, 1] : [side];
    for (const s of srcs) {
      if (heldAct(s, 'left')) out.sx -= 1;
      if (heldAct(s, 'right')) out.sx += 1;
      if (heldAct(s, 'up')) out.sy += 1;
      if (heldAct(s, 'down')) out.sy -= 1;
      if (heldAct(s, 'shoot') || latched[s].shootTap) out.shoot = true;
      latched[s].shootTap = false;
      for (const a in PRESS) {
        if (latched[s][a]) out[a] = true;
        latched[s][a] = false;
      }
    }
    out.sx = Math.max(-1, Math.min(1, out.sx));
    out.sy = Math.max(-1, Math.min(1, out.sy));
    if (side === 0) {
      if (Math.abs(touch.sx) + Math.abs(touch.sy) > 0.01) {
        out.sx = touch.sx;
        out.sy = touch.sy;
      }
      if (touch.shoot || touch.latched.shootTap) out.shoot = true;
      touch.latched.shootTap = false;
      for (const a in PRESS) {
        if (touch.latched[a]) out[a] = true;
        touch.latched[a] = false;
      }
    }
    const len = Math.hypot(out.sx, out.sy);
    if (len > 1) { out.sx /= len; out.sy /= len; }
    return out;
  }

  // Menu helpers: was this key pressed (and not yet read)?
  function clear() {
    for (const s of [0, 1]) {
      for (const k in held[s]) held[s][k] = false;
      for (const k in latched[s]) latched[s][k] = false;
    }
    touch.sx = touch.sy = 0;
    touch.shoot = false;
    for (const k in touch.latched) touch.latched[k] = false;
  }

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (setKey(e.code, true, e.repeat) && (e.code.startsWith('Arrow') || e.code === 'Enter')) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => setKey(e.code, false, false));
  window.addEventListener('blur', clear);

  // ---------------------------------------------------------------- touch: a joystick and big buttons

  function capture(el, e) {
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events have no active pointer */ }
  }

  function bindTouch(stick, knob, buttons) {
    let finger = null;
    const R = () => stick.getBoundingClientRect();
    const move = (e) => {
      const r = R();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2, rad = r.width / 2;
      let dx = (e.clientX - cx) / rad, dy = (e.clientY - cy) / rad;
      const len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
      const dead = len < 0.15;
      touch.sx = dead ? 0 : dx;
      touch.sy = dead ? 0 : -dy;
      knob.style.transform = `translate(${dx * rad * 0.55}px, ${dy * rad * 0.55}px)`;
    };
    const release = (e) => {
      if (e.pointerId !== finger) return;
      finger = null;
      touch.sx = touch.sy = 0;
      knob.style.transform = '';
      stick.classList.remove('on');
    };
    stick.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      finger = e.pointerId;
      capture(stick, e);
      stick.classList.add('on');
      move(e);
    });
    stick.addEventListener('pointermove', (e) => { if (e.pointerId === finger) move(e); });
    stick.addEventListener('pointerup', release);
    stick.addEventListener('pointercancel', release);
    for (const b of buttons) {
      const act = b.dataset.act;
      const up = () => {
        if (act === 'shoot') touch.shoot = false;
        b.classList.remove('down');
      };
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        capture(b, e);
        if (act === 'shoot') {
          touch.shoot = true;
          touch.latched.shootTap = true;
        } else touch.latched[act] = true;
        b.classList.add('down');
      });
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', up);
    }
  }

  window.HoopsInput = {
    snapshot, clear, bindTouch, KEYS,
    setTwoPlayer(on) { twoPlayer = !!on; },
    setEnabled(on) { enabled = !!on; },
  };
})();
