/**
 * storage.js - 学習データの永続化(localStorage)
 * 保存先はブラウザのみ。サーバへは一切送信しない。
 */
(function (global) {
  'use strict';

  var KEY = 'ap-study-app:v1';
  var MAX_SESSIONS = 100;

  function defaultState() {
    return {
      version: 1,
      cards: {},          // 問題ID -> 学習カード(SRS情報 + 正誤回数)
      sessions: [],       // 直近のセッション結果
      daily: {},          // 'YYYY-MM-DD' -> {answered, correct}
      streak: { current: 0, best: 0, lastDate: null },
      settings: {
        theme: 'auto',
        shuffleChoices: true,
        instantFeedback: true
      },
      lastCondition: null // 「同じ条件でもう一度」用
    };
  }

  var state = null;

  function load() {
    var base = defaultState();
    try {
      var raw = global.localStorage.getItem(KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        // 既存データとデフォルトを浅くマージし、キー追加に耐えるようにする
        Object.keys(base).forEach(function (k) {
          if (saved[k] === undefined || saved[k] === null) return;
          if (k === 'settings') {
            Object.keys(base.settings).forEach(function (sk) {
              if (saved.settings && saved.settings[sk] !== undefined) base.settings[sk] = saved.settings[sk];
            });
          } else {
            base[k] = saved[k];
          }
        });
      }
    } catch (e) {
      console.warn('学習データの読込みに失敗しました。初期状態で開始します。', e);
    }
    state = base;
    return state;
  }

  function get() {
    if (!state) load();
    return state;
  }

  function save() {
    if (!state) return false;
    try {
      if (state.sessions.length > MAX_SESSIONS) {
        state.sessions = state.sessions.slice(-MAX_SESSIONS);
      }
      global.localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      console.warn('学習データの保存に失敗しました(容量超過の可能性があります)。', e);
      return false;
    }
  }

  function reset() {
    state = defaultState();
    try { global.localStorage.removeItem(KEY); } catch (e) { /* 何もしない */ }
    return state;
  }

  /** 問題1件の学習カードを取得(なければ生成) */
  function card(qid) {
    var s = get();
    if (!s.cards[qid]) {
      s.cards[qid] = {
        correct: 0, wrong: 0, streak: 0,
        ease: 2.5, interval: 0, due: null, lastAt: null
      };
    }
    return s.cards[qid];
  }

  function todayKey(d) {
    var t = d || new Date();
    return t.getFullYear() + '-' +
      String(t.getMonth() + 1).padStart(2, '0') + '-' +
      String(t.getDate()).padStart(2, '0');
  }

  /** 日別集計と連続学習日数を更新する */
  function recordDay(answered, correct) {
    var s = get();
    var key = todayKey();
    if (!s.daily[key]) s.daily[key] = { answered: 0, correct: 0 };
    s.daily[key].answered += answered;
    s.daily[key].correct += correct;

    var last = s.streak.lastDate;
    if (last !== key) {
      var yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      s.streak.current = (last === todayKey(yesterday)) ? s.streak.current + 1 : 1;
      s.streak.lastDate = key;
      if (s.streak.current > s.streak.best) s.streak.best = s.streak.current;
    }
  }

  /** 連続学習日数は、最終学習日が今日/昨日でなければ途切れているとみなす */
  function effectiveStreak() {
    var s = get();
    if (!s.streak.lastDate) return 0;
    var y = new Date(); y.setDate(y.getDate() - 1);
    if (s.streak.lastDate === todayKey() || s.streak.lastDate === todayKey(y)) return s.streak.current;
    return 0;
  }

  function exportJSON() {
    return JSON.stringify(get(), null, 2);
  }

  function importJSON(text) {
    var parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || !parsed.cards) {
      throw new Error('学習データの形式が正しくありません。');
    }
    var base = defaultState();
    Object.keys(base).forEach(function (k) {
      if (parsed[k] !== undefined && parsed[k] !== null) base[k] = parsed[k];
    });
    state = base;
    save();
    return state;
  }

  global.AppStorage = {
    load: load, get: get, save: save, reset: reset, card: card,
    recordDay: recordDay, effectiveStreak: effectiveStreak,
    todayKey: todayKey, exportJSON: exportJSON, importJSON: importJSON,
    STORAGE_KEY: KEY
  };
})(window);
