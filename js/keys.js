/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button.
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: "BuckeTT Bros",
  cols: ["Player 1", "Player 2"],
  keys: [
    ["move", "W A S D", "↑ ← ↓ →"],
    ["pass (on defence: switch player)", "F", "J"],
    ["shoot: hold, let go at the top (on defence: jump)", "G", "K"],
    ["crossover (on defence: steal)", "H", "L"],
    ["call your brother", "T", "Enter"],
    ["pause · sound", "P or Esc · M", ""],
  ],
  note: "In 1 player both sets of keys work.",
  touch: "The joystick and the PASS, SHOOT and JUKE buttons show up on a touch screen. Tap your brother's face to call him.",
});
