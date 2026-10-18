# BuckeTT Bros

An arcade 2-on-2 street basketball game starring Teddy and Tommy, on a half court with one hoop, a chain net, chain-link fences and TEDDY / TOMMY / METRO graffiti, at sunset. It's inspired by the 90s arcade street-ball games, with our own names and art. It's built with Claude Code from plain JavaScript and Three.js, on the shared Claude Games kit.
There are no image, model or audio files: the players are the kit's blocky characters, every texture is painted on a canvas, and every sound is synthesised.
The brothers are a team: you play whoever has the ball, the other brother plays alongside you, and calling him in sets up an **ALLEY-OOP!**

The name lives in one constant, `HOOPS_TITLE` in `js/title.js`, and the logo and the page title read it from there.

## Play

- **Double-click `index.html`.** It works offline because Three.js and the kit are copied into `kit/`. Without internet the title font falls back to Arial Black.
- **Send one file:** `dist/buckett-bros.html` is the whole game inlined, about 830 KB. AirDrop or email it, then open it in a browser.
- Rebuild that file after any edit: `python3 kit/tools/bundle.py . --name buckett-bros`

### Modes

- **▶ 1 PLAYER:** Teddy & Tommy against the CPU. You control whichever brother has the ball (the camera-side marker says **1P**), and the computer plays the other one.
- **👫 2P TEAM:** two kids on one keyboard, on the same team. Player 1 is always Teddy and player 2 is always Tommy.
- **⚔️ 2P VERSUS:** Teddy's team against Tommy's team. Each brother picks a partner (Zoom, Luna, Bolt, Bruno or the Zombie), and each kid plays whoever on their team has the ball.

In 1-player and team mode you climb a ladder of three CPU teams: **MOON ROCKETS** (Zoom & Luna), **GEARS & BEARS** (Bolt the robot & Bruno the bear), then the final team, the silly **DEAD BALL DUO** (Zombie & Zombo). Beat them all and you're **🏆 CHAMPIONS!** You can also pick any team to play straight away.

### Levels

- **🐣 EASY**, for little players like Tommy (5): first to 11 and a 20-second shot clock. Shots are timed for you: press shoot and the release is perfect. The CPU is slow, rarely steals and hardly blocks. When you stand still on defence, your player drifts to his man by himself. Your brother is ready to help again 3 s after he leaves.
- **🔥 NORMAL**, for big kids like Teddy (8): first to 21 and a 14-second shot clock, with a **shot meter**. The CPU is quicker, steals, blocks, attacks open lanes, and each ladder team is a bit sharper than the last. Your brother rests 15 s between combos.
- **↩️ CLEAR THE BALL** (off by default): the street rule where, after a steal or a rebound, you must take the ball back past the 3-point line before you can shoot. A "CLEAR IT!" hint says so.

## Controls

