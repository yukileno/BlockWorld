'use strict';
/* =====================================================================
   BlockWorld — 問題を解いてブロックをゲットして、ブロックワールドであそぶ
   小5算数「10. 面積」「9. 分数」れんしゅう（スタート画面で単元をきりかえ）（HTML5 + Vanilla JS／完全無料・外部API不使用）
   ===================================================================== */
(function () {

/* ---------- 基本ユーティリティ ---------- */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const PK = a => a[R(0, a.length - 1)];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = R(0, i);[a[i], a[j]] = [a[j], a[i]]; } return a; };
const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };

/* ---------- 数学ユーティリティ（仕様 7.1） ---------- */
const gcd = (a, b) => (b === 0 ? Math.abs(a) : gcd(b, a % b));
const lcm = (a, b) => Math.abs(a * b) / gcd(a, b);
const red = (n, d) => { const g = gcd(n, d) || 1; return [n / g, d / g]; };

/* ---------- 分数の HTML ---------- */
const fh = (n, d) => `<span class="frac"><span class="num">${n}</span><span class="bar"></span><span class="den">${d}</span></span>`;
const mh = (w, n, d) => `<span class="mixed"><span class="whole">${w}</span>${fh(n, d)}</span>`;
const ansFr = (n, d) => d === 1 ? `${n}` : n > d ? `${fh(n, d)}（${mh(Math.floor(n / d), n % d, d)}）` : fh(n, d);
const altFr = (n, d) => (n > d && d > 1 && n % d) ? `${fh(n, d)} ＝ ${mh(Math.floor(n / d), n % d, d)}` : '';
const decStr = x => String(+x.toFixed(6));

/* =====================================================================
   セーブデータ（localStorage）
   ===================================================================== */
const KEY = 'blockworld.v1';
/* 単元ごとに復習リスト(wrongXxx)と正解数(totalXxx)を分けて保存する。単元を増やすときは UNITS と UNIT_KEYS に足す */
const UNIT_KEYS = ['area', 'frac'];
const UNIT_CAP = { area: 'Area', frac: 'Frac' };
const DEF = { unit: 'area', wrongArea: [], wrongFrac: [], totalArea: 0, totalFrac: 0, wrong: [], total: 0, sound: true, manual: false };
const clone = o => JSON.parse(JSON.stringify(o));
function loadSave() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null') || {};
    const s = Object.assign(clone(DEF), raw);
    if (!raw.wrongFrac && Array.isArray(raw.wrong)) { s.wrongFrac = raw.wrong; s.totalFrac = raw.total || 0; } // 以前の学習履歴は「9. 分数」へ引きつぐ
    s.wrong = [];
    if (!UNIT_KEYS.includes(s.unit)) s.unit = 'area';
    return s;
  } catch (e) { return clone(DEF); }
}
function persist() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* 保存できない環境でも遊べる */ } }
let save = loadSave();

/* ---- ブロックわーるど連携：同じブラウザの localStorage を通して、ブロックとあそび時間をわたす ---- */
const MC_HOTBAR_KEY = 'maikura_hotbar_v2', MC_TIMER_KEY = 'maikura_build_timer_v1';
const MC_MAX_SEC = 180, MC_SEC_PER_Q = 20, MC_BLOCKS_PER_Q = 3;
const MC_TNT = [27, 'TNT'], MC_TNT_RATE = 0.05; // TNTは算数の景品だけ。1問ごとに5%でGET
const MC_BLOCKS = [[1, '草ブロック'], [2, '土'], [10, '丸石'], [11, '木板'], [6, '原木'], [12, 'レンガ'], [13, 'ガラス'], [18, '金ブロック'], [19, 'ダイヤブロック'], [28, '松明']];
function mcSlots() {
  try { const a = JSON.parse(localStorage.getItem(MC_HOTBAR_KEY) || 'null'); if (Array.isArray(a) && a.length === 9) return a; } catch (e) { /* 読めなければ空から */ }
  return Array.from({ length: 9 }, () => ({ blockId: null, count: 0 }));
}
function mcSeconds() { const v = Number(localStorage.getItem(MC_TIMER_KEY)); return Number.isFinite(v) && v > 0 ? Math.min(v, MC_MAX_SEC) : 0; }
function mcState() { return { sec: Math.floor(mcSeconds()), blocks: mcSlots().reduce((n, s) => n + (s.blockId !== null ? s.count : 0), 0) }; }
const mmss = sec => Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
/** 正解した問題の数だけ、ブロックとあそび時間（さいだい3分）をプレゼント */
function mcReward(units) {
  const got = {}; let sec = mcSeconds(), added = 0;
  try {
    const slots = mcSlots();
    for (let u = 0; u < units; u++) {
      const isTnt = Math.random() < MC_TNT_RATE;
      const [id, name] = isTnt ? MC_TNT : PK(MC_BLOCKS);
      let i = slots.findIndex(x => x.blockId === id && x.count > 0);
      if (i < 0) i = slots.findIndex(x => !x.blockId || x.count <= 0);
      if (i < 0) continue;
      slots[i] = { blockId: id, count: (slots[i].blockId === id ? slots[i].count : 0) + (isTnt ? 1 : MC_BLOCKS_PER_Q) };
      got[name] = (got[name] || 0) + (isTnt ? 1 : MC_BLOCKS_PER_Q);
      const next = Math.min(MC_MAX_SEC, sec + MC_SEC_PER_Q); added += next - sec; sec = next;
    }
    localStorage.setItem(MC_HOTBAR_KEY, JSON.stringify(slots));
    localStorage.setItem(MC_TIMER_KEY, String(Math.floor(sec)));
  } catch (e) { /* 保存できない環境では何もしない */ }
  return { got, added, full: sec >= MC_MAX_SEC };
}

/* =====================================================================
   効果音（Web Audio API：外部ファイルなし）／ 音声（Web Speech API）
   ===================================================================== */
let ac = null;
function AC() {
  if (!save.sound) return null;
  try {
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
  } catch (e) { return null; }
  return ac;
}
function tone(freq, t0, dur, type, vol, slideTo) {
  const a = AC(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + t0;
  o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.15, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.05);
}
function noise(t0, dur, vol, f1, f2) {
  const a = AC(); if (!a) return;
  const len = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = a.createBufferSource(); s.buffer = buf;
  const f = a.createBiquadFilter(), g = a.createGain(), t = a.currentTime + t0;
  f.type = 'bandpass'; f.frequency.setValueAtTime(f1, t); f.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.value = vol; s.connect(f); f.connect(g); g.connect(a.destination); s.start(t);
}
const SFX = {
  click() { tone(660, 0, 0.05, 'square', 0.04); },
  correct() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.08, 0.25, 'triangle', 0.14)); },
  wrong() { tone(220, 0, 0.18, 'sawtooth', 0.09, 150); tone(165, 0.16, 0.25, 'sawtooth', 0.09, 110); },
  combo(n) { const b = 523 + Math.min(n, 12) * 40;[0, 1, 2, 3].forEach(i => tone(b * Math.pow(1.26, i), i * 0.06, 0.2, 'square', 0.07)); },
  slash() { noise(0, 0.25, 0.5, 4000, 400); tone(900, 0, 0.2, 'sawtooth', 0.08, 120); },
  levelup() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.12, 0.3, 'triangle', 0.16)); },
  clear() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.1, 0.35, 'triangle', 0.16)); tone(1047, 0.5, 0.8, 'sine', 0.14); },
  boss() { noise(0, 0.6, 0.6, 2000, 80);[392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.2 + i * 0.1, 0.4, 'sawtooth', 0.09)); }
};

/* =====================================================================
   問題ビルダー
   画面(screen) = { id, dai, kind:'k'|'t', inst, parts[], fields[], units[[]], vis, hint, hintVis, sol, ... }
   parts : 文字列(HTML) | {f:i} | {fr:[上,下]}   ※上下にも {f:i} を置ける
   fields: word / int / dec / frac / cmp / pick
   ===================================================================== */
const F = i => ({ f: i });
const INT = (ans, extra) => Object.assign({ t: 'int', ans }, extra || {});
const DEC = ans => ({ t: 'dec', ans });
const FRC = (n, d, extra) => { const r = red(n, d); return Object.assign({ t: 'frac', ans: r, mx: r[0] > r[1] && r[1] > 1 }, extra || {}); };
const CFR = (n, d) => ({ t: 'frac', ans: [n, d], any: true, mx: false });
const SC = o => { o.units = o.units || o.fields.map((_, i) => [i]); o.kind = o.kind || 'k'; return o; };
const BIAS = '<b>ストップ！</b>分母（目盛りの大きさ）がちがう分数は、そのまま分母同士・分子同士を足し引きできないよ！まずは『通分』して分母を最小公倍数の ';

/* ---- 大問1 ---- */
const CHIP1 = ['約分', '通分', '倍分', '公約数', '最大公約数', '約数', '倍数', '最小公倍数', '分子', '分母'];
function B1(s) {
  const chips = CHIP1;
  const W = a => ({ t: 'word', ans: a, opts: chips });
  const YAKU = () => W(['約分', 'やくぶん']), KOU = () => W(['公約数', '最大公約数', 'こうやくすう', 'さいだいこうやくすう']),
    TSU = () => W(['通分', 'つうぶん']), SAI = () => W(['最小公倍数', '公倍数', 'さいしょうこうばいすう', 'こうばいすう']),
    BS = () => W(['分子', 'ぶんし']), BB = () => W(['分母', 'ぶんぼ']);
  const inst = '（　）にあてはまることばを、［　］にあてはまる整数をかきましょう。';
  const [n, d] = [[2, 5], [5, 7], [7, 9]][s];
  return [
    SC({ id: `1-${s}-1`, dai: 1, inst, parts: ['分数の分母と分子を同じ数でわって、分母が小さい分数にすることを、', F(0), 'するといい、<br>分母と分子を、それらの', F(1), 'でわっていきます。'], fields: [YAKU(), KOU()], hint: '「分母を<b>小さく</b>する」のは約分。分母と分子を、どちらもわれる数（公約数）でわるよ。', sol: '約分：分母と分子を<b>公約数</b>でわる。' }),
    SC({ id: `1-${s}-2`, dai: 1, inst, parts: ['分母がちがういくつかの分数を、分母が同じ分数になおすことを', F(0), 'するといい、<br>分母の', F(1), 'を分母にします。'], fields: [TSU(), SAI()], hint: '「分母を<b>そろえる</b>」のは通分。分母にするのは、分母どうしの公倍数（いちばん小さいもの）だよ。', sol: '通分：分母を<b>最小公倍数</b>にそろえる。（「公倍数」でも正解）' }),
    mk1c(n, d, `1-${s}-3`),
    SC({ id: `1-${s}-4`, dai: 1, inst, parts: ['分数を小数で表すには、', F(0), 'を', F(1), 'でわります。'], fields: [BS(), BB()], hint: `${fh(3, 4)} は 3÷4 と同じ。<b>上の数</b>を<b>下の数</b>でわるよ。`, sol: `分数 → 小数：<b>分子</b>÷<b>分母</b>（例：${fh(1, 8)}＝1÷8＝0.125）` })
  ];
}
function mk1c(n, d, id) {
  return SC({
    id, dai: 1, inst: '（　）にあてはまることばを、［　］にあてはまる整数をかきましょう。',
    parts: [`${fh(n, d)} は、次の2通りに考えることができます。<br>ア：${fh(n, d)} は、${fh(1, d)} の `, F(0), ' 個分<br>イ：' + fh(n, d) + ' は、', F(1), ' ÷ ', F(2), ' の商'],
    fields: [INT(n), INT(n), INT(d)], units: [[0], [1, 2]], revPair: [1, 2],
    vis: { k: 'cake', n, d },
    hint: `${fh(1, d)} が いくつ集まったかな？ イは「上の数÷下の数」の順だよ。`,
    sol: `ア：${fh(1, d)} が ${n} 個分。イ：${fh(n, d)} ＝ ${n} ÷ ${d}（分子÷分母）。`
  });
}

