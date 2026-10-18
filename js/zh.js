/* 中文 for BuckeTT Bros: every word on the page, the banners and toasts, the 3D word bursts and the ? panel
   (Kit.lang, from kit/lang.js). Page text translates by itself; js/fx.js and js/game.js ask Kit.lang.t() for the
   words they paint on canvases.
   Stays in English on purpose: the game's name and logo (Alan picked it), the kids' and friends' names, and the
   street art on the walls (TEDDY / TOMMY / METRO / HOOPS graffiti, the TT court logo, the TT COURT backboard). */
(function () {
  const L = Kit.lang;
  const t = (s) => L.t(s);

  L.keep([
    'BuckeTT Bros', 'Claude Code', 'TEDDY', 'TOMMY', 'Teddy', 'Tommy', 'ZOOM', 'LUNA', 'BOLT', 'BRUNO', 'ZOMBO',
    'TEDDY & TOMMY', 'VS', 'Esc', 'TT',
  ]);

  // team names (the scoreboard, team select, results) and the one friend whose name is a word
  const TEAM = {
    'MOON ROCKETS': '月亮火箭队', 'GEARS & BEARS': '齿轮小熊队', 'DEAD BALL DUO': '僵尸二人组',
    'TEAM TEDDY': 'TEDDY 队', 'TEAM TOMMY': 'TOMMY 队', ZOMBIE: '僵尸',
  };
  L.add(TEAM);

  L.add({
    // title screen
    "Teddy & Tommy's 2-on-2 street hoops": 'Teddy 和 Tommy 的二对二街头篮球',
    '▶ 1 PLAYER': '▶ 单人', 'you + your brother vs the CPU': '你和兄弟一起打电脑',
    '👫 2P TEAM': '👫 双人组队', 'Teddy & Tommy together vs the CPU': 'Teddy 和 Tommy 一起打电脑',
    '⚔️ 2P VERSUS': '⚔️ 双人对战', "Teddy's team vs Tommy's team": 'Teddy 队对 Tommy 队',
    LEVEL: '难度', Difficulty: '难度',
    'first to 11 · shots aimed for you · slow CPU': '先到 11 分 · 自动瞄准 · 电脑慢',
    'first to 21 · shot meter · quick CPU': '先到 21 分 · 投篮力度条 · 电脑快',
    'CLEAR THE BALL': '先带出三分线',
    'off: after a steal or rebound, just go!': '关：抢断或抢到篮板后，直接进攻！',
    'on: after a steal or rebound, take it past the arc first': '开：抢断或抢到篮板后，先把球带出三分线',
    'PLAYER 1': '玩家 1', 'PLAYER 2': '玩家 2',
    'pass · (defence: switch)': '传球 ·（防守时：换人）',
    'shoot / dunk · (defence: jump)': '投篮 / 扣篮 ·（防守时：跳）',
    'hold, let go at the top': '按住，跳到最高时松开',
    'steal · (with the ball: crossover)': '抢断 ·（拿球时：变向过人）',
    "Stick to run. 🏀 shoot (dunk when you're close), 👐 pass, ✋ steal. Tap your brother's face for an ALLEY-OOP! Two players need a keyboard.":
      '用摇杆跑。🏀 投篮（离篮筐近就扣篮），👐 传球，✋ 抢断。点兄弟的头像，来个空中接力！两个人玩要用键盘。',
    // team select
    'PICK YOUR RIVALS': '选择对手', 'PICK YOUR PARTNERS': '选择队友', YOU: '你', CPU: '电脑', Teams: '球队',
    'you play whoever has the ball': '谁拿球你就操控谁', 'P1 Teddy · P2 Tommy': '玩家 1 Teddy · 玩家 2 Tommy',
    'fast feet, sneaky steals': '跑得快，爱偷球', 'robot threes, bear dunks': '机器人投三分，小熊扣篮',
    'long zombie arms! the final team': '僵尸手臂好长！最后一关',
    'GAME 1': '第 1 场', 'GAME 2': '第 2 场', '★ FINAL': '★ 决赛', 'BOO!': '哇呜！',
    'alley-oop combo': '空中接力组合', 'bonus passer': '传球小帮手',
    '← ↑ → ↓ · J K L · Enter': '← ↑ → ↓ · J K L · 回车',
    '◀ BACK': '◀ 返回', 'PLAY!': '开始！',
    'Tap a team ·': '点一个队 ·', 'Tap a partner · 1P': '点一个队友 · 1P', 'play ·': '开始 ·', back: '返回',
    // the scoreboard and the brother's bar
    'ALLEY-OOP': '空中接力', BUDDY: '小帮手', ENTER: '回车', 'T · ENTER': 'T · 回车',
    'Pause (P)': '暂停 (P)', 'Sound (M)': '声音 (M)', 'Sound on / off (M)': '声音 开 / 关 (M)', 'Sound on or off': '声音开关',
    // banners and callouts
    'GAME ON!': '比赛开始！', 'ALLEY-OOP!': '空中接力！', 'ALLEY-OOP TIME!': '空中接力时间！', 'GAME POINT!': '赛点！',
    "HE'S ON FIRE!": '他火力全开！', "SHE'S ON FIRE!": '她火力全开！', 'CHAMPIONS!': '冠军！', 'SHOT CLOCK!': '进攻超时！',
    'CLEARED ✓': '带出去了 ✓',
    // hints at the bottom
    'shoot ·': '投篮 ·', 'pass ·': '传球 ·', 'steal ·': '抢断 ·', shoot: '投篮',
    'call your brother for an ALLEY-OOP!': '叫兄弟来个空中接力！',
    'Call your bonus passer: 1P': '叫传球小帮手：1P', 'pass · 2P': '传球 · 2P',
    '. Pass to him and he passes right back!': '。传给他，他马上传回来！', 'ALLEY-OOP combo!': '空中接力组合！',
    '↩️ CLEAR IT! Take it past the 3-point line': '↩️ 先带出去！把球带出三分线',
    '↩️ CLEAR IT! Take it past the 3-point line first': '↩️ 先带出去！先把球带出三分线再投',
    // shot timing
    'PERFECT!': '完美！', 'GOOD!': '不错！', 'EARLY!': '太早啦！', 'LATE!': '太晚啦！',
    // the touch buttons (they change with the play)
    SHOOT: '投篮', DUNK: '扣篮', PASS: '传球', JUKE: '过人', JUMP: '跳', SWITCH: '换人', STEAL: '抢断', CALL: '喊人',
    // pause and results
    'P · Esc · Space to resume · Q for the menu · M sound': 'P · Esc · 空格 继续 · Q 回菜单 · M 声音',
    '🏆 CHAMPIONS!': '🏆 冠军！', PTS: '得分', DUNKS: '扣篮', '3s': '三分', STEALS: '抢断', BLOCKS: '盖帽',
    'NEXT TEAM ▶': '下一队 ▶', '↻ REMATCH': '↻ 再比一场', '↻ TRY AGAIN': '↻ 再试一次',
    'Enter: next / rematch · Esc: menu': '回车：下一队 / 再比一场 · Esc：菜单',
    'LOADING…': '加载中…', '↻ Turn sideways for a bigger court!': '↻ 把屏幕横过来，球场更大！',
    // the words painted in 3D over the court (js/fx.js, js/game.js)
    'THREE!': '三分！', 'SWISH!': '唰！', 'NICE!': '漂亮！', 'SLAM!': '扣篮！', 'BLOCKED!': '盖帽！', 'STEAL!': '抢断！',
    'PASS!': '传球！',
    // the ? panel (js/keys.js)
    'pass (on defence: switch player)': '传球（防守时：换人）',
    'shoot: hold, let go at the top (on defence: jump)': '投篮：按住，跳到最高时松开（防守时：跳）',
    'crossover (on defence: steal)': '变向过人（防守时：抢断）',
    "The joystick and the PASS, SHOOT and JUKE buttons show up on a touch screen. Tap your brother's face to call him.":
      '触屏上会出现摇杆和传球、投篮、过人按钮。点兄弟的头像叫他来。',
  });

  // text with names, team names or numbers in it
  const TREAT = { 'ICE CREAM': '冰淇淋', WATER: '水', 'JUICE BOX': '果汁', COOKIE: '饼干', WATERMELON: '西瓜', BANANA: '香蕉' };
  L.rule(/^FIRST TO (\d+)$/, '先到 $1 分');
  L.rule(/^(TEDDY|TOMMY) & (\w+)$/, (m, a, b) => `${a} & ${t(b)}`);
  L.rule(/^🔥 (.+) 🔥$/, (m, who) => `🔥 ${t(who)} 🔥`);
  L.rule(/^(.+): SURE SHOT!$/, (m, who) => `${t(who)}：必进球！`);
  L.rule(/^(.+) BLOCK!$/, (m, who) => `${t(who)} 盖帽！`);
  L.rule(/^(.+) STEAL!$/, (m, who) => `${t(who)} 抢断！`);
  L.rule(/^(.+) COOLED OFF$/, (m, who) => `${t(who)} 火灭啦`);
  L.rule(/^(.+) IS HERE!$/, (m, who) => `${t(who)} 来啦！`);
  L.rule(/^(.+) SAVED IT!$/, (m, who) => `${t(who)} 帮你守住了！`);
  L.rule(/^(.+) WIN!$/, (m, team) => `${t(team)} 赢了！`);
  L.rule(/^(.+): PASS ME THE BALL!$/, (m, who) => `${t(who)}：把球传给我！`);
  L.rule(/^(.+) JOINS (.+): PASS TO (.+)!$/, (m, who, team, to) => `${t(who)} 加入 ${t(team)}：传球给 ${t(to)}！`);
  L.rule(/^(\S+) (ICE CREAM|WATER|JUICE BOX|COOKIE|WATERMELON|BANANA) FROM (.+)!$/, (m, emoji, item, who) => `${emoji} ${t(who)} 送来的${TREAT[item]}！`);
  L.rule(/^(.+) · You beat every team on the street!$/, '$1 · 整条街的队都被你打败啦！');
  L.rule(/^(.+) · Next up: (.+)$/, (m, sc, team) => `${sc} · 下一个对手：${t(team)}`);
  L.rule(/^(.+) · So close! Have another go!$/, '$1 · 差一点点！再来一次！');
  L.rule(/^Oops, something broke: (.*)$/, '哎呀，出错了：$1');
})();
