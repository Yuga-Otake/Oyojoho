/**
 * flow.js - 計算フローモード
 *
 * 計算問題を「迷いどころ」ごとのステップに分け、各ステップで選択肢を選ばせる。
 * 誤答したときはその場で理由を示し、正解するまで同じステップにとどまる。
 */
(function (global) {
  'use strict';

  var doc = global.document;
  var FLOWS = global.FLOW_BANK || [];
  var CHOICE_LABELS = ['ア', 'イ', 'ウ', 'エ'];
  var DIFF_LABELS = { 1: '★☆☆ 基本', 2: '★★☆ 標準', 3: '★★★ 応用' };

  var ctx = { toast: function () {}, onStudied: function () {}, lessonButton: function () { return null; } };
  var cur = null;   // 実行中のフロー

  function $(id) { return doc.getElementById(id); }
  function el(tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  /** 選択肢をシャッフルし、traps(誤答への指摘)の対応も付け替える */
  function prepareStep(step, doShuffle) {
    var idx = [0, 1, 2, 3];
    if (doShuffle) idx = global.Quiz.shuffle(idx);
    var traps = {};
    Object.keys(step.traps || {}).forEach(function (k) {
      traps[idx.indexOf(Number(k))] = step.traps[k];
    });
    return {
      step: step,
      choices: idx.map(function (i) { return step.choices[i]; }),
      answerIndex: idx.indexOf(step.answer),
      traps: traps
    };
  }

  /* ---------------- 一覧 ---------------- */

  function renderList() {
    var state = global.AppStorage.get();
    var cleared = 0, perfect = 0;
    FLOWS.forEach(function (f) {
      var r = state.flows[f.id];
      if (r && r.attempts > 0) cleared += 1;
      if (r && r.perfect) perfect += 1;
    });

    var sum = $('flowSummary');
    sum.innerHTML = '';
    [[cleared + ' / ' + FLOWS.length, '挑戦したフロー'],
     [perfect + '件', 'ノーミス達成'],
     [FLOWS.reduce(function (a, f) { return a + f.steps.length; }, 0) + 'ステップ', '収録ステップ数']]
      .forEach(function (t) {
        var tile = el('div', 'stat-tile');
        tile.appendChild(el('div', 'v', t[0]));
        tile.appendChild(el('div', 'l', t[1]));
        sum.appendChild(tile);
      });

    var list = $('flowList');
    list.innerHTML = '';
    var cats = [];
    FLOWS.forEach(function (f) { if (cats.indexOf(f.category) < 0) cats.push(f.category); });

    cats.forEach(function (cat) {
      list.appendChild(el('h3', 'flow-cat', cat));
      FLOWS.filter(function (f) { return f.category === cat; }).forEach(function (f) {
        var r = state.flows[f.id];
        var card = el('button', 'flow-card');
        card.type = 'button';

        var head = el('div', 'flow-card-head');
        head.appendChild(el('span', 'flow-card-title', f.title));
        var badge;
        if (!r || !r.attempts) badge = el('span', 'flow-badge new', '未挑戦');
        else if (r.perfect) badge = el('span', 'flow-badge perfect', 'ノーミス達成');
        else badge = el('span', 'flow-badge done', '最高 ' + r.best + '/' + f.steps.length);
        head.appendChild(badge);
        card.appendChild(head);

        card.appendChild(el('p', 'flow-card-desc', f.scenario));

        var tags = el('div', 'q-tags');
        tags.appendChild(el('span', 'tag tag-cat', f.field));
        tags.appendChild(el('span', 'tag', f.topic));
        tags.appendChild(el('span', 'tag tag-diff', DIFF_LABELS[f.difficulty] || ''));
        tags.appendChild(el('span', 'tag', f.steps.length + 'ステップ'));
        card.appendChild(tags);

        card.addEventListener('click', function () { start(f); });
        list.appendChild(card);
      });
    });
  }

  /* ---------------- プレイヤー ---------------- */

  function start(flow) {
    var shuffle = !!global.AppStorage.get().settings.shuffleChoices;
    cur = {
      flow: flow,
      items: flow.steps.map(function (s) { return prepareStep(s, shuffle); }),
      index: 0,
      results: [],
      missThisStep: 0,
      startedAt: Date.now()
    };

    $('flowListView').hidden = true;
    $('flowPlayerView').hidden = false;
    $('flowSummaryCard').hidden = true;
    $('flowStepCard').hidden = false;
    $('flowNextBtn').hidden = false;
    $('flowKeyHint').hidden = false;

    var tags = $('flowTags');
    tags.innerHTML = '';
    tags.appendChild(el('span', 'tag tag-cat', flow.category));
    tags.appendChild(el('span', 'tag', flow.field + ' / ' + flow.topic));
    tags.appendChild(el('span', 'tag tag-diff', DIFF_LABELS[flow.difficulty] || ''));
    tags.appendChild(el('span', 'tag tag-id', flow.id));
    $('flowTitle').textContent = flow.title;
    $('flowScenario').textContent = flow.scenario;

    global.scrollTo(0, 0);
    renderStep();
  }

  function renderStep() {
    var item = cur.items[cur.index];
    var total = cur.items.length;

    $('flowProgressText').textContent = 'ステップ ' + (cur.index + 1) + ' / ' + total;
    $('flowProgressFill').style.width = (cur.index / total * 100) + '%';
    $('flowPitfall').textContent = '迷いどころ: ' + item.step.pitfall;
    $('flowPrompt').textContent = item.step.prompt;
    $('flowFeedback').hidden = true;
    $('flowNextBtn').disabled = true;
    $('flowNextBtn').textContent = (cur.index === total - 1) ? 'フローを完了する' : '次のステップへ →';

    var list = $('flowChoices');
    list.innerHTML = '';
    item.choices.forEach(function (text, ci) {
      var li = doc.createElement('li');
      var btn = el('button', 'choice');
      btn.type = 'button';
      btn.appendChild(el('span', 'mark', CHOICE_LABELS[ci]));
      btn.appendChild(el('span', 'body', text));
      btn.addEventListener('click', function () { pick(ci, btn); });
      li.appendChild(btn);
      list.appendChild(li);
    });

    renderTrail();
  }

  function renderTrail() {
    var trail = $('flowTrail');
    trail.innerHTML = '';
    cur.results.forEach(function (r, i) {
      var li = el('li', 'trail-item' + (r.firstTry ? '' : ' retried'));
      li.appendChild(el('span', 'trail-no', String(i + 1)));
      var body = el('span', 'trail-body');
      body.appendChild(el('span', 'trail-pitfall', cur.items[i].step.pitfall));
      body.appendChild(el('span', 'trail-answer', r.answerText));
      li.appendChild(body);
      li.appendChild(el('span', 'trail-mark', r.firstTry ? '一発正解' : '再挑戦 ' + r.miss + '回'));
      trail.appendChild(li);
    });
    trail.hidden = cur.results.length === 0;
  }

  function pick(ci, btn) {
    var item = cur.items[cur.index];
    if (cur.results.length > cur.index) return; // このステップは解答済み

    var head = $('flowFeedbackHead');
    var body = $('flowExplanation');
    $('flowFeedback').hidden = false;

    if (ci === item.answerIndex) {
      btn.classList.add('is-correct');
      Array.prototype.forEach.call($('flowChoices').querySelectorAll('.choice'), function (b) { b.disabled = true; });
      head.className = 'feedback-head ok';
      head.textContent = cur.missThisStep === 0 ? '正解 — 一発で通過' : '正解';
      $('flowFeedbackLabel').textContent = '解説';
      body.textContent = item.step.explanation;

      cur.results.push({
        firstTry: cur.missThisStep === 0,
        miss: cur.missThisStep,
        answerText: item.choices[ci]
      });
      cur.missThisStep = 0;
      $('flowNextBtn').disabled = false;
      renderTrail();
    } else {
      btn.classList.add('is-wrong');
      btn.disabled = true;
      cur.missThisStep += 1;
      head.className = 'feedback-head ng';
      head.textContent = 'ここが落とし穴です — もう一度考えてみましょう';
      $('flowFeedbackLabel').textContent = 'なぜ違うのか';
      body.textContent = item.traps[ci] || 'この選び方では正しい結果になりません。設問の条件をもう一度確認しましょう。';
    }
  }

  function next() {
    if (cur.index >= cur.items.length - 1) { finish(); return; }
    cur.index += 1;
    cur.missThisStep = 0;
    renderStep();
    $('flowStepCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function finish() {
    var total = cur.items.length;
    var firstTry = cur.results.filter(function (r) { return r.firstTry; }).length;

    var rec = global.AppStorage.flow(cur.flow.id);
    rec.attempts += 1;
    rec.last = firstTry;
    if (firstTry > rec.best) rec.best = firstTry;
    if (firstTry === total) rec.perfect = true;
    rec.lastAt = Date.now();
    global.AppStorage.save();
    ctx.onStudied(total, firstTry);

    $('flowProgressFill').style.width = '100%';
    $('flowProgressText').textContent = 'ステップ ' + total + ' / ' + total;
    $('flowStepCard').hidden = true;
    $('flowNextBtn').hidden = true;
    $('flowKeyHint').hidden = true;

    var card = $('flowSummaryCard');
    card.hidden = false;
    card.innerHTML = '';

    var title = el('h3', '', firstTry === total
      ? 'ノーミスで完走しました'
      : '完了 — ' + firstTry + ' / ' + total + ' ステップを一発で通過');
    card.appendChild(title);

    var lead = el('p', 'muted', firstTry === total
      ? '迷いどころをすべて一度で突破できています。同じ型の問題は本番でも確実に取れます。'
      : 'つまずいたステップが、この問題の「迷いどころ」です。下のまとめを読んでから、もう一度挑戦してみましょう。');
    card.appendChild(lead);

    var ol = el('ol', 'flow-result-list');
    cur.results.forEach(function (r, i) {
      var li = el('li', 'flow-result-item' + (r.firstTry ? ' ok' : ' ng'));
      li.appendChild(el('span', 'trail-mark', r.firstTry ? '○' : '×' + r.miss));
      var b = el('span', 'trail-body');
      b.appendChild(el('span', 'trail-pitfall', cur.items[i].step.pitfall));
      b.appendChild(el('span', 'trail-answer', r.answerText));
      li.appendChild(b);
      ol.appendChild(li);
    });
    card.appendChild(ol);

    var sumBox = el('div', 'flow-summary-box');
    sumBox.appendChild(el('h4', '', 'この問題のまとめ'));
    sumBox.appendChild(el('p', '', cur.flow.summary));
    card.appendChild(sumBox);

    var lesson = ctx.lessonButton(cur.flow);
    if (lesson) card.appendChild(lesson);

    var actions = el('div', 'result-actions');
    var again = el('button', 'btn btn-primary', 'もう一度挑戦する');
    again.addEventListener('click', function () { start(cur.flow); });
    var back = el('button', 'btn btn-ghost', '一覧へ戻る');
    back.addEventListener('click', exit);
    actions.appendChild(again);
    actions.appendChild(back);
    card.appendChild(actions);

    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function exit() {
    cur = null;
    $('flowPlayerView').hidden = true;
    $('flowListView').hidden = false;
    renderList();
    global.scrollTo(0, 0);
  }

  /** 出題中(完了前)かどうか。画面離脱の確認に使う */
  function isRunning() {
    return !!cur && cur.results.length < cur.items.length;
  }

  function init(c) {
    if (c) {
      if (c.toast) ctx.toast = c.toast;
      if (c.onStudied) ctx.onStudied = c.onStudied;
      if (c.lessonButton) ctx.lessonButton = c.lessonButton;
    }
    $('flowNextBtn').addEventListener('click', next);
    $('flowExitBtn').addEventListener('click', function () {
      if (isRunning() && !global.confirm('このフローを中断して一覧へ戻りますか?')) return;
      exit();
    });

    doc.addEventListener('keydown', function (e) {
      if (!cur) return;
      if (!$('screen-flow').classList.contains('is-active')) return;
      if ($('flowStepCard').hidden) return;
      if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;

      if (e.key >= '1' && e.key <= '4') {
        var btns = $('flowChoices').querySelectorAll('.choice');
        var i = parseInt(e.key, 10) - 1;
        if (btns[i] && !btns[i].disabled) { btns[i].click(); e.preventDefault(); }
      } else if (e.key === 'Enter' || e.key === ' ') {
        if (!$('flowNextBtn').disabled) { next(); e.preventDefault(); }
      }
    });
  }

  global.FlowMode = {
    init: init, renderList: renderList, exit: exit, isRunning: isRunning, count: FLOWS.length,
    startById: function (id) {
      var f = FLOWS.filter(function (x) { return x.id === id; })[0];
      if (f) start(f);
      return !!f;
    }
  };
})(window);