/* ---- 大問2 ---- */
function mk2a(n, d, k1, k2, id) {
  return SC({
    id, dai: 2, inst: '［　］にあてはまる数をかきましょう。',
    parts: [fh(n, d), ' ＝ ', { fr: [F(0), d * k1] }, ' ＝ ', { fr: [n * k2, F(1)] }],
    fields: [INT(n * k1, { traps: [{ v: n + (d * k1 - d), msg: 'たし算で考えていないかな？ もとの分数の分母と分子に「同じ数をかける」んだよ！' }] }),
      INT(d * k2, { traps: [{ v: d * k1 + (n * k2 - n * k1), msg: 'たし算で考えていないかな？ もとの ' + fh(n, d) + ' を何倍したかを考えよう（かけ算だよ）！' }] })],
    hint: `もとの ${fh(n, d)} の分母と分子に、同じ数を<b>かける</b>と、大きさは同じまま。分母 ${d}→${d * k1} は ${k1}倍、分子 ${n}→${n * k2} は ${k2}倍だね。`,
    hintVis: { k: 'bars', rows: [[n, d], [n * k1, d * k1], [n * k2, d * k2]] },
    sol: `${fh(n, d)} ＝ ${fh(n * k1, d * k1)}（×${k1}）＝ ${fh(n * k2, d * k2)}（×${k2}）`
  });
}
function mk2b(chain, id) {
  const parts = [], fields = [];
  chain.forEach((c, i) => {
    if (i) parts.push(' ＝ ');
    if (!c[2]) { parts.push(fh(c[0], c[1])); return; }
    const k = fields.length;
    if (c[2] === 'n') { parts.push({ fr: [F(k), c[1]] }); fields.push(INT(c[0])); }
    else { parts.push({ fr: [c[0], F(k)] }); fields.push(INT(c[1])); }
  });
  return SC({
    id, dai: 2, inst: '［　］にあてはまる数をかきましょう。', parts, fields,
    hint: '分母と分子を、同じ数で<b>わって</b>いこう。はじめの分数の分母と分子に共通する数を探してね。',
    hintVis: { k: 'bars', rows: chain.map(c => [c[0], c[1]]) },
    sol: chain.map(c => fh(c[0], c[1])).join(' ＝ ')
  });
}

/* ---- 大問3 ---- */
function mk3(n, d, id) {
  const g = gcd(n, d), r = red(n, d);
  return SC({
    id, dai: 3, tag: 'slash', inst: '次の分数を約分しましょう。（分母をできるだけ小さくしましょう。）',
    parts: [fh(n, d), ' ＝ ', F(0)], fields: [FRC(n, d)],
    vis: { k: 'golem', n, d },
    hint: `分母 ${d} と分子 ${n} を、どちらも同じ数でわってみよう。九九を思い出して！（ヒント：${g} でわれるよ）`,
    sol: `${fh(n, d)} ＝ ${fh(n / g, d / g)}（分母と分子を ${g} でわる）${r[0] > r[1] && r[1] > 1 ? '　帯分数なら ' + mh(Math.floor(r[0] / r[1]), r[0] % r[1], r[1]) : ''}`
  });
}

/* ---- 大問4 ---- */
function calc4(terms) {
  let a = 0, b = 1;
  terms.forEach(t => { const sn = t.s * ((t.w || 0) * t.d + t.n); const L = lcm(b, t.d); a = a * (L / b) + sn * (L / t.d); b = L; });
  return red(a, b);
}
const T = (w, n, d, s) => ({ w, n, d, s: s || 1 });
function mk4(pat, terms, id) {
  const ans = calc4(terms), L = terms.reduce((x, t) => lcm(x, t.d), 1);
  const expr = terms.map((t, i) => (i ? (t.s > 0 ? ' ＋ ' : ' － ') : '') + (t.w ? mh(t.w, t.n, t.d) : fh(t.n, t.d))).join('');
  const conv = terms.map(t => ((t.w || 0) * t.d + t.n) * L / t.d);
  const sumN = conv.reduce((x, c, i) => x + terms[i].s * c, 0);
  const traps = [];
  if (terms.length === 2 && !terms[0].w && !terms[1].w) {
    const [a, b] = terms, tn = b.s > 0 ? a.n + b.n : a.n - b.n, td = b.s > 0 ? a.d + b.d : a.d - b.d;
    if (tn > 0 && td > 0) traps.push({ n: tn, d: td, msg: BIAS + L + ' にそろえよう！' });
  }
  const rows = []; terms.forEach((t, i) => rows.push([((t.w || 0) * t.d + t.n), t.d])); conv.forEach(c => rows.push([c, L]));
  return SC({
    id, dai: 4, tag: pat === 4 ? 'triple' : undefined, inst: '次の計算をしましょう。',
    parts: [expr, ' ＝ ', F(0)], fields: [FRC(ans[0], ans[1], { traps })],
    vis: { k: 'fusion', terms: terms.map(t => [((t.w || 0) * t.d + t.n), t.d]) },
    hint: `分母 ${[...new Set(terms.map(t => t.d))].join(' と ')} の最小公倍数は <b>${L}</b>。分母を ${L} にそろえて（通分して）から計算しよう。計算のあとに約分できるかも確認！`,
    hintVis: { k: 'bars', rows },
    sol: `通分（分母を${L}に）：${conv.map((c, i) => (i ? (terms[i].s > 0 ? ' ＋ ' : ' － ') : '') + fh(c, L)).join('')} ＝ ${fh(sumN, L)}${gcd(sumN, L) > 1 ? ' ＝ ' + ansFr(ans[0], ans[1]) : (ans[0] > ans[1] && ans[1] > 1 ? '（' + mh(Math.floor(ans[0] / ans[1]), ans[0] % ans[1], ans[1]) + '）' : '')}`
  });
}

/* ---- 大問5 ---- */
function mk5(a, b, c, d, id) {
  const L = lcm(b, d), l = a * L / b, r = c * L / d, sym = l > r ? '>' : l < r ? '<' : '=';
  return SC({
    id, dai: 5, inst: `（例）にならって、分数を通分して〔　〕にかき、不等号を入れましょう。<br>（例）${fh(1, 2)} ［＞］ ${fh(1, 3)}　〔 ${fh(3, 6)} 、 ${fh(2, 6)} 〕`,
    parts: [fh(a, b), ' ', F(2), ' ', fh(c, d), '　〔 ', F(0), ' 、 ', F(1), ' 〕'],
    fields: [CFR(l, L), CFR(r, L), { t: 'cmp', ans: sym }], units: [[0, 1, 2]], joint: 'cden',
    vis: { k: 'scale', a: [a, b], c: [c, d] },
    hint: `${b} と ${d} の最小公倍数は <b>${L}</b>（どんな公倍数でも、分母がそろえばOK）。2つの分数を同じ分母にそろえてから、分子の大きさをくらべよう。`,
    hintVis: { k: 'bars', rows: [[a, b], [c, d], [l, L], [r, L]] },
    sol: `通分すると ${fh(l, L)} と ${fh(r, L)}。だから ${fh(a, b)} ${sym} ${fh(c, d)}`
  });
}

/* ---- 大問6 ---- */
const INST6 = '次の分数は小数で、整数・小数は分数で表しましょう。（約分できるときは約分しましょう。）';
function mk6f(n, d, id) {
  const v = n / d;
  return SC({ id, dai: 6, inst: INST6, parts: [fh(n, d), ' ＝ ', F(0)], fields: [DEC(v)], hint: `${fh(n, d)} は ${n} ÷ ${d}。わり算の筆算で、わり切れるまで計算しよう（小数点をわすれずに）。`, sol: `${n} ÷ ${d} ＝ ${decStr(v)}` });
}
function mk6d(str, id) {
  const k = (str.split('.')[1] || '').length, den = Math.pow(10, k), num = Math.round(parseFloat(str) * den), r = red(num, den);
  return SC({
    id, dai: 6, inst: INST6, parts: [str, ' ＝ ', F(0)], fields: [FRC(num, den, { mx: true })],
    hint: `小数第${k}位まであるから、分母は ${den}。${str} を ${den} 倍した数が分子だよ。約分できるときは約分しよう。`,
    sol: `${str} ＝ ${fh(num, den)}${gcd(num, den) > 1 ? ' ＝ ' + fh(r[0], r[1]) : ''}`
  });
}
function mk6i(N, id) {
  return SC({
    id, dai: 6, inst: INST6, parts: [`${N}`, ' ＝ ', F(0)],
    fields: [FRC(N, 1, { traps: [{ n: 1, d: N, msg: `${fh(1, N)} だと 1 ÷ ${N} になってしまうよ！整数 ${N} は ${N} ÷ 1 だから、分母を 1 にしてみよう！` }, { n: N, d: 10, msg: '分母は 10 じゃなくて、整数は「1」でわったものと考えるよ！' }] })],
    hint: `整数はどれも「分母が1の分数」で表せる。${N} ＝ ${N} ÷ 1。`, sol: `${N} ＝ ${fh(N, 1)}（整数 ÷ 1）`
  });
}

/* ---- 大問7 ---- */
const MK = { ア: 3, イ: 5, ウ: 9, エ: 12, オ: 14, カ: 16, キ: 18, ク: 21 };
function mk7(valHtml, tenths, id, traps) {
  const letter = Object.keys(MK).find(k => MK[k] === tenths);
  return SC({
    id, dai: 7, inst: '次の小数や分数は、数直線上のどこになるか記号を選びましょう。',
    parts: [valHtml, ' ＝ （ ', F(0), ' ）'], fields: [{ t: 'pick', ans: letter, traps: traps || [] }],
    vis: { k: 'numline' },
    hint: `1目盛りは 0.1（${fh(1, 10)}）。分母を 10 にそろえるか、小数になおすと何目盛り目か分かるよ。（${fh(1, 5)} ＝ ${fh(2, 10)}）`,
    sol: `${valHtml} ＝ ${decStr(tenths / 10)} → 0から ${tenths} 目盛り目 → <b>${letter}</b>`
  });
}

/* ---- 大問8 ---- */
function mk8(head, a, b, q, id) {
  const [an, ad] = a, [bn, bd] = b, L = lcm(ad, bd);
  const stem = `${head}${fh(an, ad)}L、${fh(bn, bd)}Lはいっています。<br>`;
  const sum = red(an * L / ad + bn * L / bd, L), diff = red(Math.abs(bn * L / bd - an * L / ad), L);
  const common = `通分（分母を${L}に）：`;
  if (q === 1) {
    return SC({
      id, dai: 8, kind: 't', parts: [stem + '① 合わせると何Lですか。　', F(0)],
      fields: [FRC(sum[0], sum[1], { unit: 'L', traps: [{ n: an + bn, d: ad + bd, msg: BIAS + L + ' にそろえよう！' }] })],
      vis: { k: 'potion', a, b },
      hint: `${ad} と ${bd} の最小公倍数は ${L}。ビンの目盛りを ${L} 等分にそろえてから、たし算しよう。`,
      hintVis: { k: 'bars', rows: [[an, ad], [bn, bd], [an * L / ad, L], [bn * L / bd, L]] },
      sol: `式：${fh(an, ad)} ＋ ${fh(bn, bd)} ＝ ${fh(an * L / ad, L)} ＋ ${fh(bn * L / bd, L)} ＝ ${ansFr(sum[0], sum[1])} L`
    });
  }
  return SC({
    id, dai: 8, kind: 't', parts: [stem + '② ちがいは何Lですか。　', F(0)],
    fields: [FRC(diff[0], diff[1], { unit: 'L' })],
    vis: { k: 'potion', a, b },
    hint: `通分して、どちらが多いか見くらべよう。<b>大きい方から小さい方</b>をひくよ（問題文に出てくる順とはかぎらない！）。`,
    hintVis: { k: 'bars', rows: [[an, ad], [bn, bd], [an * L / ad, L], [bn * L / bd, L]] },
    sol: `${common}${fh(an * L / ad, L)} と ${fh(bn * L / bd, L)}。大きい方 − 小さい方で ${fh(Math.abs(bn * L / bd - an * L / ad), L)} ＝ ${ansFr(diff[0], diff[1])} L`
  });
}

/* ---- 大問9 ---- */
function mk9(o, id) {
  const r = red(o.v, o.factor), rev = [r[1], r[0]];
  return SC({
    id, dai: 9, kind: 't', parts: [o.text + '<br>答え：', F(0)],
    fields: [FRC(o.v, o.factor, {
      unit: '倍', traps: [
        { n: rev[0], d: rev[1], msg: `「赤（${o.v}）÷ 青（${o.factor}）」の順番で計算するよ！もとにする量（青）が分母になるよ。分子と分母を逆にしてみよう！` },
        { n: o.v, d: 1, msg: `<b>単位に注目！</b>${o.vName}は ${o.v}${o.vu}、${o.bName}は 1${o.bu} だね。1${o.bu} は何${o.vu}だったかな？ 単位を ${o.vu} にそろえてから計算しよう！` }]
    })],
    vis: { k: 'tape', v: o.v, f: o.factor, vl: o.v + o.vu, bl: '1' + o.bu, vName: o.vName, bName: o.bName },
    hint: `①単位をそろえる（1${o.bu}＝${o.factor}${o.vu}）→ ②「くらべる量 ÷ もとにする量」→ ③分数にして約分。`,
    sol: `1${o.bu} ＝ ${o.factor}${o.vu}。${o.v} ÷ ${o.factor} ＝ ${fh(o.v, o.factor)} ＝ ${fh(r[0], r[1])} 倍`
  });
}
function tapeO(c, v, noun, ln) {
  return { v, factor: 100, vu: 'cm', bu: 'm', vName: c[0], bName: c[1], text: `${c[0]}の${noun}の長さは${v}cmで、${c[1]}の${noun}の長さは1mです。${c[0]}の${noun}の長さは${c[1]}の${noun}の長さの何倍ですか。分数で表しましょう。` };
}


