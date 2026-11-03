/**
 * drill.js - 計算ドリル
 *
 * 型ごとに数値を変えて何度でも出題する。答えは数値で入力し、
 * よくある誤り(traps)と一致したら「どこで間違えたか」を指摘する。
 * 1問ごとに時間を測り、試験の1問あたりの目安時間と比べる。
 *
 * 計算画面のタブ(計算ドリル / 計算フロー)の切替えもここで扱う。
 */
(function (global) {
  'use strict';

  var doc = global.document;
  var EXAM = global.CURRENT_EXAM || { id: 'ap' };
  var TARGET_SEC = EXAM.id === 'sc' ? 96 : 112;   // 午前II 40分/25問、AP午前 150分/80問
  var SESSION_LEN = { type: 5, mix: 10, weak: 10 };

  var ctx = { toast: function () {}, onStudied: function () {}, lessonButton: function () { return null; } };
  var tab = 'drill';
  var sess = null;     // {items:[{type, p, input, ok, trap, ms}], index, startedAt, qStart, kind, title}
  var tick = null;

  function types() { return global.DrillGen.forExam(EXAM.id); }
  function $(id) { return doc.getElementById(id); }
  function el(tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function btn(label, cls, onClick) {
    var b = el('button', 'btn ' + (cls || 'btn-secondary'), label);
    b.type = 'button';
    if (onClick) b.addEventListener('click', onClick);
    return b;
  }
  function st() { var s = global.AppStorage.get(); if (!s.drill) s.drill = {}; return s.drill; }
  function rec(id) {
    var d = st();
    if (!d[id]) d[id] = { n: 0, ok: 0, ms: 0, hist: [], lastAt: null };
    return d[id];
  }
  function stats(id) {
    var r = st()[id];
    if (!r || !r.n) return { n: 0, acc: null, avg: null, recent: null };
    var recent = r.hist.length ? r.hist.reduce(function (a, b) { return a + b; }, 0) / r.hist.length : null;
    return { n: r.n, acc: r.ok / r.n, avg: r.ms / r.n / 1000, recent: recent };
  }
  /** 苦手度(大きいほど苦手)。未挑戦は中程度 */
  function weakness(id) {
    var s = stats(id);
    if (!s.n) return 0.5;
    var acc = s.recent !== null ? s.recent : s.acc;
    return (1 - acc) + Math.max(0, s.avg / TARGET_SEC - 1) * 0.5;
  }
  function isWeak(id) {
    var s = stats(id);
    return s.n > 0 && ((s.recent !== null ? s.recent : s.acc) < 0.7 || s.avg > TARGET_SEC);
  }
  /** 型の教科書対応(試験ごとの上書き) */
  function lessonItem(t) {
    if (EXAM.id === 'sc' && t.sc) return t.sc;
    return { field: t.field, topic: t.topic };
  }

  /* ============ タブ ============ */
  function setTab(v) {
    if (v === 'flow' && !(global.FLOW_BANK || []).length) v = 'drill';
    tab = v;
    $('drillTab').hidden = v !== 'drill';
    $('flowTab').hidden = v !== 'flow';
    Array.prototype.forEach.call(doc.querySelectorAll('#calcTabs .tb-tab'), function (b) {
      b.classList.toggle('is-active', b.dataset.view === v);
    });
  }

  function onShow() {
    if (global.FlowMode.isRunning()) setTab('flow');
    setTab(tab);
    if (tab === 'flow' && !global.FlowMode.isRunning()) global.FlowMode.renderList();
    if (tab === 'drill' && !sess) renderHome();
  }

  /* ============ 一覧 ============ */
  function renderHome() {
    $('drillHome').hidden = false;
    $('drillPlayer').hidden = true;
    var all = types();
    var done = all.filter(function (t) { return stats(t.id).n > 0; });
    var tot = done.reduce(function (a, t) { var r = st()[t.id]; return { n: a.n + r.n, ok: a.ok + r.ok, ms: a.ms + r.ms }; }, { n: 0, ok: 0, ms: 0 });
    var sum = $('drillSummary');
    sum.innerHTML = '';
    [[tot.n + '問', '解いた計算問題'],
      [tot.n ? Math.round(tot.ok / tot.n * 100) + '%' : '—', '正答率'],
      [tot.n ? Math.round(tot.ms / tot.n / 1000) + '秒' : '—', '1問の平均時間(目安 ' + TARGET_SEC + '秒)'],
      [all.filter(function (t) { return isWeak(t.id); }).length + ' / ' + all.length, '苦手な型']].forEach(function (x) {
      var tile = el('div', 'stat-tile');
      tile.appendChild(el('div', 'v', x[0]));
      tile.appendChild(el('div', 'l', x[1]));
      sum.appendChild(tile);
    });

    var list = $('drillList');
    list.innerHTML = '';
    var fields = [];
    all.forEach(function (t) { if (fields.indexOf(t.field) < 0) fields.push(t.field); });
    fields.forEach(function (f) {
      list.appendChild(el('h3', 'flow-cat', f));
      var grid = el('div', 'drill-grid');
      all.filter(function (t) { return t.field === f; }).forEach(function (t) {
        var s = stats(t.id);
        var card = el('button', 'drill-card' + (isWeak(t.id) ? ' weak' : ''));
        card.type = 'button';
        card.appendChild(el('span', 'drill-title', t.title));
        var meta = el('span', 'drill-meta');
        if (!s.n) meta.appendChild(el('span', 'flow-badge new', '未挑戦'));
        else {
          var acc = Math.round((s.recent !== null ? s.recent : s.acc) * 100);
          meta.appendChild(el('span', 'flow-badge ' + (acc >= 80 ? 'perfect' : acc >= 60 ? 'done' : 'ng'), '直近 ' + acc + '%'));
          meta.appendChild(el('span', 'drill-time' + (s.avg > TARGET_SEC ? ' slow' : ''), '平均 ' + Math.round(s.avg) + '秒'));
          meta.appendChild(el('span', 'drill-n', s.n + '問'));
        }
        card.appendChild(meta);
        card.addEventListener('click', function () { startType(t.id); });
        grid.appendChild(card);
      });
      list.appendChild(grid);
    });
  }

  /* ============ 出題 ============ */
  function startSession(kind, typeList, title) {
    var items = typeList.map(function (t) { return { type: t, p: global.DrillGen.make(t), input: null, ok: null, trap: null, ms: 0 }; });
    sess = { kind: kind, title: title, items: items, index: 0, startedAt: Date.now(), qStart: Date.now() };
    $('drillHome').hidden = true;
    $('drillPlayer').hidden = false;
    $('drillResult').hidden = true;
    $('drillQCard').hidden = false;
    setTab('drill');
    renderQ();
    global.scrollTo(0, 0);
  }

  function startType(id) {
    var t = global.DrillGen.get(id);
    if (!t) return;
    var arr = [];
    for (var i = 0; i < SESSION_LEN.type; i++) arr.push(t);
    startSession('type', arr, t.title);
  }

  function startMix() {
    var all = global.Quiz.shuffle(types());
    var arr = [];
    for (var i = 0; i < SESSION_LEN.mix; i++) arr.push(all[i % all.length]);
    startSession('mix', arr, 'ミックス');
  }

  function startWeak() {
    var all = global.Quiz.shuffle(types()).sort(function (a, b) { return weakness(b.id) - weakness(a.id); });
    var top = all.slice(0, 4);
    var arr = [];
    for (var i = 0; i < SESSION_LEN.weak; i++) arr.push(top[i % top.length]);
    startSession('weak', global.Quiz.shuffle(arr), '苦手優先');
  }

  function cur() { return sess.items[sess.index]; }

  function renderQ() {
    var it = cur();
    var total = sess.items.length;
    $('drillProgressText').textContent = sess.title + '  ' + (sess.index + 1) + ' / ' + total;
    $('drillProgressFill').style.width = (sess.index / total * 100) + '%';
    var tags = $('drillTags');
    tags.innerHTML = '';
    tags.appendChild(el('span', 'tag tag-cat', it.type.field));
    tags.appendChild(el('span', 'tag', it.type.title));
    $('drillQ').textContent = it.p.q;
    var inp = $('drillInput');
    inp.value = '';
    inp.disabled = false;
    $('drillUnit').textContent = it.p.unit || '';
    $('drillSubmit').hidden = false;
    $('drillFeedback').hidden = true;
    $('drillNext').hidden = true;
    clearMemo();
    sess.qStart = Date.now();
    startTick();
    setTimeout(function () { try { inp.focus({ preventScroll: true }); } catch (e) { inp.focus(); } }, 50);
  }

  function startTick() {
    clearInterval(tick);
    var upd = function () {
      if (!sess) return;
      var s = Math.floor((Date.now() - sess.qStart) / 1000);
      var t = $('drillTimer');
      t.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0') + ' / 目安 ' + Math.floor(TARGET_SEC / 60) + '分' + (TARGET_SEC % 60 ? TARGET_SEC % 60 + '秒' : '');
      t.classList.toggle('is-urgent', s > TARGET_SEC);
    };
    upd();
    tick = setInterval(upd, 1000);
  }

  function parseNum(s) {
    var v = String(s || '').normalize('NFKC').replace(/[,\s]/g, '').replace(/[−ー―]/g, '-');
    if (!/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(v)) return NaN;
    return Number(v);
  }

  function submit() {
    var it = cur();
    if (it.ok !== null) return;
    var v = parseNum($('drillInput').value);
    if (isNaN(v)) { ctx.toast('数値で入力してください(例: 0.891、-5、1040)。'); return; }
    clearInterval(tick);
    it.ms = Date.now() - sess.qStart;
    it.input = v;
    it.ok = Math.abs(v - it.p.answer) <= it.p.tol;
    if (!it.ok) {
      var trap = it.p.traps.filter(function (t) { return Math.abs(v - t.v) <= it.p.tol; })[0];
      it.trap = trap ? trap.msg : null;
    }
    var r = rec(it.type.id);
    r.n += 1; if (it.ok) r.ok += 1; r.ms += it.ms; r.lastAt = Date.now();
    r.hist.push(it.ok ? 1 : 0);
    if (r.hist.length > 10) r.hist = r.hist.slice(-10);
    ctx.onStudied(1, it.ok ? 1 : 0);
    renderFeedback();
  }

  function fmtNum(v) { return Number(v).toLocaleString('ja-JP', { maximumFractionDigits: 6 }); }

  function renderFeedback() {
    var it = cur();
    $('drillInput').disabled = true;
    $('drillSubmit').hidden = true;
    var fb = $('drillFeedback');
    fb.hidden = false;
    fb.innerHTML = '';
    var sec = Math.round(it.ms / 1000);
    var head = el('div', 'feedback-head ' + (it.ok ? 'ok' : 'ng'),
      (it.ok ? '正解' : '不正解') + '  (正解は ' + fmtNum(it.p.answer) + (it.p.unit ? ' ' + it.p.unit : '') + ')');
    fb.appendChild(head);
    var time = el('div', 'drill-sec' + (sec > TARGET_SEC ? ' slow' : ''), '解答時間 ' + sec + '秒' + (sec > TARGET_SEC ? '(目安の ' + TARGET_SEC + '秒を超えました。手順を覚えて速く解けるようにしましょう)' : ''));
    fb.appendChild(time);
    if (!it.ok) {
      var diag = el('div', 'drill-diag' + (it.trap ? '' : ' none'));
      diag.appendChild(el('b', '', it.trap ? '🔍 間違いの原因(推定): ' : '🔍 '));
      diag.appendChild(doc.createTextNode(it.trap || 'よくある誤りのパターンとは一致しませんでした。下の手順と自分の途中式を見比べてください。'));
      fb.appendChild(diag);
    }
    var body = el('div', 'feedback-body');
    body.appendChild(el('h4', '', '解き方'));
    var ol = el('ol', 'drill-steps');
    it.p.steps.forEach(function (s) { ol.appendChild(el('li', '', s)); });
    body.appendChild(ol);
    fb.appendChild(body);
    var lb = ctx.lessonButton(lessonItem(it.type));
    if (lb) { var lw = el('div', 'feedback-lesson'); lw.appendChild(lb); fb.appendChild(lw); }
    var last = sess.index === sess.items.length - 1;
    $('drillNext').hidden = false;
    $('drillNext').textContent = last ? '結果を見る' : '次の問題 →';
    global.AppStorage.save();
  }

  function next() {
    if (sess.index >= sess.items.length - 1) { finish(); return; }
    sess.index += 1;
    renderQ();
  }

  function finish() {
    clearInterval(tick);
    $('drillQCard').hidden = true;
    $('drillProgressFill').style.width = '100%';
    var box = $('drillResult');
    box.hidden = false;
    box.innerHTML = '';
    var ok = sess.items.filter(function (i) { return i.ok; }).length;
    var avg = Math.round(sess.items.reduce(function (a, i) { return a + i.ms; }, 0) / sess.items.length / 1000);
    box.appendChild(el('h3', '', sess.title + ' — ' + ok + ' / ' + sess.items.length + ' 問正解'));
    box.appendChild(el('p', 'muted', '1問あたり平均 ' + avg + '秒(目安 ' + TARGET_SEC + '秒)。' +
      (ok === sess.items.length && avg <= TARGET_SEC ? 'この型は本番でも得点源にできます。' : '間違えた問題は手順を見直し、同じ型をもう一度解いて定着させましょう。')));
    var ol = el('ol', 'flow-result-list');
    sess.items.forEach(function (i) {
      var li = el('li', 'flow-result-item ' + (i.ok ? 'ok' : 'ng'));
      li.appendChild(el('span', 'trail-mark', i.ok ? '○' : '×'));
      var b = el('span', 'trail-body');
      b.appendChild(el('span', 'trail-pitfall', i.type.title + '(' + Math.round(i.ms / 1000) + '秒)'));
      b.appendChild(el('span', 'trail-answer', i.ok ? '正解 ' + fmtNum(i.p.answer) : 'あなた ' + fmtNum(i.input) + ' → 正解 ' + fmtNum(i.p.answer) + (i.trap ? '  ' + i.trap : '')));
      li.appendChild(b);
      ol.appendChild(li);
    });
    box.appendChild(ol);
    var row = el('div', 'result-actions');
    var kind = sess.kind, firstType = sess.items[0].type.id;
    row.appendChild(btn('同じ条件でもう一度', 'btn-primary', function () {
      if (kind === 'type') startType(firstType); else if (kind === 'mix') startMix(); else startWeak();
    }));
    row.appendChild(btn('一覧へ戻る', 'btn-ghost', exit));
    box.appendChild(row);
    sess = null;
    global.AppStorage.save();
  }

  function exit() {
    clearInterval(tick);
    sess = null;
    renderHome();
    global.scrollTo(0, 0);
  }

  function isRunning() { return !!sess && sess.items.some(function (i) { return i.ok !== null; }) && sess.items.some(function (i) { return i.ok === null; }); }

  /* ============ 手書きメモ ============ */
  var memo = { canvas: null, ctx: null, drawing: false };
  function setupMemo() {
    var c = $('drillMemo');
    memo.canvas = c;
    memo.ctx = c.getContext('2d');
    function size() {
      var w = c.parentNode.clientWidth || 600;
      var ratio = global.devicePixelRatio || 1;
      c.width = w * ratio; c.height = 220 * ratio;
      c.style.width = w + 'px'; c.style.height = '220px';
      memo.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      memo.ctx.lineWidth = 2; memo.ctx.lineCap = 'round'; memo.ctx.lineJoin = 'round';
      memo.ctx.strokeStyle = getComputedStyle(doc.documentElement).getPropertyValue('--text') || '#1b2130';
    }
    memo.resize = size;
    function pos(e) { var r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    c.addEventListener('pointerdown', function (e) {
      memo.drawing = true; c.setPointerCapture(e.pointerId);
      var p = pos(e); memo.ctx.beginPath(); memo.ctx.moveTo(p[0], p[1]); e.preventDefault();
    });
    c.addEventListener('pointermove', function (e) {
      if (!memo.drawing) return;
      var p = pos(e); memo.ctx.lineTo(p[0], p[1]); memo.ctx.stroke(); e.preventDefault();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { c.addEventListener(ev, function () { memo.drawing = false; }); });
    $('drillMemoClear').addEventListener('click', clearMemo);
    $('drillMemoToggle').addEventListener('click', function () {
      var box = $('drillMemoBox');
      box.hidden = !box.hidden;
      this.textContent = box.hidden ? '✏️ 計算メモを開く' : '✏️ 計算メモを閉じる';
      if (!box.hidden) size();
    });
  }
  function clearMemo() {
    if (!memo.ctx) return;
    memo.ctx.save();
    memo.ctx.setTransform(1, 0, 0, 1, 0, 0);
    memo.ctx.clearRect(0, 0, memo.canvas.width, memo.canvas.height);
    memo.ctx.restore();
    $('drillMemoText').value = '';
  }

  /* ============ 初期化 ============ */
  function init(c) {
    Object.keys(c || {}).forEach(function (k) { ctx[k] = c[k]; });
    Array.prototype.forEach.call(doc.querySelectorAll('#calcTabs .tb-tab'), function (b) {
      b.addEventListener('click', function () {
        if (b.dataset.view !== tab && isRunning() && !global.confirm('計算ドリルの途中です。中断しますか?')) return;
        if (b.dataset.view !== tab && global.FlowMode.isRunning() && !global.confirm('計算フローの途中です。中断しますか?')) return;
        if (b.dataset.view === 'drill' && global.FlowMode.isRunning()) global.FlowMode.exit();
        if (b.dataset.view === 'flow') { sess = null; clearInterval(tick); }
        setTab(b.dataset.view);
        onShow();
      });
    });
    $('calcTabs').hidden = !(global.FLOW_BANK || []).length;
    $('drillMixBtn').addEventListener('click', startMix);
    $('drillWeakBtn').addEventListener('click', startWeak);
    $('drillSubmit').addEventListener('click', submit);
    $('drillNext').addEventListener('click', next);
    $('drillInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); if (!$('drillSubmit').hidden) submit(); else next(); }
    });
    $('drillExitBtn').addEventListener('click', function () {
      if (isRunning() && !global.confirm('計算ドリルを中断して一覧へ戻りますか?(解いた問題の記録は残ります)')) return;
      exit();
    });
    doc.addEventListener('keydown', function (e) {
      if (!sess || $('drillPlayer').hidden || !$('screen-flow').classList.contains('is-active')) return;
      if (e.key === 'Enter' && doc.activeElement !== $('drillInput') && !$('drillNext').hidden && doc.activeElement.tagName !== 'TEXTAREA') { e.preventDefault(); next(); }
    });
    setupMemo();
    setTab('drill');
  }

  global.DrillMode = {
    init: init, onShow: onShow, setTab: setTab, startType: startType, isRunning: isRunning,
    exit: exit, types: types, stats: stats, isWeak: isWeak, lessonItem: lessonItem, TARGET_SEC: TARGET_SEC
  };
})(window);
