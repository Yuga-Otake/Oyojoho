/**
 * exam.js - 試験(応用情報 / 情報処理安全確保支援士)の切替え
 *
 * 各データファイルは試験ごとのグローバル変数に登録しておき、ここで「いま選んでいる試験」の
 * データを共通名(QUESTION_BANK, FLOW_BANK, TEXTBOOK, GLOSSARY, CASE_BANK)に差し替える。
 * 画面側のモジュールはこの共通名だけを見るので、試験ごとの分岐をほとんど持たない。
 *
 * 試験の切替えは設定に保存してページを再読込みする(?exam=sc のように URL でも指定できる)。
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'ap-study-app:v1';

  var EXAMS = {
    ap: {
      id: 'ap',
      name: '応用情報技術者試験',
      short: '応用情報',
      badge: 'AP',
      appTitle: '応用情報 学習アプリ',
      heroLead: '午前の四択、計算ドリル、午後の記述式演習で対策します。間違えた問題は間隔反復と間違いノートで復習できます。',
      examNote: '試験は午前(四肢択一80問・150分)と午後(記述式)。午前・午後とも60点以上で合格です。',
      mock: { count: 20, minutes: 30, label: '本番形式で時間を計って挑戦。終了後にまとめて採点します。' },
      passLine: '午前試験の合格基準は60%です。',
      categories: ['テクノロジ系', 'マネジメント系', 'ストラテジ系'],
      // 午前の大分類ごとの出題数(合格予測の重み)
      weights: { 'テクノロジ系': 50, 'マネジメント系': 10, 'ストラテジ系': 20 },
      amLabel: '午前',
      pm: { label: '午後', note: '情報セキュリティ(必須)と、選択した4分野の計5問で採点', select: 4 },
      questions: global.QUESTION_BANK || [],
      flows: global.FLOW_BANK || [],
      textbook: global.TEXTBOOK || [],
      glossary: global.GLOSSARY || [],
      cases: global.AP_CASE_BANK || []
    },
    sc: {
      id: 'sc',
      name: '情報処理安全確保支援士試験',
      short: '支援士',
      badge: 'SC',
      appTitle: '支援士 学習アプリ',
      heroLead: '午前IIの四択と、午後の記述式事例演習で対策します。間違えた問題は間隔反復と間違いノートで復習できます。',
      examNote: '試験は午前I(30問)・午前II(25問・40分)・午後(記述式4問中2問選択・150分)。各60点以上で合格。応用情報に合格すると午前Iが2年間免除になります(午前Iは応用情報モードの範囲で対策できます)。',
      mock: { count: 25, minutes: 40, label: '午前IIと同じ25問・40分で挑戦。終了後にまとめて採点します。' },
      passLine: '午前IIの合格基準は60%です。',
      categories: ['セキュリティ技術', 'セキュリティ管理', '関連分野'],
      weights: { 'セキュリティ技術': 14, 'セキュリティ管理': 4, '関連分野': 7 },
      amLabel: '午前II',
      pm: { label: '午後', note: '4問中2問を選択して採点', select: 2 },
      questions: global.SC_QUESTION_BANK || [],
      flows: global.SC_FLOW_BANK || [],
      textbook: global.SC_TEXTBOOK || [],
      glossary: global.SC_GLOSSARY || [],
      cases: global.SC_CASE_BANK || []
    }
  };

  function readSaved() {
    try {
      var m = /[?&]exam=(ap|sc)\b/.exec(global.location.search || '');
      if (m) return m[1];
      var raw = global.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        if (s && s.settings && EXAMS[s.settings.exam]) return s.settings.exam;
      }
    } catch (e) { /* 何もしない */ }
    return 'ap';
  }

  var current = EXAMS[readSaved()];

  global.EXAMS = EXAMS;
  global.CURRENT_EXAM = current;
  global.QUESTION_BANK = current.questions;
  global.FLOW_BANK = current.flows;
  global.TEXTBOOK = current.textbook;
  global.GLOSSARY = current.glossary;
  global.CASE_BANK = current.cases;

  /** 試験を切り替えて再読込みする */
  global.switchExam = function (id) {
    if (!EXAMS[id] || id === current.id) return;
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      var s = raw ? JSON.parse(raw) : {};
      s.settings = s.settings || {};
      s.settings.exam = id;
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch (e) { /* 保存できなくても URL で切り替える */ }
    var url = global.location.pathname + '?exam=' + id;
    global.location.href = url;
  };
})(window);