/* ---- 類題ジェネレーター（無限トレーニング用） ---- */
const copr = (lo, hi) => { for (; ;) { const a = R(1, hi - 1), b = R(Math.max(lo, a + 1), hi); if (gcd(a, b) === 1) return [a, b]; } };
const GEN = {
  1() { if (R(0, 4) < 3) { const q = B1(R(0, 2)); return PK([q[0], q[1], q[3]]); } const [n, d] = copr(3, 12); return mk1c(n, d, ''); },
  2() {
    if (R(0, 1)) { const [n, d] = copr(2, 9), k1 = R(2, 4); return mk2a(n, d, k1, R(k1 + 1, 6), ''); }
    const [a, b] = copr(2, 7), x = R(2, 3), y = R(2, 3), z = R(2, 3), g = x * y * z;
    return mk2b([[a * g, b * g], [a * y * z, b * y * z, 'n'], [a * z, b * z, 'd'], [a, b, 'n']], '');
  },
  3() { let [a, b] = copr(2, 9); const g = R(2, 9); if (a >= 2 && R(0, 2) === 0) [a, b] = [b, a]; return mk3(a * g, b * g, ''); },
  4() {
    const p = R(1, 6), proper = m => { const d = R(2, m); return [R(1, d - 1), d]; };
    for (let t = 0; t < 500; t++) {
      if (p <= 3) {
        const x = proper(9), y = proper(9); if (x[1] === y[1] || x[0] * y[1] === y[0] * x[1]) continue;
        const sum = x[0] / x[1] + y[0] / y[1];
        if (p === 1 && sum >= 1) continue; if (p === 2 && (sum <= 1 || sum === Math.floor(sum))) continue;
        if (p === 3) { const [big, sm] = x[0] / x[1] > y[0] / y[1] ? [x, y] : [y, x]; return mk4(3, [T(0, big[0], big[1]), T(0, sm[0], sm[1], -1)], ''); }
        return mk4(p, [T(0, x[0], x[1]), T(0, y[0], y[1])], '');
      }
      if (p === 4) {
        const Lc = PK([12, 10, 15, 20, 24]), dv = [2, 3, 4, 5, 6, 8, 10, 12, 15, 20].filter(d => Lc % d === 0 && d < Lc || d === Lc);
        const mkf = () => { const d = PK(dv); return [R(1, d - 1), d]; };
        const a = mkf(), b = mkf(), c = mkf(); if (a[1] === 1 || b[1] === 1 || c[1] === 1) continue;
        const v = a[0] / a[1] - b[0] / b[1] + c[0] / c[1]; if (v <= 0 || v >= 1 || new Set([a[1], b[1], c[1]]).size < 2) continue;
        return mk4(4, [T(0, a[0], a[1]), T(0, b[0], b[1], -1), T(0, c[0], c[1])], '');
      }
      const x = proper(8), y = proper(8); if (x[1] === y[1]) continue;
      if (p === 5) { if (x[0] / x[1] + y[0] / y[1] < 1) continue; return mk4(5, [T(R(1, 3), x[0], x[1]), T(R(1, 3), y[0], y[1])], ''); }
      if (x[0] / x[1] <= y[0] / y[1]) continue;
      const w2 = R(1, 3); return mk4(6, [T(w2 + R(1, 2), x[0], x[1]), T(w2, y[0], y[1], -1)], '');
    }
    return mk4(1, [T(0, 1, 4), T(0, 1, 6)], '');
  },
  5() { for (; ;) { const b = R(4, 16), d = R(4, 16); if (b === d) continue; const a = R(1, b - 1), c = R(1, d - 1); if (a * d === c * b) continue; return mk5(a, b, c, d, ''); } },
  6() {
    const p = R(1, 6);
    if (p === 1) return mk6f(PK([1, 3, 5, 7]), 8, '');
    if (p === 2) { const d = PK([20, 25, 4, 50]); let n; do { n = R(1, d - 1); } while (n * 100 % d); return mk6f(n, d, ''); }
    if (p === 3) { const d = PK([5, 4, 2]); let n; do { n = R(d + 1, d * 3); } while (n % d === 0); return mk6f(n, d, ''); }
    if (p === 4) return mk6d('0.' + R(1, 9), '');
    if (p === 5) return mk6i(R(2, 30), '');
    return mk6d(R(1, 3) + '.' + R(0, 9) + R(1, 9), '');
  },
  7() {
    const k = PK(Object.keys(MK)), t = MK[k], forms = [t >= 10 ? decStr(t / 10) : '0.' + t];
    if (t % 2 === 0 && t > 10 && t < 20) forms.push(fh(t / 2, 5));
    if (t > 10 && t < 20) { const r = red(t - 10, 10); forms.push(mh(1 + Math.floor((t - 10) / 10), r[0], r[1])); }
    if (t === 5) forms.push(fh(1, 2));
    if (t > 20) forms.push(mh(2, t - 20, 10));
    return mk7(PK(forms), t, '', []);
  },
  8() {
    const heads = ['ジュースが、2つのいれものにそれぞれ', '牛乳が、2つのびんにそれぞれ', '水が、2つのバケツにそれぞれ', 'お茶が、2つのポットにそれぞれ'];
    for (; ;) {
      const b = R(2, 9), d = R(2, 9); if (b === d) continue; const a = R(1, b - 1), c = R(1, d - 1); if (a * d === c * b) continue;
      const lo = a / b < c / d ? [[a, b], [c, d]] : [[c, d], [a, b]];
      return mk8(PK(heads), lo[0], lo[1], R(1, 2), '');
    }
  },
  9() {
    const t = R(0, 2);
    if (t === 0) { const v = PK([20, 25, 30, 40, 60, 70, 75, 80, 90, 35]); return mk9(tapeO(PK([['赤', '青'], ['白', '黒']]), v, PK(['テープ', 'リボン', 'ひも'])), ''); }
    if (t === 1) { const v = PK([2, 3, 4, 6, 7, 8, 9]); return mk9({ v, factor: 10, vu: 'dL', bu: 'L', vName: '小さい水とう', bName: '大きい水とう', text: `小さい水とうには水が${v}dL、大きい水とうには水が1Lはいっています。小さい水とうの水のかさは、大きい水とうの水のかさの何倍ですか。分数で表しましょう。` }, ''); }
    const v = PK([200, 250, 300, 400, 600, 750, 800]); return mk9({ v, factor: 1000, vu: 'g', bu: 'kg', vName: '赤い箱', bName: '青い箱', text: `赤い箱の重さは${v}gで、青い箱の重さは1kgです。赤い箱の重さは青い箱の重さの何倍ですか。分数で表しましょう。` }, '');
  }
};
/** 学校のテストと同じ問題がたまたま出ないように、ハッシュ値だけで除外する（問題そのものは入れていない） */
const SKIP = new Set(["g1-15ub572","g2-mi5yh","g2-15wzy1w","g3-110ow7m","g3-a43ipn","g3-hi29ly","g4-15n6y8l","g4-1stjiri","g4-1hsq7n0","g4-1pjg7gi","g4-a2faqh","g4-1b65p6h","g5-1tfpcwe","g5-ik0h7h","g5-ql7o1j","g6-15k3ewh","g6-8tn981","g6-sc7x0e","g6-tv1caf","g6-w4hshr","g6-hnpp87","g7-fkk55w","g7-19x2r6a","g7-n3mp14","g8-1an69c3","g8-15zfvzg","g9-117r4ot"]);
function genScreen(dai) {
  for (; ;) {
    const g = clone(GEN[dai]());
    g.id = 'g' + dai + '-' + hash(JSON.stringify([g.parts, g.fields.map(f => f.ans)]));
    if (!SKIP.has(g.id)) return g;
  }
}


/* =====================================================================
   「10. 面積」ジェネレーター（わくわく算数5年 第3回テスト 大問1〜6）
   出題のたびに数がかわる。本番と同じ数がたまたま出てもOK（除外はしない）。
   追加フィールド: num（整数も小数も入れられる数。常に「.」キーが使える）／ sel（ことば・記号をえらぶ）
   画面の追加項目: perm＝入れかえてもよい欄のグループ ／ diag＝ひっかけミスの専用メッセージ
   ===================================================================== */
const NUM = (ans, extra) => Object.assign({ t: 'num', ans }, extra || {});
const SEL = (ans, opts, extra) => Object.assign({ t: 'sel', ans, opts }, extra || {});
const CM2 = 'cm²';
const nf = x => String(+(+x).toFixed(2));
const r1 = x => +x.toFixed(1);
const AINST = '次の図形の面積を求めましょう。（式と答えを書きましょう。）';

/* ---- 大問1：公式 ---- */
const T_OPTS = ['底辺', '高さ', '上底', '下底', '対角線', '一辺'], OP_OPTS = ['＋', '－', '×', '÷'], N_OPTS = ['2', '3', '4', '10'];
const TS = a => SEL(a, T_OPTS), OPS = a => SEL(a, OP_OPTS, { keep: true }), NS = a => SEL(a, N_OPTS, { keep: true });
const SHAPE_NAMES = ['三角形', '平行四辺形', '台形', 'ひし形'];
const SHAPE = {
  tri: {
    name: '三角形', f: '底辺×高さ÷2', wrong: ['底辺×高さ', '底辺×底辺÷2', '（底辺＋高さ）÷2'],
    parts: o => ['三角形の面積 ＝ ', F(o), ' ', F(o + 1), ' ', F(o + 2), ' ', F(o + 3), ' ', F(o + 4)],
    fields: () => [TS('底辺'), OPS('×'), TS('高さ'), OPS('÷'), NS('2')], tip: '三角形は、同じ三角形を2つ合わせると平行四辺形になる。だから ÷2 を忘れない！'
  },
  par: {
    name: '平行四辺形', f: '底辺×高さ', wrong: ['底辺×高さ÷2', '底辺＋高さ', '底辺×底辺'],
    parts: o => ['平行四辺形の面積 ＝ ', F(o), ' ', F(o + 1), ' ', F(o + 2)],
    fields: () => [TS('底辺'), OPS('×'), TS('高さ')], tip: '平行四辺形は長方形に直せるから、÷2 はいらない。'
  },
  tra: {
    name: '台形', f: '（上底＋下底）×高さ÷2', wrong: ['上底＋下底×高さ÷2', '（上底＋下底）×高さ', '上底×下底×高さ÷2'],
    parts: o => ['台形の面積 ＝ （', F(o), ' ', F(o + 1), ' ', F(o + 2), '） ', F(o + 3), ' ', F(o + 4), ' ', F(o + 5), ' ', F(o + 6)],
    fields: () => [TS('上底'), OPS('＋'), TS('下底'), OPS('×'), TS('高さ'), OPS('÷'), NS('2')], tip: '台形は、先に（上底＋下底）を計算するからかっこが必要。さいごは ÷2！'
  },
  rho: {
    name: 'ひし形', f: '対角線×対角線÷2', wrong: ['対角線×対角線', '底辺×高さ÷2', '一辺×一辺'],
    parts: o => ['ひし形の面積 ＝ ', F(o), ' ', F(o + 1), ' ', F(o + 2), ' ', F(o + 3), ' ', F(o + 4)],
    fields: () => [TS('対角線'), OPS('×'), TS('対角線'), OPS('÷'), NS('2')], tip: 'ひし形は、2本の対角線を使う。長方形の半分になるから ÷2。'
  }
};
const formMsg = (right, w) => {
  if (right.includes('÷2') && !w.includes('÷2')) return '最後の「÷2」を忘れていないかな？ 同じ形を2つ合わせると考えよう！';
  if (!right.includes('÷2') && w.includes('÷2')) return '「÷2」はいらないよ。それは三角形などの公式だよ！';
  if (right.includes('（') && !w.includes('（')) return '先に「上底＋下底」を計算するから、かっこ（　）が必要だよ！';
  return '公式をもういちど思い出してみよう。ヒントも見てね！';
};
function mk1(keys, mode) {
  const ks = shuffle(keys), tips = ks.map(k => `<div>${SHAPE[k].tip}</div>`).join('');
  const sol = ks.map(k => `${SHAPE[k].name}の面積 ＝ <b>${SHAPE[k].f}</b>`).join('<br>');
  if (mode === 'rev') {
    const s = SHAPE[ks[0]];
    return SC({ id: '', dai: 1, inst: '次の公式で面積が求められる図形の名前をえらびましょう。', parts: [`<b>${s.f}</b> で面積が求められる図形は？<br>答え：`, F(0)], fields: [SEL(s.name, SHAPE_NAMES)], hint: tips, sol });
  }
  const parts = [], fields = [], perm = [], units = [];
  if (mode === 'pick') {
    ks.forEach((k, j) => {
      const s = SHAPE[k], msgs = {}; s.wrong.forEach(w => { msgs[w] = formMsg(s.f, w); });
      if (j) parts.push('<br>');
      parts.push(`${s.name}の面積 ＝ `, F(j)); fields.push(SEL(s.f, [s.f, ...s.wrong], { msgs })); units.push([j]);
    });
    return SC({ id: '', dai: 1, inst: '［　］にあてはまる公式をえらびましょう。', parts, fields, units, hint: tips, sol });
  }
  let off = 0;
  ks.forEach(k => {
    const s = SHAPE[k], fs = s.fields();
    if (parts.length) parts.push('<br>');
    parts.push(...s.parts(off)); perm.push([off, off + 2]); units.push(fs.map((_, i) => off + i)); fields.push(...fs); off += fs.length;
  });
  return SC({ id: '', dai: 1, inst: '［　］にあてはまることばや数をえらんで、面積を求める公式を完成させましょう。', parts, fields, perm, units, hint: tips, sol });
}
const pickMode = () => PK(['asm', 'asm', 'asm', 'pick', 'pick', 'rev']);

