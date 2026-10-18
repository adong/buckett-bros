/* hoops96-teddy: who plays. Basketball stats for every character, the CPU teams of the 1-player ladder and the
   partners you can pick in 2-player versus. No Three.js here: the headless tests load this file too.
   The looks come from the kit roster, except ZOMBO (the second zombie), whose look game.js makes from the zombie's. */
(function (root) {
  'use strict';
  const H = (root.Hoops = root.Hoops || {});

  // spd: running speed; shoot: jump shots; three: extra for 3-pointers; dunk: hang time; steal / block: defence.
  // he: for the "HE'S ON FIRE!" banner.
  const STATS = {
    teddy: { name: 'TEDDY', spd: 1.0, shoot: 1.08, three: 1.0, dunk: 1.15, steal: 1.0, block: 1.0, he: 'HE' },
    tommy: { name: 'TOMMY', spd: 1.08, shoot: 1.0, three: 1.1, dunk: 1.0, steal: 1.1, block: 0.9, he: 'HE' },
    zoom: { name: 'ZOOM', spd: 1.1, shoot: 0.96, three: 0.95, dunk: 1.0, steal: 1.1, block: 0.9, he: 'HE' },
    luna: { name: 'LUNA', spd: 1.02, shoot: 1.04, three: 1.1, dunk: 0.95, steal: 1.05, block: 0.95, he: 'SHE' },
    bolt: { name: 'BOLT', spd: 0.92, shoot: 1.05, three: 1.15, dunk: 0.95, steal: 0.9, block: 1.05, he: 'HE' },
    bruno: { name: 'BRUNO', spd: 0.94, shoot: 0.94, three: 0.85, dunk: 1.2, steal: 0.95, block: 1.2, he: 'HE' },
    zombie: { name: 'ZOMBIE', spd: 0.9, shoot: 1.0, three: 1.0, dunk: 1.05, steal: 1.25, block: 1.15, he: 'HE' },
    zombo: { name: 'ZOMBO', spd: 0.9, shoot: 1.02, three: 1.05, dunk: 1.0, steal: 1.2, block: 1.1, he: 'HE' },
  };

  const BROTHERS = { id: 'tt', name: 'TEDDY & TOMMY', ids: ['teddy', 'tommy'], color: '#3d8bff', brothers: true };

  // The 1-player ladder, in order. `level` scales the CPU brain a little (the final team is the toughest).
  const LADDER = [
    { id: 'moon', name: 'MOON ROCKETS', ids: ['zoom', 'luna'], color: '#ff3d7f', blurb: 'fast feet, sneaky steals', level: 0.85 },
    { id: 'gears', name: 'GEARS & BEARS', ids: ['bolt', 'bruno'], color: '#ff8a1f', blurb: 'robot threes, bear dunks', level: 1.0 },
    { id: 'dead', name: 'DEAD BALL DUO', ids: ['zombie', 'zombo'], color: '#7bd35a', blurb: 'long zombie arms! the final team', level: 1.2, final: true },
  ];

  // 2-player versus: Teddy captains one team and Tommy the other, and each picks a partner.
  const PARTNERS = ['zoom', 'luna', 'bolt', 'bruno', 'zombie'];

  H.teams = { STATS, BROTHERS, LADDER, PARTNERS, stats: (id) => STATS[id] || STATS.zoom };
})(typeof window !== 'undefined' ? window : globalThis);