| | Player 1 | Player 2 | Touch (player 1) |
|---|---|---|---|
| move | W A S D | arrows | the joystick |
| pass (to the teammate the stick points at) | F | J | 👐 PASS |
| shoot: hold, let go at the top (dunk when close) | G | K | 🏀 SHOOT (💥 DUNK when close) |
| crossover juke (with the ball) | H | L | 💨 JUKE |
| on defence: jump / block | G | K | 🙌 JUMP |
| on defence: steal (switch player if nobody's close) | H | L | ✋ STEAL |
| on defence: switch player | F | J | 🔄 SWITCH |
| call your brother | T | Enter | tap his face |

- Movement is from the camera's point of view: W / ↑ runs up the screen, towards the hoop.
- In 1-player mode both key sets control you, so arrows + J K L (and Enter) work too. Player 2 can also use numpad 1 2 3 0.
- **P** or Esc pauses, and **M** turns the sound on or off. In a game the ❚❚ and 🔊 buttons in the corner do the same, and every menu screen has its own 🔊 button in the top-right corner.
- **Menus:** on the title screen, Enter or 1 is 1 player, 2 is team, 3 is versus, ← → change the level and C switches the clear rule. On team select, A D or ← → pick the rival (in versus, A D for player 1's partner and ← → for player 2's), and Enter plays.
- **Touch:** the joystick and buttons appear on phones and tablets. The button labels change with the play (SHOOT or DUNK with the ball, JUMP / SWITCH / STEAL on defence). Two players need a keyboard.

## Moves

- **Dribble** wherever you run. You're a little slower with the ball, and running straight into a defender who's between you and the hoop slows you down: go round him, or **juke** past him (H): a burst of speed, and any steal misses while you do it.
- **Pass** goes to your teammate, and control switches to whoever catches it, like the arcade games. A defender standing in the passing lane can pick it off.
- **Jump shot**: Teddy's `jumpshot` pose. On Normal, hold shoot and let go when the meter beside you is in the green: **PERFECT!**, GOOD!, or EARLY! / LATE!. Timing, distance and a hand in your face decide whether it goes in. Inside the arc it's 2 points, from outside it's **3**.
- **Dunk**: press shoot close to the hoop (inside about 3.3 m) for an over-the-top flying dunk (a spin, a tomahawk, a windmill or a two-hander), with a star trail, **SLAM!**, stars, confetti and a camera shake. You hang on the rim for a moment.
- **Steal**: H next to the ball handler. Miss and you're off balance for a moment, and a handler who just felt a reach protects the ball.
- **Block**: jump (G) when the shooter goes up, standing between him and the hoop. Dunks can be blocked too, but rarely.
- **Rebounds**: missed shots clank off the rim and the backboard. Whoever gets there first grabs it, and jumping grabs it higher.

## Arcade rules

- 2-point and 3-point baskets. First to **21** (Normal) or **11** (Easy) wins, with no fouls (kid rules).
- After a basket the other team checks the ball at the top of the key.
- **Shot clock**: 14 s (20 s on Easy). It resets when the ball hits the rim or the other team gets it. If it runs out, the buzzer goes and the other team gets the ball.
- **HE'S ON FIRE!** Score three baskets in a row (without the other team scoring) and you're on fire: flames, a burning ball, a little extra speed, and your shots almost always drop. It lasts until the other team scores. (Luna gets SHE'S ON FIRE!)
- **Celebrations**: Teddy does his Mike Tyson-style **boxing** combo after a dunk, and Tommy does his **Y pose with peace fingers** (比耶) after a 3-pointer. Everyone else pumps their fists. Celebrating players turn to face the camera so you see them.

## Call your brother (companion mode)

Both brothers are already on the court, so calling the companion (T, Enter for player 2, or tapping his face) starts a **team ALLEY-OOP combo** for 10 seconds instead.

- The brother you're *not* controlling is the helper. A name tag pops up over him, the HUD bar with his face turns green, and he **hands you a treat** (🍦 💧 🧃 🍪 🍉 🍌) with a toast like "🍪 COOKIE FROM TOMMY!". You hold it while you play.
- **Call him with the ball near the hoop** (inside about 8.5 m) and you flip it to him and he lobs it straight back: **ALLEY-OOP!** You fly up and slam it.
- During the combo he never keeps the ball. Pass to him and it comes back as a perfect pass, as an alley-oop when you're in range. If he grabs a rebound or a steal, he hands it to you.
- **Your next shot or dunk is guaranteed** ("SURE SHOT!").
- **He's got your back:** the first steal or block the other team would make against your team is cancelled, "TOMMY SAVED IT!" (or "TEDDY SAVED IT!"), and the attacker goes dizzy for a moment.
- Afterwards he rests (3 s on Easy, 15 s on Normal). His face goes grey and the bar refills. Pressing too early wiggles the bar.
- In 1-player mode the helper is always the brother you're not steering: if control switches to him on defence, the two swap roles.

**2P versus:** each team's call brings in its captain's brother as a small **bonus sixth player**. Team Teddy gets a mini Tommy, and Team Tommy gets a mini Teddy. He runs onto a wing, hands his captain a treat, and **only passes**: pass to him and he passes straight back, as an alley-oop if you're near the hoop. Nobody can steal from him or pick off his passes, and he saves one steal or block for his team. He stays 10 s, then needs **20 s** of rest for fairness. Each team has its own bar.

## Make it yours

- `js/title.js`: the game's name and tagline.
- `js/teams.js`: each character's speed, shooting, 3-point, dunk, steal and block stats, the CPU ladder and the versus partners. The looks come from the kit roster, so a new kit character needs one line here.
- `js/sim.js`, top of the file: court sizes, jump and shot timings, the CPU levels (`LEVELS`), the kids' steal and block chances (`HUMAN`) and the rules for each level (`RULES`: points to win, shot clock, companion rest).
- `js/ai.js`: how the CPU decides to shoot, pass, drive, guard, help and rebound.

## How it works, and how it's tested

- The engine (`js/sim.js` and `js/ai.js`) has no Three.js in it. A game is plain state stepped at a fixed 60 ticks a second, and the same code runs the browser game and the headless tests.
  - Players have a small set of actions: free (run or dribble), juke, pass, steal, shoot, jump, dunk, alley-oop, hang, fall, land, stun and celebrate.
  - Shots are decided when the ball leaves the hand (from range, meter timing, a defender in your face, stats and fire). Makes fly an exact arc into the rim. Misses aim at a spot on the rim and bounce off it with a random kick, so rebounds are lively but can't get stuck on the rim.
  - Loose balls are real physics: gravity, bouncing on the court, the fences and the backboard. A safety net hands a ball nobody touches for 8 s to the nearest player and counts it, and the tests check that count stays at zero.
- The renderer (`js/game.js`) only reads game state, and it turns engine events into effects, sounds, banners and camera shake. A CPU-vs-CPU demo plays behind the menus.
- Console hooks (`window.game`):

```js
game.soak(100)                         // 100 random headless CPU-vs-CPU games: all must finish, no stuck ball
game.soak(20, { mode: 'vs' })          // the same with test bots pressing the keys in versus (or '1p', 'coop')
game.soak(20, { maxTime: 60 })         // proves the check can fail: games cut off at 60 s are reported
game.versus('kid', 'easy', 50)         // win counts: a little-kid bot as Teddy & Tommy vs the CPU ladder
game.start({ mode: '1p', level: 'normal', rival: 2 })   // jump straight into a game (partners: [i, j] for versus)
game.step(2)                           // advance 2 s and draw (when the browser tab's animation is throttled)
game.hold(true)                        // freeze the live loop, so only game.step() moves time
game.setup('dunk')                     // stage a moment for a screenshot: 'dunk', 'jumpshot', 'oop', 'block'
game.autoplay('kid')                   // let a test bot press the keys for the kids' side; autoplay(false) stops
game.state()                           // score, phase, ball, players, combo
```

- The same tests run from a terminal with Node, using the same engine files: `node tools/soak.js 200`, `node tools/soak.js 100 --mode vs`, `node tools/soak.js versus kid normal 60`.
- At the last check:
  - 200 random CPU-vs-CPU games, plus 100 each of 1-player, team and versus with bots pressing the keys, all finished. No ball needed rescuing, the longest a ball stayed loose was about 3 s, and no team held the ball longer than the 20-second Easy shot clock without a shot going up. A game to 21 takes about 2 minutes of game time (from 36 s to 4 minutes).
  - Cutting games off at 60 s makes the soak report all 20 as unfinished, so the check can fail.
  - The "kid" bot (wanders, reacts every 0.3–0.7 s, rough meter timing, mashes steal) won 60 of 60 on Easy (about 12–3) and 54 of 60 on Normal (about 21–12). The "good" bot won 60 of 60 on Easy and 59 of 60 on Normal. The bots steer perfectly when they do move, so real kids will find Normal harder than this. `LEVELS.normal` in `js/sim.js` is the knob.
  - A whole game in each mode was also played through the real renderer in the browser (with `game.autoplay`), to the results screen, with no console errors.

## Files

```
index.html         page, HUD, menus, touch controls (CSS inline)
js/title.js        the game's name (one constant) and tagline
js/teams.js        character stats, the CPU ladder, versus partners
js/sim.js          the engine: court, players, ball, shots, dunks, passes, steals, blocks, rules, ON FIRE, the companion
js/ai.js           the CPU players: handler, off-ball, man-to-man defence with help, rebounds, the bonus passer
js/soak.js         headless test runner and the test bots (game.soak, game.versus)
js/input.js        keyboard for two players, touch joystick and buttons
js/poses.js        basketball poses on top of Kit.people.pose
js/court.js        the street court: painted court, hoop and chain net, fences, graffiti walls, lamps, skyline, sunset
js/fx.js           particles, comic bursts (SLAM!, BLOCKED!), stars, +2 / +3, dizzy stars
js/sfx.js          game sounds on top of Kit.sound
js/game.js         scene, camera, drawing, events to effects, HUD, screens, main loop, window.game hooks
tools/soak.js      runs the headless tests under Node
kit/               copy of ~/claude-games/kit (python3 ../kit/tools/sync.py .), never edited here
dist/buckett-bros.html    the single-page build
```

## Kit candidates

These live in this game's own JS for now. They could move into `~/claude-games/kit` if another game wants them:

- **Basketball poses** (`js/poses.js`): `dribble` (synced to the ball's bounce), `hold`, `defend` (wide stance, arms out), `pass`, `steal`, `block`, `dunk` in four styles (spin, tomahawk, windmill, two-hand), `hang` on the rim, `fall`, `land`, `stun` (dizzy wobble) and `cheer`. There's also a `drive()` helper that eases leg spread, head tilt and rig height, which `Kit.people.pose` doesn't touch, and steadies the feet for the kit's standing celebrations.
- **A dribbled ball** (`syncBall` in `js/game.js`): the ball bounces between `Kit.people.handWorld` and the floor, in time with the arm, with a thump each bounce.
- **The hoop** (`js/court.js`): a backboard, a rim, and a chain net made of line segments that stretches and swings when the ball goes through.
- **Graffiti walls** (`graffitiTexture` in `js/court.js`): a brick wall with spray-paint bubble letters, drips, stars and a basketball tag.
- **Sounds** (`js/sfx.js`): `dribble`, `squeak`, `clank` (rim), `board`, `slam`, `buzzer`, `whistle`, `cheer`, `fire`.
- **Effects** (`js/fx.js`): a point-sprite particle pool with its own fade, comic starbursts with a word, flying stars, floating text.
- **ZOMBO**: a second zombie, recoloured from the kit's zombie (`initRoster` in `js/game.js`), for when a game needs two.

## Not verified

- **Sound**: the synth code runs without errors, but nobody listened to it. (The test browser had the shared kit mute switched on.)
- **Real touch devices**: the joystick, buttons and the brother's face button were tested in the browser's phone emulation (740×360) with synthetic pointer events, not on a real phone or iPad. Two thumbs at once (stick and button) is untested.
- **Double-click from Finder (`file://`)**: the page only uses classic `<script src>` tags and no network requests apart from the Google font, but it was tested over `http://localhost`, because the test browser can't drive `file://` pages.
- **Real kids**: the balance numbers come from test bots. How hard Normal feels for Teddy needs Teddy.