/* ---- 大問2：基本4図形（式と答え） ---- */
function mkA2a() {
  let b, h, e, s1, s2;
  do { b = R(3, 12); h = R(3, 12); e = R(2, 4); s1 = r1(Math.hypot(b + e, h)); s2 = r1(Math.hypot(e, h)); } while ([s1, s2].some(s => s === b || s === h || s === b * h / 2));
  const S = b * h / 2, flip = R(0, 1) === 1;
  const slant = `<b>ストップ！</b>斜めの辺（${nf(s2)}cm や ${nf(s1)}cm）は『高さ』ではないよ！底辺をまっすぐのばした線に『直角マーク（∟）』で交わる点線（${h}cm）が本当の高さだよ！`;
  return SC({
    id: '', dai: 2, inst: AINST + '<br>（三角形）', vis: { k: 'a-tri', b, h, e, s1, s2, flip },
    parts: ['式　', F(0), ' × ', F(1), ' ÷ 2<br>答え　', F(2)], fields: [NUM(b), NUM(h), NUM(S, { unit: CM2 })], perm: [[0, 1]], units: [[0, 1, 2]],
    diag: [
      { f: [0, 1], v: [s1, s2], msg: slant },
      { f: [2], v: [b * s2 / 2, s1 * h / 2, b * s2, s1 * h], msg: slant },
      { f: [2], v: [b * h], msg: '惜しい！それは平行四辺形の面積だよ。三角形の面積は最後に『÷ 2』を忘れないでね！' }],
    hint: '「底辺」と「高さ」は、直角マーク（∟）でつながっている2つの長さだよ。高さが三角形の外にあるときもあるよ。斜めの辺は使わない！',
    sol: `式：${b} × ${h} ÷ 2 ＝ ${nf(S)}　答え：<b>${nf(S)} cm²</b><br>高さは、直角マーク（∟）のついた点線の ${h}cm。斜めの辺（${nf(s1)}cm、${nf(s2)}cm）は使わない！`
  });
}
function mkA2b() {
  const b = R(8, 18), h = R(4, Math.min(12, b - 3)), d = R(h + 1, b - 2), S = b * h;
  const m1 = `<b>引っかかり注意！！</b>下の辺（${d}cm）を底辺にしたくなるけれど、直角マーク（∟）がどこについているかよく見て！高さ ${h}cm の点線は、斜めの辺（${b}cm）に垂直に交わっているね。だから底辺は ${b}cm だよ！`;
  const m2 = `周りに書いてある2つの辺をかけても面積にはならないよ！直角マーク（∟）がついている高さ（${h}cm）を使おう！`;
  return SC({
    id: '', dai: 2, inst: AINST + '<br>（平行四辺形）', vis: { k: 'a-par', b, h, d },
    parts: ['式　', F(0), ' × ', F(1), '<br>答え　', F(2)], fields: [NUM(b), NUM(h), NUM(S, { unit: CM2 })], perm: [[0, 1]], units: [[0, 1, 2]],
    diag: [
      { f: [0, 1], set: [b, d], msg: m2 }, { f: [0, 1], v: [d], msg: m1 },
      { f: [2], v: [d * h], msg: m1 }, { f: [2], v: [b * d], msg: m2 },
      { f: [2], v: [b * h / 2], msg: '平行四辺形は『÷2』はいらないよ。三角形と混ざっていないかな？' }],
    hint: '高さの点線についている直角マーク（∟）が、どの辺にくっついているかを見よう。その辺が底辺だよ。',
    sol: `式：${b} × ${h} ＝ ${S}　答え：<b>${S} cm²</b><br>直角マーク（∟）は斜めの ${b}cm の辺についている → 底辺 ${b}cm × 高さ ${h}cm。${d}cm の辺は使わない！`
  });
}
function mkA2c() {
  const a = R(3, 12); let b; do { b = R(3, 12); } while (b === a);
  const h = R(3, 10), S = (a + b) * h / 2;
  return SC({
    id: '', dai: 2, inst: AINST + '<br>（台形）', vis: { k: 'a-trap', a, b, h },
    parts: ['式　（ ', F(0), ' ＋ ', F(1), ' ） × ', F(2), ' ÷ 2<br>答え　', F(3)], fields: [NUM(a), NUM(b), NUM(h), NUM(S, { unit: CM2 })], perm: [[0, 1]], units: [[0, 1, 2, 3]],
    diag: [
      { f: [3], v: [(a + b) * h], msg: '惜しい！最後の『÷ 2』を忘れているよ。台形は（上底＋下底）×高さ÷2 だよ！' },
      { f: [3], v: [a + b * h / 2, b + a * h / 2], msg: 'かっこ（　）を忘れていないかな？ 先に（上底＋下底）を計算してから、×高さ÷2 をするよ！' }],
    hint: '平行な2つの辺が上底と下底。直角マーク（∟）の点線が高さ。（上底＋下底）を先に足してから、×高さ÷2。',
    sol: `式：（${a} ＋ ${b}）× ${h} ÷ 2 ＝ ${a + b} × ${h} ÷ 2 ＝ ${nf(S)}　答え：<b>${nf(S)} cm²</b><br>上底と下底は、どちらを先に足してもOK！`
  });
}
function mkA2d() {
  const d1h = R(3, 9), d2 = R(5, 15), d1 = d1h * 2, S = d1h * d2;
  const half = `<b>超重要ポイント！</b>${d1h}cm は端から端までではなく、真ん中までの『半分の長さ』だよ！まずは ${d1h} × 2 ＝ ${d1}cm で対角線全体の長さを出してから、『対角線×対角線÷2』を計算しよう！`;
  return SC({
    id: '', dai: 2, inst: AINST + '<br>（ひし形）', vis: { k: 'a-rhom', d1h, d2 },
    parts: ['ステップ1　', F(0), ' × 2 ＝ ', F(1), '<br>ステップ2　', F(2), ' × ', F(3), ' ÷ 2 ＝ ', F(4)],
    fields: [NUM(d1h), NUM(d1, { unit: 'cm' }), NUM(d2), NUM(d1), NUM(S, { unit: CM2 })], perm: [[2, 3]], units: [[0, 1], [2, 3, 4]],
    diag: [{ f: [2, 3], set: [d1h, d2], msg: half }, { f: [4], v: [d1h * d2 / 2], msg: half }],
    hint: '横の対角線は、まん中から右はしまでの「半分」しか書いていないよ。2倍して全体の長さにしてから、対角線×対角線÷2。',
    sol: `${d1h} × 2 ＝ ${d1}（cm）<br>${d2} × ${d1} ÷ 2 ＝ ${S}　答え：<b>${S} cm²</b>`
  });
}

/* ---- 大問3：方眼上の五角形 ---- */
function mkA3() {
  const W = PK([5, 6]), h1 = PK([2, 3]), h2 = PK([3, 4]), b3 = PK([3, 4, 5]), h3 = PK([2, 3, 4]), xE = R(1, W - 1);
  const s3 = b3 * h3 / 2, s2 = W * h2 / 2, s1 = W * h1 / 2, S = s1 + s2 + s3;
  const vis = { k: 'a-pent', W, h1, h2, b3, h3, xE };
  return SC({
    id: '', dai: 3, kind: 't', inst: '次の五角形の面積をくふうして求めましょう。（方眼の1めもりは 1cm）<br>赤い点線で3つの三角形に分けて考えよう。',
    vis, hintVis: Object.assign({ hi: true }, vis),
    parts: ['三角形ABC ＝ ', F(0), '<br>三角形ACD ＝ ', F(1), '<br>三角形ADE ＝ ', F(2), '<br>五角形ABCDE ＝ ', F(3)],
    fields: [NUM(s3, { unit: CM2 }), NUM(s2, { unit: CM2 }), NUM(s1, { unit: CM2 }), NUM(S, { unit: CM2 })], units: [[0, 1, 2, 3]],
    hint: `A から C と D に点線を引くと、3つの三角形に分けられるよ。ADの長さは ${W}cm。ADを底辺にすると、ACD の高さは ${h2}cm、ADE の高さは ${h1}cm。ABC は AB（${b3}cm）を底辺にして、高さは横の ${h3}cm。さいごに3つをたそう！`,
    sol: `ABC：${b3} × ${h3} ÷ 2 ＝ ${nf(s3)}<br>ACD：${W} × ${h2} ÷ 2 ＝ ${nf(s2)}<br>ADE：${W} × ${h1} ÷ 2 ＝ ${nf(s1)}<br>${nf(s3)} ＋ ${nf(s2)} ＋ ${nf(s1)} ＝ <b>${nf(S)} cm²</b>`
  });
}

/* ---- 大問4：底辺と面積（比例） ---- */
function mkA4() {
  const H = R(4, 12), top = ['底辺（cm）', 1, 2, 3, 4, 5, 6, 7], bot = ['面積（cm²）', H];
  for (let i = 0; i < 6; i++) bot.push(F(i));
  return SC({
    id: '', dai: 4, inst: `平行四辺形の高さを ${H} cm にきめて、底辺を 1cm、2cm、3cm、……と変えていきます。<br>① 下の表にあてはまる数をかきましょう。`,
    vis: { k: 'a-par3', H },
    parts: [{ tbl: [top, bot] }, '② 底辺が2倍、3倍、……になると、面積は ', F(6), ' 倍、', F(7), ' 倍、……になります。<br>③ ②のことから、面積は底辺に（ ', F(8), ' ）しているといえます。'],
    fields: [2, 3, 4, 5, 6, 7].map(x => NUM(H * x)).concat([NUM(2), NUM(3), SEL('比例', ['比例', '反比例', '合同', '等しい'], { msgs: { 反比例: '反比例は「一方が2倍になると、もう一方は半分になる」関係だよ。今回は面積も2倍になっているね。' } })]),
    units: [[0, 1, 2, 3, 4, 5], [6, 7], [8]],
    hint: `面積 ＝ 底辺 × 高さ。高さは ${H}cm で変わらないから、底辺が1cm ふえるごとに面積は ${H}cm² ずつふえるよ。`,
    sol: `面積 ＝ 底辺 × ${H}：${[2, 3, 4, 5, 6, 7].map(x => `${x}×${H}＝${x * H}`).join('、')}<br>底辺が2倍、3倍、……になると、面積も2倍、3倍、……になる → 面積は底辺に<b>比例</b>している。`
  });
}

