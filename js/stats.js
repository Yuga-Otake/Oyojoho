/**
 * stats.js - 学習履歴の集計
 */
(function (global) {
  'use strict';

  function rate(correct, total) {
    return total > 0 ? correct / total : 0;
  }

  /** 全体サマリ */
  function summary(questions, state) {
    var answered = 0, correct = 0, touched = 0, mastered = 0;
    questions.forEach(function (q) {
      var c = state.cards[q.id];
      if (!c || c.lastAt === null) return;
      touched += 1;
      answered += c.correct + c.wrong;
      correct += c.correct;
      if (global.SRS.masteryLevel(c) >= 4) mastered += 1;
    });
    return {
      totalQuestions: questions.length,
      touched: touched,
      coverage: rate(touched, questions.length),
      answered: answered,
      correct: correct,
      accuracy: rate(correct, answered),
      mastered: mastered,
      streak: global.AppStorage.effectiveStreak(),
      bestStreak: state.streak.best || 0
    };
  }

  /**
   * 分野(field)またはカテゴリ(category)単位の正答率
   * @param {string} keyName 'field' または 'category'
   */
  function byKey(questions, state, keyName) {
    var map = {};
    questions.forEach(function (q) {
      var k = q[keyName];
      if (!map[k]) map[k] = { key: k, total: 0, answered: 0, correct: 0, touched: 0 };
      var g = map[k];
      g.total += 1;
      var c = state.cards[q.id];
      if (c && c.lastAt !== null) {
        g.touched += 1;
        g.answered += c.correct + c.wrong;
        g.correct += c.correct;
      }
    });
    return Object.keys(map).map(function (k) {
      var g = map[k];
      g.accuracy = rate(g.correct, g.answered);
      g.coverage = rate(g.touched, g.total);
      return g;
    });
  }

  /** 苦手な問題(誤答があり、正答率の低い順) */
  function weakQuestions(questions, state, limit) {
    return questions
      .map(function (q) {
        var c = state.cards[q.id];
        if (!c || c.wrong === 0) return null;
        var total = c.correct + c.wrong;
        return { q: q, accuracy: rate(c.correct, total), total: total, wrong: c.wrong };
      })
      .filter(Boolean)
      .sort(function (a, b) {
        if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
        return b.wrong - a.wrong;
      })
      .slice(0, limit || 10);
  }

  /** 直近 weeks 週間の日別学習量(ヒートマップ用、日曜始まり) */
  function heatmapData(state, weeks) {
    var w = weeks || 12;
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var end = new Date(today);
    end.setDate(end.getDate() + (6 - end.getDay())); // 今週の土曜まで
    var start = new Date(end);
    start.setDate(start.getDate() - (w * 7 - 1));

    var cells = [];
    var cur = new Date(start);
    while (cur <= end) {
      var key = global.AppStorage.todayKey(cur);
      var d = state.daily[key];
      cells.push({
        date: new Date(cur),
        key: key,
        answered: d ? d.answered : 0,
        correct: d ? d.correct : 0,
        future: cur > today
      });
      cur.setDate(cur.getDate() + 1);
    }
    return cells;
  }

  function level(answered) {
    if (answered <= 0) return 0;
    if (answered < 5) return 1;
    if (answered < 15) return 2;
    if (answered < 30) return 3;
    return 4;
  }

  global.Stats = {
    summary: summary, byKey: byKey, weakQuestions: weakQuestions,
    heatmapData: heatmapData, level: level, rate: rate
  };
})(window);
