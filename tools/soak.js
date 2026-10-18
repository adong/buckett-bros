#!/usr/bin/env node
/* Run the headless tests from a terminal, with the same engine files the page loads.
     node tools/soak.js 200                  200 random CPU-vs-CPU games: all must finish, no stuck ball
     node tools/soak.js 20 --maxTime 60      proves the check can fail: games cut off at 60 s are reported
     node tools/soak.js versus kid easy 60   win counts: a little-kid bot (Teddy & Tommy) vs the CPU ladder
*/
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console, Math, Number, JSON, Object, Array, Map, Set };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['js/teams.js', 'js/sim.js', 'js/ai.js', 'js/soak.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx, { filename: f });
}
const H = ctx.Hoops;
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : def;
};

let out;
if (args[0] === 'versus') {
  out = H.versus(args[1] || 'kid', args[2] || 'easy', +(args[3] || 30), { mode: opt('mode', '1p'), noCall: args.includes('--noCall') });
} else {
  const t0 = Date.now();
  out = H.soak(+(args[0] || 50), { maxTime: opt('maxTime') ? +opt('maxTime') : undefined, level: opt('level'), mode: opt('mode') });
  out.wallSeconds = +((Date.now() - t0) / 1000).toFixed(1);
}
console.log(JSON.stringify(out, null, 1));
process.exitCode = out.ok === false ? 1 : 0;
