/* hoops96-teddy: game sounds, synthesised with the kit's Kit.sound.tone / hiss (so mute and volume are shared with the
   other games). Kit.sound already has swish (the net), punch, bump, jump, land, coin, powerup, swipe and click.
   Kit candidates: dribble, squeak, clank, buzzer, whistle, slam, cheer. */
(function () {
  'use strict';
  const S = () => window.Kit.sound;

  const sfx = {
    // a basketball on asphalt: a low thump with a little slap on top
    dribble(v) {
      const k = Math.min(1, v || 1);
      S().tone({ f: 120, to: 62, dur: 0.09, vol: 0.32 * k });
      S().hiss({ filter: 'bandpass', f: 1400, q: 1.2, dur: 0.03, vol: 0.05 * k });
    },
    squeak() { S().tone({ type: 'sine', f: 2100 + Math.random() * 500, to: 2700, dur: 0.07, vol: 0.035 }); },
    pass() { S().hiss({ f: 1800, to: 900, q: 1.3, dur: 0.12, vol: 0.09 }); },
    catch() {
      S().tone({ f: 200, to: 120, dur: 0.05, vol: 0.18 });
      S().hiss({ filter: 'highpass', f: 2500, dur: 0.03, vol: 0.06 });
    },
    // off the rim: a metal clank
    clank() {
      S().tone({ type: 'square', f: 620, to: 480, dur: 0.16, vol: 0.06, lp: 2400 });
      S().tone({ type: 'triangle', f: 1240, to: 1180, dur: 0.3, vol: 0.07 });
      S().tone({ f: 180, to: 90, dur: 0.12, vol: 0.15 });
    },
    board() { S().tone({ type: 'triangle', f: 240, to: 150, dur: 0.12, vol: 0.2 }); },
    swish() {
      S().swish();
      S().tone({ type: 'triangle', f: 1568, dur: 0.15, vol: 0.05, at: 0.08 });
    },
    // the dunk: a rim-rattling bang
    slam() {
      S().punch();
      S().tone({ type: 'square', f: 300, to: 110, dur: 0.3, vol: 0.08, lp: 1800 });
      S().hiss({ filter: 'lowpass', f: 3500, to: 600, dur: 0.35, vol: 0.25 });
      S().tone({ type: 'triangle', f: 980, to: 900, dur: 0.45, vol: 0.06, at: 0.03 });
    },
    block() {
      S().punch();
      S().tone({ type: 'sine', f: 220, to: 660, dur: 0.18, vol: 0.12, at: 0.05 });
    },
    steal() { S().swipe(); S().tone({ type: 'square', f: 880, to: 1320, dur: 0.1, vol: 0.05, at: 0.05 }); },
    whiff() { S().hiss({ f: 1400, to: 700, q: 1, dur: 0.1, vol: 0.06 }); },
    jump() { S().tone({ type: 'square', f: 240, to: 420, dur: 0.1, vol: 0.04, lp: 1800 }); },
    land() { S().land(); },
    // the shot clock running out
    buzzer() {
      S().tone({ type: 'sawtooth', f: 196, dur: 0.75, vol: 0.12, lp: 1300, attack: 0.01 });
      S().tone({ type: 'square', f: 98, dur: 0.75, vol: 0.06, lp: 800, attack: 0.01 });
    },
    whistle() {
      S().tone({ type: 'sine', f: 2350, dur: 0.18, vol: 0.09 });
      S().tone({ type: 'sine', f: 2350, dur: 0.28, vol: 0.09, at: 0.22 });
    },
    // points on the board: a little coin run, three notes for a three
    score(pts) {
      const notes = pts === 3 ? [784, 988, 1175, 1568] : [659, 880, 1175];
      notes.forEach((f, i) => S().tone({ type: 'square', f, dur: 0.12, vol: 0.05, lp: 3000, at: 0.1 + i * 0.07 }));
    },
    cheer(big) {
      S().hiss({ f: 1300, to: 1700, q: 0.6, dur: big ? 1.8 : 1.1, vol: big ? 0.14 : 0.09, attack: 0.12 });
      S().hiss({ f: 600, to: 900, q: 0.8, dur: big ? 1.6 : 0.9, vol: 0.07, attack: 0.15 });
    },
    fire() {
      S().hiss({ filter: 'lowpass', f: 500, to: 3000, dur: 0.7, vol: 0.25, attack: 0.08 });
      [523, 659, 784, 1047].forEach((f, i) => S().tone({ type: 'sawtooth', f, dur: 0.16, vol: 0.04, lp: 2600, at: i * 0.08 }));
    },
    // the brother arrives for the combo
    combo() {
      [659, 784, 988, 1319].forEach((f, i) => S().tone({ type: 'triangle', f, dur: 0.14, vol: 0.12, at: i * 0.07 }));
      S().hiss({ f: 1200, to: 3200, dur: 0.3, vol: 0.06 });
    },
    treat() { S().powerup(); },
    save() {
      S().tone({ type: 'triangle', f: 330, to: 260, dur: 0.1, vol: 0.18 });
      S().tone({ type: 'sine', f: 880, to: 1320, dur: 0.2, vol: 0.1, at: 0.06 });
    },
    nope() { S().tone({ type: 'square', f: 220, to: 180, dur: 0.12, vol: 0.05, lp: 1200 }); },
    click() { S().click(); },
    win() {
      [[523, 0], [659, 0.15], [784, 0.3], [1047, 0.45], [784, 0.65], [1047, 0.8], [1319, 1.0]].forEach(([f, at]) => {
        S().tone({ type: 'square', f, dur: 0.22, vol: 0.06, lp: 2600, at });
        S().tone({ type: 'triangle', f: f / 2, dur: 0.25, vol: 0.1, at });
      });
      sfx.cheer(true);
    },
    lose() { [523, 440, 349].forEach((f, i) => S().tone({ type: 'triangle', f, dur: 0.3, vol: 0.1, at: i * 0.22 })); },
  };

  window.HoopsSfx = sfx;
})();