/* ---- 大問5：色をぬった部分 ---- */
function mkA5a() {
  const H = R(5, 10), W = R(6, 12), brem = R(2, W - 2), hrem = R(2, H - 2), w1 = W - brem, h2 = H - hrem;
  const rect = H * W, t1 = w1 * H / 2, t2 = W * h2 / 2, S = rect - t1 - t2;
  return SC({
    id: '', dai: 5, kind: 't', inst: '下の図で、色をぬった部分の面積を求めましょう。<br>（全体の長方形から、白い三角形2つをひいて考えよう）', vis: { k: 'a-cut1', H, W, brem, hrem },
    parts: ['考え方　全体の長方形 ', F(0), ' － （ 白い三角形 ', F(1), ' ＋ ', F(2), ' ）<br>答え　', F(3)],
    fields: [NUM(rect, { unit: CM2 }), NUM(t1, { unit: CM2 }), NUM(t2, { unit: CM2 }), NUM(S, { unit: CM2 })], perm: [[1, 2]], units: [[0, 1, 2, 3]],
    hint: `全体は 縦${H}cm × 横${W}cm の長方形。左の白い三角形は、底辺が ${W}－${brem}＝${w1}cm、高さ${H}cm。上の白い三角形は、底辺${W}cm、高さが ${H}－${hrem}＝${h2}cm。`,
    sol: `${H} × ${W} ＝ ${rect}<br>${w1} × ${H} ÷ 2 ＝ ${nf(t1)}　${h2} × ${W} ÷ 2 ＝ ${nf(t2)}<br>${rect} － （${nf(t1)} ＋ ${nf(t2)}） ＝ <b>${nf(S)} cm²</b>`
  });
}
function mkA5b() {
  const B = 2 * R(3, 8), H1 = R(6, 14), H2 = R(2, H1 - 2), pf = PK([0.35, 0.5, 0.65]);
  const all = B * H1 / 2, wh = B * H2 / 2, S = all - wh;
  return SC({
    id: '', dai: 5, kind: 't', inst: '下の図で、色をぬった部分の面積を求めましょう。<br>（大きい三角形から、中の白い三角形をひいて考えよう）', vis: { k: 'a-cut2', B, H1, H2, pf },
    parts: ['考え方　全体の三角形 ', F(0), ' － 白い三角形 ', F(1), '<br>答え　', F(2)],
    fields: [NUM(all, { unit: CM2 }), NUM(wh, { unit: CM2 }), NUM(S, { unit: CM2 })], units: [[0, 1, 2]],
    hint: `大きい三角形は 底辺${B}cm・高さ${H1}cm。中の白い三角形は 同じ底辺${B}cm・高さ${H2}cm。どちらも底辺が同じだよ。`,
    sol: `${B} × ${H1} ÷ 2 ＝ ${all}<br>${B} × ${H2} ÷ 2 ＝ ${wh}<br>${all} － ${wh} ＝ <b>${S} cm²</b>`
  });
}

