/**
 * app.js - 画面制御とイベント処理
 */
(function (global) {
  'use strict';

  var doc = global.document;
  var QUESTIONS = global.QUESTION_BANK || [];
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
    if (name === 'flow' && !global.FlowMode.isRunning()) global.FlowMode.renderList();
    if (name === 'practice') updatePoolInfo();
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

    var flows = global.FLOW_BANK || [];
    var flowDone = flows.filter(function (f) {
      var r = state.flows[f.id];
      return r && r.attempts > 0;
    }).length;
    $('flowHomeInfo').textContent = flowDone === 0
      ? '計算問題を迷いどころごとの選択に分解して解き進めます。'
      : flows.length + '件中 ' + flowDone + '件に挑戦済みです。';

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
      var card = global.AppStorage.card(item.question.id);
      global.SRS.update(card, isCorrect);
      global.AppStorage.save();
    }
    renderQuestion();
    if (session.mode === 'exam') next();
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
        var card = global.AppStorage.card(item.question.id);
        global.SRS.update(card, session.answers[i] === item.answerIndex);
      });
    }

    var sc = global.Quiz.score(session);
    var answeredCount = session.answers.filter(function (a) { return a !== null; }).length;
    global.AppStorage.recordDay(answeredCount, sc.correct);
    state.sessions.push({
      at: session.finishedAt,
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
    if (accuracy >= 0.8) { title = '合格ラインを超えています'; comment = '午前試験の合格基準は60%です。この調子で出題範囲を広げていきましょう。'; }
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
      d.appendChild(detail);
      if (!ok) d.open = true;
      list.appendChild(d);
    });

    var wrongIds = s.items.filter(function (item, i) { return !global.Quiz.isCorrectAt(s, i); })
      .map(function (item) { return item.question.id; });
    $('retryWrongBtn').disabled = wrongIds.length === 0;
    $('retryWrongBtn').dataset.ids = wrongIds.join(',');
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
    grid.appendChild(statTile(flowPerfect + ' / ' + flows.length, '計算フロー ノーミス達成'));

    // ヒートマップ
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
    var recent = state.sessions.slice(-10).reverse();
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
    $('mockStartBtn').addEventListener('click', function () {
      showScreen('practice');
      setMode('exam');
      $('countSelect').value = '20';
      cond.count = 20;
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
      applyTheme(state.settings.theme);
      renderSettings();
      renderHome();
      toast('学習データを消去しました。');
    });

    // キーボード操作
    doc.addEventListener('keydown', function (e) {
      var quizVisible = $('screen-quiz').classList.contains('is-active');
      if (!quizVisible || !session) return;
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
    bind();
    global.FlowMode.init({
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
