/**
 * app.js - 画面制御とイベント処理
 */
(function (global) {
  'use strict';

  var doc = global.document;
  var QUESTIONS = global.QUESTION_BANK || [];
  var EXAM = global.CURRENT_EXAM || { id: 'ap', categories: [], mock: { count: 20, minutes: 30 }, passLine: '' };
  var state = global.AppStorage.load();

  var session = null;        // 実行中の出題セッション
  var timerId = null;
  var deadline = null;
  var lastResult = null;     // 結果画面で使う直前のセッション

  var CHOICE_LABELS = ['ア', 'イ', 'ウ', 'エ'];
  var DIFF_LABELS = { 1: '★☆☆ 基本', 2: '★★☆ 標準', 3: '★★★ 応用' };

  /* ============ 汎用ヘルパ ============ */
  function $(id) { return doc.getElementById(id); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }
  function pct(v) { return Math.round(v * 100); }
  function el(tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  var toastTimer = null;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }

  function rateClass(accuracy, answered) {
    if (!answered) return 'none';
    if (accuracy < 0.5) return 'low';
    if (accuracy < 0.8) return 'mid';
    return 'high';
  }

  function barItem(label, accuracy, answered, extra) {
    var wrap = el('div', 'bar-item');
    var head = el('div', 'bar-head');
    head.appendChild(el('span', 'name', label));
    var n = answered
      ? pct(accuracy) + '%  (' + Math.round(accuracy * answered) + '/' + answered + ')'
      : '未学習';
    head.appendChild(el('span', 'n', extra ? n + ' ' + extra : n));
    wrap.appendChild(head);
    var track = el('div', 'bar-track');
    var fill = el('div', 'bar-fill ' + rateClass(accuracy, answered));
    fill.style.width = (answered ? pct(accuracy) : 0) + '%';
    track.appendChild(fill);
    wrap.appendChild(track);
    return wrap;
  }

  function statTile(value, label) {
    var t = el('div', 'stat-tile');
    t.appendChild(el('div', 'v', value));
    t.appendChild(el('div', 'l', label));
    return t;
  }

  /* ============ 画面遷移 ============ */
  function showScreen(name) {
    qsa('.screen').forEach(function (s) { s.classList.toggle('is-active', s.id === 'screen-' + name); });
    qsa('.nav-btn').forEach(function (b) { b.classList.toggle('is-active', b.dataset.screen === name); });
    global.scrollTo(0, 0);
    if (name === 'home') renderHome();
    if (name === 'stats') renderStats();
    if (name === 'flow') global.DrillMode.onShow();
    if (name === 'glossary' && !$('flashBox').hidden) global.Flashcards.open();
    if (name === 'practice') updatePoolInfo();
    if (name === 'textbook') global.Textbook.renderScreen();
    if (name === 'cases' && !global.CaseMode.isOpen()) global.CaseMode.renderList();
  }

  /* ============ 試験の切替え ============ */
  function applyExam() {
    state.settings.exam = EXAM.id;
    global.AppStorage.save();
    doc.title = EXAM.appTitle;
    $('logoMark').textContent = EXAM.badge;
    $('logoText').textContent = EXAM.appTitle;
    $('heroLead').textContent = EXAM.heroLead;
    $('examNote').textContent = EXAM.examNote;
    $('mockInfo').textContent = EXAM.mock.label;
    $('aboutExam').textContent = EXAM.name;
    $('examSelect').value = EXAM.id;
    qsa('#examSwitch .exam-btn').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.exam === EXAM.id);
      b.setAttribute('aria-pressed', b.dataset.exam === EXAM.id ? 'true' : 'false');
    });
    doc.documentElement.setAttribute('data-exam', EXAM.id);

    var hasFlows = (global.FLOW_BANK || []).length > 0;
    var hasCases = (global.CASE_BANK || []).length > 0;
    $('navFlow').hidden = !hasFlows && !global.DrillGen.forExam(EXAM.id).length;
    $('flowHomeCard').hidden = $('navFlow').hidden;
    $('navCases').hidden = !hasCases;
    $('caseHomeCard').hidden = !hasCases;

    // 出題分野のチップ(試験ごとの大分類)
    var group = $('categoryGroup');
    qsa('.chip', group).forEach(function (c) { if (c.dataset.category !== 'all') c.remove(); });
    var cats = (EXAM.categories || []).filter(function (c) { return QUESTIONS.some(function (q) { return q.category === c; }); });
    QUESTIONS.forEach(function (q) { if (cats.indexOf(q.category) < 0) cats.push(q.category); });
    cats.forEach(function (c) {
      var b = el('button', 'chip', c);
      b.dataset.category = c;
      group.appendChild(b);
    });
  }

  function requestExamSwitch(id) {
    if (id === EXAM.id) return;
    if ((session && !session.finishedAt) || global.FlowMode.isRunning() || global.CaseMode.isRunning()) {
      if (!global.confirm('演習の途中です。試験を切り替えると中断されます。よろしいですか?')) { $('examSelect').value = EXAM.id; return; }
    }
    global.switchExam(id);
  }

  /* ============ テーマ ============ */
  function applyTheme(theme) {
    if (theme === 'auto') doc.documentElement.removeAttribute('data-theme');
    else doc.documentElement.setAttribute('data-theme', theme);
    state.settings.theme = theme;
    $('themeSelect').value = theme;
    global.AppStorage.save();
  }

  /* ============ ホーム ============ */
  function renderHome() {
    var s = global.Stats.summary(QUESTIONS, state);
    $('homeStreak').textContent = s.streak;

    var grid = $('homeStats');
    grid.innerHTML = '';
    grid.appendChild(statTile(s.answered + '問', '累計の解答数'));
    grid.appendChild(statTile(s.answered ? pct(s.accuracy) + '%' : '—', '通算の正答率'));
    grid.appendChild(statTile(s.touched + ' / ' + s.totalQuestions, '着手した問題'));
    grid.appendChild(statTile(s.mastered + '問', '定着した問題'));

    var due = global.SRS.dueQuestions(QUESTIONS, state.cards);
    var neverSeen = QUESTIONS.length - s.touched;
    $('dueSummary').textContent = due.length > 0
      ? '復習期限が来ている問題が ' + due.length + ' 問あります。'
      : (s.touched === 0
        ? 'まずは演習を始めましょう。間違えた問題が自動で復習キューに入ります。'
        : '今日の復習はありません。未着手が ' + neverSeen + ' 問残っています。');
    $('startReviewBtn').disabled = due.length === 0;

    var dtypes = global.DrillMode.types();
    var weakTypes = dtypes.filter(function (t) { return global.DrillMode.isWeak(t.id); });
    var triedTypes = dtypes.filter(function (t) { return global.DrillMode.stats(t.id).n > 0; });
    $('flowHomeInfo').textContent = triedTypes.length === 0
      ? '数値が毎回変わる ' + dtypes.length + ' 型の計算問題で、解き方の型と速さを身につけます。'
      : dtypes.length + '型中 ' + triedTypes.length + '型に挑戦済み。' + (weakTypes.length ? '苦手な型: ' + weakTypes.slice(0, 2).map(function (t) { return t.title; }).join('、') : '苦手な型はありません。');

    renderPlan();

    var cases = global.CASE_BANK || [];
    var caseDone = cases.filter(function (c) { var r = (state.cases || {})[c.id]; return r && r.attempts > 0; }).length;
    $('caseHomeInfo').textContent = caseDone === 0
      ? '事例を読んで記述式の設問に答え、解答例と採点の観点で自己採点します。'
      : cases.length + '事例中 ' + caseDone + '事例に挑戦済みです。';

    var nc = global.Textbook.counts();
    var pending = nc.open + nc.reviewing;
    $('notebookSummary').textContent = pending > 0
      ? '未克服 ' + nc.open + '問・復習中 ' + nc.reviewing + '問。教科書で解説を読み、体感ビジュアルで確かめてから解き直しましょう。'
      : (nc.done > 0 ? '未克服の問題はありません(克服 ' + nc.done + '問)。教科書で次の単元を予習しましょう。'
        : '分野ごとの解説と、さわって理解できる体感ビジュアルを収録。間違えた問題はここに集まります。');
    $('notebookBtn').textContent = pending > 0 ? '間違いノートを開く' : '教科書を開く';
    $('notebookBtn').dataset.target = pending > 0 ? 'notebook' : 'toc';

    var bars = $('homeFieldBars');
    bars.innerHTML = '';
    global.Stats.byKey(QUESTIONS, state, 'category').forEach(function (g) {
      bars.appendChild(barItem(g.key, g.accuracy, g.answered, '/ 収録' + g.total + '問'));
    });
  }

  /* ============ 演習設定 ============ */
  var cond = { mode: 'practice', category: 'all', fields: [], count: 10, order: 'random', difficulty: 0, timeLimit: 30 };

  function renderFieldChips() {
    var box = $('fieldSelect');
    box.innerHTML = '';
    var fields = [];
    QUESTIONS.forEach(function (q) {
      if (cond.category !== 'all' && q.category !== cond.category) return;
      if (fields.indexOf(q.field) < 0) fields.push(q.field);
    });
    cond.fields = cond.fields.filter(function (f) { return fields.indexOf(f) >= 0; });

    fields.forEach(function (f) {
      var count = QUESTIONS.filter(function (q) { return q.field === f; }).length;
      var b = el('button', 'chip' + (cond.fields.indexOf(f) >= 0 ? ' is-active' : ''), f + ' (' + count + ')');
      b.addEventListener('click', function () {
        var i = cond.fields.indexOf(f);
        if (i >= 0) cond.fields.splice(i, 1); else cond.fields.push(f);
        b.classList.toggle('is-active');
        updatePoolInfo();
      });
      box.appendChild(b);
    });
  }

  function updatePoolInfo() {
    var pool = global.Quiz.buildPool(QUESTIONS, state, Object.assign({}, cond, { count: 0 }));
    var willAsk = cond.count > 0 ? Math.min(cond.count, pool.length) : pool.length;
    $('poolInfo').textContent = '該当 ' + pool.length + ' 問 / 出題 ' + willAsk + ' 問';
    $('startBtn').disabled = pool.length === 0;
    if (pool.length === 0) {
      $('poolInfo').textContent = cond.mode === 'review'
        ? '復習期限が到来している問題はありません。'
        : '条件に合う問題がありません。条件を緩めてください。';
    }
  }

  var MODE_HINTS = {
    practice: '1問ごとに正誤と解説を確認しながら進めます。',
    exam: '解説は表示せず最後にまとめて採点します。時間を計って本番に近い形で解けます。',
    review: '復習期限が到来した問題だけを、期限の近い順に出題します。'
  };

  function setMode(mode) {
    cond.mode = mode;
    qsa('#modeGroup .chip').forEach(function (b) { b.classList.toggle('is-active', b.dataset.mode === mode); });
    $('modeHint').textContent = MODE_HINTS[mode];
    $('timeLimitRow').hidden = (mode !== 'exam');
    updatePoolInfo();
  }

  /* ============ 出題 ============ */
  function startSession(customCond) {
    var c = Object.assign({}, cond, customCond || {});
    var pool = global.Quiz.buildPool(QUESTIONS, state, c);
    if (pool.length === 0) { toast('条件に合う問題がありません。'); return; }

    session = global.Quiz.createSession(pool, c, state.settings.shuffleChoices);
    state.lastCondition = c;
    global.AppStorage.save();

    $('prevBtn').hidden = (c.mode !== 'exam');
    startTimer(c.mode === 'exam' ? c.timeLimit : 0);
    showScreen('quiz');
    renderQuestion();
  }

  function startTimer(minutes) {
    clearInterval(timerId);
    var elm = $('timer');
    if (!minutes || minutes <= 0) {
      elm.hidden = true;
      deadline = null;
      return;
    }
    elm.hidden = false;
    deadline = Date.now() + minutes * 60 * 1000;
    tick();
    timerId = setInterval(tick, 1000);
  }

  function tick() {
    var elm = $('timer');
    var rest = Math.max(0, deadline - Date.now());
    var m = Math.floor(rest / 60000);
    var sec = Math.floor((rest % 60000) / 1000);
    elm.textContent = String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
    elm.classList.toggle('is-urgent', rest <= 60000);
    if (rest <= 0) {
      clearInterval(timerId);
      toast('制限時間になりました。採点します。');
      finishSession();
    }
  }

  function renderQuestion() {
    var item = global.Quiz.currentItem(session);
    var q = item.question;
    var total = session.items.length;
    var i = session.index;

    $('progressText').textContent = (i + 1) + ' / ' + total;
    $('progressFill').style.width = ((i) / total * 100) + '%';
    $('qCategory').textContent = q.category;
    $('qField').textContent = q.field + (q.topic ? ' / ' + q.topic : '');
    $('qDifficulty').textContent = DIFF_LABELS[q.difficulty] || '';
    $('qId').textContent = q.id;
    $('qText').textContent = q.question;

    var list = $('choices');
    list.innerHTML = '';
    var answered = session.answers[i];
    var reveal = (session.mode !== 'exam') && answered !== null && state.settings.instantFeedback;

    item.choices.forEach(function (text, ci) {
      var li = doc.createElement('li');
      var btn = el('button', 'choice');
      btn.type = 'button';
      var mark = el('span', 'mark', CHOICE_LABELS[ci]);
      var body = el('span', 'body', text);
      btn.appendChild(mark);
      btn.appendChild(body);

      if (answered === ci) btn.classList.add('is-selected');
      if (reveal) {
        btn.disabled = true;
        if (ci === item.answerIndex) btn.classList.add('is-correct');
        else if (ci === answered) { btn.classList.remove('is-selected'); btn.classList.add('is-wrong'); }
      }
      btn.addEventListener('click', function () { selectChoice(ci); });
      li.appendChild(btn);
      list.appendChild(li);
    });

    var fb = $('feedback');
    if (reveal) {
      fb.hidden = false;
      var ok = answered === item.answerIndex;
      var head = $('feedbackHead');
      head.className = 'feedback-head ' + (ok ? 'ok' : 'ng');
      head.textContent = ok
        ? '正解  (正解は ' + CHOICE_LABELS[item.answerIndex] + ')'
        : '不正解  (正解は ' + CHOICE_LABELS[item.answerIndex] + ')';
      $('explanation').textContent = q.explanation;
      var lessonBox = $('feedbackLesson');
      lessonBox.innerHTML = '';
      var lb = global.Textbook.lessonButton(q, ok ? '教科書で確認' : '教科書で復習する', { chosenText: ok ? null : item.choices[answered] });
      if (lb) {
        lessonBox.appendChild(lb);
        if (!ok) lessonBox.appendChild(el('span', 'hint', '間違えた問題は「教科書 › 間違いノート」にまとまります。'));
      }
      var anBox = global.Textbook.analogyFor(q);
      if (anBox) {
        var det = el('details', 'analogy-details');
        det.appendChild(el('summary', '', '🏠 言葉がむずかしい? たとえで理解する'));
        det.appendChild(anBox);
        if (!ok) det.open = true;
        lessonBox.appendChild(det);
      }
      if (!ok) lessonBox.appendChild(reasonChips(q.id));
    } else {
      fb.hidden = true;
    }

    var last = (i === total - 1);
    var nextBtn = $('nextBtn');
    nextBtn.textContent = last ? '採点する' : '次の問題 →';
    nextBtn.disabled = (session.mode === 'exam') ? false : (answered === null);
    $('prevBtn').disabled = (i === 0);
  }

  function selectChoice(ci) {
    var i = session.index;
    if (session.mode !== 'exam' && session.answers[i] !== null) return; // 演習モードは解答を確定
    session.answers[i] = ci;

    if (session.mode !== 'exam') {
      var item = session.items[i];
      var isCorrect = (ci === item.answerIndex);
      recordAnswer(item, ci);
      global.AppStorage.save();
    }
    renderQuestion();
    if (session.mode === 'exam') next();
  }

  /** 解答を SRS に反映し、誤答なら間違いノート用に選んだ選択肢を残す */
  function recordAnswer(item, ci) {
    var card = global.AppStorage.card(item.question.id);
    var ok = ci === item.answerIndex;
    global.SRS.update(card, ok);
    if (!ok) {
      card.lastWrongAt = card.lastAt;
      card.lastWrongChoice = item.choices[ci];
    }
  }

  function next() {
    if (session.index >= session.items.length - 1) { finishSession(); return; }
    session.index += 1;
    renderQuestion();
  }

  function prev() {
    if (session.index === 0) return;
    session.index -= 1;
    renderQuestion();
  }

  function finishSession() {
    clearInterval(timerId);
    session.finishedAt = Date.now();

    // 模擬試験モードはここでまとめて採点し、SRS へ反映する
    if (session.mode === 'exam') {
      session.items.forEach(function (item, i) {
        if (session.answers[i] === null) return; // 未解答は学習記録に含めない
        recordAnswer(item, session.answers[i]);
      });
    }

    var sc = global.Quiz.score(session);
    var answeredCount = session.answers.filter(function (a) { return a !== null; }).length;
    global.AppStorage.recordDay(answeredCount, sc.correct);
    state.sessions.push({
      at: session.finishedAt,
      exam: EXAM.id,
      mode: session.mode,
      total: sc.total,
      answered: answeredCount,
      correct: sc.correct,
      durationMs: session.finishedAt - session.startedAt
    });
    global.AppStorage.save();

    lastResult = session;
    renderResult();
    showScreen('result');
  }

  /* ============ 結果 ============ */
  function renderResult() {
    var s = lastResult;
    var sc = global.Quiz.score(s);
    var accuracy = sc.total ? sc.correct / sc.total : 0;
    var p = pct(accuracy);

    $('scorePct').textContent = p + '%';
    $('scoreSub').textContent = sc.correct + ' / ' + sc.total + ' 問正解';
    var color = accuracy >= 0.8 ? 'var(--success)' : (accuracy >= 0.6 ? '#d99400' : 'var(--danger)');
    $('scoreRing').style.background = 'conic-gradient(' + color + ' ' + (p * 3.6) + 'deg, var(--surface-2) 0deg)';

    var title, comment;
    if (accuracy >= 0.8) { title = '合格ラインを超えています'; comment = EXAM.passLine + 'この調子で出題範囲を広げていきましょう。'; }
    else if (accuracy >= 0.6) { title = '合格ラインに到達'; comment = '基準の60%は超えています。取りこぼした分野を復習して安定させましょう。'; }
    else { title = 'もう一歩'; comment = '間違えた問題は復習キューに入りました。解説を読んでから再挑戦しましょう。'; }
    $('resultTitle').textContent = title;
    $('resultComment').textContent = comment;

    var sec = Math.round((s.finishedAt - s.startedAt) / 1000);
    var perQ = sc.total ? Math.round(sec / sc.total) : 0;
    $('resultTime').textContent = '所要時間 ' + Math.floor(sec / 60) + '分' + (sec % 60) + '秒 (1問あたり約' + perQ + '秒)';

    // 分野別
    var agg = {};
    s.items.forEach(function (item, i) {
      var f = item.question.field;
      if (!agg[f]) agg[f] = { total: 0, correct: 0 };
      agg[f].total += 1;
      if (global.Quiz.isCorrectAt(s, i)) agg[f].correct += 1;
    });
    var bars = $('resultFieldBars');
    bars.innerHTML = '';
    Object.keys(agg).sort().forEach(function (f) {
      bars.appendChild(barItem(f, agg[f].correct / agg[f].total, agg[f].total));
    });

    // 振り返り
    var list = $('reviewList');
    list.innerHTML = '';
    s.items.forEach(function (item, i) {
      var ok = global.Quiz.isCorrectAt(s, i);
      var d = doc.createElement('details');
      d.className = 'review-item ' + (ok ? 'ok' : 'ng');
      var sum = doc.createElement('summary');
      sum.appendChild(el('span', 'res-icon', ok ? '○' : '×'));
      sum.appendChild(el('span', 'q', (i + 1) + '. ' + item.question.question));
      d.appendChild(sum);

      var detail = el('div', 'detail');
      var ans = el('p', 'ans');
      var yours = s.answers[i] !== null ? CHOICE_LABELS[s.answers[i]] + '. ' + item.choices[s.answers[i]] : '未解答';
      ans.appendChild(el('span', '', 'あなたの解答: '));
      ans.appendChild(el('span', ok ? '' : 'your', yours));
      detail.appendChild(ans);
      var correctP = el('p', 'ans');
      correctP.appendChild(el('span', '', '正解: '));
      var b = doc.createElement('b');
      b.textContent = CHOICE_LABELS[item.answerIndex] + '. ' + item.choices[item.answerIndex];
      correctP.appendChild(b);
      detail.appendChild(correctP);
      detail.appendChild(el('p', '', item.question.explanation));
      var lb = global.Textbook.lessonButton(item.question, ok ? '教科書で確認' : '教科書で復習する',
        { chosenText: (!ok && s.answers[i] !== null) ? item.choices[s.answers[i]] : null });
      if (lb) detail.appendChild(lb);
      if (!ok && s.answers[i] !== null) detail.appendChild(reasonChips(item.question.id));
      d.appendChild(detail);
      if (!ok) d.open = true;
      list.appendChild(d);
    });

    var wrongIds = s.items.filter(function (item, i) { return !global.Quiz.isCorrectAt(s, i); })
      .map(function (item) { return item.question.id; });
    $('retryWrongBtn').disabled = wrongIds.length === 0;
    $('toNotebookBtn').hidden = wrongIds.length === 0;
    $('retryWrongBtn').dataset.ids = wrongIds.join(',');
  }

  /* ============ 間違えた理由 ============ */
  var REASONS = [
    ['knowledge', '知識不足', '教科書の該当単元で要点と用語を覚え直し、体感ビジュアルで仕組みを確かめましょう。'],
    ['calc', '計算ミス', '計算ドリルで同じ型を数値を変えて繰り返し、手順を体に覚えさせましょう。'],
    ['misread', '問題文の読み違い', '「適切でないもの」「最も」「〜以外」などの条件に印を付けてから選択肢を読みましょう。'],
    ['confuse', '用語の混同', '似た用語は教科書の表や「ひっかけ注意」で違いを比べて覚えましょう。暗記カードも有効です。'],
    ['careless', 'ケアレスミス', '選んだ後に、問われていることと選択肢をもう一度照らし合わせる習慣をつけましょう。']
  ];

  /** 「なぜ間違えた?」のタグ選択 */
  function reasonChips(qid) {
    var wrap = el('div', 'reason-box');
    wrap.appendChild(el('span', 'reason-label', 'なぜ間違えた?'));
    var card = global.AppStorage.card(qid);
    var cur = card.lastReason && card.lastReasonAt && card.lastReasonAt >= (card.lastWrongAt || 0) ? card.lastReason : null;
    REASONS.forEach(function (r) {
      var b = el('button', 'chip chip-sm' + (cur === r[0] ? ' is-active' : ''), r[1]);
      b.type = 'button';
      b.addEventListener('click', function () {
        var c = global.AppStorage.card(qid);
        c.reasons = c.reasons || {};
        var prev = c.lastReason && c.lastReasonAt >= (c.lastWrongAt || 0) ? c.lastReason : null;
        if (prev) c.reasons[prev] = Math.max(0, (c.reasons[prev] || 0) - 1);
        c.reasons[r[0]] = (c.reasons[r[0]] || 0) + 1;
        c.lastReason = r[0];
        c.lastReasonAt = Date.now();
        global.AppStorage.save();
        Array.prototype.forEach.call(wrap.querySelectorAll('.chip'), function (x) { x.classList.toggle('is-active', x === b); });
        tip.textContent = '💡 ' + r[2];
      });
      wrap.appendChild(b);
    });
    var tip = el('p', 'hint reason-tip', cur ? '💡 ' + REASONS.filter(function (r) { return r[0] === cur; })[0][2] : '理由を記録すると、統計画面で自分のミスの傾向がわかります。');
    wrap.appendChild(tip);
    return wrap;
  }

  function renderReasonStats() {
    var box = $('reasonStats');
    box.innerHTML = '';
    var tally = {};
    QUESTIONS.forEach(function (q) {
      var c = state.cards[q.id];
      if (!c || !c.reasons) return;
      Object.keys(c.reasons).forEach(function (k) { tally[k] = (tally[k] || 0) + c.reasons[k]; });
    });
    var total = Object.keys(tally).reduce(function (a, k) { return a + tally[k]; }, 0);
    if (!total) {
      box.appendChild(el('p', 'empty', '演習で間違えたときに「なぜ間違えた?」を選ぶと、ここに傾向が表示されます。'));
      return;
    }
    var top = null;
    REASONS.forEach(function (r) {
      var nn = tally[r[0]] || 0;
      if (!top || nn > (tally[top[0]] || 0)) top = r;
      box.appendChild(barItem(r[1], nn / total, nn ? Math.round(total) : 0, ''));
      var last = box.lastChild;
      last.querySelector('.n').textContent = nn + '回(' + pct(nn / total) + '%)';
      last.querySelector('.bar-fill').className = 'bar-fill reason';
      last.querySelector('.bar-fill').style.width = pct(nn / total) + '%';
    });
    box.appendChild(el('p', 'reason-advice', '最も多いのは「' + top[1] + '」。' + top[2]));
  }

  /* ============ 合格の見込みと学習計画 ============ */
  function startFieldPractice(field) {
    startSession({ mode: 'practice', category: 'all', fields: [field], count: 10, order: 'weak', difficulty: 0, ids: null });
  }

  function scoreMeter(label, score, note) {
    var m = el('div', 'meter');
    var head = el('div', 'meter-head');
    head.appendChild(el('span', 'meter-label', label));
    head.appendChild(el('span', 'meter-score ' + (score === null ? 'none' : score >= 60 ? 'ok' : 'ng'), score === null ? '未挑戦' : '予測 ' + score + '点'));
    m.appendChild(head);
    var track = el('div', 'meter-track');
    var fill = el('div', 'meter-fill ' + (score === null ? '' : score >= 60 ? 'ok' : 'ng'));
    fill.style.width = (score || 0) + '%';
    track.appendChild(fill);
    var line = el('div', 'meter-line');
    line.style.left = '60%';
    line.title = '合格基準 60点';
    track.appendChild(line);
    m.appendChild(track);
    if (note) m.appendChild(el('div', 'meter-note', note));
    return m;
  }

  function planOptions() {
    var key = global.AppStorage.todayKey();
    var weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    var cases = global.CASE_BANK || [];
    var dtypes = global.DrillMode.types();
    var weak = dtypes.filter(function (t) { return global.DrillMode.isWeak(t.id); });
    var untried = !weak.length;
    if (untried) weak = dtypes.filter(function (t) { return !global.DrillMode.stats(t.id).n; });
    return {
      weakIsUntried: untried,
      weakDrills: weak.map(function (t) { return t.title; }),
      drillToday: (state.drillDays || {})[key] || 0,
      cases: cases,
      casesThisWeek: cases.filter(function (c) { var r = (state.cases || {})[c.id]; return r && r.lastAt && r.lastAt >= weekAgo; }).length
    };
  }

  function renderPlan() {
    var box = $('homePlan');
    box.innerHTML = '';
    box.appendChild(el('h3', '', '🎯 合格への道のり'));
    var am = global.Planner.predictAM(QUESTIONS, state, EXAM);
    var pm = global.Planner.predictPM(global.CASE_BANK || [], state, EXAM);
    var meters = el('div', 'meters');
    meters.appendChild(scoreMeter(EXAM.amLabel || '午前', am.score, am.reliable ? null : 'まだ解いた問題が少ないので参考値です(着手 ' + pct(am.coverage) + '%)'));
    if (pm) meters.appendChild(scoreMeter('午後', pm.score, pm.score === null ? '午後演習の事例に挑戦すると予測できます' : (pm.missing ? 'あと ' + pm.missing + ' 分野(事例)に挑戦すると予測が安定します' : null)));
    box.appendChild(meters);

    if (am.gains.length) {
      var g = el('div', 'gains');
      g.appendChild(el('span', 'gains-label', '次の一手(伸ばすと効果が大きい分野):'));
      am.gains.forEach(function (f) {
        var b = el('button', 'chip chip-sm gain-chip', f.field + ' +' + Math.round(f.gain * 10) / 10 + '点');
        b.type = 'button';
        b.title = f.field + ' を10問演習する';
        b.addEventListener('click', function () { startFieldPractice(f.field); });
        g.appendChild(b);
      });
      box.appendChild(g);
    }

    var planBox = el('div', 'plan');
    var p = global.Planner.plan(QUESTIONS, state, EXAM, planOptions());
    var editing = !p;
    function dateEditor() {
      var row = el('div', 'plan-date');
      row.appendChild(el('label', '', '試験日'));
      var inp = el('input', 'text-input');
      inp.type = 'date';
      inp.value = (state.settings.examDates || {})[EXAM.id] || '';
      row.appendChild(inp);
      var save = el('button', 'btn btn-primary btn-sm', '設定');
      save.type = 'button';
      save.addEventListener('click', function () {
        if (!inp.value) { toast('試験日を選んでください。'); return; }
        state.settings.examDates = state.settings.examDates || {};
        state.settings.examDates[EXAM.id] = inp.value;
        global.AppStorage.save();
        renderPlan();
      });
      row.appendChild(save);
      return row;
    }
    if (editing) {
      planBox.appendChild(el('p', 'muted', '試験日を設定すると、残り日数から今日やる問題数を割り振ります。'));
      planBox.appendChild(dateEditor());
    } else {
      var head = el('div', 'plan-head');
      var dd = p.date.split('-');
      head.appendChild(el('span', 'plan-days', p.days >= 0 ? '📅 試験まで ' + p.days + ' 日' : '📅 試験日を過ぎました'));
      head.appendChild(el('span', 'plan-date-label', dd[0] + '/' + Number(dd[1]) + '/' + Number(dd[2]) + (p.phase === 'final' ? ' ・直前期' : '')));
      var chg = el('button', 'btn btn-ghost btn-sm', '変更');
      chg.type = 'button';
      chg.addEventListener('click', function () { chg.replaceWith(dateEditor()); });
      head.appendChild(chg);
      planBox.appendChild(head);
      if (p.phase === 'after') {
        planBox.appendChild(el('p', 'muted', '次の試験日を設定してください。'));
      } else {
        planBox.appendChild(el('div', 'plan-sub', '今日やること'));
        p.items.forEach(function (it) {
          var row = el('div', 'plan-item');
          var done = Math.min(it.done, it.target);
          row.appendChild(el('span', 'plan-label', (it.done >= it.target ? '✅ ' : '') + it.label));
          row.appendChild(el('span', 'plan-count', it.done + ' / ' + it.target + ' ' + it.unit));
          var track = el('div', 'bar-track');
          var fill = el('div', 'bar-fill ' + (it.done >= it.target ? 'high' : 'mid'));
          fill.style.width = (done / it.target * 100) + '%';
          track.appendChild(fill);
          row.appendChild(track);
          row.appendChild(el('span', 'plan-note', it.note));
          planBox.appendChild(row);
        });
      }
    }
    box.appendChild(planBox);
  }

  function renderPredictStats() {
    var box = $('statsPredict');
    box.innerHTML = '';
    var am = global.Planner.predictAM(QUESTIONS, state, EXAM);
    box.appendChild(scoreMeter((EXAM.amLabel || '午前') + 'の予測', am.score, am.reliable ? null : '参考値(着手 ' + pct(am.coverage) + '%)'));
    am.categories.forEach(function (c) {
      var it = barItem(c.category + '(本番 約' + c.weight + '問)', c.est, 1, '');
      it.querySelector('.n').textContent = '正解見込み ' + pct(c.est) + '%';
      box.appendChild(it);
    });
    if (am.gains.length) {
      box.appendChild(el('h4', 'sub-h', '得点を伸ばしやすい分野'));
      am.gains.forEach(function (f) {
        var row = el('div', 'weak-item');
        row.appendChild(el('span', 'q', f.field + '(本番 約' + Math.round(f.expected * 10) / 10 + '問・正解見込み ' + pct(f.est) + '%)'));
        row.appendChild(el('span', 'rate gain', '+' + Math.round(f.gain * 10) / 10 + '点'));
        var b = el('button', 'btn btn-secondary btn-sm', '10問演習');
        b.addEventListener('click', function () { startFieldPractice(f.field); });
        row.appendChild(b);
        box.appendChild(row);
      });
    }
    var pm = global.Planner.predictPM(global.CASE_BANK || [], state, EXAM);
    if (pm) {
      box.appendChild(el('h4', 'sub-h', '午後(' + EXAM.pm.note + ')'));
      box.appendChild(scoreMeter('午後の予測', pm.score, pm.score === null ? '午後演習に挑戦すると予測できます' : null));
      (pm.areas || []).forEach(function (a) {
        var row = el('div', 'weak-item');
        row.appendChild(el('span', 'q', a.area + (a.required ? '(必須)' : a.chosen ? '(選択候補)' : '')));
        row.appendChild(el('span', 'rate' + (a.best >= 60 ? ' ok' : ''), 'ベスト ' + a.best + '点'));
        box.appendChild(row);
      });
    }
    box.appendChild(el('p', 'hint', '予測は、問題ごとの直近の正誤から「いま解いたら正解できる確率」を見積もり、本番の出題比率で重み付けした目安です。未着手の分野は当てずっぽう(25%)として計算します。'));
  }

  /* ============ 統計 ============ */
  function renderStats() {
    var s = global.Stats.summary(QUESTIONS, state);
    var grid = $('statsSummary');
    grid.innerHTML = '';
    grid.appendChild(statTile(s.answered + '問', '累計の解答数'));
    grid.appendChild(statTile(s.answered ? pct(s.accuracy) + '%' : '—', '通算の正答率'));
    grid.appendChild(statTile(pct(s.coverage) + '%', '出題範囲の網羅率'));
    grid.appendChild(statTile(s.streak + '日', '連続学習(最長' + s.bestStreak + '日)'));

    var flows = global.FLOW_BANK || [];
    var flowPerfect = flows.filter(function (f) {
      var r = state.flows[f.id];
      return r && r.perfect;
    }).length;
    if (flows.length) grid.appendChild(statTile(flowPerfect + ' / ' + flows.length, '計算フロー ノーミス達成'));
    var cases = global.CASE_BANK || [];
    if (cases.length) {
      var passed = cases.filter(function (c) { var r = (state.cases || {})[c.id]; return r && r.best >= 60; }).length;
      grid.appendChild(statTile(passed + ' / ' + cases.length, '午後演習 60点以上'));
    }

    // ヒートマップ
    renderPredictStats();
    renderReasonStats();

    var hm = $('heatmap');
    hm.innerHTML = '';
    global.Stats.heatmapData(state, 12).forEach(function (c) {
      var i = doc.createElement('i');
      i.className = 'lv' + (c.future ? 0 : global.Stats.level(c.answered));
      i.title = c.key + ' : ' + c.answered + '問' + (c.answered ? '(正解' + c.correct + ')' : '');
      hm.appendChild(i);
    });

    // 分野別
    var bars = $('statsFieldBars');
    bars.innerHTML = '';
    global.Stats.byKey(QUESTIONS, state, 'field')
      .sort(function (a, b) {
        if (!a.answered && !b.answered) return a.key.localeCompare(b.key, 'ja');
        if (!a.answered) return 1;
        if (!b.answered) return -1;
        return a.accuracy - b.accuracy;
      })
      .forEach(function (g) { bars.appendChild(barItem(g.key, g.accuracy, g.answered)); });

    // 苦手問題
    var weak = global.Stats.weakQuestions(QUESTIONS, state, 10);
    var wl = $('weakList');
    wl.innerHTML = '';
    if (weak.length === 0) {
      wl.appendChild(el('p', 'empty', 'まだ誤答がありません。演習を進めると、ここに苦手な問題が表示されます。'));
    } else {
      weak.forEach(function (w) {
        var row = el('div', 'weak-item');
        row.appendChild(el('span', 'q', '[' + w.q.field + '] ' + w.q.question));
        row.appendChild(el('span', 'rate', pct(w.accuracy) + '% (' + w.total + '回)'));
        var lb = global.Textbook.lessonButton(w.q, '教科書');
        if (lb) row.appendChild(lb);
        wl.appendChild(row);
      });
      var btn = el('button', 'btn btn-secondary btn-sm', '苦手な問題を演習する');
      btn.style.marginTop = '12px';
      btn.addEventListener('click', function () {
        startSession({ mode: 'practice', ids: weak.map(function (w) { return w.q.id; }), count: 0 });
      });
      wl.appendChild(btn);
    }

    // セッション履歴
    var sl = $('sessionList');
    sl.innerHTML = '';
    var recent = state.sessions.filter(function (r) { return (r.exam || 'ap') === EXAM.id; }).slice(-10).reverse();
    if (recent.length === 0) {
      sl.appendChild(el('p', 'empty', '学習履歴はまだありません。'));
    } else {
      var MODE_NAME = { practice: '演習', exam: '模擬試験', review: '復習' };
      recent.forEach(function (r) {
        var row = el('div', 'session-item');
        var d = new Date(r.at);
        row.appendChild(el('span', 'when', (d.getMonth() + 1) + '/' + d.getDate() + ' ' +
          String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')));
        row.appendChild(el('span', 'what', (MODE_NAME[r.mode] || r.mode) + ' ' + r.total + '問'));
        row.appendChild(el('span', 'sc', r.correct + '/' + r.total + ' (' + pct(r.correct / r.total) + '%)'));
        sl.appendChild(row);
      });
    }
  }

  /* ============ 用語・公式 ============ */
  function renderGlossary(keyword) {
    var box = $('glossaryList');
    box.innerHTML = '';
    var kw = (keyword || '').trim().toLowerCase();
    var hit = 0;

    (global.GLOSSARY || []).forEach(function (grp) {
      var items = grp.items.filter(function (it) {
        if (!kw) return true;
        return (it.term + ' ' + it.formula + ' ' + it.desc + ' ' + grp.group).toLowerCase().indexOf(kw) >= 0;
      });
      if (items.length === 0) return;
      hit += items.length;

      var d = doc.createElement('details');
      d.className = 'glossary-group';
      if (kw) d.open = true;
      var sum = doc.createElement('summary');
      sum.textContent = grp.group + ' (' + items.length + ')';
      d.appendChild(sum);

      var wrap = el('div', 'glossary-items');
      items.forEach(function (it) {
        var card = el('div', 'glossary-item');
        card.appendChild(el('div', 'term', it.term));
        if (it.formula) card.appendChild(el('div', 'formula', it.formula));
        card.appendChild(el('p', 'desc', it.desc));
        wrap.appendChild(card);
      });
      d.appendChild(wrap);
      box.appendChild(d);
    });

    if (hit === 0) box.appendChild(el('p', 'empty', '該当する項目がありません。'));
  }

  /* ============ 設定 ============ */
  function renderSettings() {
    $('themeSelect').value = state.settings.theme;
    $('shuffleChoices').checked = !!state.settings.shuffleChoices;
    $('instantFeedback').checked = !!state.settings.instantFeedback;
    $('totalQuestions').textContent = QUESTIONS.length;
    var s = global.Stats.summary(QUESTIONS, state);
    $('dataInfo').textContent = '記録済み: ' + Object.keys(state.cards).length + '問 / 累計解答 ' +
      s.answered + '回 / セッション ' + state.sessions.length + '件';
  }

  /* ============ AI 採点の設定 ============ */
  function renderAISettings(models) {
    var c = global.AIGrader.config;
    $('aiEnabled').checked = c.enabled;
    $('aiKey').value = c.apiKey;
    var sel = $('aiModel');
    var list = models || [];
    if (!list.some(function (m) { return m.id === c.model; })) list = [{ id: c.model, label: c.model }].concat(list);
    sel.innerHTML = '';
    list.forEach(function (m) {
      var o = doc.createElement('option');
      o.value = m.id; o.textContent = m.label + (m.label !== m.id ? '(' + m.id + ')' : '');
      if (m.id === c.model) o.selected = true;
      sel.appendChild(o);
    });
    $('aiStatus').textContent = c.apiKey ? (c.enabled ? 'AI 採点は有効です。午後演習の記述式で「Gemini で採点する」を押せます。' : 'API キーは保存済みです。「AI 採点を使う」をオンにすると使えます。') : 'API キーが未登録です。';
  }

  function bindAI() {
    renderAISettings();
    $('aiKey').addEventListener('change', function () {
      var v = this.value.trim();
      global.AIGrader.set({ apiKey: v, enabled: v ? true : global.AIGrader.config.enabled });
      renderAISettings();
      if (v) toast('API キーを保存しました(この端末のみ)。');
    });
    $('aiEnabled').addEventListener('change', function () {
      if (this.checked && !global.AIGrader.config.apiKey) { this.checked = false; toast('先に API キーを入力してください。'); return; }
      global.AIGrader.set({ enabled: this.checked });
      renderAISettings();
    });
    $('aiModel').addEventListener('change', function () { global.AIGrader.set({ model: this.value }); renderAISettings(); });
    $('aiKeyShow').addEventListener('click', function () {
      var k = $('aiKey');
      k.type = k.type === 'password' ? 'text' : 'password';
      this.textContent = k.type === 'password' ? '表示' : '隠す';
    });
    $('aiListBtn').addEventListener('click', function () {
      var key = $('aiKey').value.trim();
      if (!key) { toast('API キーを入力してください。'); return; }
      global.AIGrader.set({ apiKey: key });
      var b = this;
      b.disabled = true;
      $('aiStatus').textContent = '接続しています…';
      global.AIGrader.listModels().then(function (models) {
        b.disabled = false;
        renderAISettings(models);
        $('aiStatus').textContent = '接続できました。使用できる Gemini のモデル: ' + models.length + '件。採点には高速な Flash 系のモデルがおすすめです。';
      }, function (e) {
        b.disabled = false;
        $('aiStatus').textContent = '接続に失敗しました: ' + e.message;
      });
    });
    $('aiClearBtn').addEventListener('click', function () {
      if (!global.confirm('保存した API キーを削除しますか?')) return;
      global.AIGrader.clear();
      renderAISettings();
      toast('API キーを削除しました。');
    });
  }

  function download(filename, text) {
    var blob = new Blob([text], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = doc.createElement('a');
    a.href = url;
    a.download = filename;
    doc.body.appendChild(a);
    a.click();
    doc.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* ============ イベント登録 ============ */
  function bind() {
    qsa('.nav-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        if (session && !session.finishedAt && b.dataset.screen !== 'quiz') {
          if (!global.confirm('出題中です。中断してもよろしいですか?(ここまでの解答は記録済みです)')) return;
          clearInterval(timerId);
          session = null;
        }
        if (global.CaseMode.isRunning() && b.dataset.screen !== 'cases') {
          if (!global.confirm('午後演習の途中です。中断してもよろしいですか?(この事例の結果は記録されません)')) return;
          global.CaseMode.exit();
        }
        if (global.DrillMode.isRunning() && b.dataset.screen !== 'flow') {
          if (!global.confirm('計算ドリルの途中です。中断してもよろしいですか?(解いた問題の記録は残ります)')) return;
          global.DrillMode.exit();
        }
        if (global.FlowMode.isRunning() && b.dataset.screen !== 'flow') {
          if (!global.confirm('計算フローの途中です。中断してもよろしいですか?')) return;
          global.FlowMode.exit();
        }
        showScreen(b.dataset.screen);
      });
    });

    $('themeToggle').addEventListener('click', function () {
      var order = ['auto', 'light', 'dark'];
      var nextTheme = order[(order.indexOf(state.settings.theme) + 1) % order.length];
      applyTheme(nextTheme);
      toast('テーマ: ' + ({ auto: '端末の設定に従う', light: 'ライト', dark: 'ダーク' })[nextTheme]);
    });

    // ホーム
    $('quickStartBtn').addEventListener('click', function () {
      startSession({ mode: 'practice', category: 'all', fields: [], count: 10, order: 'random', difficulty: 0 });
    });
    $('startReviewBtn').addEventListener('click', function () {
      startSession({ mode: 'review', category: 'all', fields: [], count: 0, difficulty: 0 });
    });
    $('flowStartBtn').addEventListener('click', function () { showScreen('flow'); });
    $('caseStartBtn').addEventListener('click', function () { showScreen('cases'); });
    qsa('#examSwitch .exam-btn').forEach(function (b) {
      b.addEventListener('click', function () { requestExamSwitch(b.dataset.exam); });
    });
    $('examSelect').addEventListener('change', function () { requestExamSwitch(this.value); });
    $('notebookBtn').addEventListener('click', function () {
      if (this.dataset.target === 'notebook') global.Textbook.showNotebook();
      showScreen('textbook');
    });
    $('toNotebookBtn').addEventListener('click', function () {
      session = null;
      global.Textbook.showNotebook();
      showScreen('textbook');
    });
    $('mockStartBtn').addEventListener('click', function () {
      showScreen('practice');
      setMode('exam');
      $('countSelect').value = String(EXAM.mock.count);
      if ($('countSelect').value !== String(EXAM.mock.count)) {
        var o = doc.createElement('option');
        o.value = String(EXAM.mock.count); o.textContent = EXAM.mock.count + '問';
        $('countSelect').insertBefore(o, $('countSelect').querySelector('option[value="40"]'));
        $('countSelect').value = String(EXAM.mock.count);
      }
      cond.count = EXAM.mock.count;
      $('timeLimitSelect').value = String(EXAM.mock.minutes);
      cond.timeLimit = EXAM.mock.minutes;
      updatePoolInfo();
    });

    // 演習設定
    qsa('#modeGroup .chip').forEach(function (b) {
      b.addEventListener('click', function () { setMode(b.dataset.mode); });
    });
    qsa('#categoryGroup .chip').forEach(function (b) {
      b.addEventListener('click', function () {
        cond.category = b.dataset.category;
        qsa('#categoryGroup .chip').forEach(function (x) { x.classList.toggle('is-active', x === b); });
        renderFieldChips();
        updatePoolInfo();
      });
    });
    $('countSelect').addEventListener('change', function () { cond.count = parseInt(this.value, 10); updatePoolInfo(); });
    $('orderSelect').addEventListener('change', function () { cond.order = this.value; updatePoolInfo(); });
    $('difficultySelect').addEventListener('change', function () { cond.difficulty = parseInt(this.value, 10); updatePoolInfo(); });
    $('timeLimitSelect').addEventListener('change', function () { cond.timeLimit = parseInt(this.value, 10); });
    $('startBtn').addEventListener('click', function () { startSession(); });

    // 出題中
    $('nextBtn').addEventListener('click', next);
    $('prevBtn').addEventListener('click', prev);
    $('abortBtn').addEventListener('click', function () {
      if (!global.confirm('出題を中断してホームへ戻りますか?')) return;
      clearInterval(timerId);
      session = null;
      showScreen('home');
    });

    // 結果
    $('retryWrongBtn').addEventListener('click', function () {
      var ids = (this.dataset.ids || '').split(',').filter(Boolean);
      if (ids.length === 0) return;
      startSession({ mode: 'practice', ids: ids, count: 0 });
    });
    $('againBtn').addEventListener('click', function () {
      startSession(state.lastCondition || {});
    });
    $('backHomeBtn').addEventListener('click', function () { session = null; showScreen('home'); });

    // 用語集
    $('glossarySearch').addEventListener('input', function () { renderGlossary(this.value); });
    qsa('#glossaryMode .chip').forEach(function (b) {
      b.addEventListener('click', function () {
        qsa('#glossaryMode .chip').forEach(function (x) { x.classList.toggle('is-active', x === b); });
        var cards = b.dataset.mode === 'cards';
        $('glossaryListView').hidden = cards;
        $('flashBox').hidden = !cards;
        if (cards) global.Flashcards.open();
      });
    });
    bindAI();

    // 設定
    $('themeSelect').addEventListener('change', function () { applyTheme(this.value); });
    $('shuffleChoices').addEventListener('change', function () {
      state.settings.shuffleChoices = this.checked; global.AppStorage.save();
    });
    $('instantFeedback').addEventListener('change', function () {
      state.settings.instantFeedback = this.checked; global.AppStorage.save();
    });
    $('exportBtn').addEventListener('click', function () {
      download('ap-study-data-' + global.AppStorage.todayKey() + '.json', global.AppStorage.exportJSON());
      toast('学習データを書き出しました。');
    });
    $('importBtn').addEventListener('click', function () { $('importFile').click(); });
    $('importFile').addEventListener('change', function () {
      var file = this.files && this.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          state = global.AppStorage.importJSON(String(reader.result));
          state.settings.exam = EXAM.id;
          applyTheme(state.settings.theme);
          renderSettings();
          renderHome();
          toast('学習データを読み込みました。');
        } catch (e) {
          global.alert('読込みに失敗しました: ' + e.message);
        }
      };
      reader.readAsText(file);
      this.value = '';
    });
    $('resetBtn').addEventListener('click', function () {
      if (!global.confirm('学習データをすべて消去します。元に戻せませんがよろしいですか?')) return;
      state = global.AppStorage.reset();
      state.settings.exam = EXAM.id;
      applyTheme(state.settings.theme);
      renderSettings();
      renderHome();
      toast('学習データを消去しました。');
    });

    // キーボード操作
    doc.addEventListener('keydown', function (e) {
      var quizVisible = $('screen-quiz').classList.contains('is-active');
      if (!quizVisible || !session) return;
      if (global.Textbook.isModalOpen()) return;
      if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;

      if (e.key >= '1' && e.key <= '4') {
        var ci = parseInt(e.key, 10) - 1;
        var item = global.Quiz.currentItem(session);
        if (ci < item.choices.length) { selectChoice(ci); e.preventDefault(); }
      } else if (e.key === 'Enter' || e.key === ' ') {
        if (!$('nextBtn').disabled) { next(); e.preventDefault(); }
      } else if (e.key === 'ArrowLeft') {
        if (!$('prevBtn').hidden && !$('prevBtn').disabled) prev();
      }
    });

    global.addEventListener('beforeunload', function (e) {
      if (session && !session.finishedAt && session.answers.some(function (a) { return a !== null; })) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }

  /* ============ 初期化 ============ */
  function init() {
    if (QUESTIONS.length === 0) {
      $('main').innerHTML = '<p class="empty">問題データを読み込めませんでした。</p>';
      return;
    }
    applyTheme(state.settings.theme);
    applyExam();
    bind();
    global.Textbook.init({
      getState: function () { return state; },
      canStart: function () {
        return !(session && !session.finishedAt) && !global.FlowMode.isRunning() && !global.CaseMode.isRunning() && !global.DrillMode.isRunning();
      },
      startQuestions: function (ids) {
        session = null;
        startSession({ mode: 'practice', ids: ids, count: 0, order: 'weak' });
      },
      startFlow: function (id) {
        global.DrillMode.setTab('flow');
        showScreen('flow');
        global.FlowMode.startById(id);
      },
      startDrill: function (id) {
        global.DrillMode.setTab('drill');
        showScreen('flow');
        global.DrillMode.startType(id);
      },
      startCase: function (id) {
        showScreen('cases');
        global.CaseMode.startById(id);
      },
      showScreen: showScreen
    });
    global.CaseMode.init({
      toast: toast,
      lessonButton: function (item) { return global.Textbook.lessonButton(item, '教科書で復習'); },
      onStudied: function (n, full) {
        global.AppStorage.recordDay(n, full);
        global.AppStorage.save();
      }
    });
    global.DrillMode.init({
      toast: toast,
      lessonButton: function (item) { return global.Textbook.lessonButton(item, '教科書で復習'); },
      onStudied: function (n, ok) {
        var key = global.AppStorage.todayKey();
        state.drillDays = state.drillDays || {};
        state.drillDays[key] = (state.drillDays[key] || 0) + n;
        global.AppStorage.recordDay(n, ok);
        global.AppStorage.save();
      }
    });
    global.Flashcards.init();
    global.FlowMode.init({
      lessonButton: function (flow) {
        var b = global.Textbook.lessonButton(flow, '教科書でこの単元を復習');
        if (!b) return null;
        var wrap = el('div', 'flow-lesson');
        wrap.appendChild(b);
        return wrap;
      },
      toast: toast,
      onStudied: function (steps, firstTry) {
        global.AppStorage.recordDay(steps, firstTry);
        global.AppStorage.save();
      }
    });
    setMode('practice');
    renderFieldChips();
    renderGlossary('');
    renderSettings();
    renderHome();
    showScreen('home');
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