/* ---- 大問6：平行な2直線にはさまれた三角形 ---- */
function mkA6() {
  const H = R(4, 10), bs = shuffle([2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 3), names = ['あ', 'い', 'う'];
  const ans = names.map((n, i) => [n, bs[i]]).sort((x, y) => y[1] - x[1]).map(x => x[0]);
  const KANA = ['あ', 'い', 'う'], WORDS = ['高さ', '底辺', '面積', '斜めの辺'];
  const diag = [{ eq: { 0: ans[2], 1: ans[1], 2: ans[0] }, msg: '順番が逆（小さい順）になっているよ！『面積が【大きい順】』にならべよう！' }];
  if (ans[0] !== 'う') diag.push({ eq: { 0: 'う' }, msg: `斜めの線の長さにだまされないで！平行な2本の直線にはさまれているから、3つとも『高さ』は同じ ${H}cm だよ。底辺の数字を比べてみよう！` });
  diag.push({ eq: { 3: '底辺' }, msg: '3つの三角形でおなじなのは『高さ』だよ。ちがっているのが『底辺』。' });
  return SC({
    id: '', dai: 6, kind: 't', inst: '次のような平行な2本の直線にはさまれた三角形があります。面積が大きい順にならべましょう。なぜそのようにならべたか、理由を書きましょう。',
    vis: { k: 'a-tri3', H, b: bs },
    parts: ['① （大　', F(0), ' → ', F(1), ' → ', F(2), '　小）<br>② 3つとも三角形の ', F(3), ' は ', F(4), ' cm で等しい。したがって、', F(5), ' の長さの大きい順に並べると、面積の大きい順になる。'],
    fields: [SEL(ans[0], KANA, { keep: true }), SEL(ans[1], KANA, { keep: true }), SEL(ans[2], KANA, { keep: true }), SEL('高さ', WORDS), NUM(H), SEL('底辺', WORDS)], units: [[0, 1, 2], [3, 4, 5]], diag,
    hint: '2本の平行線のあいだの長さ（高さ）は、どの三角形でも同じ。高さが同じなら、面積は底辺が長いほど大きくなるよ。',
    sol: `面積 ＝ 底辺 × ${H} ÷ 2：${names.map((n, i) => `${n} ${nf(bs[i] * H / 2)}cm²`).join('、')}<br>大きい順：<b>${ans.join(' → ')}</b><br>理由：3つとも三角形の高さは ${H}cm で等しい。したがって、底辺の長さの大きい順に並べると、面積の大きい順になる。`
  });
}

/* ---- 全11画面を1巡のシャッフル・デッキで出す（1巡すれば8ページ目の全パターンを一通り解ける） ---- */
const GENA = { '1a': () => mk1(['tri', 'par'], pickMode()), '1b': () => mk1(['tra', 'rho'], pickMode()), '2a': mkA2a, '2b': mkA2b, '2c': mkA2c, '2d': mkA2d, '3': mkA3, '4': mkA4, '5a': mkA5a, '5b': mkA5b, '6': mkA6 };
const AREA_KEYS = Object.keys(GENA);
let aDeck = [], aLast = '';
function genArea(key) {
  const g = clone(GENA[key]());
  g.id = 'a' + key + '-' + hash(JSON.stringify([g.parts, g.fields.map(f => f.ans), g.vis || 0]));
  return g;
}
function nextArea() {
  if (!aDeck.length) { aDeck = shuffle(AREA_KEYS); if (aDeck[aDeck.length - 1] === aLast) aDeck.unshift(aDeck.pop()); }
  aLast = aDeck.pop();
  return genArea(aLast);
}

/* =====================================================================
   図（SVG／HTML）
   ===================================================================== */
const COLS = ['#5cc8ff', '#ffb35c', '#8be28b', '#ff8fb3', '#c3a0ff', '#ffe066'];
function barsSVG(rows, labelText) {
  const W = 360, LH = 28, padL = 62;
  const maxv = Math.max(1, ...rows.map(r => r[0] / r[1])), scale = Math.ceil(maxv - 1e-9), uw = (W - padL - 10) / scale;
  let y = 4, s = '';
  rows.forEach((r, ri) => {
    const cw = uw / r[1];
    s += `<text x="${padL - 6}" y="${y + 15}" text-anchor="end" class="svt">${r[0]}/${r[1]}</text>`;
    s += `<rect x="${padL}" y="${y}" width="${scale * uw}" height="20" fill="#fff" stroke="#556" stroke-width="1.2"/>`;
    s += `<rect x="${padL}" y="${y}" width="${r[0] / r[1] * uw}" height="20" fill="${COLS[ri % COLS.length]}"/>`;
    if (cw >= 3.2) for (let i = 1; i < r[1] * scale; i++) s += `<line x1="${padL + i * cw}" y1="${y}" x2="${padL + i * cw}" y2="${y + 20}" stroke="#445" stroke-width="${i % r[1] === 0 ? 2.2 : 0.8}"/>`;
    else for (let i = 1; i < scale; i++) s += `<line x1="${padL + i * uw}" y1="${y}" x2="${padL + i * uw}" y2="${y + 20}" stroke="#445" stroke-width="2.2"/>`;
    y += LH;
  });
  return `<svg viewBox="0 0 ${W} ${y + 2}" class="viz" role="img" aria-label="${labelText || '分数のバー'}">${s}</svg>`;
}
function numLineSVG() {
  const x0 = 30, u = 270;
  let s = `<svg viewBox="0 0 660 118" class="viz numline" role="img" aria-label="数直線"><line x1="${x0 - 12}" y1="70" x2="${x0 + 2.3 * u}" y2="70" stroke="#334" stroke-width="3"/>`;
  for (let i = 0; i <= 22; i++) {
    const x = x0 + i * u / 10, h = i % 10 === 0 ? 26 : i % 5 === 0 ? 19 : 11;
    s += `<line x1="${x}" y1="70" x2="${x}" y2="${70 + h}" stroke="#334" stroke-width="${i % 10 === 0 ? 3 : 1.6}"/>`;
    if (i % 10 === 0) s += `<text x="${x}" y="${70 + h + 16}" text-anchor="middle" class="svt big">${i / 10}</text>`;
  }
  Object.keys(MK).forEach(k => {
    const x = x0 + MK[k] * u / 10;
    s += `<g class="mk" data-k="${k}" tabindex="0"><path d="M${x} 66 l-7 -13 h14 z" class="mkp"/><circle cx="${x}" cy="30" r="14" class="mkc"/><text x="${x}" y="36" text-anchor="middle" class="mkt">${k}</text></g>`;
  });
  return s + '</svg>';
}
function potionSVG(a, b) {
  const bottle = (f, x, col) => {
    const H = 130, top = 12, fill = H * f[0] / f[1];
    let s = `<rect x="${x}" y="${top}" width="62" height="${H}" rx="8" fill="#fff" stroke="#556" stroke-width="2"/>`;
    s += `<rect x="${x}" y="${top + H - fill}" width="62" height="${fill}" rx="6" fill="${col}"/>`;
    for (let i = 1; i < f[1]; i++) s += `<line x1="${x}" y1="${top + H * i / f[1]}" x2="${x + 14}" y2="${top + H * i / f[1]}" stroke="#334" stroke-width="1.4"/>`;
    return s + `<text x="${x + 31}" y="${top + H + 18}" text-anchor="middle" class="svt big">${f[0]}/${f[1]} L</text>`;
  };
  return `<svg viewBox="0 0 300 170" class="viz small" role="img" aria-label="2本のポーション瓶">${bottle(a, 50, '#7be0a0')}${bottle(b, 190, '#c79bff')}</svg>`;
}
function tapeSVG(v) {
  const W = 300, r = v.v / v.f;
  return `<svg viewBox="0 0 400 130" class="viz" role="img" aria-label="赤と青のテープ">
    <text x="4" y="30" class="svt big">${v.bName}</text><rect x="70" y="14" width="${W}" height="24" fill="#6aa8ff" stroke="#235"/><text x="${70 + W / 2}" y="31" text-anchor="middle" class="svt big w">${v.bl}</text>
    <text x="4" y="78" class="svt big">${v.vName}</text><rect x="70" y="62" width="${W * r}" height="24" fill="#ff6a6a" stroke="#523"/><text x="${70 + W * r / 2}" y="79" text-anchor="middle" class="svt big w">${v.vl}</text>
    <text x="70" y="115" class="svt big">${v.vName}は ${v.bName}の □ 倍？</text></svg>`;
}
/* ---- 面積の図（直角マーク＝赤、高さ＝赤い点線） ---- */
const pf1 = n => (+n).toFixed(1);
const arL = (x1, y1, x2, y2, c) => `<line x1="${pf1(x1)}" y1="${pf1(y1)}" x2="${pf1(x2)}" y2="${pf1(y2)}" class="${c || 'ar-s'}"/>`;
const arPoly = (pts, c, st) => `<polygon points="${pts.map(p => pf1(p[0]) + ',' + pf1(p[1])).join(' ')}" class="${c || 'ar-shape'}"${st ? ` style="${st}"` : ''}/>`;
const arT = (x, y, t, a) => `<text x="${pf1(x)}" y="${pf1(y)}" text-anchor="${a || 'middle'}" class="ar-t">${t}</text>`;
/** 直角マーク：(x,y) の角から、方向 u と v（画面の向き）に小さな四角をかく */
function arRA(x, y, ux, uy, vx, vy, s) {
  s = s || 10;
  const p = [[x + ux * s, y + uy * s], [x + (ux + vx) * s, y + (uy + vy) * s], [x + vx * s, y + vy * s]];
  return `<polyline points="${p.map(q => pf1(q[0]) + ',' + pf1(q[1])).join(' ')}" class="ar-ra"/>`;
}
const arSvg = (w, h, body, label) => `<svg viewBox="0 0 ${pf1(w)} ${pf1(h)}" class="viz area" role="img" aria-label="${label}">${body}</svg>`;

function aTri(p) { // 大問2① 高さが外側にある三角形
  const { b, h, e, s1, s2, flip } = p, W = b + e, k = Math.min(330 / W, 140 / h), x0 = 50, y0 = 185, sg = flip ? -1 : 1;
  const X = x => x0 + (flip ? W - x : x) * k, Y = y => y0 - y * k;
  const A = [X(0), Y(0)], Bq = [X(b), Y(0)], C = [X(W), Y(h)], Fq = [X(W), Y(0)];
  let s = arL(Bq[0], y0, Fq[0], y0, 'ar-d') + arPoly([A, Bq, C]) + arL(C[0], C[1], Fq[0], Fq[1], 'ar-h') + arRA(Fq[0], Fq[1], -sg, 0, 0, -1);
  s += arT((A[0] + Bq[0]) / 2, y0 + 22, nf(b) + ' cm');
  s += arT((A[0] + C[0]) / 2 - sg * 8, (A[1] + C[1]) / 2 - 10, nf(s1) + ' cm');
  s += arT((Bq[0] + C[0]) / 2 - sg * 8, (Bq[1] + C[1]) / 2 + 4, nf(s2) + ' cm', flip ? 'start' : 'end'); // 高さの点線と重ならないよう三角形の内側がわに置く
  s += arT(Fq[0] + sg * 8, y0 - h * k * 0.18, nf(h) + ' cm', flip ? 'end' : 'start');
  return arSvg(460, 225, s, '底辺と高さが外にある三角形');
}
function aPar(p) { // 大問2② 斜めの辺が底辺の平行四辺形
  const { b, h, d } = p, y = h * b / d, dx = Math.sqrt(b * b - y * y), W = d + dx, k = Math.min(300 / W, 150 / y), x0 = 80, y0 = 185;
  const X = x => x0 + x * k, Y = v => y0 - v * k, P = q => [X(q[0]), Y(q[1])];
  const t = d * dx / b, F = [dx * t / b, y * t / b], ux = dx / b, uy = y / b, fx = d - F[0], fy = -F[1], fl = Math.hypot(fx, fy) || 1;
  let s = arPoly([[0, 0], [d, 0], [d + dx, y], [dx, y]].map(P));
  s += arL(X(d), Y(0), X(F[0]), Y(F[1]), 'ar-h') + arRA(X(F[0]), Y(F[1]), ux, -uy, fx / fl, -fy / fl);
  s += arT(X(d / 2), Y(0) + 22, nf(d) + ' cm');
  s += arT(X(dx / 2) - 12, Y(y / 2) + 5, nf(b) + ' cm', 'end');
  s += arT((X(d) + X(F[0])) / 2 + 4, (Y(0) + Y(F[1])) / 2 - 8, nf(h) + ' cm');
  return arSvg(430, 220, s, '斜めの辺が底辺の平行四辺形');
}
function aTrap(p) { // 大問2③ 台形
  const { a, b, h } = p, m = Math.max(a, b), k = Math.min(320 / m, 150 / h), cx = 215, yt = 34, yb = yt + h * k;
  let s = arPoly([[cx - a * k / 2, yt], [cx + a * k / 2, yt], [cx + b * k / 2, yb], [cx - b * k / 2, yb]]);
  s += arL(cx, yt, cx, yb, 'ar-h') + arRA(cx, yb, 1, 0, 0, -1);
  s += arT(cx, yt - 10, nf(a) + ' cm') + arT(cx, yb + 24, nf(b) + ' cm') + arT(cx + 8, (yt + yb) / 2 + 5, nf(h) + ' cm', 'start');
  return arSvg(430, yb + 40, s, '台形');
}
function aRhom(p) { // 大問2④ ひし形（横の対角線は半分だけ書いてある）
  const { d1h, d2 } = p, k = Math.min(150 / d1h, 100 / (d2 / 2), 30), hw = d1h * k, hh = d2 / 2 * k, cx = hw + 30, cy = hh + 22, bx = cx + hw + 34, by = cy + hh + 22;
  let s = arPoly([[cx - hw, cy], [cx, cy - hh], [cx + hw, cy], [cx, cy + hh]]);
  s += arL(cx - hw, cy, cx, cy, 'ar-h') + arL(cx, cy - hh, cx, cy + hh, 'ar-h') + arRA(cx, cy, 1, 0, 0, -1);
  s += arL(cx, cy + hh, cx, by, 'ar-d') + arL(cx + hw, cy, cx + hw, by, 'ar-d') + arL(cx, by, cx + hw, by, 'ar-dim') + arL(cx, by - 6, cx, by + 6) + arL(cx + hw, by - 6, cx + hw, by + 6);
  s += arT(cx + hw / 2, by + 22, nf(d1h) + ' cm');
  s += arL(cx, cy - hh, bx, cy - hh, 'ar-d') + arL(cx, cy + hh, bx, cy + hh, 'ar-d') + arL(bx, cy - hh, bx, cy + hh, 'ar-dim') + arL(bx - 6, cy - hh, bx + 6, cy - hh) + arL(bx - 6, cy + hh, bx + 6, cy + hh);
  s += arT(bx + 10, cy + 5, nf(d2) + ' cm', 'start');
  return arSvg(bx + 80, by + 34, s, 'ひし形');
}
function aPent(p) { // 大問3 方眼上の五角形
  const { W, h1, h2, b3, h3, xE } = p, yA = Math.max(h2, b3), rows = yA + h1, cs = Math.min(40, 300 / W, 270 / rows), ox = 36, oy = 24;
  const X = x => ox + x * cs, Y = y => oy + (rows - y) * cs, P = q => [X(q[0]), Y(q[1])];
  const A = [0, yA], B = [0, yA - b3], C = [h3, yA - h2], D = [W, yA], E = [xE, yA + h1];
  let s = '';
  for (let i = 0; i <= W; i++) s += arL(X(i), Y(0), X(i), Y(rows), 'ar-grid');
  for (let j = 0; j <= rows; j++) s += arL(X(0), Y(j), X(W), Y(j), 'ar-grid');
  if (p.hi) s += arPoly([A, B, C].map(P), 'ar-t1') + arPoly([A, C, D].map(P), 'ar-t2') + arPoly([A, D, E].map(P), 'ar-t3');
  s += arPoly([A, B, C, D, E].map(P), 'ar-pent');
  s += arL(X(A[0]), Y(A[1]), X(D[0]), Y(D[1]), 'ar-h') + arL(X(A[0]), Y(A[1]), X(C[0]), Y(C[1]), 'ar-h');
  if (p.hi) s += arL(X(xE), Y(E[1]), X(xE), Y(yA), 'ar-d') + arL(X(C[0]), Y(C[1]), X(C[0]), Y(yA), 'ar-d') + arL(X(C[0]), Y(C[1]), X(0), Y(C[1]), 'ar-d');
  [['A', A, -16, 5], ['B', B, -16, 16], ['C', C, 0, 20], ['D', D, 16, 5], ['E', E, 0, -9]].forEach(([n, q, dx, dy]) => { s += arT(X(q[0]) + dx, Y(q[1]) + dy, n); });
  const lx = X(W) + 26;
  s += `<rect x="${pf1(lx)}" y="${pf1(oy)}" width="${pf1(cs)}" height="${pf1(cs)}" class="ar-unit"/>` + arT(lx + cs / 2, oy + cs + 18, '1cm');
  return arSvg(lx + cs + 30, oy + rows * cs + 34, s, '方眼の上の五角形');
}
function aPar3(p) { // 大問4 底辺が1cm,2cm,3cmの平行四辺形
  const hh = 80, off = 22, yb = 105, yt = yb - hh, kb = 24; let x = 56, s = '';
  [1, 2, 3].forEach(n => { const w = n * kb; s += arPoly([[x, yb], [x + w, yb], [x + w + off, yt], [x + off, yt]]) + arT(x + w / 2, yb + 22, n + ' cm'); x += w + off + 36; });
  s += arL(56 + off, yt, 56 + off, yb, 'ar-h') + arRA(56 + off, yb, 1, 0, 0, -1, 8) + arT(56 + off - 6, (yt + yb) / 2 + 5, p.H + ' cm', 'end') + arT(x - 4, yb - 28, '……');
  return arSvg(x + 40, 140, s, '底辺をかえる平行四辺形');
}
function aCut1(p) { // 大問5① 長方形から白い三角形2つ
  const { H, W, brem, hrem } = p, w1 = W - brem, k = Math.min(310 / W, 190 / H), ox = 64, oy = 36, X = x => ox + x * k, Y = y => oy + (H - y) * k, P = q => [X(q[0]), Y(q[1])];
  let s = arPoly([[0, H], [0, 0], [w1, 0]].map(P), 'ar-white') + arPoly([[0, H], [W, H], [W, hrem]].map(P), 'ar-white') + arPoly([[0, H], [w1, 0], [W, 0], [W, hrem]].map(P), 'ar-col');
  s += arRA(X(0), Y(0), 1, 0, 0, -1) + arRA(X(0), Y(H), 1, 0, 0, 1) + arRA(X(W), Y(H), -1, 0, 0, 1);
  s += arT(ox - 8, (Y(0) + Y(H)) / 2 + 5, nf(H) + ' cm', 'end') + arT((X(0) + X(W)) / 2, oy - 10, nf(W) + ' cm') + arT((X(w1) + X(W)) / 2, Y(0) + 22, nf(brem) + ' cm') + arT(X(W) + 8, (Y(0) + Y(hrem)) / 2 + 5, nf(hrem) + ' cm', 'start');
  return arSvg(ox + W * k + 86, oy + H * k + 34, s, '色をぬった部分（長方形から三角形をひく）');
}
function aCut2(p) { // 大問5② 大きい三角形から白い三角形をひく
  const { B, H1, H2, pf } = p, k = Math.min(330 / B, 150 / H1), ox = 74, oy = 28, px = B * pf, X = x => ox + x * k, Y = y => oy + (H1 - y) * k, P = q => [X(q[0]), Y(q[1])];
  let s = `<rect x="${pf1(X(0))}" y="${pf1(Y(H1))}" width="${pf1(B * k)}" height="${pf1(H1 * k)}" class="ar-d"/>` + arPoly([[0, 0], [px, H1], [B, 0], [px, H2]].map(P), 'ar-col');
  s += arL(X(px), Y(0), X(px), Y(H1), 'ar-h') + arRA(X(px), Y(0), 1, 0, 0, -1);
  s += arT((X(0) + X(B)) / 2, Y(0) + 22, nf(B) + ' cm');
  s += arL(X(0) - 24, Y(0), X(0) - 24, Y(H1), 'ar-dim') + arL(X(0) - 30, Y(0), X(0) - 18, Y(0)) + arL(X(0) - 30, Y(H1), X(0) - 18, Y(H1)) + arT(X(0) - 32, (Y(0) + Y(H1)) / 2 + 5, nf(H1) + ' cm', 'end');
  s += arT(X(px) + 8, (Y(0) + Y(H2)) / 2 + 5, nf(H2) + ' cm', 'start');
  return arSvg(ox + B * k + 40, oy + H1 * k + 34, s, '色をぬった部分（大きい三角形から三角形をひく）');
}
function aTri3(p) { // 大問6 平行な2直線にはさまれた3つの三角形
  const { H, b } = p, tot = b[0] + b[1] + b[2] + 6 + 1.5, k = Math.min(24, 380 / tot), ky = Math.min(22, 150 / H), top = 26, bot = top + H * ky, gap = 2 * k;
  const defs = [[0.35, '#fde68a'], [0.6, '#bbf7d0'], [1 + 1.5 / b[2], '#bfdbfe']], names = ['あ', 'い', 'う'];
  let x = 18, s = '';
  b.forEach((w, i) => {
    const bw = w * k, ax = x + bw * defs[i][0], pts = [[x, bot], [x + bw, bot], [ax, top]];
    s += arPoly(pts, 'ar-shape', `fill:${defs[i][1]}`);
    s += arT((x + x + bw + ax) / 3, bot - H * ky / 3 + 6, names[i]) + arT(x + bw / 2, bot + 22, w + ' cm');
    x += bw + gap;
  });
  const xr = x + 1.5 * k + 18;
  s = arL(6, top, xr + 14, top) + arL(6, bot, xr + 14, bot) + s + arL(xr, top, xr, bot, 'ar-h') + arRA(xr, bot, -1, 0, 0, -1) + arT(xr + 8, (top + bot) / 2 + 5, H + ' cm', 'start');
  return arSvg(xr + 70, bot + 34, s, '平行な2直線にはさまれた3つの三角形');
}

function visHTML(v) {
  switch (v.k) {
    case 'a-tri': return aTri(v); case 'a-par': return aPar(v); case 'a-trap': return aTrap(v); case 'a-rhom': return aRhom(v);
    case 'a-pent': return aPent(v); case 'a-par3': return aPar3(v); case 'a-cut1': return aCut1(v); case 'a-cut2': return aCut2(v); case 'a-tri3': return aTri3(v);
    case 'numline': return `<div class="nlwrap">${numLineSVG()}</div>`;
    case 'cake': return `<div class="cakeline">🍰×${v.n} ＝ ${v.n}こ　👧×${v.d}人でわける</div>` + barsSVG([[v.n, v.d]], `${v.d}等分のうち${v.n}こ分`);
    case 'golem': return `<div class="golem"><div class="golem-face">🗿</div><div class="armor">装甲値 ${fh(v.n, v.d)}</div></div>`;
    case 'potion': return potionSVG(v.a, v.b);
    case 'tape': return tapeSVG(v);
    case 'scale': return `<div class="scale"><div class="pan">${fh(v.a[0], v.a[1])}</div><div class="beam">⚖️</div><div class="pan">${fh(v.c[0], v.c[1])}</div></div>`;
    case 'fusion': return `<div class="fusion">${v.terms.map(t => fh(t[0], t[1])).join('<span class="plus">⚡</span>')}<div class="small-note">分母（目盛り）がちがうと合体できない！</div></div>`;
    case 'bars': return barsSVG(v.rows);
  }
  return '';
}
let B = null;
const PRAISE = ['すごい！ばっちり！', 'せいかい！その調子！', 'ナイス魔導！', 'かんぺき！', 'いいね、その計算！'];
const NUMT = ['int', 'dec', 'num', 'frac'], DOTT = ['dec', 'num'];
const SLOTS = f =>f.t === 'frac' ? (f.vm.mixed ? ['w', 'n', 'd'] : ['n', 'd']) : ['v'];

function firstSlot() { for (let i = 0; i < B.scr.fields.length; i++) { return { i, s: SLOTS(B.scr.fields[i])[0] }; } return null; }

function partNode(p) {
  if (typeof p === 'string') return el('span', 'txt', p);
  if (p.f != null) return fieldNode(p.f);
  if (p.fr) {
    const fr = el('span', 'frac'), cell = (x, c) => { const e = el('span', c); if (typeof x === 'object') e.append(fieldNode(x.f)); else e.textContent = x; return e; };
    fr.append(cell(p.fr[0], 'num'), el('span', 'bar'), cell(p.fr[1], 'den')); return fr;
  }
  if (p.tbl) { // 表（大問4）
    const wrap = el('div', 'tblwrap'), t = el('table', 'ptbl');
    p.tbl.forEach(r => { const tr = el('tr'); r.forEach((c, ci) => { const td = el(ci === 0 ? 'th' : 'td'); if (c && c.f != null) td.append(fieldNode(c.f)); else td.textContent = c; tr.append(td); }); t.append(tr); });
    wrap.append(t); return wrap;
  }
  return document.createTextNode('');
}
function slotNode(i, s) { const e = el('span', 'slot'); e.dataset.i = i; e.dataset.s = s; e.tabIndex = 0; return e; }
function fieldNode(i) {
  const f = B.scr.fields[i], w = el('span', 'fld t-' + f.t); w.dataset.i = i;
  if (f.t === 'frac') {
    if (f.mx) { const tg = el('button', 'mxtog'); tg.type = 'button'; tg.dataset.i = i; w.append(tg); }
    const row = el('span', 'frow'), whole = slotNode(i, 'w'); whole.classList.add('whole-slot');
    const fr = el('span', 'frac'), num = el('span', 'num'), bar = el('span', 'bar'), den = el('span', 'den');
    num.append(slotNode(i, 'n')); den.append(slotNode(i, 'd')); fr.append(num, bar, den); row.append(whole, fr); w.append(row);
  } else if (f.t === 'word' && save.manual) {
    const inp = el('input', 'wtext'); inp.type = 'text'; inp.placeholder = '入力'; inp.dataset.i = i;
    inp.addEventListener('focus', () => { B.act = { i, s: 'v' }; refreshAll(); renderChoices(); });
    inp.addEventListener('input', () => { B.vals[i].v = inp.value; clearMarks(); });
    w.append(inp);
  } else w.append(slotNode(i, 'v'));
  if (f.unit) w.append(el('span', 'unit', f.unit));
  return w;
}
function refreshAll() {
  if (!B || !B.scr) return;
  $$('#stem .slot').forEach(sl => {
    const i = +sl.dataset.i, s = sl.dataset.s, f = B.scr.fields[i], v = B.vals[i];
    sl.textContent = v[s];
    sl.classList.toggle('empty', v[s] === '');
    sl.classList.toggle('active', !!B.act && B.act.i === i && B.act.s === s);
    if (f.t === 'cmp' || f.t === 'pick' || f.t === 'word' || f.t === 'sel') sl.classList.add('wide');
    if (s === 'w') sl.hidden = !f.vm.mixed;
  });
  $$('#stem .mxtog').forEach(b => { const f = B.scr.fields[+b.dataset.i]; b.textContent = f.vm.mixed ? '帯分数で答える' : '仮分数で答える'; b.classList.toggle('on', f.vm.mixed); });
  $$('#stem .wtext').forEach(inp => { inp.classList.toggle('active', !!B.act && B.act.i === +inp.dataset.i); });
  $$('#vis .mk').forEach(m => m.classList.toggle('sel', B.scr.fields.some((f, i) => f.t === 'pick' && B.vals[i].v === m.dataset.k)));
  const a = B.act, f = a && B.scr.fields[a.i];
  $('#pad').classList.toggle('nonum', !f || !NUMT.includes(f.t));
  $('#pad').classList.toggle('nodot', !f || !DOTT.includes(f.t)); // 面積の「num」は、整数か小数かをさとられないよう常に「.」が使える
}
function setActive(i, s) { B.act = { i, s }; refreshAll(); renderChoices(); }
function allSlots() { const a = []; B.scr.fields.forEach((f, i) => { if (f.t === 'word' && save.manual) return; SLOTS(f).forEach(s => a.push({ i, s })); }); return a; }
function slotEmpty(sl) { return B.vals[sl.i][sl.s] === ''; }
function advance() {
  const all = allSlots(); if (!all.length) return;
  const cur = B.act ? all.findIndex(x => x.i === B.act.i && x.s === B.act.s) : -1;
  const ord = all.slice(cur + 1).concat(all.slice(0, cur + 1));
  const next = ord.find(x => slotEmpty(x) && !(x.s === 'w')) || ord[0];
  setActive(next.i, next.s);
}
function clearMarks() { $$('#stem .fld').forEach(e => e.classList.remove('good', 'bad')); }

function renderChoices() {
  const box = $('#choices'); box.innerHTML = '';
  const a = B && B.act; if (!a) { box.hidden = true; return; }
  const f = B.scr.fields[a.i], mkChip = (txt, fn, cls) => { const b = el('button', 'chip ' + (cls || ''), txt); b.type = 'button'; b.onclick = () => { SFX.click(); fn(); }; box.append(b); };
  if (f.t === 'word' && !save.manual) B.opts[a.i].forEach(w => mkChip(w, () => { B.vals[a.i].v = w; clearMarks(); refreshAll(); if (allSlots().some(slotEmpty)) advance(); }));
  else if (f.t === 'sel') B.opts[a.i].forEach(w => mkChip(w, () => { B.vals[a.i].v = w; clearMarks(); refreshAll(); if (allSlots().some(slotEmpty)) advance(); }, w.length <= 3 ? 'big' : ''));
  else if (f.t === 'cmp') ['>', '=', '<'].forEach(c => mkChip(c, () => { B.vals[a.i].v = c; clearMarks(); refreshAll(); if (allSlots().some(slotEmpty)) advance(); }, 'big'));
  else if (f.t === 'pick') Object.keys(MK).forEach(k => mkChip(k, () => { B.vals[a.i].v = k; clearMarks(); refreshAll(); }, 'big'));
  box.hidden = !box.children.length;
  fitPad();
}
function bindVis() {
  $$('#vis .mk').forEach(m => {
    const pick = () => { const i = B.scr.fields.findIndex(f => f.t === 'pick'); if (i < 0 || B.locked) return; SFX.click(); B.vals[i].v = m.dataset.k; B.act = { i, s: 'v' }; clearMarks(); refreshAll(); renderChoices(); };
    m.addEventListener('click', pick); m.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
  });
}


function pressKey(k) {
  if (!B || !B.scr) return;
  if (k === 'enter') return onSubmit();
  if (B.locked) return;
  const a = B.act; if (!a && k !== 'swap') return;
  if (k === 'swap') return advance();
  const f = B.scr.fields[a.i], v = B.vals[a.i];
  if (!NUMT.includes(f.t)) { if (k === 'bs' || k === 'clr') { v.v = ''; refreshAll(); } return; }
  SFX.click(); clearMarks();
  if (k === 'clr') { if (f.t === 'frac') { v.w = v.n = v.d = ''; } else v.v = ''; setActive(a.i, a.s); return; }
  if (k === 'bs') { v[a.s] = v[a.s].slice(0, -1); refreshAll(); return; }
  let cur = v[a.s]; const max = DOTT.includes(f.t) ? 6 : a.s === 'w' ? 2 : 4;
  if (k === '.') { if (!DOTT.includes(f.t) || cur.includes('.')) return; cur = cur === '' ? '0.' : cur + '.'; }
  else { if (cur === '0') cur = ''; if (cur.length >= max) return; cur += k; }
  v[a.s] = cur; refreshAll();
}

function markFields(res) { B.scr.fields.forEach((f, i) => { const e = $(`#stem .fld[data-i="${i}"]`); if (e) { e.classList.remove('good', 'bad'); e.classList.add(res.fr[i].ok ? 'good' : 'bad'); } }); }
function showFb(html, cls) { const e = $('#fb'); e.hidden = false; e.className = 'feedback ' + (cls || ''); e.innerHTML = html; e.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }

/* =====================================================================
   採点（誤答診断：仕様 第7章）
   ===================================================================== */
const norm = s => String(s || '').replace(/\s+/g, '').replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
function gradeField(f, v) {
  switch (f.t) {
    case 'word': {
      const x = norm(v.v); if (!x) return { ok: false, empty: true };
      return f.ans.map(norm).includes(x) ? { ok: true } : { ok: false, msg: `「${v.v}」とは少しちがうみたい。ことばの意味をヒントで確かめよう！` };
    }
    case 'int': {
      if (v.v === '') return { ok: false, empty: true };
      if (+v.v === f.ans) return { ok: true };
      const t = (f.traps || []).find(t => t.v === +v.v);
      return { ok: false, msg: t ? t.msg : '' };
    }
    case 'dec': {
      if (v.v === '') return { ok: false, empty: true };
      return Math.abs(parseFloat(v.v) - f.ans) < 1e-9 ? { ok: true } : { ok: false, msg: 'わり算をさいごまで計算できているかな？ 分子 ÷ 分母 の順番も確かめよう！' };
    }
    case 'num': {
      if (v.v === '') return { ok: false, empty: true };
      const x = parseFloat(v.v);
      return Math.abs(x - f.ans) < 1e-9 ? { ok: true } : { ok: false, msg: '' };
    }
    case 'sel': {
      if (v.v === '') return { ok: false, empty: true };
      if ([].concat(f.ans).includes(v.v)) return { ok: true };
      return { ok: false, msg: (f.msgs && f.msgs[v.v]) || '' };
    }
    case 'cmp': return v.v === '' ? { ok: false, empty: true } : (v.v === f.ans ? { ok: true } : { ok: false });
    case 'pick': {
      if (v.v === '') return { ok: false, empty: true };
      if (v.v === f.ans) return { ok: true };
      const t = (f.traps || []).find(t => t.v === v.v);
      return { ok: false, msg: t ? t.msg : '数直線の目盛りは 1目盛り＝0.1（' + fh(1, 10) + '）だよ。0からいくつ目の目盛りか数えてみよう！' };
    }
    case 'frac': {
      if (v.n === '' || v.d === '') return { ok: false, empty: true };
      const n = +v.n, d = +v.d, w = f.vm && f.vm.mixed && v.w !== '' ? +v.w : 0;
      if (d === 0) return { ok: false, msg: '分母は 0 にできないよ！' };
      const tr = (f.traps || []).find(t => t.n === n && t.d === d && w === 0);
      if (tr) return { ok: false, msg: tr.msg };
      const tn = w * d + n, [an, ad] = f.ans;
      if (tn * ad !== an * d) return { ok: false, msg: '' };
      if (f.any) return { ok: true };
      if (w > 0 && n >= d) return { ok: false, msg: `通分とたし算（ひき算）はできているよ！でも分数部分の ${fh(n, d)} は 1 より大きいから、整数部分に繰り上げて帯分数をととのえよう！` };
      const g = gcd(n, d);
      if (g > 1) return { ok: false, soft: true, msg: `<b>惜しい！大きさはバッチリ合っているよ！</b>でも、分母と分子がまだ ${g} で割れる（約分できる）よ！もう一度だけ約分してみよう！` };
      return { ok: true };
    }
  }
  return { ok: false };
}
const nzv = x => (x !== '' && x != null && !isNaN(+x)) ? String(+x) : String(x);
const sameV = (a, b) => { if (a === '' || a == null) return false; const x = +a, y = +b; return (!isNaN(x) && !isNaN(y)) ? Math.abs(x - y) < 1e-9 : String(a) === String(b); };
function diagHit(d, vals) {
  if (d.set) return d.f.map(i => nzv(vals[i].v)).sort().join('|') === d.set.map(nzv).sort().join('|');
  if (d.eq) return Object.keys(d.eq).every(i => sameV(vals[i].v, d.eq[i]));
  return d.f.some(i => d.v.some(x => sameV(vals[i].v, x)));
}
function gradeScreen(scr, vals) {
  const fr = scr.fields.map((f, i) => gradeField(f, vals[i]));
  if (scr.joint === 'cden' && fr[0].ok && fr[1].ok && +vals[0].d !== +vals[1].d) {
    fr[0] = fr[1] = { ok: false, msg: '通分は、2つの分数の分母を<b>同じ数</b>にそろえることだよ！' };
  }
  if (scr.revPair) {
    const [a, b] = scr.revPair;
    if (!fr[a].ok && !fr[b].ok && vals[a].v === String(scr.fields[b].ans) && vals[b].v === String(scr.fields[a].ans))
      fr[a].msg = fr[b].msg = '<b>分子と分母が逆になっているよ！</b>『上の数（分子）÷ 下の数（分母）』の順番を思い出そう！';
  }
  // 入れかえてもよい欄（かけ算・たし算の順番など）：中身が同じ組み合わせなら正解
  (scr.perm || []).forEach(g => {
    const exp = g.map(i => nzv(scr.fields[i].ans)).sort().join('|'), got = g.map(i => nzv(vals[i].v)).sort().join('|');
    if (got === exp) g.forEach(i => { fr[i] = { ok: true }; });
  });
  const unitOk = scr.units.map(u => u.every(i => fr[i].ok));
  const msgs = [...new Set(fr.filter(r => !r.ok && r.msg).map(r => r.msg))];
  if (!unitOk.every(Boolean)) { const d = (scr.diag || []).find(d => diagHit(d, vals)); if (d && !msgs.includes(d.msg)) msgs.unshift(d.msg); } // ひっかけミスの専用メッセージ
  return {
    fr, unitOk, msgs, all: unitOk.every(Boolean),
    empty: fr.some(r => r.empty), hard: fr.some(r => !r.ok && !r.soft && !r.empty)
  };
}
const ansText = f => f.t === 'word' ? f.ans[0] : f.t === 'frac' ? (f.any ? fh(f.ans[0], f.ans[1]) : ansFr(f.ans[0], f.ans[1])) + (f.unit ? ' ' + f.unit : '') : String(f.ans);

const memo = { on: false, erase: false, drawing: false };
function memoInit() {
  const cv = $('#memoCv'), ctx = cv.getContext('2d');
  const size = () => { const r = cv.getBoundingClientRect(), img = cv.width ? ctx.getImageData(0, 0, cv.width, cv.height) : null; cv.width = r.width; cv.height = r.height; if (img && img.width) ctx.putImageData(img, 0, 0); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; };
  const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.addEventListener('pointerdown', e => { memo.drawing = true; cv.setPointerCapture(e.pointerId); const [x, y] = pos(e); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 0.1, y + 0.1); stroke(); });
  const stroke = () => { ctx.globalCompositeOperation = memo.erase ? 'destination-out' : 'source-over'; ctx.strokeStyle = '#1a3a8a'; ctx.lineWidth = memo.erase ? 26 : 3.5; ctx.stroke(); };
  cv.addEventListener('pointermove', e => { if (!memo.drawing) return; const [x, y] = pos(e); ctx.lineTo(x, y); stroke(); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => cv.addEventListener(t, () => { memo.drawing = false; }));
  $('#memoBtn').onclick = () => { memo.on = !memo.on; $('#memo').hidden = !memo.on; $('#memoBtn').textContent = memo.on ? '✏️ 計算メモを閉じる' : '✏️ 計算メモを開く'; if (memo.on) size(); };
  $('#memoPen').onclick = () => { memo.erase = false; $('#memoPen').classList.add('on'); $('#memoEr').classList.remove('on'); };
  $('#memoEr').onclick = () => { memo.erase = true; $('#memoEr').classList.add('on'); $('#memoPen').classList.remove('on'); };
  $('#memoClr').onclick = () => ctx.clearRect(0, 0, cv.width, cv.height);
  $('#memoClose').onclick = () => $('#memoBtn').onclick();
  window.addEventListener('resize', () => { if (memo.on) size(); });
}

/* =====================================================================
   画面とゲームの流れ：もんだいは どんどん出る → まちがえた問題はあとでもう一度出る
   ===================================================================== */
const view = id => {
  ['start', 'quiz'].forEach(v => $('#' + v).classList.toggle('active', v === id));
  document.body.classList.toggle('quizzing', id === 'quiz');
  window.scrollTo(0, 0);
  status(); fitPad();
};
function fitPad() { const p = $('#pad'); document.documentElement.style.setProperty('--padh', document.body.classList.contains('quizzing') ? p.offsetHeight + 'px' : '0px'); }
window.addEventListener('resize', fitPad);

function status() {
  const m = mcState(), txt = `🧱 ${m.blocks}こ　⏱ ${mmss(m.sec)}`;
  $$('.mc-status').forEach(e => { e.textContent = txt; });
  $('#qCount').textContent = `✔ ${save['total' + UNIT_CAP[save.unit]]}もん`;
  $('#qWrong').textContent = wList().length ? `ふくしゅう ${wList().length}` : '';
  $('#qUnit').textContent = UNIT_BADGE[save.unit];
  $$('.unit-tab').forEach(b => { const on = b.dataset.unit === save.unit; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
  $('#tSound').textContent = save.sound ? '🔊' : '🔇';
  $('#sNote').textContent = m.sec > 0 ? 'ためた時間で あそべるよ！' : 'まず もんだいを解いて、あそぶ時間をためよう！';
}

/** 次の問題：ふだんはランダム。まちがえた問題は、少し間をあけてまた出す。 */
let lastId = '', since = 0;
const UNIT_BADGE = { area: '📐 面積', frac: '🍕 分数' };
const wKey = () => 'wrong' + UNIT_CAP[save.unit];
const wList = () => save[wKey()];
function pickScreen() {
  const pool = wList().filter(w => w.id !== lastId);
  let scr = null, review = false;
  if (pool.length && (since >= 3 || Math.random() < 0.25)) { scr = clone(PK(pool)); review = true; since = 0; }
  else {
    if (save.unit === 'area') scr = nextArea(); // 11画面を1巡するシャッフル・デッキ
    else for (let i = 0; i < 30 && !scr; i++) { const g = genScreen(R(1, 9)); if (g.id !== lastId) scr = g; }
    since++;
  }
  lastId = scr.id;
  return { scr, review };
}
function addWrong(scr) {
  const c = clone(scr); c.fields.forEach(f => { delete f.vm; });
  const k = wKey(); save[k] = save[k].filter(w => w.id !== c.id); save[k].unshift(c); save[k] = save[k].slice(0, 50);
  persist();
}

function loadScreen() {
  const { scr, review } = pickScreen();
  B = { scr, review, fails: 0, missU: new Set(), locked: false, noted: false, opts: {}, act: null };
  B.vals = scr.fields.map(f => { f.vm = { mixed: false }; return { w: '', n: '', d: '', v: '' }; });
  scr.fields.forEach((f, i) => { if (f.t === 'word' || f.t === 'sel') B.opts[i] = f.keep ? f.opts : shuffle(f.opts); });
  $('#badge').hidden = !review;
  $('#inst').innerHTML = scr.inst || '';
  const stem = $('#stem'); stem.innerHTML = '';
  scr.parts.forEach(p => stem.append(partNode(p)));
  $('#vis').innerHTML = scr.vis ? visHTML(scr.vis) : '';
  bindVis();
  $('#hintBox').hidden = true; $('#hintBox').innerHTML = '';
  $('#fb').hidden = true; $('#fb').innerHTML = '';
  $('#enter').innerHTML = '決定！';
  const first = firstSlot(); setActive(first.i, first.s);
  fitPad();
}

function onSubmit() {
  if (!B) return;
  if (B.locked) return loadScreen();
  const res = gradeScreen(B.scr, B.vals);
  if (res.empty) { SFX.wrong(); showFb('まだ入力していない［　］があるよ。ぜんぶ入れてから決定してね！', 'warn'); return; }
  markFields(res);
  if (res.all) onCorrect(); else if (res.hard) onMiss(res); else onSoft(res);
}
function onCorrect() {
  const scr = B.scr, units = scr.units.length;
  save.total += units; save['total' + UNIT_CAP[save.unit]] += units;
  if (B.fails === 0) save[wKey()] = wList().filter(w => w.id !== scr.id); // 一発で正解 → ふくしゅう完了
  persist();
  const mc = mcReward(units);
  const mcHtml = Object.keys(mc.got).length ? `<div class="mc-gain">🧱 ${Object.entries(mc.got).map(([n, c]) => `${n} ×${c}`).join('、')}　⏱ +${mc.added}秒${mc.full ? '（さいだい3分！ もうあそべるよ）' : ''}</div>` : '';
  let extra = ''; scr.fields.forEach(f => { if (f.t === 'frac' && f.mx) { const [n, d] = f.ans; extra += `<div>${altFr(n, d)}　どちらの書き方でもOK！</div>`; } });
  B.locked = true; $('#enter').innerHTML = 'つぎへ ▶';
  SFX.correct();
  showFb(`<div class="fb-title">⭕ ${B.review && B.fails === 0 ? 'ふくしゅう クリア！' : PK(PRAISE)}</div>${mcHtml}${extra}<div class="sol">${scr.sol || ''}</div>`, 'good');
  status();
}
function onSoft(res) {
  SFX.wrong();
  showFb(`<div class="fb-title">😲 惜しい！</div><div>${res.msgs.join('<br>')}</div>`, 'soft');
}
function onMiss(res) {
  B.fails++; SFX.wrong();
  if (!B.noted) { addWrong(B.scr); B.noted = true; status(); }
  const msgs = res.msgs.length ? res.msgs : ['もういちど考えてみよう。赤くなった所を見直してね。'];
  let html = `<div class="fb-title">❌ おしい！</div><div>${msgs.join('<br>')}</div>`;
  if (B.fails >= 2) html += '<button class="btn small" id="revealBtn" type="button">こたえを見る</button>';
  showFb(html, 'bad');
}
function reveal() {
  const scr = B.scr;
  scr.fields.forEach((f, i) => {
    const v = B.vals[i];
    if (f.t === 'frac') { f.vm.mixed = false; v.n = String(f.ans[0]); v.d = String(f.ans[1]); v.w = ''; }
    else if (f.t === 'sel') v.v = [].concat(f.ans)[0];
    else if (f.t === 'word') { v.v = f.ans[0]; const inp = $(`#stem .wtext[data-i="${i}"]`); if (inp) inp.value = v.v; }
    else v.v = String(f.ans);
  });
  B.locked = true; refreshAll(); $$('#stem .fld').forEach(e => e.classList.add('good'));
  $('#enter').innerHTML = 'つぎへ ▶';
  showFb(`<div class="fb-title">📖 こたえ</div><div class="sol">${scr.sol || ''}</div><div>この問題は、あとでもう一度出すよ！</div>`, 'soft');
}

function init() {
  document.addEventListener('pointerdown', () => AC(), { once: true });
  $('#goQuiz').onclick = () => { SFX.click(); view('quiz'); if (!B) loadScreen(); };
  $('#qBack').onclick = () => view('start');
  $$('.unit-tab').forEach(b => { b.onclick = () => { // 単元の切りかえ：出題中の問題をリセットして、えらんだ単元だけを出す
    if (save.unit !== b.dataset.unit) { save.unit = b.dataset.unit; persist(); B = null; lastId = ''; since = 0; }
    SFX.click(); status();
  }; });
  $('#tSound').onclick = () => { save.sound = !save.sound; persist(); status(); SFX.click(); };
  $('#hintBtn').onclick = () => {
    const s = B.scr, hb = $('#hintBox'); hb.hidden = false;
    hb.innerHTML = `<b>💡 ヒント</b><div>${s.hint || ''}</div>${s.hintVis ? visHTML(s.hintVis) : ''}`;
  };
  $('#stem').addEventListener('click', e => {
    const tg = e.target.closest('.mxtog');
    if (tg) { if (B.locked) return; const i = +tg.dataset.i, f = B.scr.fields[i]; f.vm.mixed = !f.vm.mixed; if (!f.vm.mixed) B.vals[i].w = ''; SFX.click(); clearMarks(); setActive(i, f.vm.mixed ? 'w' : 'n'); return; }
    const sl = e.target.closest('.slot'); if (sl && !B.locked) { SFX.click(); setActive(+sl.dataset.i, sl.dataset.s); }
  });
  $('#fb').addEventListener('click', e => { if (e.target.id === 'revealBtn') reveal(); });
  $('#pad').addEventListener('click', e => { const b = e.target.closest('button[data-k]'); if (b) pressKey(b.dataset.k); });
  document.addEventListener('keydown', e => {
    if (!document.body.classList.contains('quizzing') || !B) return;
    if (/^[0-9]$/.test(e.key)) pressKey(e.key); else if (e.key === '.') pressKey('.');
    else if (e.key === 'Backspace') { e.preventDefault(); pressKey('bs'); }
    else if (e.key === 'Enter') { e.preventDefault(); pressKey('enter'); }
    else if (e.key === 'Tab') { e.preventDefault(); pressKey('swap'); }
  });
  memoInit();
  window.addEventListener('pageshow', status);
  if (location.hash === '#quiz') $('#goQuiz').click(); else view('start');
}
window.__BW = { genScreen, genArea, AREA_KEYS, gradeScreen, mcState, cur: () => B };
document.addEventListener('DOMContentLoaded', init);
})();
