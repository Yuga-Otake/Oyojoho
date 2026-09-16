/**
 * quiz.js - 出題プールの作成とセッション管理(DOM に依存しない部分)
 */
(function (global) {
  'use strict';

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /**
   * 条件に合致する問題を抽出し、出題順に並べる。
   * @param {object} cond {mode, category, fields[], count, order, difficulty, ids[]}
   */
  function buildPool(questions, state, cond) {
    var cards = state.cards;
    var pool = questions.slice();

    if (cond.ids && cond.ids.length) {
      var set = {};
      cond.ids.forEach(function (id) { set[id] = true; });
      pool = pool.filter(function (q) { return set[q.id]; });
    } else {
      if (cond.category && cond.category !== 'all') {
        pool = pool.filter(function (q) { return q.category === cond.category; });
      }
      if (cond.fields && cond.fields.length) {
        pool = pool.filter(function (q) { return cond.fields.indexOf(q.field) >= 0; });
      }
      if (cond.difficulty) {
        pool = pool.filter(function (q) { return q.difficulty === cond.difficulty; });
      }
      if (cond.mode === 'review') {
        pool = global.SRS.dueQuestions(pool, cards);
      }
    }

    var order = cond.mode === 'review' ? 'due' : (cond.order || 'random');
    if (order === 'weak') {
      pool = shuffle(pool).sort(function (a, b) { return scoreWeak(cards[a.id]) - scoreWeak(cards[b.id]); });
    } else if (order === 'unseen') {
      pool = shuffle(pool).sort(function (a, b) { return seenCount(cards[a.id]) - seenCount(cards[b.id]); });
    } else if (order === 'due') {
      pool = shuffle(pool).sort(function (a, b) {
        return global.SRS.daysUntilDue(cards[a.id]) - global.SRS.daysUntilDue(cards[b.id]);
      });
    } else {
      pool = shuffle(pool);
    }

    if (cond.count && cond.count > 0) pool = pool.slice(0, cond.count);
    return pool;
  }

  /** 苦手度スコア(小さいほど優先) */
  function scoreWeak(card) {
    if (!card || card.lastAt === null) return 0.5;           // 未学習は中程度の優先度
    var total = card.correct + card.wrong;
    if (total === 0) return 0.5;
    return card.correct / total;
  }

  function seenCount(card) {
    if (!card) return 0;
    return card.correct + card.wrong;
  }

  /** 選択肢をシャッフルしても正解位置を追えるようにする */
  function prepareQuestion(q, doShuffle) {
    var idx = q.choices.map(function (_, i) { return i; });
    if (doShuffle) idx = shuffle(idx);
    return {
      question: q,
      order: idx,
      choices: idx.map(function (i) { return q.choices[i]; }),
      answerIndex: idx.indexOf(q.answer)
    };
  }

  /**
   * セッション(1回の出題)を表すオブジェクトを生成する。
   */
  function createSession(pool, cond, shuffleChoices) {
    return {
      cond: cond,
      mode: cond.mode || 'practice',
      items: pool.map(function (q) { return prepareQuestion(q, shuffleChoices); }),
      index: 0,
      answers: new Array(pool.length).fill(null), // 各要素: 表示上の選択肢インデックス
      startedAt: Date.now(),
      finishedAt: null
    };
  }

  function currentItem(session) {
    return session.items[session.index];
  }

  function isCorrectAt(session, i) {
    var a = session.answers[i];
    return a !== null && a === session.items[i].answerIndex;
  }

  function score(session) {
    var correct = 0;
    for (var i = 0; i < session.items.length; i++) if (isCorrectAt(session, i)) correct += 1;
    return { correct: correct, total: session.items.length };
  }

  global.Quiz = {
    buildPool: buildPool, createSession: createSession, currentItem: currentItem,
    isCorrectAt: isCorrectAt, score: score, shuffle: shuffle, prepareQuestion: prepareQuestion
  };
})(window);
