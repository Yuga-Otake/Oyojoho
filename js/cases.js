/**
 * cases.js - 午後(記述式)事例演習
 *
 * 事例(問題文と図表)を読み、設問に答える。
 * - 選択式: その場で正誤と解説を表示
 * - 記述式: 解答を書いて確定すると、解答例と「採点の観点」を表示する。
 *   観点のキーワードが解答に含まれているかを自動で照合し、それを参考に自己採点(○ / △ / ×)する
 */
(function (global) {
  'use strict';

  var doc = global.document;
  var CASES = global.CASE_BANK || [];
  var DIFF_LABELS = { 1: '★☆☆ 基本', 2: '★★☆ 標準', 3: '★★★ 応用' };
  var GRADES = { full: { label: '○ できた', rate: 1 }, half: { label: '△ 一部できた', rate: 0.5 }, zero: { label: '× できなかった', rate: 0 } };

  var ctx = { toast: function () {}, onStudied: function () {}, lessonButton: function () { return null; } };
  var cur = null;
  var tick = null;

  function $(id) { return doc.getElementById(id); }
  function el(tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function state() { var s = global.AppStorage.get(); if (!s.cases) s.cases = {}; return s; }
  function rec(id) {
    var s = state();
    if (!s.cases[id]) s.cases[id] = { attempts: 0, best: 0, last: 0, lastAt: null, answers: null };
    return s.cases[id];
  }

  /** 全角英数を半角にし、空白を除いて小文字化(キーワード照合用) */
  function norm(t) {
    return String(t || '').normalize('NFKC').replace(/\s+/g, '').toLowerCase();
  }
  function keywordHits(text, groups) {
    var n = norm(text);
    return (groups || []).map(function (g) {
      return g.some(function (w) { return n.indexOf(norm(w)) >= 0; });
    });
  }
  function countChars(t) { return Array.from(String(t || '').replace(/\n/g, '')).length; }

  /* ============ 一覧 ============ */
  function renderList() {
    var sum = $('caseSummary');
    sum.innerHTML = '';
    var done = CASES.filter(function (c) { var r = state().cases[c.id]; return r && r.attempts > 0; });
    var best = done.length ? Math.round(done.reduce(function (a, c) { return a + state().cases[c.id].best; }, 0) / done.length) : null;
    [[CASES.length + '問', '収録事例'], [done.length + ' / ' + CASES.length, '挑戦した事例'], [best === null ? '—' : best + '点', '平均ベストスコア']].forEach(function (t) {
      var tile = el('div', 'stat-tile');
      tile.appendChild(el('div', 'v', t[0]));
      tile.appendChild(el('div', 'l', t[1]));
      sum.appendChild(tile);
    });

    var list = $('caseList');
    list.innerHTML = '';
    if (!CASES.length) { list.appendChild(el('p', 'empty', 'この試験の午後演習はまだ収録されていません。')); return; }

    // 分野選びの作戦(午後の出題分野がある試験のみ)
    if (CASES.some(function (c) { return c.area; }) && global.Planner) {
      var exam = global.CURRENT_EXAM || {};
      var pm = global.Planner.predictPM(CASES, state(), exam);
      var box = el('div', 'card area-card');
      box.appendChild(el('h3', '', '🧭 午後の分野選び'));
      box.appendChild(el('p', 'muted', (exam.pm && exam.pm.note ? exam.pm.note + '。' : '') + '各分野の事例を解くと、ベストスコアの高い分野を本番の選択候補として提案します。'));
      var tbl = el('div', 'area-list');
      var areas = [];
      CASES.forEach(function (c) { if (areas.indexOf(c.area) < 0) areas.push(c.area); });
      var info = {};
      ((pm && pm.areas) || []).forEach(function (a) { info[a.area] = a; });
      areas.forEach(function (a) {
        var row = el('div', 'area-row');
        var req = CASES.some(function (c) { return c.area === a && c.required; });
        row.appendChild(el('span', 'area-name', a));
        if (req) row.appendChild(el('span', 'status-chip open', '必須'));
        else if (info[a] && info[a].chosen) row.appendChild(el('span', 'status-chip done', '選択候補'));
        row.appendChild(el('span', 'area-score' + (info[a] && info[a].best >= 60 ? ' ok' : ''), info[a] ? 'ベスト ' + info[a].best + '点' : '未挑戦'));
        tbl.appendChild(row);
      });
      box.appendChild(tbl);
      if (pm && pm.score !== null) box.appendChild(el('p', 'hint', '選択候補で受験した場合の予測: ' + pm.score + '点(合格基準 60点)' + (pm.missing ? '。あと ' + pm.missing + ' 分野に挑戦すると予測が安定します。' : '')));
      list.appendChild(box);
    }

    CASES.forEach(function (c) {
      var r = state().cases[c.id];
      var card = el('button', 'flow-card');
      card.type = 'button';
      var head = el('div', 'flow-card-head');
      head.appendChild(el('span', 'flow-card-title', c.title));
      var badge = !r || !r.attempts ? el('span', 'flow-badge new', '未挑戦')
        : el('span', 'flow-badge ' + (r.best >= 60 ? 'perfect' : 'done'), 'ベスト ' + r.best + '点');
      head.appendChild(badge);
      card.appendChild(head);
      card.appendChild(el('p', 'flow-card-desc', c.scenario[0]));
      var tags = el('div', 'q-tags');
      tags.appendChild(el('span', 'tag tag-cat', c.area || c.field));
      if (c.required) tags.appendChild(el('span', 'tag tag-req', '必須'));
      tags.appendChild(el('span', 'tag tag-diff', DIFF_LABELS[c.difficulty] || ''));
      tags.appendChild(el('span', 'tag', '設問' + c.questions.length + '・目安' + c.minutes + '分'));
      var nText = c.questions.filter(function (q) { return q.type === 'text'; }).length;
      if (nText) tags.appendChild(el('span', 'tag', '記述 ' + nText + '問'));
      var nNum = c.questions.filter(function (q) { return q.type === 'number'; }).length;
      if (nNum) tags.appendChild(el('span', 'tag', '計算 ' + nNum + '問'));
      card.appendChild(tags);
      card.addEventListener('click', function () { start(c); });
      list.appendChild(card);
    });
  }

  /* ============ 演習 ============ */
  function start(c) {
    var doShuffle = !!global.AppStorage.get().settings.shuffleChoices;
    cur = {
      c: c,
      answers: c.questions.map(function () { return null; }),
      grades: c.questions.map(function () { return null; }),
      // 選択式の表示順(choices のインデックスの並び)
      orders: c.questions.map(function (q) {
        if (q.type !== 'choice') return null;
        var idx = q.choices.map(function (_, i) { return i; });
        return doShuffle ? global.Quiz.shuffle(idx) : idx;
      }),
      startedAt: Date.now(), finished: false
    };
    $('caseListView').hidden = true;
    $('casePlayerView').hidden = false;
    $('caseResult').hidden = true;
    renderScenario();
    renderQuestions();
    startTick();
    global.scrollTo(0, 0);
  }

  function startTick() {
    clearInterval(tick);
    var upd = function () {
      if (!cur) return;
      var sec = Math.floor((Date.now() - cur.startedAt) / 1000);
      var t = $('caseTimer');
      t.textContent = '経過 ' + String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0') + ' / 目安 ' + cur.c.minutes + '分';
      t.classList.toggle('is-urgent', sec > cur.c.minutes * 60);
    };
    upd();
    tick = setInterval(upd, 1000);
  }

  function renderScenario() {
    var box = $('caseScenario');
    box.innerHTML = '';
    var c = cur.c;
    box.appendChild(el('div', 'case-label', '問題文'));
    box.appendChild(el('h3', 'case-title', c.title));
    c.scenario.forEach(function (p) { box.appendChild(el('p', 'case-p', p)); });
    (c.materials || []).forEach(function (m) {
      var fig = el('figure', 'case-fig');
      fig.appendChild(el('figcaption', '', m.title));
      fig.appendChild(el('pre', 'case-pre', m.pre));
      box.appendChild(fig);
    });
  }

  function progressText() {
    var graded = cur.grades.filter(function (g) { return g !== null; }).length;
    $('caseProgress').textContent = '設問 ' + graded + ' / ' + cur.c.questions.length + ' 採点済み';
    $('caseProgressFill').style.width = (graded / cur.c.questions.length * 100) + '%';
  }

  function points(c) { return Math.round(100 / c.questions.length); }

  function renderQuestions() {
    var box = $('caseQuestions');
    box.innerHTML = '';
    cur.c.questions.forEach(function (q, i) { box.appendChild(questionCard(q, i)); });
    progressText();
  }

  function questionCard(q, i) {
    var card = el('div', 'card case-q');
    card.id = 'caseQ' + i;
    var head = el('div', 'case-q-head');
    head.appendChild(el('span', 'case-no', q.no));
    head.appendChild(el('span', 'tag', q.type === 'text' ? '記述' + (q.limit ? '(' + q.limit + '字以内)' : '') : q.type === 'number' ? '計算' : '選択'));
    head.appendChild(el('span', 'case-pts', points(cur.c) + '点'));
    card.appendChild(head);
    card.appendChild(el('p', 'q-text', q.prompt));
    if (q.type === 'choice') renderChoice(card, q, i);
    else if (q.type === 'number') renderNumber(card, q, i);
    else renderText(card, q, i);
    return card;
  }

  function renderChoice(card, q, i) {
    var ul = el('ul', 'choices');
    var answered = cur.answers[i];
    var order = cur.orders[i];
    var correctIdx = order.indexOf(q.answer);
    order.forEach(function (orig, ci) {
      var t = q.choices[orig];
      var li = el('li');
      var b = el('button', 'choice');
      b.type = 'button';
      b.appendChild(el('span', 'mark', ['ア', 'イ', 'ウ', 'エ'][ci]));
      b.appendChild(el('span', 'body', t));
      if (answered !== null) {
        b.disabled = true;
        if (ci === correctIdx) b.classList.add('is-correct');
        else if (ci === answered) b.classList.add('is-wrong');
      }
      b.addEventListener('click', function () {
        if (cur.answers[i] !== null) return;
        cur.answers[i] = ci;
        cur.grades[i] = ci === correctIdx ? 'full' : 'zero';
        refresh(i);
      });
      li.appendChild(b);
      ul.appendChild(li);
    });
    card.appendChild(ul);
    if (answered !== null) {
      var ok = answered === correctIdx;
      card.appendChild(feedback(ok ? '正解' : '不正解(正解は ' + ['ア', 'イ', 'ウ', 'エ'][correctIdx] + ')', ok ? 'ok' : 'ng', q));
    }
  }

  function renderText(card, q, i) {
    var answered = cur.answers[i] !== null;
    var ta = el('textarea', 'case-answer');
    ta.rows = 3;
    ta.placeholder = q.limit ? q.limit + '字以内で解答を書いてください' : '解答を書いてください';
    ta.value = answered ? cur.answers[i] : (cur.drafts && cur.drafts[i]) || '';
    ta.disabled = answered;
    var counter = el('div', 'case-counter');
    var upd = function () {
      var n = countChars(ta.value);
      counter.textContent = n + (q.limit ? ' / ' + q.limit + '字' : '字');
      counter.classList.toggle('over', !!q.limit && n > q.limit);
    };
    ta.addEventListener('input', function () { cur.drafts = cur.drafts || {}; cur.drafts[i] = ta.value; upd(); });
    upd();
    card.appendChild(ta);
    card.appendChild(counter);

    if (!answered) {
      var row = el('div', 'btn-row');
      var submit = el('button', 'btn btn-primary btn-sm', '解答を確定して解答例を見る');
      submit.type = 'button';
      submit.addEventListener('click', function () {
        if (!ta.value.trim() && !global.confirm('解答が空です。このまま解答例を見ますか?')) return;
        cur.answers[i] = ta.value;
        refresh(i);
      });
      row.appendChild(submit);
      card.appendChild(row);
      return;
    }

    // 解答例と観点
    var hits = keywordHits(cur.answers[i], q.keywords);
    var nHit = hits.filter(Boolean).length;
    var fb = el('div', 'feedback');
    var body = el('div', 'feedback-body');
    body.appendChild(el('h4', '', '解答例'));
    body.appendChild(el('p', 'case-model', q.model));
    if (q.keywords && q.keywords.length) {
      body.appendChild(el('h4', '', '採点の観点(あなたの解答に含まれているか)'));
      var ul = el('ul', 'case-kw');
      q.keywords.forEach(function (g, k) {
        var li = el('li', hits[k] ? 'hit' : 'miss');
        li.appendChild(el('span', 'ck', hits[k] ? '✓' : '—'));
        li.appendChild(el('span', '', g.join(' / ')));
        ul.appendChild(li);
      });
      body.appendChild(ul);
      body.appendChild(el('p', 'hint', '観点の照合は文字の一致による目安です。同じ意味を別の言葉で書けていれば、自分の判断で採点してください。'));
    }
    if (q.limit && countChars(cur.answers[i]) > q.limit) body.appendChild(el('p', 'case-over', '字数制限を超えています。本試験では減点・不正解になることがあります。'));
    body.appendChild(el('h4', '', '解説'));
    body.appendChild(el('p', '', q.explanation));
    fb.appendChild(body);
    var lb = ctx.lessonButton({ field: q.field, topic: q.topic });
    if (lb) { var lw = el('div', 'feedback-lesson'); lw.appendChild(lb); fb.appendChild(lw); }
    card.appendChild(fb);

    card.appendChild(aiBox(q, i));

    var gradeBox = el('div', 'case-grade');
    gradeBox.appendChild(el('span', 'case-grade-label', '自己採点:'));
    var suggest = !q.keywords || !q.keywords.length ? null : nHit === q.keywords.length ? 'full' : nHit > 0 ? 'half' : 'zero';
    Object.keys(GRADES).forEach(function (k) {
      var b = el('button', 'chip' + (cur.grades[i] === k ? ' is-active' : '') + (cur.grades[i] === null && suggest === k ? ' suggest' : ''), GRADES[k].label);
      b.type = 'button';
      b.addEventListener('click', function () { cur.grades[i] = k; refresh(i); });
      gradeBox.appendChild(b);
    });
    if (cur.grades[i] === null && suggest) gradeBox.appendChild(el('span', 'hint', '観点の照合からの目安: ' + GRADES[suggest].label));
    card.appendChild(gradeBox);
  }

  /* ---------- 計算設問 ---------- */
  function parseNum(s) {
    var v = String(s || '').normalize('NFKC').replace(/[,\s]/g, '').replace(/[^0-9.+\-eE]/g, '');
    return v === '' ? NaN : Number(v);
  }

  function renderNumber(card, q, i) {
    var answered = cur.answers[i] !== null;
    var row = el('div', 'case-num-row');
    var inp = el('input', 'case-num');
    inp.type = 'text';
    inp.inputMode = 'decimal';
    inp.placeholder = '数値';
    inp.value = answered ? cur.answers[i] : '';
    inp.disabled = answered;
    row.appendChild(inp);
    if (q.unit) row.appendChild(el('span', 'case-unit', q.unit));
    card.appendChild(row);
    if (!answered) {
      var b = el('button', 'btn btn-primary btn-sm', '解答する');
      b.type = 'button';
      var submit = function () {
        var v = parseNum(inp.value);
        if (isNaN(v)) { ctx.toast('数値を入力してください。'); return; }
        cur.answers[i] = inp.value;
        var tol = q.tol !== undefined ? q.tol : Math.max(1e-9, Math.abs(q.answer) * 0.005);
        cur.grades[i] = Math.abs(v - q.answer) <= tol ? 'full' : 'zero';
        refresh(i);
      };
      b.addEventListener('click', submit);
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
      var r2 = el('div', 'btn-row');
      r2.appendChild(b);
      card.appendChild(r2);
      return;
    }
    var ok = cur.grades[i] === 'full';
    card.appendChild(feedback(ok ? '正解' : '不正解(正解は ' + q.answer + (q.unit || '') + ')', ok ? 'ok' : 'ng', q));
  }

  /* ---------- AI 採点(Gemini) ---------- */
  function aiBox(q, i) {
    var box = el('div', 'ai-box');
    var AI = global.AIGrader;
    if (!AI || !AI.ready()) {
      var p = el('p', 'hint ai-hint', '設定画面で Gemini の API キーを登録すると、この記述を AI に採点してもらえます。');
      box.appendChild(p);
      return box;
    }
    cur.ai = cur.ai || {};
    var st = cur.ai[i] || { status: 'idle' };
    if (st.status === 'idle' || st.status === 'error') {
      var b = el('button', 'btn btn-ai btn-sm', st.status === 'error' ? '🤖 もう一度 AI で採点する' : '🤖 Gemini で採点する');
      b.type = 'button';
      b.addEventListener('click', function () { runAI(q, i); });
      box.appendChild(b);
      if (st.status === 'error') box.appendChild(el('p', 'ai-error', st.error));
      return box;
    }
    if (st.status === 'loading') {
      box.appendChild(el('div', 'ai-loading', '🤖 採点中… (' + AI.config.model + ')'));
      return box;
    }
    var r = st.result;
    var head = el('div', 'ai-head');
    head.appendChild(el('span', 'ai-badge', 'AI 採点'));
    head.appendChild(el('span', 'ai-score ' + r.grade, r.score + '点 / 100 — ' + GRADES[r.grade].label));
    box.appendChild(head);
    if (r.criteria.length) {
      var ul = el('ul', 'case-kw');
      r.criteria.forEach(function (c) {
        var li = el('li', c.met ? 'hit' : 'miss');
        li.appendChild(el('span', 'ck', c.met ? '✓' : '✕'));
        var tx = el('span');
        tx.appendChild(el('b', '', c.point));
        if (c.comment) tx.appendChild(document.createTextNode(' — ' + c.comment));
        li.appendChild(tx);
        ul.appendChild(li);
      });
      box.appendChild(ul);
    }
    if (r.feedback) { box.appendChild(el('h4', '', '講評')); box.appendChild(el('p', '', r.feedback)); }
    if (r.improved) { box.appendChild(el('h4', '', 'あなたの解答をもとにした改善例')); box.appendChild(el('p', 'case-model', r.improved)); }
    var row = el('div', 'btn-row');
    var adopt = el('button', 'btn btn-primary btn-sm', cur.grades[i] === r.grade ? '✓ AI の採点を採用済み' : 'AI の採点(' + GRADES[r.grade].label + ')を採用する');
    adopt.type = 'button';
    adopt.disabled = cur.grades[i] === r.grade;
    adopt.addEventListener('click', function () { cur.grades[i] = r.grade; refresh(i); });
    row.appendChild(adopt);
    box.appendChild(row);
    box.appendChild(el('p', 'hint', 'AI の採点は目安です。採点の観点と解説も見て、納得できなければ下の自己採点で上書きしてください。(' + r.model + ')'));
    return box;
  }

  function runAI(q, i) {
    cur.ai = cur.ai || {};
    cur.ai[i] = { status: 'loading' };
    refresh(i);
    var c = cur.c, answer = cur.answers[i];
    var token = cur;
    global.AIGrader.grade({
      examName: (global.CURRENT_EXAM || {}).name || '',
      caseTitle: c.title, scenario: c.scenario, materials: c.materials,
      no: q.no, prompt: q.prompt, limit: q.limit, model: q.model, keywords: q.keywords, explanation: q.explanation,
      answer: answer, answerLength: countChars(answer)
    }).then(function (r) {
      if (cur !== token) return;
      cur.ai[i] = { status: 'done', result: r };
      refresh(i);
    }, function (e) {
      if (cur !== token) return;
      cur.ai[i] = { status: 'error', error: e.message };
      refresh(i);
    });
  }

  function feedback(head, cls, q) {
    var fb = el('div', 'feedback');
    fb.appendChild(el('div', 'feedback-head ' + cls, head));
    var body = el('div', 'feedback-body');
    body.appendChild(el('h4', '', '解説'));
    body.appendChild(el('p', '', q.explanation));
    fb.appendChild(body);
    var lb = ctx.lessonButton({ field: q.field, topic: q.topic });
    if (lb) { var lw = el('div', 'feedback-lesson'); lw.appendChild(lb); fb.appendChild(lw); }
    return fb;
  }

  function refresh(i) {
    var old = $('caseQ' + i);
    var q = cur.c.questions[i];
    old.parentNode.replaceChild(questionCard(q, i), old);
    progressText();
    if (cur.grades.every(function (g) { return g !== null; }) && !cur.finished) finish();
  }

  function score() {
    var per = 100 / cur.c.questions.length;
    return Math.round(cur.grades.reduce(function (a, g) { return a + (g ? GRADES[g].rate * per : 0); }, 0));
  }

  function finish() {
    cur.finished = true;
    clearInterval(tick);
    var sc = score();
    var r = rec(cur.c.id);
    r.attempts += 1; r.last = sc; r.best = Math.max(r.best, sc); r.lastAt = Date.now();
    r.answers = cur.answers.slice();
    global.AppStorage.save();
    var full = cur.grades.filter(function (g) { return g === 'full'; }).length;
    ctx.onStudied(cur.c.questions.length, full);

    var card = $('caseResult');
    card.hidden = false;
    card.innerHTML = '';
    card.appendChild(el('h3', '', '採点結果: ' + sc + ' / 100 点'));
    card.appendChild(el('p', 'muted', sc >= 60
      ? '合格基準の60点に届いています。記述の言い回しを解答例と比べて、より短く的確に書けるか見直しましょう。'
      : '合格基準は60点。△ や × の設問は、解答例と観点を見比べてから教科書で該当単元を復習しましょう。'));
    var ol = el('ol', 'flow-result-list');
    cur.c.questions.forEach(function (q, i) {
      var g = cur.grades[i];
      var li = el('li', 'flow-result-item ' + (g === 'full' ? 'ok' : 'ng'));
      li.appendChild(el('span', 'trail-mark', g === 'full' ? '○' : g === 'half' ? '△' : '×'));
      var b = el('span', 'trail-body');
      b.appendChild(el('span', 'trail-pitfall', q.no + '(' + q.topic + ')'));
      b.appendChild(el('span', 'trail-answer', q.prompt));
      li.appendChild(b);
      ol.appendChild(li);
    });
    card.appendChild(ol);
    var sumBox = el('div', 'flow-summary-box');
    sumBox.appendChild(el('h4', '', 'この事例のまとめ'));
    sumBox.appendChild(el('p', '', cur.c.summary));
    card.appendChild(sumBox);
    var lb = ctx.lessonButton({ field: cur.c.field, topic: cur.c.topic });
    if (lb) { var lw = el('div', 'flow-lesson'); lw.appendChild(lb); card.appendChild(lw); }
    var actions = el('div', 'result-actions');
    var again = el('button', 'btn btn-primary', 'もう一度解く');
    again.type = 'button';
    var c = cur.c;
    again.addEventListener('click', function () { start(c); });
    var back = el('button', 'btn btn-ghost', '一覧へ戻る');
    back.type = 'button';
    back.addEventListener('click', exit);
    actions.appendChild(again);
    actions.appendChild(back);
    card.appendChild(actions);
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function exit() {
    clearInterval(tick);
    cur = null;
    $('casePlayerView').hidden = true;
    $('caseListView').hidden = false;
    renderList();
    global.scrollTo(0, 0);
  }

  function isRunning() { return !!cur && !cur.finished && cur.answers.some(function (a) { return a !== null; }); }

  function init(c) {
    Object.keys(c || {}).forEach(function (k) { ctx[k] = c[k]; });
    $('caseExitBtn').addEventListener('click', function () {
      if (isRunning() && !global.confirm('演習を中断して一覧へ戻りますか?(この事例の結果は記録されません)')) return;
      exit();
    });
  }

  global.CaseMode = {
    init: init, renderList: renderList, isRunning: isRunning, exit: exit, count: CASES.length,
    isOpen: function () { return !!cur; },
    startById: function (id) {
      var c = CASES.filter(function (x) { return x.id === id; })[0];
      if (c) start(c);
      return !!c;
    },
    keywordHits: keywordHits
  };
})(window);
