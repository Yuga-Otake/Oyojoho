/**
 * planner.js - 合格の見込みと、試験日から逆算した学習計画
 *
 * 午前の予測得点:
 *   分野ごとに「いま解いたら正解できる確率」を見積もり、本番の出題比率(大分類の重み × 分野の割合)で平均する。
 *   - 解いたことのある問題 … 直近の連続正解数(SRS の streak)から 0:35% / 1:75% / 2以上:90%
 *   - 同じ分野の未着手の問題 … 当てずっぽう(25%)と、着手済み問題の見積りの中間
 *   - 一度も着手していない分野 … 25%(四択の当てずっぽう)
 * 午後の予測得点: 午後演習の事例ごとのベストスコアから、本番の選択方法に合わせて平均する。
 */
(function (global) {
  'use strict';

  var DAY = 24 * 60 * 60 * 1000;
  var GUESS = 0.25;
  var TARGET = 0.85;

  function pNow(card) {
    if (!card || card.lastAt === null || card.lastAt === undefined) return null;
    if (card.streak >= 2) return 0.9;
    if (card.streak === 1) return 0.75;
    return 0.35;
  }

  /** 午前の予測 */
  function predictAM(questions, state, exam) {
    var weights = exam.weights || {};
    var cats = Object.keys(weights);
    var totalW = cats.reduce(function (a, c) { return a + weights[c]; }, 0) || 1;
    var fields = [];
    var touchedAll = 0;
    var score = 0;
    var catResult = [];
    cats.forEach(function (c) {
      var qs = questions.filter(function (q) { return q.category === c; });
      if (!qs.length) return;
      var byField = {};
      qs.forEach(function (q) { (byField[q.field] = byField[q.field] || []).push(q); });
      var catEst = 0;
      Object.keys(byField).forEach(function (f) {
        var list = byField[f];
        var ps = list.map(function (q) { return pNow(state.cards[q.id]); }).filter(function (p) { return p !== null; });
        touchedAll += ps.length;
        var mean = ps.length ? ps.reduce(function (a, b) { return a + b; }, 0) / ps.length : null;
        var cov = ps.length / list.length;
        var unseen = mean === null ? GUESS : GUESS + 0.5 * (mean - GUESS);
        var est = mean === null ? GUESS : cov * mean + (1 - cov) * unseen;
        var share = list.length / qs.length;
        catEst += share * est;
        var weight = weights[c] * share;  // 本番の想定出題数
        fields.push({
          field: f, category: c, est: est, coverage: cov, expected: weight,
          gain: Math.max(0, (TARGET - est) * weight / totalW * 100)
        });
      });
      score += weights[c] * catEst;
      catResult.push({ category: c, est: catEst, weight: weights[c] });
    });
    var coverage = touchedAll / Math.max(1, questions.length);
    return {
      score: Math.round(score / totalW * 100),
      categories: catResult,
      fields: fields,
      gains: fields.filter(function (f) { return f.gain >= 0.5; }).sort(function (a, b) { return b.gain - a.gain; }).slice(0, 3),
      coverage: coverage,
      reliable: coverage >= 0.3
    };
  }

  /** 午後の予測 */
  function predictPM(cases, state, exam) {
    if (!cases.length) return null;
    var rec = state.cases || {};
    var tried = cases.filter(function (c) { return rec[c.id] && rec[c.id].attempts > 0; });
    if (!tried.length) return { score: null, tried: 0, total: cases.length };
    var pick = (exam.pm && exam.pm.select) || 2;
    var hasArea = cases.some(function (c) { return c.area; });
    var used, areas = [];
    if (hasArea) {
      var best = {};
      tried.forEach(function (c) { best[c.area] = Math.max(best[c.area] || 0, rec[c.id].best); });
      var reqArea = (cases.filter(function (c) { return c.required; })[0] || {}).area;
      var others = Object.keys(best).filter(function (a) { return a !== reqArea; })
        .map(function (a) { return { area: a, best: best[a] }; }).sort(function (a, b) { return b.best - a.best; });
      var chosen = others.slice(0, pick);
      used = (reqArea && best[reqArea] !== undefined ? [best[reqArea]] : []).concat(chosen.map(function (x) { return x.best; }));
      Object.keys(best).forEach(function (a) { areas.push({ area: a, best: best[a], required: a === reqArea, chosen: chosen.some(function (x) { return x.area === a; }) }); });
      areas.sort(function (a, b) { return (b.required - a.required) || (b.best - a.best); });
      var need = (reqArea ? 1 : 0) + pick;
      return {
        score: Math.round(used.reduce(function (a, b) { return a + b; }, 0) / used.length),
        tried: tried.length, total: cases.length, areas: areas,
        missing: Math.max(0, need - used.length), reqArea: reqArea, reqTried: reqArea ? best[reqArea] !== undefined : true
      };
    }
    used = tried.map(function (c) { return rec[c.id].best; }).sort(function (a, b) { return b - a; }).slice(0, pick);
    return { score: Math.round(used.reduce(function (a, b) { return a + b; }, 0) / used.length), tried: tried.length, total: cases.length, missing: Math.max(0, pick - used.length) };
  }

  /* ============ 学習計画 ============ */
  function daysUntil(dateStr) {
    if (!dateStr) return null;
    var p = dateStr.split('-').map(Number);
    var d = new Date(p[0], p[1] - 1, p[2]);
    var t = new Date(); t.setHours(0, 0, 0, 0);
    return Math.round((d - t) / DAY);
  }

  /**
   * 今日やること
   * @returns {days, items:[{label, target, done, unit, note}], phase}
   */
  function plan(questions, state, exam, opts) {
    var dateStr = state.settings.examDates && state.settings.examDates[exam.id];
    var days = daysUntil(dateStr);
    if (days === null) return null;
    var todayKey = global.AppStorage.todayKey();
    var today = state.daily[todayKey] || { answered: 0, correct: 0 };
    var due = global.SRS.dueQuestions(questions, state.cards).length;
    var untouched = questions.filter(function (q) { var c = state.cards[q.id]; return !c || c.lastAt === null; }).length;
    var phase = days < 0 ? 'after' : days <= 14 ? 'final' : 'learn';
    var items = [];
    if (phase === 'after') return { days: days, date: dateStr, phase: phase, items: [] };

    var newPerDay = phase === 'learn' ? Math.ceil(untouched / Math.max(1, days - 14)) : 0;
    var amTarget = Math.max(due + newPerDay, phase === 'final' ? 20 : 10);
    items.push({ label: (exam.amLabel || '午前') + 'の演習・復習', target: amTarget, done: today.answered, unit: '問',
      note: '復習期限 ' + due + '問' + (newPerDay ? ' + 新しい問題 ' + newPerDay + '問' : '') + (phase === 'final' ? '(直前期は模擬試験で時間配分の確認を)' : '') });

    if (opts && opts.weakDrills && opts.weakDrills.length) {
      items.push({ label: '計算ドリル', target: 5, done: opts.drillToday || 0, unit: '問', note: (opts.weakIsUntried ? 'まだ解いていない型: ' : '苦手な型: ') + opts.weakDrills.slice(0, 2).join('、') });
    }
    if (opts && opts.cases && opts.cases.length) {
      var rec = state.cases || {};
      var notTried = opts.cases.filter(function (c) { return !rec[c.id] || !rec[c.id].attempts; }).length;
      var weeks = Math.max(1, Math.floor(days / 7));
      var perWeek = Math.max(1, Math.ceil((notTried + opts.cases.length) / weeks));
      items.push({ label: '午後演習', target: perWeek, done: opts.casesThisWeek || 0, unit: '事例/週',
        note: notTried ? '未挑戦 ' + notTried + '事例。解いた事例も2回目で記述を磨く' : 'ベストスコアが低い事例から解き直す' });
    }
    return { days: days, date: dateStr, phase: phase, items: items, untouched: untouched, newPerDay: newPerDay };
  }

  global.Planner = { predictAM: predictAM, predictPM: predictPM, plan: plan, daysUntil: daysUntil };
})(window);
