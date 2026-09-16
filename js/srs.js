/**
 * srs.js - 間隔反復(SM-2 を簡略化したアルゴリズム)
 *
 * 正解すると次回復習までの間隔が伸び、誤答するとリセットされる。
 * 間隔は日単位で、期限(due)を過ぎた問題が復習キューに入る。
 */
(function (global) {
  'use strict';

  var DAY = 24 * 60 * 60 * 1000;
  var FIRST_INTERVAL = 1;   // 初回正解時の間隔(日)
  var SECOND_INTERVAL = 3;  // 2回連続正解時の間隔(日)
  var MIN_EASE = 1.3;
  var MAX_INTERVAL = 180;

  /**
   * 解答結果をカードへ反映する。
   * @param {object} card AppStorage.card() が返すカード
   * @param {boolean} isCorrect 正誤
   * @param {number} [now] 現在時刻(ミリ秒)
   */
  function update(card, isCorrect, now) {
    var t = now || Date.now();
    card.lastAt = t;

    if (isCorrect) {
      card.correct += 1;
      card.streak += 1;
      if (card.streak === 1) {
        card.interval = FIRST_INTERVAL;
      } else if (card.streak === 2) {
        card.interval = SECOND_INTERVAL;
      } else {
        card.interval = Math.min(Math.round(card.interval * card.ease), MAX_INTERVAL);
      }
      card.ease = Math.min(card.ease + 0.1, 3.0);
    } else {
      card.wrong += 1;
      card.streak = 0;
      card.interval = 0; // 同日中に再出題の対象とする
      card.ease = Math.max(card.ease - 0.2, MIN_EASE);
    }

    card.due = t + card.interval * DAY;
    return card;
  }

  /** 復習期限が到来しているか */
  function isDue(card, now) {
    if (!card || card.lastAt === null) return false;
    return (card.due || 0) <= (now || Date.now());
  }

  /** 期限までの残り日数(マイナスは超過) */
  function daysUntilDue(card, now) {
    if (!card || card.due === null) return Infinity;
    return Math.ceil((card.due - (now || Date.now())) / DAY);
  }

  /** 問題一覧のうち、復習期限が到来しているものを返す */
  function dueQuestions(questions, cards, now) {
    var t = now || Date.now();
    return questions.filter(function (q) {
      return isDue(cards[q.id], t);
    });
  }

  /** カードの習熟度を 0(未学習)〜4(定着) で表す */
  function masteryLevel(card) {
    if (!card || card.lastAt === null) return 0;
    if (card.streak === 0) return 1;
    if (card.streak === 1) return 2;
    if (card.streak === 2) return 3;
    return 4;
  }

  global.SRS = {
    update: update, isDue: isDue, daysUntilDue: daysUntilDue,
    dueQuestions: dueQuestions, masteryLevel: masteryLevel, DAY: DAY
  };
})(window);
