/* Naadamy pixel icons: every icon in the game is our own pixel art, drawn in code (no emoji fonts, no image files).
   Sprites are 14×14 colour grids; a dark outline is added around them automatically so they all read the same way.
   Emoji characters that are still written in the source code (data, labels, toasts) are swapped for these icons
   wherever they are shown: in the page (text, buttons, toasts) and on canvases (name tags, chat bubbles). */
(function (TG) {
  const OUT = '#2b1e2e';
  const PAL = {
    k: '#2b1e2e', w: '#ffffff', W: '#f4efe3', e: '#d3d3dc', a: '#a5a5b0', A: '#77778a',
    r: '#e14b3d', R: '#a8312a', o: '#f39b2c', O: '#c46d12', y: '#f7c646', Y: '#c98f22', l: '#fde58a',
    g: '#76b947', G: '#3f7a2c', L: '#a6dc6a', b: '#3f76db', B: '#2b52a5', c: '#93d4f6', C: '#4aa6e2',
    p: '#a97de9', P: '#7d57c4', i: '#f492ba', I: '#c2427e', n: '#a46d3b', N: '#6b4220', m: '#c99257',
    s: '#edbb93', S: '#c98a5e', h: '#3a2516', H: '#6a4630', t: '#f6dca8', T: '#d8ab6c', u: '#5b361a', x: '#1e1a22', v: '#8a5a33',
  };

  // ------------------------------------------------------------ 14×14 sprites (outline added automatically)
  const SPR = {
    star: ['......yy......', '.....yyyy.....', '.....ylyy.....', '....yllyyy....', 'yyyyylyyyyyyyy', '.yllllyyyyyyY.', '..yllyyyyyyY..', '...yyyyyyyY...', '...yyyyyyyY...', '..yyyyyYyyyY..', '..yyyY..YyyY..', '.yyYY....YYyY.', '.yY........YY.', '..............'],
    star_glow: ['w.....yy.....w', '.....yyyy.....', '.....ylyy.....', '....ylwyyy....', 'yyyyylwyyyyyyy', '.yllllyyyyyyY.', '..yllyyyyyyY..', '...yyyyyyyY...', '...yyyyyyyY...', '..yyyyyYyyyY..', '..yyyY..YyyY..', '.yyYY....YYyY.', '.yY........YY.', 'w............w'],
    sparkles: ['....y.........', '....y.........', '..yylyy.......', '....y.....y...', '....y.....y...', '.........yly..', '........yylyy.', '.........yly..', '..y.......y...', '..y.......y...', 'yylyy.........', '..y...........', '..y...........', '..............'],
    heart: ['..............', '..rrr....rrr..', '.rrwrr..rrrrr.', 'rrwrrrrrrrrrrR', 'rrrrrrrrrrrrrR', 'rrrrrrrrrrrrrR', '.rrrrrrrrrrrR.', '..rrrrrrrrrR..', '...rrrrrrrR...', '....rrrrrR....', '.....rrrR.....', '......rR......', '..............', '..............'],
    smile: ['....yyyyyy....', '..yyyyyyyyyy..', '.yyyyyyyyyyyy.', '.yylyyyyyyyyy.', 'yylyyxyyyxyyyY', 'yyyyyxyyyxyyyY', 'yyyyyyyyyyyyyY', 'yyyiyyyyyyiyyY', 'yyyyxyyyyxyyyY', '.yyyyxxxxyyyY.', '.yyyyyyyyyyYY.', '..yyyyyyyyYY..', '....YYYYYY....', '..............'],
    laugh: ['....yyyyyy....', '..yyyyyyyyyy..', '.yyyyyyyyyyyy.', '.yyxyyyyyyxyy.', 'yyxyxyyyyxyxyY', 'cyyyyyyyyyyyyc', 'ccyyyyyyyyyycc', 'yyykkkkkkkkyyY', 'yyykwwwwwwkyyY', '.yykrrrrrrkyY.', '.yyykrrrrkyYY.', '..yyykkkkyYY..', '....YYYYYY....', '..............'],
    wow: ['....yyyyyy....', '..yyyyyyyyyy..', '.yyyyyyyyyyyy.', '.yyyxyyyyxyyy.', 'yyyxxxyyxxxyyY', 'yyyyxyyyyxyyyY', 'yyyyyyyyyyyyyY', 'yyyyyykkyyyyyY', 'yyyyykRRkyyyyY', '.yyyykRRkyyyY.', '.yyyyykkyyyYY.', '..yyyyyyyyYY..', '....YYYYYY....', '..............'],
    scared: ['....cccccc....', '..cccccccccc..', '.ccyyyyyyyycc.', '.yykyyyyyykyy.', 'yykwxyyyywxkyY', 'yyywwyyyywwyyY', 'yyyyyyyyyyyyyY', 'yyyyyyyyyyyycY', 'yyykykykykyycY', '.yyykykykyyyY.', '.yyyyyyyyyyYY.', '..yyyyyyyyYY..', '....YYYYYY....', '..............'],
    sleepy: ['..........kkk.', '....yyyyyy.k..', '..yyyyyyyykkk.', '.yyyyyyyyyyy..', '.yyyyyyyyyyyy.', 'yyykkyyyykkyyY', 'yyyyyyyyyyyyyY', 'yyyyyyyyyyyyyY', 'yyyyyyyyyyyyyY', '.yyyyykkyyyyY.', '.yyyyykkyyyYY.', '..yyyyyyyyYY..', '....YYYYYY....', '..............'],
    tired: ['....yyyyyy....', '..yyyyyyyyyy..', '.yyyyyyyyyyyy.', '.yykkyyykkyyy.', 'yyyyyyyyyyyyyY', 'yyyyyyyyyyyyyY', 'yyyyyyyyyyyyyY', 'yyyyyyykkyywwe', 'yyyyyykRRkwwwe', '.yyyyyykkywwe.', '.yyyyyyyyyyYY.', '..yyyyyyyyYY..', '....YYYYYY....', '..............'],
    book_open: ['..............', '..............', '..............', '.www......www.', 'wttwww..wwwttw', 'wwwwwwwkwwwwww', 'wtttttwkwttttw', 'wwwwwwwkwwwwww', 'wtttttwkwttttw', 'wwwwwwwkwwwwww', 'wwwwwwwkwwwwww', 'nnnnnnnknnnnnn', '.....nnnnn....', '..............'],
    books: ['..............', '..............', '...rrrrrrrrr..', '..rrrrrrrrrrr.', '..rWWWWWWWWWr.', '..rrrrrrrrrrr.', '.bbbbbbbbbbb..', 'bbbbbbbbbbbbb.', 'bWWWWWWWWWWWb.', 'bbbbbbbbbbbbb.', '..gggggggggggg', '..gWWWWWWWWWWg', '..gggggggggggg', '..............'],
    tome: ['..............', '..rrrrrrrrrr..', '.rRrrrrrrrrrr.', '.rRryyyyyyrrr.', '.rRryRRRRyrrr.', '.rRryRyyRyrrr.', '.rRryRRRRyrrr.', '.rRryyyyyyrrr.', '.rRrrrrrrrrrr.', '.rRrrrrrrrrrr.', '.rRrrrrrrrrrr.', '.rRWWWWWWWWWW.', '..rrrrrrrrrrr.', '..............'],
    grad_cap: ['..............', '......BB......', '....BBBBBB....', '..BBBBBBBBBB..', 'BBBBBBBBBBBBBB', '..BBBBBBBBBB.y', '....BBBBBB...y', '...bbbbbbbb..y', '...bbbbbbbb..y', '...bbbbbbbb.yy', '....bbbbbb..yy', '..............', '..............', '..............'],
    brush: ['...........NN.', '..........NmN.', '.........NmN..', '........NmN...', '.......NmN....', '......NmN.....', '.....yyY......', '....wwwY......', '...wwwk.......', '...wkk........', '..kk..........', '.kk...kk......', 'kk..kkkk......', '...kk.........'],
    script: ['..............', '.bbbbbbbbbbbb.', 'bbbbbbbbbbbbbb', 'bbbbbwwbbbbbbb', 'bbbbbwwwwbbbbb', 'bbbbbwwbbbbbbb', 'bbbbwwwbbbbbbb', 'bbbbbwwwwwbbbb', 'bbbbbwwbbbbbbb', 'bbbbbwwbbbbbbb', 'bbbbwwwwbbbbbb', 'bbbbbbwbbbbbbb', '.BBBBBBBBBBBB.', '..............'],
    scroll: ['..............', '.NnnnnnnnnnnN.', '.NtttttttttN..', '..tTTTTTTTTt..', '..tttttttttt..', '..tTTTTTTTTt..', '..tttttttttt..', '..tTTTTTTTt...', '..tttttttttt..', '..tTTTTTTTTt..', '..tttttttttt..', '.NtttttttttN..', '.NnnnnnnnnnnN.', '..............'],
    quill: ['............ww', '..........wwwe', '.........wwwe.', '........wwwe..', '.......wwwe...', '......wwwe....', '.....wwwe.....', '....eewe......', '...eee........', '...ke.........', '..kk..........', '.k............', 'kttttttt......', '.ttttttt......'],
    brain: ['..............', '...iiii.iiii..', '..iIiiiiIiiii.', '.iiiiIiiiiIii.', '.iIiiiiiIiiiI.', 'iiiIiiiIiiiiii', 'iiiiiIiiiiIiii', 'iIiiiiiiIiiiii', '.iiiIiiiiiIii.', '.iiiiiiIiiiii.', '..iIiiiiiiIi..', '...iiiiiiii...', '......ii......', '......ii......'],
    bulb: ['....llllll....', '...llwwlllll..', '..llwlllllll..', '..llwllllllll.', '..lllllllllll.', '..lllllllllll.', '...lllyllyll..', '....llyllyl...', '.....lyyyl....', '.....aaaaa....', '.....AAAAA....', '.....aaaaa....', '......AAA.....', '..............'],
    hundred: ['..............', '..............', '.r..rrr...rrr.', 'rr.r...r.r...r', '.r.r...r.r...r', '.r.r...r.r...r', '.r.r...r.r...r', '.r.r...r.r...r', 'rrr.rrr...rrr.', '..............', 'rrrrrrrrrrrrrr', '..............', 'rrrrrrrrrrrrrr', '..............'],
    owl: ['.n..........n.', '.nn........nn.', '.nnnnnnnnnnnn.', 'nnwwwnnnnwwwnn', 'nwwxwwnnwwxwwn', 'nwxxxwnnwxxxwn', 'nwwxwwyywwxwwn', 'nnwwwnnyynwwnn', 'nnmmmmnnmmmmnn', 'nmmNmmmmmmNmmn', 'nmmmmNmmNmmmmn', '.nmmmmmmmmmmn.', '..nnnnnnnnnn..', '...yy....yy...'],
    question: ['....bbbbbb....', '...bbwwwwbb...', '..bbwbbbbwbb..', '..bbbbbbbwbb..', '.......bbwbb..', '......bbwbb...', '.....bbwbb....', '.....bwbb.....', '.....bwb......', '.....bbb......', '..............', '.....bbb......', '.....bwb......', '.....bbb......'],
    rainbow: ['..............', '..............', '....rrrrrr....', '..rrooooooorr.', '.rooyyyyyyyoor', '.royyggggggyyo', 'royggbbbbbbggy', 'roygbb....bbgy', 'roygb......bgy', 'roygb......bgy', 'roygb......bgy', 'Woygb......bgW', 'WWyg........WW', '.WW..........W'],
    sprout: ['..............', '..............', '..LLL....LLL..', '.LLgggL.LgggL.', '.LgggggLggggL.', '..LgggggggggL.', '...LLgGgggLL..', '......G.......', '......G.......', '......G.......', '....NNNNN.....', '...NvvvvvN....', '...NvvvvvN....', '....NNNNN.....'],
    oak: ['....gggggg....', '..ggLLggggGg..', '.gLLggggggGGg.', '.gLgggggGgggGg', 'ggggggGgggggGg', 'gggGgggggGgggG', 'gggggggGggggGG', '.gggGggggggGG.', '..GGgggGGGGG..', '....GGnnGG....', '......nn......', '......nn......', '.....nnnn.....', '....NNNNNN....'],
    pine: ['......GG......', '.....GgGG.....', '....GgggGG....', '.....GggG.....', '....GgggGG....', '...GgggggGG...', '....GggggG....', '...GgggggGG...', '..GgggggggGG..', '.GgggggggggGG.', '..GGGGGGGGGG..', '......nn......', '......nn......', '.....NNNN.....'],
    tag: ['..............', '..yyyyyyyyy...', '.yyyyyyyyyyy..', 'yyw..yyyyyyyy.', 'yy....yyyyyyyy', 'yyw..yyyyyyyyY', '.yyyyyyyyyyyY.', '..yyyyyyyyyY..', '...YYYYYYYYY..', '..............', '..............', '..............', '..............', '..............'],
    mic: ['.....aaaa.....', '....aAaAaa....', '....aaAaAa....', '....aAaAaa....', '....aaAaAa....', '....aAaAaa....', '..A.aaaaaa.A..', '..A..aaaa..A..', '...A......A...', '....AAAAAA....', '......AA......', '......AA......', '....AAAAAA....', '..............'],
    palette: ['..............', '....tttttt....', '..tttttttttt..', '.ttrrtttttbbt.', '.ttrrttttttbbt', 'ttttttttttttt.', 'ttyyttt...tt..', 'ttyytt....tt..', 'tttttt...ttt..', '.ttggttttttt..', '..tggtttpptt..', '...tttttpptt..', '.....tttttt...', '..............'],
    stamp: ['..............', '.bbbbbbbbbbb..', '.bBBBBBBBBBb..', '.bByyyyyyyBb..', '.bBy.....yBb..', '.bBy.rr..yBb..', '.bBy.rrr.yBb..', '.bBy..rr.yBb..', '.bBy.....yBb..', '.bByyyyyyyBb..', '.bBBBBBBBBBb..', '.bBBBBBBBBBb..', '.bbbbbbbbbbb..', '..............'],
    compass: ['....yyyyyy....', '..yyWWWWWWyy..', '.yWWWWrWWWWWy.', '.yWWWWrrWWWWy.', 'yWWWWWrrWWWWWy', 'yWWWWWrrWWWWWy', 'yWWWWWkkWWWWWy', 'yWWWWWbbWWWWWy', 'yWWWWWbbWWWWWy', '.yWWWWbbWWWWy.', '.yWWWWWbWWWWy.', '..yyWWWWWWyy..', '....yyyyyy....', '..............'],
    flag_mn: ['..............', '..............', 'rrrrbbbbbbrrrr', 'ryrrbbbbbbrrrr', 'yyyrbbbbbbrrrr', 'ryrrbbbbbbrrrr', 'yyyrbbbbbbrrrr', 'yryrbbbbbbrrrr', 'yryrbbbbbbrrrr', 'yyyrbbbbbbrrrr', 'yyyrbbbbbbrrrr', 'rrrrbbbbbbrrrr', '..............', '..............'],
    seasons: ['..............', '.iiiii.yyyyy..', 'iiwiiiyyywyyy.', 'iwiiiiyyyyyyy.', 'iiiiiiyyyyyyy.', 'iiiiiiyyyyyyy.', '.iiiiiyyyyyy..', '.ooooocccccc..', 'oooOoocccwccc.', 'ooOooocccccwc.', 'oooooocwccccc.', 'oOooooccccccc.', '.ooooo.ccccc..', '..............'],
    plate: ['..............', '..............', 'a..........a.a', 'a..aaaaaa..a.a', 'a.aWWWWWWa.aaa', 'aaWWrrgWWWa.a.', 'a.WWyrggWWWa..', '.aWWWyrrWWWa..', '.aWWWWWWWWWa..', '.aaWWWWWWWa...', '..aaaaaaaaa...', '..............', '..............', '..............'],
    shield: ['.bbbbbbbbbbbb.', 'bbyyyyyyyyyybb', 'bybbbbbbbbbbyb', 'byb..yyy..byb.', 'byb.yrrry.byb.', 'byb.yrrry.byb.', 'byb..yyy..byb.', 'bybbbbbbbbbbyb', '.byybbbbbbyyb.', '.bbyybbbbyybb.', '..bbyyyyyybb..', '...bbbyybbb...', '.....bbbb.....', '......bb......'],
    fortress: ['r.....r.....r.', 'rr....rr....rr', 'a.a.a.a.a.a.a.', 'aaaaaaaaaaaaaa', 'aAaaaaaaaaaaAa', 'aaaaaaaaaaaaaa', 'aAaaaRRRRaaaAa', 'aaaaRnnnnRaaaa', 'aaaRnnnnnnRaaa', 'aAaRnnnnnnRaAa', 'aaaRnnnnnnRaaa', 'aaaRnnnnnnRaaa', 'AAAAAAAAAAAAAA', '..............'],
    home: ['......r.......', '.....rrr......', '....rrrrr..A..', '...rrrrrrr.A..', '..rrrrrrrrrA..', '.rrrrrrrrrrrr.', 'rrrrrrrrrrrrrr', '.WWWWWWWWWWWW.', '.WbbWWnnWWbbW.', '.WbbWWnnWWbbW.', '.WWWWWnnWWWWW.', '.WWWWWnnWWWWW.', 'GggggggggggggG', '..............'],
    home_garden: ['..............', '.....rrr......', '....rrrrr.....', '...rrrrrrr....', '..rrrrrrrrr...', '.rrrrrrrrrrr..', '..WWWWWWWWW...', '..WbbWnnWbb.g.', '..WbbWnnWbbggg', '..WWWWnnWWWgLg', '..WWWWnnWWW.n.', 'i.i.i.i.i.i.n.', 'gggggggggggggg', 'GGGGGGGGGGGGGG'],
    rod: ['............nn', '...........nn.', '..........nn.w', '.........nn..w', '........nn...w', '.......nn....w', '......nn.....w', '.....nn......w', '....nn.......w', '...nn.......rr', '..NN........ww', '.NN...........', 'NN..CCCCCCCCCC', '....cCcCcCcCcC'],
    trophy: ['..............', '.yyyyyyyyyyyy.', 'yyylyyyyyyyyyy', 'y.ylyyyyyyyY.y', 'y.yyyyyyyyyY.y', '.yylyyyyyyYYy.', '...yyyyyyyY...', '....yyyyYY....', '......YY......', '......YY......', '....nnnnnn....', '...nnyyyynn...', '...nnnnnnnn...', '..............'],
    medal_gold: ['bbb......rrr..', '.bbb....rrr...', '..bbb..rrr....', '...bbbrrr.....', '....bbrr......', '....yyyyy.....', '...yyllyyy....', '..yylyyyyyY...', '..yyyyYyyyY...', '..yyyYYyyyY...', '..yyyyYyyyY...', '...yyyYyyY....', '....YYYYY.....', '..............'],
    medal: ['..rrr..bbb....', '..rrr..bbb....', '...rrrbbb.....', '...rrrbbb.....', '....rrbb......', '....aaaaa.....', '...aaWWaaa....', '..aaWaaaaaA...', '..aaaaaaaaA...', '..aaaayaaaA...', '..aaaaaaaaA...', '...aaaaaaA....', '....AAAAA.....', '..............'],
    medal_star: ['..rrrrrrrr....', '..rWWrrWWr....', '..rWWrrWWr....', '...rrrrrr.....', '....yyyy......', '...yyyyyy.....', '..yyyyyyyy....', '..yyyrryyy....', '..yyrrrryy....', '..yyyrryyy....', '..yyyyyyyy....', '...yyyyyy.....', '....YYYY......', '..............'],
    target: ['....rrrrrr....', '..rrwwwwwwrr..', '.rwwrrrrrrwwr.', '.rwrrwwwwrrwr.', 'rwrrwrrrrwrrwr', 'rwrwrrkkrrwrwr', 'rwrwrkkkkrwrwr', 'rwrwrkkkkrwrwr', 'rwrwrrkkrrwrwr', 'rwrrwrrrrwrrwr', '.rwrrwwwwrrwr.', '.rwwrrrrrrwwr.', '..rrwwwwwwrr..', '....rrrrrr....'],
    arm: ['..............', '......ss......', '.....ssss.....', '.....ssss.....', '......ss......', '......sS......', '..ss..sS......', '.ssss.sS......', 'sssssssss.....', 'sssssssssS....', '.sssssssssS...', '..sssssssss...', '...ssssssS....', '....SSSSS.....'],
    zodog: ['..............', '..rr......rr..', '.rrrr....rrrr.', 'rrrrrr..rrrrrr', 'rrRrrr..rrrRrr', 'rrrRrr..rrRrrr', '.rrrrr..rrrrr.', '.rrrrr..rrrrr.', '..rrrrrrrrrr..', '..rRRRRRRRRr..', '..............', '..bb......bb..', '..bbbbbbbbbb..', '..bbbbbbbbbb..'],
    eagle: ['......hh......', '.....hwwh.....', '.....hwxyy....', '......hhy.....', 'nn...nnnn...nn', '.nnn.nnnn.nnn.', '..nnnnmmnnnn..', '...nnnmmnnn...', '....nnnnnn....', '.....nnnn.....', '.....nnnn.....', '....nn..nn....', '....yy..yy....', '..............'],
    elephant: ['..............', '...aaaaaa.....', '..aaaaaaaa....', '.aaaaaaaaaa...', 'aaeaaaaaaaaaa.', 'aaeeaaaxaaaaaa', 'aaeeaaaaaaaaaa', 'aaeaaaaaaaaa.a', '.aaaaaaaaaa..a', '..aaaaaaaa...a', '..aa.aa.aa..aa', '..aa.aa.aa....', '..AA.AA.AA....', '..............'],
    lion: ['....oooooo....', '..oooOOOOooo..', '.ooOyyyyyyOoo.', '.oOyyyyyyyyOo.', 'ooyyxyyyyxyyoo', 'ooyyyyyyyyyyoo', 'oOyyyykkyyyyOo', 'oOyyyyyyyyyyOo', '.oOyyykkyyyOo.', '.ooOyyyyyyOoo.', '..oooOOOOooo..', '....oooooo....', '..............', '..............'],
    falcon: ['..............', '.....aaa......', '....aawax.....', '....aaaaay....', '.....aaay.....', '....aaaaa.....', '...aaeeaaa....', '..aaeAeeaaa...', '..aaeeAeaaa...', '...aaeeeaa....', '....aaaaa.....', '.....aaa......', '....yy.yy.....', '..............'],
    horseshoe: ['..............', '..aaa....aaa..', '.aaAa....aAaa.', '.aaa......aaa.', 'aaAa......aAaa', 'aaa........aaa', 'aAa........aAa', 'aaa........aaa', 'aAaa......aaAa', '.aaaa....aaaa.', '..aaAaaaaAaa..', '...aaaaaaaa...', '..............', '..............'],
    tea_bowl: ['..............', '....W..W......', '.....W..W.....', '....W..W......', '..............', 'nnnnnnnnnnnnnn', 'nTTTTTTTTTTTTn', '.nTTTTTTTTTTn.', '.nnnnnnnnnnnn.', '..nbbnnnnbbn..', '...nnnnnnnn...', '....nnnnnn....', '..............', '..............'],
    family_tree: ['....gggggg....', '..ggigggggig..', '.gggggiggggggg', 'ggiggggggiggg.', '.gggggggggggig', '..ggggnnggggg.', '....nnnnnn....', '......nn......', '......nn......', '.....nnnn.....', '....nn..nn....', '...nn....nn...', '..nn......nn..', '..............'],

    // places and nature
    city: ['..........bb..', '...aa.....bb..', '..aaaa....bb..', '..aWaa..bbbbb.', '..aaaa..bWbWb.', '..aWaa..bbbbb.', 'eeaaaaeebWbWb.', 'eWaWaaWebbbbb.', 'eeaaaaeebWbWb.', 'eWaWaaWebbbbb.', 'eeaaaaeebWbWb.', 'eWaWaaWebbbbb.', 'AAAAAAAAAAAAAA', '..............'],
    volcano: ['.....r..o.....', '......oo.r....', '....a.ro.a....', '.....rrroo....', '.....AAAAA....', '....AvvvvvA...', '...AvvvvvvvA..', '...AvvAvvvvvA.', '..AvvvvvvAvvA.', '..AvvAvvvvvvvA', '.AvvvvvvvvAvvA', 'AvvvvvAvvvvvvA', 'GGGGGGGGGGGGGG', '..............'],
    desert: ['...........yy.', '..........yyyy', '...........yy.', '....g.........', '...gg.g.......', '...gggg.......', '....gg........', '....gg..ttt...', '..ttttttttTttt', '.tTttttttttTTt', 'ttttTTtttttttt', 'tttttttTTttttt', 'TTTTTTTTTTTTTT', '..............'],
    mountain: ['......ww......', '.....wwww.....', '....wwawwa....', '...wwaaaawa...', '...aAaaaaaaa..', '..aaaaAaaaaa..', '..aAaaaaaAaaa.', '.aaaaaAaaaaaa.', '.aaAaaaaaaAaaa', 'aaaaaaaaaAaaaa', 'aAaaaaAaaaaaaa', 'GGGGGGGGGGGGGG', '..............', '..............'],
    rock: ['..............', '..............', '.....aaaa.....', '...aaeeaaa....', '..aaeaaaaAa...', '..aeaaaaaaAa..', '.aaaaaaAaaaA..', '.aaaaaaaaaaAa.', 'aAaaaaaaaAaaAa', 'aaaAaaaaaaaaAa', 'aaaaaaaAaaaAAa', '.AAAAAAAAAAAA.', '..............', '..............'],
    railway: ['......nn......', '..a..nnnn..a..', '..a.nnnnnn.a..', '..a.......a...', '.a.nnnnnnnn.a.', '.a..........a.', '.a.nnnnnnnn.a.', 'a............a', 'a.nnnnnnnnnn.a', 'a............a', 'anbnnnnnnnnnba', 'a............a', 'nnnnnnnnnnnnnn', '..............'],
    factory: ['..e..e........', '.ee.ee........', '..e..e........', '.aa.aa........', '.aa.aa........', '.aa.aa......a.', 'raarrarr...aar', 'rrrrrrrrr.aarr', 'rrrrrrrrrrrrrr', 'rcrrcrrcrrcrrr', 'rrrrrrrrrrrrrr', 'rcrrcrrcrrcrrr', 'rrrrrrrrrrrrrr', '..............'],
    pick: ['..............', '..aaaaaaaa....', '.aaAAAAAAaa...', 'aA........aa..', 'a.....n....a..', '.....n.......a', '....n.........', '...n..........', '..n...........', '.n............', 'n.............', '..............', '..............', '..............'],
    temple: ['......yy......', '.....yyyy.....', '....rrrrrr....', '.rrrrrrrrrrrr.', 'rrRRRRRRRRRRrr', '..yyyyyyyyyy..', '.rrrrrrrrrrrr.', 'rRRRRRRRRRRRRr', '..WrWWnnWWrW..', '..WrWWnnWWrW..', '..WrWWnnWWrW..', '..WrWWnnWWrW..', 'AAAAAAAAAAAAAA', '..............'],
    dino: ['.......ggggg..', '......ggxgggg.', '......gggggggg', '......ggggg...', '.....gggggW...', '....ggggg.....', '.L.gggggggg...', '.LggggggggGg..', 'LgggggggggG...', '.gggggggggg...', '...gggGggg....', '...gg...gg....', '...GG...GG....', '..............'],
    wheat: ['..y...y...y...', '.yyy.yyy.yyy..', '..yY..yY..yY..', '.yyy.yyy.yyy..', '..yY..yY..yY..', '.yyy.yyy.yyy..', '..Y...Y...Y...', '..Y...Y...Y...', '...Y..Y..Y....', '....YYYYY.....', '....rrrrr.....', '.....YYY......', '....Y.Y.Y.....', '...Y..Y..Y....'],
    statue: ['....aaaaa.....', '...aAAAAAa....', '...aAaaaAa....', '...aaaaaaa....', '....aAAAa.....', '.....aaa......', '..aaaaaaaaa...', '.aaAaaaaaAaa..', '.aaaaaaaaaaa..', '.aaAaaaaaAaa..', '..aaaaaaaaa...', '..aaaaaaaaa...', '.AAAAAAAAAAA..', 'AAAAAAAAAAAAA.'],
    wave: ['..............', '......CCCC....', '....CCCccCC...', '...CCcwwwcC...', '..CCcw...wc...', '..Ccw....CC...', '.CCcw.........', '.CCcc....C..C.', 'CCCCcc..CCCCCC', 'CcCCCCCCCcCCCC', 'CCCCcCCCCCCcCC', 'bbbbbbbbbbbbbb', 'BBBBBBBBBBBBBB', '..............'],
    melon: ['..............', '..............', '..............', 'GGGGGGGGGGGGGG', 'Grrrrrrrrrrrrg', 'Grrxrrrxrrrxrg', '.Grrrrrrrrrrg.', '.GrrxrrrrxrrG.', '..Grrrrrrrrg..', '..GGrrxrrrGG..', '...GGrrrrGG...', '....GGGGGG....', '..............', '..............'],
    crown: ['..............', '..............', 'y.....y.....y.', 'yy...yyy...yy.', 'yyy.yyyyy.yyy.', 'yyyyyyyyyyyyy.', 'yyryyybyyyryy.', 'yyyyyyyyyyyyy.', 'yyyyyyyyyyyyy.', 'YYYYYYYYYYYYY.', '..............', '..............', '..............', '..............'],
    deer: ['.n.n......n.n.', '.nnn......nnn.', '..n.n....n.n..', '...nn....nn...', '....nmmmmn....', '....mmmmmm....', '....mxmmxm....', '.....mmmm.....', '.....mmkm.....', '......mm......', '..............', '..............', '..............', '..............'],

    // things and tools
    pin: ['....rrrrr.....', '...rrrrrrr....', '..rrwwrrrrr...', '..rrwrrrrrrR..', '..rrrrWWrrrR..', '..rrrWWWWrrR..', '..rrrrWWrrrR..', '...rrrrrrrR...', '....rrrrrR....', '.....rrrR.....', '......rR......', '......R.......', '...AAAAAAAA...', '..............'],
    globe: ['....bbbbbb....', '..bbgggbbbbb..', '.bggggggbbggb.', '.bgggggbbbggb.', 'bbbgggbbbbbbbb', 'bbbbggbbbbbggb', 'bbbbbgbbbbgggb', 'bbbbbbbbbgggbb', 'bbbbbbbbbggbbb', '.bbbgggbbbbbb.', '.bbbbgggbbbbb.', '..bbbbggbbbb..', '....bbbbbb....', '..............'],
    earth: ['....CCCCCC....', '..CCgggCCCCC..', '.CggggggCCLgC.', '.CgLgggCCCggC.', 'CCCgggCCCCCCCC', 'CCCCggCCCCCggC', 'CCCCCgCCCCgggC', 'CCCCCCCCCgggCC', 'CCWCCCCCCggCCC', '.CCCgggCCCCCC.', '.CCCCgggCCCCC.', '..CCCCggCCCC..', '....CCCCCC....', '..............'],
    door: ['...nnnnnnnn...', '..nNNNNNNNNn..', '..nNmmmmmmNn..', '..nNmNNNNmNn..', '..nNmmmmmmNn..', '..nNmNNNNmNn..', '..nNmmmmmmyn..', '..nNmNNNNmyn..', '..nNmmmmmmNn..', '..nNmNNNNmNn..', '..nNmmmmmmNn..', '..nNNNNNNNNn..', 'AAAAAAAAAAAAAA', '..............'],
    lock: ['..............', '....aaaaa.....', '...aa...aa....', '...a.....a....', '...a.....a....', '..yyyyyyyyy...', '..yllyyyyyY...', '..ylyyYYyyY...', '..yyyyYYyyY...', '..yyyyYYyyY...', '..yyyyyyyyY...', '..YYYYYYYYY...', '..............', '..............'],
    unlock: ['....aaaaa.....', '...aa...aa....', '...a.....a....', '...a.....a....', '.........a....', '..yyyyyyyyy...', '..yllyyyyyY...', '..ylyyYYyyY...', '..yyyyYYyyY...', '..yyyyYYyyY...', '..yyyyyyyyY...', '..YYYYYYYYY...', '..............', '..............'],
    key: ['..............', '..yyyy........', '.yy..yy.......', '.y....y.......', '.y....y.......', '.yy..yy.......', '..yyyyyyyyyyy.', '.........y.yy.', '.........y.y..', '..............', '..............', '..............', '..............', '..............'],
    rec: ['..............', '..............', '....rrrrrr....', '...rrwwrrrr...', '..rrwrrrrrrr..', '..rrrrrrrrrr..', '..rrrrrrrrrr..', '..rrrrrrrrrR..', '..rrrrrrrrRR..', '...rrrrrrRR...', '....RRRRRR....', '..............', '..............', '..............'],
    dice: ['..............', '..wwwwwwwwww..', '.wwwwwwwwwwwe.', '.wrrwwwwwwwwe.', '.wrrwwwwwwwwe.', '.wwwwwrrwwwwe.', '.wwwwwrrwwwwe.', '.wwwwwwwwrrwe.', '.wwwwwwwwrrwe.', '.wwwwwwwwwwwe.', '..eeeeeeeeee..', '..............', '..............', '..............'],
    gear: ['.....aa.......', '..a.aaaa.a....', '.aaaaaaaaaa...', '..aaAAAAaa....', '.aaAA..AAaa...', 'aaaA....Aaaa..', 'aaaA....Aaaa..', '.aaAA..AAaa...', '..aaAAAAaa....', '.aaaaaaaaaa...', '..a.aaaa.a....', '.....aa.......', '..............', '..............'],
    speaker: ['..............', '......A.......', '.....AA...c...', '....AaA....c..', 'aaaAaaA..c..c.', 'aaaaaaA...c.c.', 'aaaaaaA...c.c.', 'aaaAaaA..c..c.', '....AaA....c..', '.....AA...c...', '......A.......', '..............', '..............', '..............'],
    note: ['......PPPPPPPP', '......PPPPPPPP', '......P......P', '......P......P', '......P......P', '......P......P', '......P......P', '......P......P', '...pppP...pppP', '..ppppP..ppppP', '..ppppP..ppppP', '...ppp....ppp.', '..............', '..............'],
    bigtext: ['..............', '..bb..........', '.bbbb.........', 'bb..bb........', 'bb..bb........', 'bbbbbb..bbbb..', 'bb..bb.....bb.', 'bb..bb..bbbbb.', 'bb..bb.bb..bb.', 'bb..bb..bbbbb.', '..............', '..............', '..............', '..............'],
    turtle: ['..............', '..............', '....GGGGG.....', '...GgGgGgG....', '..GgggGgggG.ss', '..GgGgggGgGsxs', '.GgggGgGgggGss', '.GGGGGGGGGGG..', '..ss.....ss...', '..ss.....ss...', '..............', '..............', '..............', '..............'],
    phone: ['...AAAAAAAA...', '...AccccccA...', '...AccccccA...', '...AcwcwccA...', '...AccccccA...', '...AcccwccA...', '...AccccccA...', '...AcwccccA...', '...AccccccA...', '...AccccccA...', '...AAAAAAAA...', '...AAAaaAAA...', '...AAAAAAAA...', '..............'],
    money_fly: ['..............', '.ww.......ww..', '..ww.....ww...', '...GGGGGGGG...', '..GggggggggG..', '..GgGGggGGgG..', '..GggggggggG..', '..GgGGggGGgG..', '..GggggggggG..', '...GGGGGGGG...', '..............', '..............', '..............', '..............'],
    speak: ['..........b...', '.....ssss..b..', '....ssssss..b.', '...sshhhhs..b.', '...shhhhhs.b..', '...ssxsssss...', '...ssssssss...', '...sssssssrr..', '....ssssss....', '.....ssss.....', '....bbbbbb....', '...bbbbbbbb...', '..bbbbbbbbbb..', '..............'],
    signal: ['..............', '...........gg.', '...........gg.', '........gg.gg.', '........gg.gg.', '.....gg.gg.gg.', '.....gg.gg.gg.', '..gg.gg.gg.gg.', '..gg.gg.gg.gg.', '..gg.gg.gg.gg.', '..............', '..............', '..............', '..............'],
    no: ['....rrrrrr....', '..rrrrrrrrrr..', '.rrrw....wrrr.', '.rrr.....rrrr.', 'rrrrr...rrr.rr', 'rr.rrr.rrr..rr', 'rr..rrrrr...rr', 'rr...rrr....rr', 'rr..rrr.r...rr', 'rr.rrr...rrrrr', '.rrrr.....rrr.', '.rrrr....rrrr.', '..rrrrrrrrrr..', '....rrrrrr....'],
    paw: ['..............', '...nn....nn...', '..nnnn..nnnn..', '..nnnn..nnnn..', 'nn.nn....nn.nn', 'nnn........nnn', 'nnn..nnnn..nnn', '....nnnnnn....', '...nnnnnnnn...', '...nnnnnnnn...', '....nnnnnn....', '..............', '..............', '..............'],
    party: ['.y.....r....b.', '...y.r....b...', '.........y....', '..i.....p.....', '...........g..', '....oooo......', '...ooyooo.....', '..ooyoooo..r..', '.oooooyoo.....', 'ooyoooooo..y..', 'ooooyooo......', 'oyoooooo..i...', 'ooooo.........', 'oo............'],
    bone: ['..............', '..WW......WW..', '.WWWW....WWWW.', '.WWWWWWWWWWWW.', '..WWWWWWWWWW..', '..WWWWWWWWWW..', '.WWWWWWWWWWWW.', '.WWWW....WWWW.', '..WW......WW..', '..............', '..............', '..............', '..............', '..............'],
    moon: ['.....yyyy.....', '...yyyy.......', '..yyyy........', '.yyyy.........', '.yyyy.........', 'yyyyy.........', 'yyyyy.........', 'yyyyy.........', 'yyyyyy........', '.yyyyyy.....yy', '.yyyyyyyyyyyyy', '..yyyyyyyyyyy.', '...yyyyyyyyy..', '.....yyyyy....'],
    sun: ['......yy......', '.y....yy....y.', '..y........y..', '.....oooo.....', '....oyyyyo....', '...oyylyyyo...', 'yy.oyyyyyyo.yy', 'yy.oyyyyyyo.yy', '...oyyyyyyo...', '....oyyyyo....', '.....oooo.....', '..y........y..', '.y....yy....y.', '......yy......'],
    sunrise: ['......yy......', '..y...yy...y..', '...y......y...', '.....oooo.....', '....oyyyyo....', '...oyxyyxyo...', 'yy.oyyyyyyo.yy', '...oyxyyxyo...', '...ooyxxyoo...', 'cccccccccccccc', 'gggggggggggggg', 'gGgggGgggGgggg', 'GGGGGGGGGGGGGG', '..............'],
    run: ['.......sss....', '.......sss....', '........s.....', '.....rrrr.....', '....rrrrrrs...', '...s.rrr......', '.....rrr......', '.....bbbb.....', '....bb..bb....', '...bb....bb...', '..bb......n...', '..n...........', '..............', '..............'],
    picture: ['nnnnnnnnnnnnnn', 'nccccccccccccn', 'nccccccccyyccn', 'ncccccccyyyycn', 'nccccccccyyccn', 'ncccaccccccccn', 'nccaaacccccccn', 'ncaaaaaccgcccn', 'naaaaaaaggggcn', 'nggggggggggggn', 'nGgggGgggGgggn', 'nnnnnnnnnnnnnn', '..............', '..............'],
    bus: ['..............', '.yyyyyyyyyyyy.', 'yyyyyyyyyyyyyy', 'ycccycccyccccy', 'ycccycccyccccy', 'yyyyyyyyyyyyyy', 'yyyyyyyyyyyyyy', 'YYYYYYYYYYYYYY', 'yyyyyyyyyyyyyy', 'ywyyyyyyyyyyry', '.yyAAyyyyAAyy.', '...AA....AA...', '..............', '..............'],
    swords: ['e............e', 'ee..........ee', '.ee........ee.', '..ee......ee..', '...ee....ee...', '....ee..ee....', '.....eeee.....', '......ee......', '.....eeee.....', '...yyee.eyy...', '..yy.....yy...', '.nn........nn.', 'nn..........nn', '..............'],
    ladle: ['..............', '...........nn.', '..........nn..', '.........nn...', '........nn....', '.......nn.....', '......nn......', '.aaaaann......', 'aWWWWWaa......', 'aWWWWWWa......', 'aWWWWWWa......', '.aWWWWa.......', '..aaaa........', '..............'],
    buuz: ['..............', '..............', '......WW......', '....WWWWWW....', '...WeWWWWeW...', '..WWWeWWeWWW..', '.WWWWWWWWWWWW.', '.WWWWWWWWWWWW.', 'WWWWWWWWWWWWWW', 'eWWWWWWWWWWWWe', '.eeeeeeeeeeee.', '..............', 'aaaaaaaaaaaaaa', '..............'],
    megaphone: ['..............', '..........rr..', '........rrrr..', '......rrrrrr..', '.yy.rrrrrrrr..', 'yyyyrrrrrrrr.w', 'yyyyrrrrrrrr..', '.yy.rrrrrrrr.w', '......rrrrrr..', '....AA..rrrr..', '....AA....rr..', '..............', '..............', '..............'],
    horn: ['..............', '.............y', '...........yyy', '.........yyyyy', '.......yyyyyyy', '.yy.yyyyyyyyyy', 'yyyyyyYYyyyyyy', 'yyyyyyYYyyyyyy', '.yy.yyyyyyyyyy', '.......yyyyyyy', '.........yyyyy', '...........yyy', '.............y', '..............'],
    fire: ['......r.......', '.....rr.......', '.....rrr...r..', '....rrorr..r..', '...rroorr.rr..', '..rroooorrrr..', '..rrooyoorrr..', '.rrooyyyoorr..', '.rroyyyyyoorr.', '.rooyylyyyorr.', '.rooyyllyyorr.', '..roooyyooor..', '...rrrooorr...', '....nnnnnn....'],
    eye: ['..............', '..............', '....kkkkkk....', '..kkWWWWWWkk..', '.kWWWbbbbWWWk.', 'kWWWbbxxbbWWWk', 'kWWWbxxxxbWWWk', 'kWWWbbxxbbWWWk', '.kWWWbbbbWWWk.', '..kkWWWWWWkk..', '....kkkkkk....', '..............', '..............', '..............'],
    blossom: ['..............', '.....ii.......', '....iwii......', '..ii.iii.ii...', '.iwii...iwii..', '.iiii.y.iiii..', '..ii.yyy.ii...', '.....yyy......', '..ii..y..ii...', '.iiii...iiii..', '.iwiii.iiwii..', '..ii.iii.ii...', '.....iii......', '......i.......'],
    leaf_fall: ['......o.......', '.....ooo......', '..o..ooo..o...', '..oooooooooo..', '...ooOoOooo...', '.oooooOooooo..', '..oooOOOoooo..', '....ooOooo....', '...ooooooo....', '......n.......', '......n.......', '.....n........', '..............', '..............'],
    leaves: ['..............', '......gg......', '.....gggg.....', '....gggLgg....', '...ggGgLggg...', '..gggGggggLg..', '..ggGgggggLg..', '...gGggggLg...', '....Gggggg....', '...G.gggg.....', '..G...........', '.G............', '..............', '..............'],
    snowflake: ['......cc......', '...c..cc..c...', '....c.cc.c....', '.....cccc.....', '.c...cccc...c.', '..c.cc..cc.c..', 'cccccc..cccccc', 'cccccc..cccccc', '..c.cc..cc.c..', '.c...cccc...c.', '.....cccc.....', '....c.cc.c....', '...c..cc..c...', '......cc......'],
    clipboard: ['....aaaaaa....', '.nnnaAAAAannn.', '.nWWWWWWWWWWn.', '.nWAAAAAAAAWn.', '.nWWWWWWWWWWn.', '.nWAAAAAAWWWn.', '.nWWWWWWWWWWn.', '.nWAAAAAAAAWn.', '.nWWWWWWWWWWn.', '.nWAAAAAWWWWn.', '.nWWWWWWWWWWn.', '.nWWWWWWWWWWn.', '.nnnnnnnnnnnn.', '..............'],
    map: ['..............', 'tt..tttt..ttt.', 'ttTTttTTTTttTt', 'tgggTttCCCTttt', 'tgggTttCCCTtrt', 'ttgTttttCTTrrr', 'tttTTTtttTtttr', 'ttttTttTTTtttt', 'tgggTtttTtgggt', 'tgggTTtttTgggt', 'ttgtTttttTtgtt', 'ttTTttTTTTttTT', '.tt..tttt..tt.', '..............'],
    speech: ['..............', '.wwwwwwwwwwww.', 'wwwwwwwwwwwwww', 'wwwwwwwwwwwwww', 'wwkkwwkkwwkkww', 'wwkkwwkkwwkkww', 'wwwwwwwwwwwwww', 'wwwwwwwwwwwwww', '.wwwwwwwwwwww.', '..www.........', '..ww..........', '..w...........', '..............', '..............'],
    meat: ['..............', '.........WW...', '........WWWW..', '.......nWWWW..', '.....nnnnWW...', '...nrrrrnn....', '..nrrRrrrnn...', '.nrrrrrRrrn...', '.nrRrrrrrrn...', '.nrrrrRrrrn...', '.nrrrrrrrn....', '..nrrRrrn.....', '...nnnnn......', '..............'],
    jug: ['....aaaa......', '.....aa.......', '....nnnn......', '...nnnnnn.....', '..nnmmmmnn....', '.nnmmmmmmnn...', '.nmmmWmmmmn.n.', 'nnmmWWWmmmnnn.', 'nmmmmWmmmmmnn.', 'nmmmmmmmmmmn..', 'nnmmmmmmmmnn..', '.nnmmmmmmnn...', '..nnnnnnnn....', '..............'],
    aaruul: ['..............', '..............', '..WWWW........', '.WtWWtW..WWWW.', '.WWWWWW.WtWWtW', '.WtWWtW.WWWWWW', '..WWWW..WtWWtW', '.........WWWW.', '...WWWW.......', '..WtWWtW......', '..WWWWWW......', '..WtWWtW......', '...WWWW.......', '..............'],
    butter: ['..............', '..............', '..............', '....llllll....', '..llllllllll..', '.lllwlllllll..', '.yllllllllly..', 'nyyyyyyyyyyyyn', 'nWWWWWWWWWWWWn', '.nWWWWWWWWWWn.', '..nnnnnnnnnn..', '..............', '..............', '..............'],
    bowl: ['..............', '..............', '..............', '..............', 'WWWWWWWWWWWWWW', 'bWWWWWwWWWWWWb', 'bbbbbbbbbbbbbb', '.bbybbbbbbybb.', '.bbbbbbbbbbbb.', '..bbbbbbbbbb..', '...BBBBBBBB...', '....BBBBBB....', '..............', '..............'],
    milk: ['..............', '....aaaaaa....', '...aWWWWWWa...', '...aaaaaaaa...', '...aWWWWWWa...', '..aWWWWWWWWa..', '..aWWWWWWWWa..', '..abbbbbbbba..', '..abwwbbbbba..', '..abbbbbbbba..', '..aWWWWWWWWa..', '..aWWWWWWWWa..', '...aaaaaaaa...', '..............'],
    fish_blue: ['..............', '..............', '....bbbbb.....', '..bbbbbbbbb.bb', '.bbwbbcbbbbbbb', 'bbbxbbcbbbbbb.', 'bbbbbbcbbbbbb.', '.bbbbbcbbbbbbb', '..bbbbbbbbb.bb', '....bbbbb.....', '..............', '..............', '..............', '..............'],
    cap: ['..............', '..............', '....bbbbbb....', '...bbbbbbbb...', '..bbbwbbbbbb..', '..bbbbbbbbbb..', '..bbbbbbbbbb..', '..BBBBBBBBBBbb', '...........bbb', '..............', '..............', '..............', '..............', '..............'],
    flower_crown: ['..............', '..............', '..............', '.y..i..y..i...', 'yoy.iii.yoy.ii', '.y..i..y..i.i.', 'GgGgGgGgGgGgGg', '.g.......g....', '..............', '..............', '..............', '..............', '..............', '..............'],
    hat_mongol: ['......rr......', '......rr......', '.....yyyy.....', '....bbbbbb....', '...bbbbbbbb...', '...bbbbbbbb...', '..bbbbbbbbbb..', '.yyyyyyyyyyyy.', 'yyyyyyyyyyyyyy', '.r..........r.', '..r........r..', '..............', '..............', '..............'],
    fur_hat: ['......rr......', '.....rrrr.....', '....rrrrrr....', '...rrrrrrrr...', '..vvvvvvvvvv..', '.vmvvmvvmvvmv.', 'vvvvmvvvvmvvvv', 'vmvvvvmvvvvmvv', 'v.vvv....vvv.v', 'v...........vv', '..............', '..............', '..............', '..............'],
    glasses: ['..............', '..............', '..............', '..............', '.kkkkk..kkkkk.', 'kcccwk..kcccwk', 'kcccckkkkcccck', 'kcccck..kcccck', '.kkkkk..kkkkk.', '..............', '..............', '..............', '..............', '..............'],
    sunglasses: ['..............', '..............', '..............', '..............', 'kkkkkkkkkkkkkk', 'kxxxwxkkxxxwxk', 'kxxxxxkkxxxxxk', '.kxxxk..kxxxk.', '..kkk....kkk..', '..............', '..............', '..............', '..............', '..............'],
    scarf: ['..............', '..............', '..rrrrrrrrrr..', '.rrRrrRrrRrrr.', '.rrrrrrrrrrrr.', '..rrrrrrrrrr..', '.......rrr....', '.......rRr....', '.......rrr....', '.......rRr....', '.......rrr....', '.......y.y....', '..............', '..............'],
    khadag: ['..............', '...cccccccc...', '..ccbcccccbcc.', '.cc........cc.', '.c..........c.', '.c..........c.', '.cc........cc.', '..cc......cc..', '...cc....cc...', '...cc....cc...', '...cbc..cbc...', '...ccc..ccc...', '...c.c..c.c...', '..............'],
    wardrobe: ['......aa......', '.....a..a.....', '........a.....', '.......a......', '..aaaaaaaaaa..', '.bbbbbbbbbbbb.', 'bbbbyybbbbbbbb', 'bb.byyybbb.bbb', 'bb.bbyyybb.bbb', '...bbbyyyb....', '...bbbbyyb....', '...bbbbbbb....', '...yyyyyyy....', '..............'],
    deel_shirt: ['..............', '....yy..yy....', '..rrryyyyrrr..', '.rrrrryyrrrrr.', 'rrrrrrryrrrrrr', 'rrr.rrrrrr.rrr', 'rr..rrrrry..rr', '....rrrrry....', '....yyyyyy....', '....rrrrry....', '....rrrrrr....', '....rrrrrr....', '....yyyyyy....', '..............'],
    noodle: ['..............', '.....y.y.y....', '......y.y.....', '..............', 'nnnnnnnnnnnnnn', 'nTyTyTyTyTyTyn', '.nyyyrrryyyyn.', '.nnnnnnnnnnnn.', '..nbbnnbbnnn..', '...nnnnnnnn...', '....nnnnnn....', '..............', '..............', '..............'],
    tsuivan: ['..............', '..............', '..............', '..yyyyyyyyyy..', '.yyrryyggyyyy.', 'yygyyyyrryyyyy', 'yyyyrryyyyggyy', 'aaaaaaaaaaaaaa', 'aWWWWWWWWWWWWa', '.aaaaaaaaaaaa.', '..............', '..............', '..............', '..............'],
    jerky: ['..............', '..rr....rr....', '..rR....rR...r', '..rRr..rRr..rR', '..rRr..rRr..rR', '..rRr..rRr..rR', '..rRr..rRr..rR', '..rRr..rRr..rR', '..rRr..rRr..rR', '..rr....rr..rr', '..............', '.nnnnnnnnnnnn.', '.NNNNNNNNNNNN.', '..............'],
    salad: ['..............', '..............', '...g.L..r.....', '..gLgLgrrg....', '.gLgLorggLgo..', '.LgoggLgrgLgg.', 'aaaaaaaaaaaaaa', 'aWWWWWWWWWWWWa', '.aWWWWWWWWWWa.', '..aWWWWWWWWa..', '...aaaaaaaa...', '..............', '..............', '..............'],
    boortsog: ['..............', '..............', '..TTTT....TT..', '.TmmmmT..TmmT.', '.TmTTmT.TmmmmT', '.TmmmmT.TmTTmT', '..TTTT..TmmmmT', '.....TTT.TTTT.', '....TmmmT.....', '....TmTmT.....', '....TmmmT.....', '.....TTT......', '..............', '..............'],
    baursak: ['..............', '..............', '....mmmmmm....', '...mTTTTTTm...', '..mTTmmmmTTm..', '.mTTm....mTTm.', '.mTm......mTm.', '.mTm......mTm.', '.mTTm....mTTm.', '..mTTmmmmTTm..', '...mTTTTTTm...', '....mmmmmm....', '..............', '..............'],
    tea: ['..............', '..............', '....W.W.......', '.....W.W......', '....W.W.......', '..............', 'ntttttttttttn.', 'nTtttttttttTnn', 'nnTtttttttTn.n', '.nnnnnnnnnnn.n', '..nnnnnnnnnnn.', '...nnnnnnnn...', '..............', '..............'],
    juice: ['.......aa.....', '.......a......', '......a.......', '....oooooo....', '....WWWWWW....', '...WooooooW...', '...WoOoooOW...', '...WooooooW...', '...WoooOooW...', '...WooooooW...', '...WoOoooOW...', '...WooooooW...', '....WWWWWW....', '..............'],
    drop: ['......c.......', '......cc......', '.....cccc.....', '.....cccc.....', '....cccccc....', '....cwcccc....', '...cwccccCc...', '...cwccccCc...', '...ccccccCc...', '...cccccCCc...', '....cccCCc....', '.....cccc.....', '..............', '..............'],
    carrot: ['.........g.g..', '..........gg..', '.........gGg..', '.......ooo.g..', '......oooOo...', '.....ooOooo...', '....ooooOo....', '...ooOooo.....', '...oooOo......', '..ooooo.......', '..ooOo........', '.ooo..........', '.o............', '..............'],
    warning: ['......yy......', '.....yyyy.....', '.....yyyy.....', '....yykkyy....', '....yykkyy....', '...yyykkyyy...', '...yyykkyyy...', '..yyyykkyyyy..', '..yyyyyyyyyy..', '.yyyyykkyyyyy.', '.yyyyykkyyyyy.', 'yyyyyyyyyyyyyy', 'YYYYYYYYYYYYYY', '..............'],
    reload: ['..............', '....gggggg....', '...gg....gg...', '..gg......g...', '..g.......g...', '.ggg.....ggg..', '..g.......g...', '..............', '...g......g...', '...gg....gg...', '....gggggg....', '..............', '..............', '..............'],
    cart: ['..............', 'AA............', '.A............', '.Ayyyyyyyyyyy.', '.Ayyyyyyyyyyy.', '..Ayyyyyyyyy..', '..AyyyyyyyyA..', '...AAAAAAAA...', '...A..........', '...AAAAAAAAA..', '....AA...AA...', '....AA...AA...', '..............', '..............'],
    moneybag: ['......yy......', '.....yyyy.....', '......nn......', '....nnnnnn....', '...nnnnnnnn...', '..nnnnyynnnn..', '.nnnnyyyynnnn.', '.nnnnnyynnnnn.', 'nnnnnyyyynnnnn', 'nnnnnnyynnnnnn', 'nnnnnyyyynnnnn', '.nnnnnyynnnnn.', '..nnnnnnnnnn..', '..............'],
    bolt: ['........yyy...', '.......yyy....', '......yyy.....', '.....yyy......', '....yyy.......', '...yyyyyyyy...', '......yyy.....', '.....yyy......', '....yyy.......', '...yyy........', '..yyy.........', '..yy..........', '..............', '..............'],
    checkered: ['n.............', 'nkWkWkWk......', 'nWkWkWkW......', 'nkWkWkWk......', 'nWkWkWkW......', 'nkWkWkWk......', 'n.............', 'n.............', 'n.............', 'n.............', 'n.............', 'n.............', 'n.............', 'nn............'],
    bell: ['......yy......', '.....yyyy.....', '....yyyyyy....', '...yylyyyyy...', '...ylyyyyyy...', '...yyyyyyyy...', '..yyyyyyyyyy..', '..yyyyyyyyyy..', '.yyyyyyyyyyyy.', 'YYYYYYYYYYYYYY', '......nn......', '..............', '..............', '..............'],
    stopwatch: ['.....aaaa.....', '......aa......', '...aaaaaaaa...', '..aWWWWWWWWa..', '.aWWWWkWWWWWa.', '.aWWWWkWWWWWa.', '.aWWWWkWWWWWa.', '.aWWWWkkkkWWa.', '.aWWWWWWWWWWa.', '.aWWWWWWWWWWa.', '..aWWWWWWWWa..', '...aaaaaaaa...', '..............', '..............'],
    gift: ['...r....r.....', '....r..r......', '.....rr.......', 'bbbbbrrbbbbbb.', 'bbbbbrrbbbbbb.', 'BBBBBrrBBBBBB.', '.bbbbrrbbbbb..', '.bbbbrrbbbbb..', '.bbbbrrbbbbb..', '.bbbbrrbbbbb..', '.bbbbrrbbbbb..', '.BBBBRRBBBBB..', '..............', '..............'],
    chest: ['..............', '..nnnnnnnnnn..', '.nmmmmmmmmmmn.', 'nmmmmmmmmmmmmn', 'nnnnnnnnnnnnnn', 'nyyyyyyyyyyyyn', 'nmmmmmyymmmmmn', 'nmmmmmYYmmmmmn', 'nmmmmmmmmmmmmn', 'nmmmmmmmmmmmmn', 'nyyyyyyyyyyyyn', 'nnnnnnnnnnnnnn', '..............', '..............'],
    cushion: ['..............', '..............', '..............', '.rrrrrrrrrrrr.', 'rryyyyyyyyyyrr', 'ryybbbbbbbbyyr', 'rybbwbbbbwbbyr', 'rybbbbyybbbbyr', 'rybbwbbbbwbbyr', 'ryybbbbbbbbyyr', 'rryyyyyyyyyyrr', '.rrrrrrrrrrrr.', '..............', '..............'],
    gamepad: ['..............', '..............', '..............', '..pppppppppp..', '.pppppppppppp.', 'ppAppppppprpp.', 'pAAAppppprprp.', 'ppAppppppprpp.', 'pppppppppppppp', 'ppppp....ppppp', '.ppp......ppp.', '..............', '..............', '..............'],
    puff: ['..............', '..............', '....eeee......', '..eeWWWWe.....', '.eWWWWWWWee...', '.eWWWWWWWWWe..', 'eWWWWWWWWWWWe.', 'eWWWWWWWWWWWWe', '.eWWWWWWWWWWe.', '..eeeWWWWeee..', '.....eeee.....', '..............', '..............', '..............'],
    scale: ['......yy......', '......yy......', '.yyyyyyyyyyyy.', '.y....yy....y.', 'y.y...yy...y.y', 'y.y...yy...y.y', 'yyy...yy...yyy', '......yy......', '......yy......', '......yy......', '....yyyyyy....', '...YYYYYYYY...', '..............', '..............'],
    arrow_down: ['.....bbbb.....', '.....bbbb.....', '.....bbbb.....', '.....bbbb.....', '.....bbbb.....', '..bbbbbbbbbb..', '...bbbbbbbb...', '....bbbbbb....', '.....bbbb.....', '......bb......', '..............', '..............', '..............', '..............'],
    horse_head: ['....N.........', '...NvN........', '...vvvNN......', '..vvvvvvN.....', '..vvxvvvvN....', '.vvvvvvvvvN...', 'vvvvvvvNvvvN..', 'vvvvvvvNNvvvN.', '.vvvvvNNNvvvvN', '..kvvNN.NNvvvN', '...vvv...NNvvN', '.........NNvvv', '..........Nvvv', '..............'],
    wolf: ['..a......a....', '..aa....aa....', '..aaaaaaaa....', '.aaeaaaaeaa...', '.aaxaaaaxaa...', '.aaaaeeaaaa...', '..aaaekeaa....', '...aaeeeaa..a.', '..aaaaaaaaa.aa', '.aaaaaaaaaaaaa', '.aaAaaaaAaaaa.', '.aa.aa..aa.aa.', '.AA.AA..AA.AA.', '..............'],
    fox: ['..o......o....', '..oo....oo....', '..oOoooooOo...', '.oooooooooo...', '.ooxooooxoo...', '.oooowwoooo...', '..oowkwwoo....', '...wwwwww...o.', '..oooooooo.ooo', '.ooooooooooowo', '.oooOoooOoooww', '.oo.oo..oo....', '.kk.kk..kk....', '..............'],
    leopard: ['..............', '..e......e....', '..ee....ee....', '..eeeeeeee....', '.eekeeeekee...', '.eexeeeexee...', '.eeeekkeeee...', '..eeeeeeee....', '..eAeeeAeeee..', '.eeeeAeeeeAee.', '.eAeeeeeAeeeeA', '.ee.ee..ee.eeA', '.ee.ee..ee..eA', '..............'],
    squirrel: ['.........mmm..', '........mmTmm.', '..n.n...mTTTm.', '.nnnnn..mTTTm.', '.nxnnn..mmTm..', 'nnnnnn...mm...', '.nnnnnn.mm....', '..nnnnnnmm....', '..nnTTnnm.....', '..nnTTnnn.....', '..nnnnnn......', '..nn..nn......', '..NN..NN......', '..............'],
    question_red: ['....rrrrrr....', '...rrwwwwrr...', '..rrwrrrrwrr..', '..rrrrrrrwrr..', '.......rrwrr..', '......rrwrr...', '.....rrwrr....', '.....rwrr.....', '.....rwr......', '.....rrr......', '..............', '.....rrr......', '.....rwr......', '.....rrr......'],
  };

  // recoloured variants of a base sprite
  const VARIANT = {
    heart_yellow: ['heart', { r: 'y', R: 'Y', w: 'l' }], heart_pink: ['heart', { r: 'i', R: 'I' }],
    fish_green: ['fish_blue', { b: 'g', c: 'L' }], fish_red: ['fish_blue', { b: 'r', c: 'o' }],
    arrow_up: ['arrow_down', null, 'flipY'], arrow_left: ['arrow_down', null, 'rotR'], arrow_right: ['arrow_down', null, 'rotL'],
  };

  // ------------------------------------------------------------ drawing
  const mk = (w, hh) => { const c = document.createElement('canvas'); c.width = w; c.height = hh; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return { c, x }; };
  /** Paint a grid into a 16×16 canvas with a 1px outline around everything. */
  function fromGrid(rows, swap, xf) {
    const { c, x } = mk(16, 16), N = 14;
    const at = (i, j) => { let [ii, jj] = [i, j]; if (xf === 'flipY') jj = N - 1 - j; if (xf === 'rotR') [ii, jj] = [j, N - 1 - i]; if (xf === 'rotL') [ii, jj] = [N - 1 - j, i]; const ch = (rows[jj] || '')[ii] || '.'; return swap && swap[ch] ? swap[ch] : ch; };
    const solid = (i, j) => i >= 0 && j >= 0 && i < N && j < N && at(i, j) !== '.';
    for (let j = -1; j <= N; j++) for (let i = -1; i <= N; i++) {
      if (solid(i, j)) { x.fillStyle = PAL[at(i, j)] || OUT; x.fillRect(i + 1, j + 1, 1, 1); }
      else if (solid(i - 1, j) || solid(i + 1, j) || solid(i, j - 1) || solid(i, j + 1)) { x.fillStyle = OUT; x.fillRect(i + 1, j + 1, 1, 1); }
    }
    return c;
  }
  /** Fit another canvas (a game sprite) into 16×16, keeping its pixels square. */
  function fit(src, sx = 0, sy = 0, sw = src.width, sh = src.height) {
    const { c, x } = mk(16, 16), k = Math.min(16 / sw, 16 / sh), w = Math.max(1, Math.round(sw * k)), hh = Math.max(1, Math.round(sh * k));
    x.drawImage(src, sx, sy, sw, sh, Math.floor((16 - w) / 2), Math.floor((16 - hh) / 2), w, hh);
    return c;
  }

  // people: drawn from a few parts so every family member looks different
  const SKINS = { light: ['#f6d3b3', '#e0b18c'], mid: ['#edbb93', '#d29a6e'], tan: ['#d9a06e', '#b9824f'], deep: ['#b97a4a', '#94592f'] };
  const DEELS = { blue: '#3f76db', red: '#e14b3d', green: '#2ea35f', purple: '#9466e0', pink: '#f06ca8', gold: '#e9a91f', teal: '#1fa3a3', brown: '#8a5a33', white: '#f2eee4' };
  /** One head-and-shoulders person at (ox, oy), r = head radius. hair: short|long|bun|pigtails|bald|scarf|baby; hairCol: colour. */
  function person(x, o, ox = 8, oy = 6, r = 4) {
    const [sk, skD] = SKINS[o.skin || 'mid'], hc = o.hairCol || '#3a2516', dc = DEELS[o.deel || 'blue'];
    const px = (X, Y, col) => { x.fillStyle = col; x.fillRect(Math.round(X), Math.round(Y), 1, 1); };
    const disc = (cx, cy, rx, ry, col, cond) => { for (let Y = Math.floor(cy - ry); Y <= Math.ceil(cy + ry); Y++) for (let X = Math.floor(cx - rx); X <= Math.ceil(cx + rx); X++) { const q = ((X + 0.5 - cx) / (rx + 0.3)) ** 2 + ((Y + 0.5 - cy) / (ry + 0.3)) ** 2; if (q <= 1 && (!cond || cond(X, Y))) px(X, Y, col); } };
    // shoulders (deel) with a gold collar
    const sy = oy + r + 1;
    disc(ox, sy + r * 0.9, r * 1.45, r * 0.95, OUT, (X, Y) => Y >= sy - 1);
    disc(ox, sy + r * 0.9, r * 1.45 - 1, r * 0.95 - 1, dc, (X, Y) => Y >= sy);
    px(ox - 1, sy, '#f7c646'); px(ox, sy, '#f7c646'); if (r >= 4) px(ox + 1, sy + 1, '#f7c646');
    if (o.hair === 'long') { const side = (X) => Math.abs(X + 0.5 - ox) > r - 1.5; disc(ox, oy + 1.5, r + 1.2, r + 1.5, OUT, (X, Y) => Y >= oy && side(X)); disc(ox, oy + 1.5, r + 0.4, r + 0.8, hc, (X, Y) => Y >= oy && side(X)); }
    if (o.hair === 'pigtails') { disc(ox - r - 1, oy + 2, 1.4, 1.6, OUT); disc(ox + r + 1, oy + 2, 1.4, 1.6, OUT); disc(ox - r - 1, oy + 2, 0.8, 1, hc); disc(ox + r + 1, oy + 2, 0.8, 1, hc); }
    if (o.hair === 'bun') { disc(ox, oy - r - 0.5, 1.8, 1.4, OUT); disc(ox, oy - r - 0.5, 1.1, 0.8, hc); }
    // head
    disc(ox, oy, r + 1, r + 1, OUT); disc(ox, oy, r, r, sk);
    for (let Y = oy - 1; Y <= oy + r; Y++) px(ox + r - 0.4, Y, skD);
    // hair on top
    if (o.hair === 'scarf') { disc(ox, oy, r + 1, r + 1, OUT, (X, Y) => Y <= oy - 1 || Math.abs(X + 0.5 - ox) > r - 1); disc(ox, oy, r, r, o.scarfCol || '#e14b3d', (X, Y) => Y <= oy - 1 || Math.abs(X + 0.5 - ox) > r - 1.2); }
    else if (o.hair === 'baby') { px(ox, oy - r, hc); px(ox + 1, oy - r - 1, hc); }
    else if (o.hair !== 'bald') disc(ox, oy - 0.6, r, r - 0.4, hc, (X, Y) => Y < oy - r * 0.25 || (o.hair !== 'short' && Math.abs(X + 0.5 - ox) > r - 1.2 && Y < oy + r * 0.5));
    else { disc(ox, oy, r, r, hc, (X, Y) => Math.abs(X + 0.5 - ox) > r - 1.1 && Y < oy + 1 && Y > oy - r * 0.6); }
    // face
    const ey = oy + (r >= 4 ? 0.5 : 0.2);
    px(ox - r * 0.45, ey, '#1e1a22'); px(ox + r * 0.45, ey, '#1e1a22');
    if (r >= 4) { px(ox - r * 0.7, ey + 1.5, '#f2a0a0'); px(ox + r * 0.7, ey + 1.5, '#f2a0a0'); px(ox - 0.5, oy + r * 0.62, '#a8312a'); px(ox + 0.5, oy + r * 0.62, '#a8312a'); }
    if (o.glasses) { px(ox - r * 0.45 - 1, ey, OUT); px(ox + r * 0.45 + 1, ey, OUT); px(ox, ey, OUT); }
    if (o.beard) { disc(ox, oy + r * 0.8, r * 0.7, 1.2, o.beard); }
    if (o.wave) { px(ox + r + 2, oy - 3, sk); px(ox + r + 2, oy - 2, sk); px(ox + r + 3, oy - 4, OUT); px(ox + r + 1, oy - 4, OUT); px(ox + r + 2, oy - 4, sk); }
  }
  const P1 = (o) => () => { const { c, x } = mk(16, 16); person(x, o); return c; };
  const PEOPLE = {
    woman: P1({ hair: 'long', deel: 'pink', skin: 'mid' }), man: P1({ hair: 'short', deel: 'blue', skin: 'tan' }),
    grandma: P1({ hair: 'bun', hairCol: '#d3d3dc', deel: 'purple', skin: 'mid', glasses: true }), grandpa: P1({ hair: 'bald', hairCol: '#d3d3dc', deel: 'brown', skin: 'tan', beard: '#e8e8f0' }),
    person: P1({ hair: 'short', hairCol: '#5a3a22', deel: 'teal', skin: 'mid' }), girl: P1({ hair: 'pigtails', deel: 'red', skin: 'light' }),
    boy: P1({ hair: 'short', deel: 'green', skin: 'mid' }), child: P1({ hair: 'short', hairCol: '#6a4630', deel: 'gold', skin: 'light' }),
    baby: () => { const { c, x } = mk(16, 16); person(x, { hair: 'baby', deel: 'white', skin: 'light' }, 8, 7, 4.5); return c; },
    woman_scarf: P1({ hair: 'scarf', scarfCol: '#2ea35f', deel: 'green', skin: 'tan' }), woman_gray: P1({ hair: 'long', hairCol: '#c9c9d4', deel: 'teal', skin: 'mid' }),
    man_gray: P1({ hair: 'short', hairCol: '#c9c9d4', deel: 'brown', skin: 'mid', beard: '#d3d3dc' }),
    raise_hand: P1({ hair: 'short', deel: 'gold', skin: 'mid', wave: true }),
    family3: () => { const { c, x } = mk(16, 16); person(x, { hair: 'short', deel: 'blue', skin: 'tan' }, 4, 4, 2.6); person(x, { hair: 'long', deel: 'pink' }, 12, 4, 2.6); person(x, { hair: 'pigtails', deel: 'red', skin: 'light' }, 8, 8, 2.4); return c; },
    family4: () => { const { c, x } = mk(16, 16); person(x, { hair: 'short', deel: 'blue', skin: 'tan' }, 4, 3, 2.4); person(x, { hair: 'long', deel: 'pink' }, 12, 3, 2.4); person(x, { hair: 'pigtails', deel: 'red', skin: 'light' }, 5, 9, 2); person(x, { hair: 'short', deel: 'green' }, 11, 9, 2); return c; },
    friends: () => { const { c, x } = mk(16, 16); person(x, { hair: 'short', deel: 'gold' }, 4.5, 5, 3); person(x, { hair: 'pigtails', deel: 'teal', skin: 'light' }, 11.5, 5, 3); x.fillStyle = '#edbb93'; x.fillRect(7, 12, 2, 1); return c; },
  };

  // sprites that come straight from the game's own art (so the horse icon is the same horse you ride)
  const PX = () => TG.pixel;
  const GAME = {
    horse: () => fit(PX().horse('bay', 0, false), 0, 0, 28, 22),
    dog: () => PX().iconCanvas('ui:dog'), ger: () => PX().iconCanvas('ui:ger'), coin: () => PX().iconCanvas('ui:coin'),
    sheep: () => fit(PX().beast('sheep', 0)), goat: () => fit(PX().beast('goat', 0)), cow: () => fit(PX().beast('cow', 0)), yak: () => fit(PX().beast('yak', 0)),
    camel: () => fit(PX().beast('camel', 0)), bear: () => fit(PX().beast('bear', 0)), reindeer: () => fit(PX().beast('reindeer', 0)), gazelle: () => fit(PX().beast('gazelle', 0)),
    kitten: () => fit(PX().beast('kitten', 0)), puppy: () => fit(PX().beast('puppy', 0)), takhi: () => fit(PX().beast('takhi', 0)), swan: () => fit(PX().beast('swan', 0)),
    bow: () => PX().iconCanvas('ui:bow'), ovoo: () => PX().iconCanvas('ui:ovoo'), wrestle: () => PX().iconCanvas('ui:wrestle'), bag: () => PX().iconCanvas('ui:bag'),
    shop: () => PX().iconCanvas('ui:shop'), morin: () => PX().iconCanvas('furn:morinkhuur'), shagai: () => PX().iconCanvas('furn:shagai'),
    perch: () => PX().iconCanvas('fish:perch'), lenok: () => PX().iconCanvas('fish:lenok'), taimen: () => PX().iconCanvas('fish:taimen'),
    airag: () => PX().iconCanvas('dairy:airag'), tarag: () => PX().iconCanvas('dairy:tarag'), urum: () => PX().iconCanvas('dairy:urum'), mare_milk: () => PX().iconCanvas('dairy:mare'),
    deel_blue: () => PX().iconCanvas('deel:blue'), deel_green: () => PX().iconCanvas('deel:green'), deel_pink: () => PX().iconCanvas('deel:pink'), deel_purple: () => PX().iconCanvas('deel:purple'), deel_gold: () => PX().iconCanvas('deel:gold'),
    raceflag: () => fit(PX().raceFlag('#e14b3d', 0)),
    // a few wild animals drawn from the herd art in new coats
  };

  // ------------------------------------------------------------ the emoji → icon table
  const EMOJI = {
    '⭐': 'star', '🌟': 'star_glow', '✨': 'sparkles', '❤️': 'heart', '💛': 'heart_yellow', '🩷': 'deel_pink', '💙': 'khadag',
    '🙂': 'smile', '😂': 'laugh', '😮': 'wow', '😨': 'scared', '😴': 'sleepy', '😮‍💨': 'tired',
    '📚': 'books', '📖': 'book_open', '🎓': 'grad_cap', '✍️': 'brush', '🔤': 'script', '📜': 'scroll', '🧠': 'brain', '💡': 'bulb', '💯': 'hundred',
    '🦉': 'owl', '❓': 'question', '🌈': 'rainbow', '🌱': 'sprout', '🌳': 'oak', '🌲': 'pine', '🏷️': 'tag', '🎙️': 'mic', '🎨': 'palette',
    '🛂': 'stamp', '🧭': 'compass', '🇲🇳': 'flag_mn', '🍃': 'leaves', '🍽️': 'plate', '🛡️': 'shield', '🏯': 'fortress', '🏠': 'home', '🏡': 'home_garden',
    '🎣': 'rod', '🏆': 'trophy', '🥇': 'medal_gold', '🏅': 'medal', '🎖️': 'medal_star', '🎯': 'target', '💪': 'arm', '🥋': 'zodog',
    '🦅': 'eagle', '🐘': 'elephant', '🦁': 'lion',
    '👵': 'grandma', '👴': 'grandpa', '👩': 'woman', '👨': 'man', '🧑': 'person', '👧': 'girl', '👦': 'boy', '🧒': 'child', '👶': 'baby', '🧕': 'woman_scarf',
    '👩‍🦳': 'woman_gray', '👨‍🦳': 'man_gray', '👨‍👩‍👧': 'family3', '👨‍👩‍👧‍👦': 'family4', '🧑‍🤝‍🧑': 'friends', '🙋': 'raise_hand', '👥': 'friends',
    '👋': 'wave', '👍': 'thumbs', '✋': 'hand', '👆': 'point_up', '✊': 'fist', '👐': 'open_hands', '🙏': 'thanks', '🤝': 'handshake',
    '🏙️': 'city', '🌋': 'volcano', '🏜️': 'desert', '🐻': 'bear', '🛤️': 'railway', '🏭': 'factory', '🦌': 'gazelle', '🪨': 'rock', '🏔️': 'mountain',
    '⛏️': 'pick', '🏛️': 'temple', '🦖': 'dino', '🌾': 'wheat', '🗿': 'statue', '🌊': 'wave_sea', '🍉': 'melon', '👑': 'crown',
    '📍': 'pin', '🐕': 'dog', '🌐': 'globe', '🌍': 'earth', '🚪': 'door', '🔒': 'lock', '🔓': 'unlock', '🔑': 'key', '🔴': 'rec', '🎲': 'dice', '⚙️': 'gear',
    '🔊': 'speaker', '🎵': 'note', '🔠': 'bigtext', '🐢': 'turtle', '📱': 'phone', '💸': 'money_fly', '🗣️': 'speak', '📶': 'signal', '🚫': 'no',
    '🐾': 'paw', '🎉': 'party', '🪙': 'coin', '🐑': 'sheep', '🎻': 'morin', '🐫': 'camel', '🐆': 'leopard', '🐺': 'wolf', '🐐': 'goat', '🐂': 'yak',
    '🦊': 'fox', '🐿️': 'squirrel', '🌙': 'moon', '☀️': 'sun', '🦴': 'bone', '🏃': 'run', '🖼️': 'picture', '🚌': 'bus', '⚔️': 'swords', '🥄': 'ladle',
    '🌞': 'sunrise', '🥟': 'buuz', '📢': 'megaphone', '📣': 'horn', '⬇': 'arrow_down', '⬆': 'arrow_up', '⬅': 'arrow_left', '➡': 'arrow_right',
    '🔥': 'fire', '👁': 'eye', '🌸': 'blossom', '🍂': 'leaf_fall', '❄️': 'snowflake', '📋': 'clipboard', '🗺️': 'map', '💬': 'speech', '🍖': 'meat',
    '🐄': 'cow', '🍶': 'jug', '🧀': 'aaruul', '🧈': 'butter', '🥣': 'bowl', '🥛': 'milk', '🐟': 'perch', '🐠': 'lenok', '🐡': 'taimen',
    '🔵': 'deel_blue', '🟢': 'deel_green', '🟣': 'deel_purple', '🟡': 'deel_gold', '🧢': 'cap', '🌼': 'flower_crown', '🎩': 'hat_mongol', '🧶': 'fur_hat',
    '👓': 'glasses', '🕶️': 'sunglasses', '🧣': 'scarf', '🐈': 'kitten', '🍝': 'tsuivan', '🍜': 'noodle', '🥩': 'jerky', '🥗': 'salad', '🍪': 'boortsog',
    '🍩': 'baursak', '🍵': 'tea', '🧃': 'juice', '💧': 'drop', '🥕': 'carrot', '⚠️': 'warning', '🔁': 'reload', '🛒': 'cart', '👗': 'wardrobe',
    '💰': 'moneybag', '⚡': 'bolt', '🏁': 'checkered', '🔔': 'bell', '⏱': 'stopwatch', '🎁': 'gift', '🧰': 'chest', '🛋️': 'cushion', '👘': 'deel_shirt',
    '🎮': 'gamepad', '💨': 'puff', '⚖': 'scale', '⛺': 'ger', '🐎': 'horse', '🐴': 'horse_head', '🏹': 'bow',
  };
  // hands are skin-coloured grids
  Object.assign(SPR, {
    wave: ['.........k....', '....s.s.s.k...', '....s.s.s..k..', '.s..s.s.s.....', '.s..sssss.....', '.ss.ssssss....', '..sssssssS....', '..ssssssss....', '...sssssSS....', '...ssssSS.....', '....sssS......', '....SSS.......', '..............', '..............'],
    hand: ['..............', '....ss.ss.....', '....ss.ss.ss..', '.ss.ss.ss.ss..', '.ss.ssssssss..', '.ssssssssss...', '..sssssssss...', '..ssssssssS...', '...sssssssS...', '...ssssssS....', '....ssssS.....', '....SSSS......', '..............', '..............'],
    thumbs: ['..............', '.....ss.......', '.....ss.......', '....sss.......', '....sss.......', '.bbsssssssss..', '.bbssssssSSs..', '.bbsssssssss..', '.bbssssssSSs..', '.bbsssssssss..', '.bbssssssSSs..', '.bbsssssssS...', '..............', '..............'],
    point_up: ['.....ss.......', '.....ss.......', '.....ss.......', '.....ss.......', '.....sssss....', '...ssssssss...', '...sssssssss..', '...ssssSsSss..', '...sssssssss..', '....sssssss...', '....ssssssS...', '.....sssSS....', '.....bbbbb....', '.....bbbbb....'],
    fist: ['..............', '..............', '...sss.ss.....', '..ssssssssss..', '..sSsSsSsSss..', '..ssssssssss..', '..sssssssssS..', '..ssssssssSS..', '...ssssssSS...', '....ssssSS....', '....bbbbbb....', '....bbbbbb....', '....bbbbbb....', '..............'],
    open_hands: ['..............', '.s.s......s.s.', '.s.s.s..s.s.s.', '.s.s.s..s.s.s.', 'ssssss..ssssss', 'ssssss..ssssss', 'sssssS..Ssssss', '.ssssS..Sssss.', '..sssS..Ssss..', '...ss....ss...', '..............', '..............', '..............', '..............'],
    thanks: ['......ss......', '.....ssss.....', '.....ssss.....', '....ssSsss....', '....ssSsss....', '...sssSssss...', '...sssSssss...', '..ssssSsssss..', '..ssssSsssss..', '..ssssSssssS..', '...sssSsssS...', '...bbbbbbbb...', '...bbbbbbbb...', '..............'],
    handshake: ['..............', '..............', '..............', 'bb..........yy', 'bbb..ssss..yyy', 'bbbsssssssyyyy', 'bbssSsSsSsssyy', 'bbsssssssssyyy', 'bbbssSsSssyyyy', 'bb..ssssss..yy', '.....ssss.....', '..............', '..............', '..............'],
    wave_sea: ['..............', '......CCCC....', '....CCCccCC...', '...CCcwwwcC...', '..CCcw...wc...', '..Ccw....CC...', '.CCcw.........', '.CCcc....C..C.', 'CCCCcc..CCCCCC', 'CcCCCCCCCcCCCC', 'CCCCcCCCCCCcCC', 'bbbbbbbbbbbbbb', 'BBBBBBBBBBBBBB', '..............'],
  });

  // ------------------------------------------------------------ canvases, data URLs and <img> icons
  const cache = new Map(), urls = new Map();
  function canvas(id) {
    if (cache.has(id)) return cache.get(id);
    let c = null;
    try {
      if (SPR[id]) c = fromGrid(SPR[id]);
      else if (VARIANT[id]) { const [base, swap, xf] = VARIANT[id]; c = fromGrid(SPR[base], swap, xf); }
      else if (PEOPLE[id]) c = PEOPLE[id]();
      else if (GAME[id] && TG.pixel) c = GAME[id]();
    } catch (e) { c = null; }
    if (c) cache.set(id, c);
    return c;
  }
  function url(id) {
    if (urls.has(id)) return urls.get(id);
    const c = canvas(id); if (!c) return '';
    const u = c.toDataURL(); urls.set(id, u); return u;
  }
  /** An <img> of a pixel icon. id: an icon name or an emoji. */
  function img(id, size, cls = '') {
    const key = EMOJI[id] || EMOJI[norm(id)] || id, el = document.createElement('img');
    el.src = url(key); el.alt = ''; el.draggable = false; el.className = 'emo ' + cls; el.dataset.icon = key;
    if (size) { el.width = size; el.height = size; el.style.height = size + 'px'; el.style.width = size + 'px'; }
    return el;
  }

  // ------------------------------------------------------------ finding emoji in text
  const norm = (s) => s.replace(/️/g, '');
  const KEYS = Object.keys(EMOJI).map(norm).sort((a, b) => b.length - a.length);
  const NORM = {}; for (const [k, v] of Object.entries(EMOJI)) NORM[norm(k)] = v;
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const RX = new RegExp('(' + KEYS.map((k) => [...k].map((ch) => esc(ch) + '\\uFE0F?').join('')).join('|') + ')', 'gu');
  // any other emoji (typed by a player, say) is dropped from labels and canvases
  const ANY = /(?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:️|‍(?:\p{Extended_Pictographic}))*/gu;
  // plain symbols the game uses as text (battle hearts, stars, ticks, arrows) are not emoji and stay as they are
  const KEEP = new Set(['♥', '♡', '★', '☆', '✓', '✔', '✗', '✕', '✖', '→', '←', '↑', '↓', '↔', '♪', '☰', '⇄', '↺', '➤', '©', '®', '™', '‼', '⁉']);
  // a cheap first look: ordinary text (Latin, Cyrillic, digits, the kept symbols) has no character that could start an emoji
  const MAYBE = /[\u00a9\u00ae\u203c\u2049\u2122\u2139\u2194-\u2199\u21a9\u21aa\u231a-\u23ff\u24c2\u25aa-\u27bf\u2934\u2935\u2b05-\u2b55\u3030\u303d\u3297\u3299\ud83c-\ud83e]/;
  const other = (s) => { if (!MAYBE.test(s)) return false; ANY.lastIndex = 0; const r = [...s.matchAll(ANY)].some((m) => !KEEP.has(norm(m[0])) && !NORM[norm(m[0])]); ANY.lastIndex = 0; return r; };
  const dropOther = (s) => s.replace(ANY, (e) => (KEEP.has(norm(e)) || NORM[norm(e)] ? e : ''));
  const has = (s) => { if (!s || !MAYBE.test(s)) return false; RX.lastIndex = 0; const r = !!s && RX.test(s); RX.lastIndex = 0; return r; };
  const strip = (s) => dropOther(s).replace(RX, '').replace(/\s{2,}/g, ' ').trim();
  /** Split text into strings and icon ids. */
  function parts(s) {
    const out = []; let last = 0; RX.lastIndex = 0; let m;
    while ((m = RX.exec(s))) { if (m.index > last) out.push(s.slice(last, m.index)); out.push({ icon: NORM[norm(m[0])] }); last = m.index + m[0].length; }
    if (last < s.length) out.push(s.slice(last));
    return out;
  }

  // ------------------------------------------------------------ the page: swap emoji in text for <img> icons
  const SKIP = /^(SCRIPT|STYLE|TEXTAREA|INPUT|OPTION|TITLE|CANVAS|SVG|svg)$/;
  function swapText(node) {
    const s = node.nodeValue; if (!has(s)) return;
    const parent = node.parentNode; if (!parent || SKIP.test(parent.nodeName)) { if (parent && parent.nodeName === 'OPTION') node.nodeValue = strip(s); return; }
    const frag = document.createDocumentFragment();
    for (const p of parts(s)) frag.appendChild(typeof p === 'string' ? document.createTextNode(p) : img(p.icon));
    parent.replaceChild(frag, node);
  }
  const ATTRS = ['title', 'aria-label', 'placeholder', 'alt'];
  function swapAttrs(el) { if (!el.getAttribute) return; for (const a of ATTRS) { const v = el.getAttribute(a); if (v && (has(v) || other(v))) el.setAttribute(a, strip(v)); } }
  function walk(root) {
    if (root.nodeType === 3) return swapText(root);
    if (root.nodeType !== 1 || SKIP.test(root.nodeName)) return;
    swapAttrs(root);
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT), todo = [];
    let n; while ((n = tw.nextNode())) { if (n.nodeType === 3) { if (has(n.nodeValue)) todo.push(n); } else swapAttrs(n); }
    todo.forEach(swapText);
  }
  function watch() {
    walk(document.body);
    new MutationObserver((list) => {
      for (const m of list) {
        if (m.type === 'characterData') swapText(m.target);
        else if (m.type === 'attributes') swapAttrs(m.target);
        else m.addedNodes.forEach(walk);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  // ------------------------------------------------------------ canvases: draw icons in place of emoji in fillText
  const C2D = window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype;
  if (C2D && !C2D.__pxIcons) {
    C2D.__pxIcons = true;
    const fill = C2D.fillText, stroke = C2D.strokeText, measure = C2D.measureText;
    const sizeOf = (ctx) => { const m = /(\d+(?:\.\d+)?)px/.exec(ctx.font); return m ? +m[1] : 10; };
    const lay = (ctx, text) => {
      const ps = parts(dropOther(text)), s = Math.round(sizeOf(ctx) * 1.05), gap = Math.round(s * 0.08);
      let w = 0; const ws = ps.map((p) => { const ww = typeof p === 'string' ? measure.call(ctx, p).width : s + gap; w += ww; return ww; });
      return { ps, ws, w, s };
    };
    const plain = (t) => !MAYBE.test(t) || (!has(t) && !other(t));
    C2D.measureText = function (text) {
      text = String(text);
      if (plain(text)) return measure.call(this, text);
      const L0 = lay(this, text), m = measure.call(this, 'M'); return { width: L0.w, actualBoundingBoxAscent: m.actualBoundingBoxAscent, actualBoundingBoxDescent: m.actualBoundingBoxDescent };
    };
    const draw = function (orig, text, X, Y, maxW) {
      text = String(text);
      if (plain(text)) return maxW === undefined ? orig.call(this, text, X, Y) : orig.call(this, text, X, Y, maxW);
      const { ps, ws, w, s } = lay(this, text), al = this.textAlign, bl = this.textBaseline;
      let x0 = al === 'center' ? X - w / 2 : al === 'right' || al === 'end' ? X - w : X;
      const iy = bl === 'middle' ? Y - s / 2 : bl === 'top' || bl === 'hanging' ? Y : bl === 'bottom' || bl === 'ideographic' ? Y - s : Y - s * 0.82;
      this.save(); this.textAlign = 'left'; const smooth = this.imageSmoothingEnabled; this.imageSmoothingEnabled = false;
      ps.forEach((p, i) => {
        if (typeof p === 'string') orig.call(this, p, x0, Y);
        else if (orig === fill) { const c = canvas(p.icon); if (c) this.drawImage(c, Math.round(x0), Math.round(iy), s, s); }
        x0 += ws[i];
      });
      this.imageSmoothingEnabled = smooth; this.restore();
    };
    C2D.fillText = function (t, x, y, mw) { return draw.call(this, fill, t, x, y, mw); };
    C2D.strokeText = function (t, x, y, mw) { return draw.call(this, stroke, t, x, y, mw); };
  }

  // ------------------------------------------------------------ achievement badges (32×32): a frame per category, a unique emblem inside
  const FRAME = {
    learn: { rim: '#2b52a5', fill: '#93d4f6', hi: '#d6ecfb', trim: '#f7c646' },
    family: { rim: '#c2427e', fill: '#f8c6dc', hi: '#fde6f0', trim: '#f7c646' },
    nutag: { rim: '#3f7a2c', fill: '#a6dc6a', hi: '#dff3c4', trim: '#f7c646' },
    naadam: { rim: '#a8312a', fill: '#fbd27a', hi: '#fff0c4', trim: '#e14b3d' },
  };
  function badge(emblem, cat) {
    const key = 'badge:' + emblem + ':' + cat; if (cache.has(key)) return cache.get(key);
    const { c, x } = mk(32, 32), F = FRAME[cat] || FRAME.learn;
    const px = (X, Y, col) => { x.fillStyle = col; x.fillRect(X, Y, 1, 1); };
    const inShape = (X, Y, r) => {
      const dx = X + 0.5 - 16, dy = Y + 0.5 - 15;
      if (cat === 'learn') return dx * dx + dy * dy <= r * r;                                        // a round medallion
      if (cat === 'family') { const t = (dy + r) / (2 * r); return Math.abs(dy) <= r && Math.abs(dx) <= r * (t < 0.55 ? 1 : 1 - (t - 0.55) * 2.0); } // a shield
      if (cat === 'nutag') return Math.abs(dx) <= r * 0.93 && Math.abs(dx) * 0.55 + Math.abs(dy) <= r;  // a hexagon
      const a = Math.atan2(dy, dx), rr = r * (0.86 + 0.14 * Math.cos(a * 8)); return dx * dx + dy * dy <= rr * rr; // a rosette
    };
    // ribbons behind the badge
    const rib = cat === 'naadam' ? ['#e14b3d', '#3f76db'] : cat === 'family' ? ['#f492ba', '#f7c646'] : cat === 'nutag' ? ['#3f76db', '#e14b3d'] : ['#e14b3d', '#f7c646'];
    for (let Y = 22; Y < 32; Y++) { for (let X = 8; X < 13; X++) px(X - (Y - 22) * 0.3 | 0, Y, (Y === 31 && X === 10) ? 'rgba(0,0,0,0)' : rib[0]); for (let X = 19; X < 24; X++) px(X + (Y - 22) * 0.3 | 0, Y, (Y === 31 && X === 21) ? 'rgba(0,0,0,0)' : rib[1]); }
    for (let Y = 0; Y < 32; Y++) for (let X = 0; X < 32; X++) {
      if (inShape(X, Y, 14.5)) px(X, Y, OUT);
      if (inShape(X, Y, 13.5)) px(X, Y, F.rim);
      if (inShape(X, Y, 12)) px(X, Y, F.trim);
      if (inShape(X, Y, 11)) px(X, Y, (X + Y) % 9 === 0 ? F.hi : F.fill);
    }
    for (let i = 0; i < 6; i++) px(9 + i, 6 + Math.round(i * 0.2), F.hi);                       // a shine on the upper left
    const em = canvas(emblem); if (em) x.drawImage(em, 8, 7);
    cache.set(key, c); return c;
  }
  /** A badge <img>. Locked ones are shown greyed out by CSS (.ach:not(.on) .ach-badge). */
  function badgeImg(emblem, cat, cls = '') {
    const k = 'badge:' + emblem + ':' + cat;
    if (!urls.has(k)) { const b = badge(emblem, cat); urls.set(k, b ? b.toDataURL() : ''); }
    const el = document.createElement('img'); el.src = urls.get(k); el.alt = ''; el.draggable = false; el.className = 'ach-badge ' + cls; return el;
  }

  TG.icons = { PAL, SPR, EMOJI, canvas, url, img, badge, badgeImg, strip, parts, has, ids: () => [...new Set([...Object.keys(SPR), ...Object.keys(VARIANT), ...Object.keys(PEOPLE), ...Object.keys(GAME)])], walk };
  TG.px = img;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();
})(window.TG);
