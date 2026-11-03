/**
 * textbook.js - 教科書・間違いノート・体感ラボ
 *
 * - 教科書: 分野ごとの章と節。問題・計算フローは field/topic で節に対応づける
 * - 間違いノート: 誤答した問題を節ごとにまとめ、「読む → 体感 → 解き直す」の3ステップで復習させる
 * - 体感ラボ: 体感ビジュアルだけを一覧から開く
 */
(function (global) {
  'use strict';

  var doc = global.document;
  var BOOK = global.TEXTBOOK || [];
  var QUESTIONS = global.QUESTION_BANK || [];
  var FLOWS = global.FLOW_BANK || [];
  var CASES = global.CASE_BANK || [];
  var CHOICE_LABELS = ['ア', 'イ', 'ウ', 'エ'];

  var ctx = {
    getState: function () { return global.AppStorage.get(); },
    startQuestions: function () {},
    startFlow: function () {},
    startCase: function () {},
    startDrill: function () {},
    canStart: function () { return true; },
    showScreen: function () {}
  };

  var view = 'toc';          // toc | notebook | lab | reader
  var readerSection = null;  // 教科書画面で開いている節
  var notebookFilter = 'open';
  var tocKeyword = '';
  var labVisual = null;

  /* ============ 索引 ============ */
  var sections = [];          // 全節(章の順)
  var sectionById = {};
  var byFieldTopic = {};
  var byTopic = {};

  BOOK.forEach(function (ch) {
    ch.sections.forEach(function (sec) {
      sec.chapter = ch;
      sec.index = sections.length;
      sections.push(sec);
      sectionById[sec.id] = sec;
      (sec.topics || []).forEach(function (t) {
        byFieldTopic[ch.field + '/' + t] = sec;
        if (!byTopic[t]) byTopic[t] = sec;
      });
    });
  });

  /** 問題(または計算フロー)に対応する節を返す */
  function sectionFor(item) {
    if (!item) return null;
    return byFieldTopic[item.field + '/' + item.topic] || byTopic[item.topic] ||
      (BOOK.filter(function (c) { return c.field === item.field; })[0] || { sections: [null] }).sections[0];
  }

  var questionsBySection = {};
  QUESTIONS.forEach(function (q) {
    var sec = sectionFor(q);
    if (!sec) return;
    (questionsBySection[sec.id] = questionsBySection[sec.id] || []).push(q);
  });
  var flowsBySection = {};
  FLOWS.forEach(function (f) {
    var sec = sectionFor(f);
    if (!sec) return;
    (flowsBySection[sec.id] = flowsBySection[sec.id] || []).push(f);
  });

  var casesBySection = {};
  CASES.forEach(function (c) {
    [c].concat(c.questions || []).forEach(function (q) {
      var sec = sectionFor(q.field ? q : c);
      if (!sec) return;
      var arr = casesBySection[sec.id] = casesBySection[sec.id] || [];
      if (arr.indexOf(c) < 0) arr.push(c);
    });
  });

  /** この節に対応する計算ドリルの型(DrillGen は後から読み込まれるので都度求める) */
  function drillsFor(sec) {
    if (!global.DrillGen || !global.DrillMode) return [];
    return global.DrillMode.types().filter(function (t) { return sectionFor(global.DrillMode.lessonItem(t)) === sec; });
  }

  /* ============ 汎用 ============ */
  function $(id) { return doc.getElementById(id); }
  function el(tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function btn(label, cls, onClick) {
    var b = el('button', 'btn ' + (cls || 'btn-secondary'), label);
    b.type = 'button';
    if (onClick) b.addEventListener('click', onClick);
    return b;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  /** **強調** と `コード` だけを解釈する簡易マークアップ */
  function rich(tag, cls, text) {
    var n = el(tag, cls);
    n.innerHTML = escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.+?)`/g, '<code>$1</code>');
    return n;
  }

  /* ============ 学習状況 ============ */
  function lessonRec(sid) {
    var st = ctx.getState();
    if (!st.lessons) st.lessons = {};
    if (!st.lessons[sid]) st.lessons[sid] = { readAt: null, visualAt: null };
    return st.lessons[sid];
  }

  /** 問題の状態: null(誤答なし) | 'open'(未克服) | 'reviewing'(復習中) | 'done'(克服) */
  function mistakeStatus(q) {
    var c = ctx.getState().cards[q.id];
    if (!c || !c.wrong) return null;
    if (c.streak === 0) return 'open';
    if (c.streak === 1) return 'reviewing';
    return 'done';
  }

  function sectionMistakes(sec) {
    return (questionsBySection[sec.id] || []).filter(function (q) { return mistakeStatus(q) !== null; });
  }

  function lastWrongAt(qs) {
    var st = ctx.getState();
    return qs.reduce(function (m, q) {
      var c = st.cards[q.id];
      return Math.max(m, (c && (c.lastWrongAt || c.lastAt)) || 0);
    }, 0);
  }

  /** 復習3ステップの達成状況 */
  function reviewProgress(sec) {
    var qs = sectionMistakes(sec).filter(function (q) { return mistakeStatus(q) !== 'done'; });
    var since = lastWrongAt(qs);
    var rec = lessonRec(sec.id);
    var read = !!rec.readAt && rec.readAt >= since;
    var visual = !sec.visual || (!!rec.visualAt && rec.visualAt >= since);
    var retried = qs.length > 0 && qs.every(function (q) { return mistakeStatus(q) !== 'open'; });
    return { open: qs, read: read, visual: visual, retried: retried, hasVisual: !!sec.visual };
  }

  function counts() {
    var r = { open: 0, reviewing: 0, done: 0 };
    QUESTIONS.forEach(function (q) { var s = mistakeStatus(q); if (s) r[s] += 1; });
    return r;
  }

  function save() { global.AppStorage.save(); }

  /* ============ 節の描画(画面・モーダル共通) ============ */
  /**
   * @param {object} sec 節
   * @param {Element} box 描画先
   * @param {object} opts {inModal, focusQid, chosenText}
   */
  function renderSection(sec, box, opts) {
    opts = opts || {};
    box.innerHTML = '';
    var ch = sec.chapter;
    var art = el('article', 'lesson');

    var crumb = el('div', 'lesson-crumb');
    crumb.appendChild(el('span', '', ch.icon + ' ' + ch.category + ' › ' + ch.title));
    art.appendChild(crumb);
    art.appendChild(el('h2', 'lesson-title', sec.title));
    if (sec.lead) art.appendChild(rich('p', 'lesson-lead', sec.lead));

    // ---- 間違えた問題 ----
    var mistakes = sectionMistakes(sec).filter(function (q) { return mistakeStatus(q) !== 'done' || q.id === opts.focusQid; });
    if (opts.focusQid) {
      mistakes.sort(function (a, b) { return (b.id === opts.focusQid) - (a.id === opts.focusQid); });
      if (!mistakes.some(function (q) { return q.id === opts.focusQid; })) {
        var fq = QUESTIONS.filter(function (q) { return q.id === opts.focusQid; })[0];
        if (fq) mistakes.unshift(fq);
      }
    }
    if (mistakes.length) {
      var mb = el('section', 'lesson-mistakes');
      mb.appendChild(el('h3', '', '✏️ あなたが間違えた問題(' + mistakes.length + ')'));
      mistakes.forEach(function (q) { mb.appendChild(mistakeItem(q, q.id === opts.focusQid, q.id === opts.focusQid ? opts.chosenText : null)); });
      art.appendChild(mb);
      art.appendChild(checklist(sec, opts));
    }

    // ---- 本文 ----
    (sec.body || []).forEach(function (p) { art.appendChild(rich('p', 'lesson-p', p)); });

    if (sec.table) art.appendChild(tableEl(sec.table));

    if (sec.formulas && sec.formulas.length) {
      var fb = el('section', 'lesson-formulas');
      fb.appendChild(el('h3', '', '📐 公式'));
      sec.formulas.forEach(function (f) {
        var row = el('div', 'lesson-formula');
        row.appendChild(el('div', 'name', f[0]));
        row.appendChild(el('div', 'expr', f[1]));
        fb.appendChild(row);
      });
      art.appendChild(fb);
    }

    if (sec.visual && global.Visuals && global.Visuals.has(sec.visual)) {
      var vbox = el('section', 'lesson-visual');
      vbox.id = 'lessonVisual-' + (opts.inModal ? 'm' : 's');
      global.Visuals.mount(sec.visual, vbox, function () {
        lessonRec(sec.id).visualAt = Date.now();
        save();
        refreshChecklist(art, sec, opts);
      });
      art.appendChild(vbox);
    }

    if (sec.points && sec.points.length) art.appendChild(listBox('lesson-points', '✅ 押さえどころ', sec.points));
    if (sec.traps && sec.traps.length) art.appendChild(listBox('lesson-traps', '⚠️ ひっかけ注意', sec.traps));

    if (sec.example) {
      var ex = el('section', 'lesson-example');
      ex.appendChild(el('h3', '', '📝 例題'));
      ex.appendChild(rich('p', 'q', sec.example.q));
      var d = el('details');
      d.appendChild(el('summary', '', '解き方を見る'));
      var ol = el('ol');
      (sec.example.steps || []).forEach(function (s) { ol.appendChild(rich('li', '', s)); });
      d.appendChild(ol);
      d.appendChild(rich('p', 'a', '答え: ' + sec.example.a));
      ex.appendChild(d);
      art.appendChild(ex);
    }

    // ---- 演習への導線 ----
    var qs = questionsBySection[sec.id] || [];
    var flows = flowsBySection[sec.id] || [];
    var cases = casesBySection[sec.id] || [];
    var drills = drillsFor(sec);
    if (qs.length || flows.length || cases.length || drills.length) {
      var pr = el('section', 'lesson-practice');
      pr.appendChild(el('h3', '', '🎯 この単元を解いて確かめる'));
      if (qs.length) {
        var dots = el('div', 'mastery-dots');
        qs.forEach(function (q) {
          var lv = global.SRS.masteryLevel(ctx.getState().cards[q.id]);
          var dot = el('span', 'mdot lv' + lv);
          dot.title = q.id + ': ' + ['未学習', '要復習', '1回正解', '2回連続正解', '定着'][lv];
          dots.appendChild(dot);
        });
        pr.appendChild(dots);
      }
      var row = el('div', 'btn-row');
      var can = ctx.canStart();
      if (qs.length) {
        var openIds = qs.filter(function (q) { return mistakeStatus(q) === 'open' || mistakeStatus(q) === 'reviewing'; }).map(function (q) { return q.id; });
        if (openIds.length) {
          row.appendChild(btn('🔁 間違えた問題を解き直す(' + openIds.length + '問)', 'btn-primary', function () { closeModal(); ctx.startQuestions(openIds); }));
        }
        row.appendChild(btn('この単元の問題を解く(' + qs.length + '問)', openIds.length ? 'btn-secondary' : 'btn-primary', function () {
          closeModal(); ctx.startQuestions(qs.map(function (q) { return q.id; }));
        }));
      }
      flows.forEach(function (f) {
        row.appendChild(btn('🧮 計算フロー: ' + f.title, 'btn-ghost', function () { closeModal(); ctx.startFlow(f.id); }));
      });
      cases.forEach(function (c) {
        row.appendChild(btn('📝 午後演習: ' + c.title, 'btn-ghost', function () { closeModal(); ctx.startCase(c.id); }));
      });
      drills.forEach(function (d) {
        row.appendChild(btn('🔢 計算ドリル: ' + d.title, 'btn-ghost', function () { closeModal(); ctx.startDrill(d.id); }));
      });
      if (!can) {
        Array.prototype.forEach.call(row.querySelectorAll('button'), function (b) { b.disabled = true; });
        pr.appendChild(el('p', 'hint', '出題中のため、ここからは開始できません。今の演習が終わったら解き直しましょう。'));
      }
      pr.appendChild(row);
      art.appendChild(pr);
    }

    // ---- 読了マーカー ----
    var end = el('div', 'lesson-end');
    var readBtn = btn(lessonRec(sec.id).readAt ? '✓ 読みました' : 'この節を読んだ', 'btn-ghost btn-sm', function () { markRead(sec, art, opts); });
    end.appendChild(readBtn);
    art.appendChild(end);
    observeEnd(end, function () { markRead(sec, art, opts); });

    // ---- 前後の節 ----
    if (!opts.inModal) {
      var nav = el('div', 'lesson-nav');
      var prev = sections[sec.index - 1], next = sections[sec.index + 1];
      if (prev) nav.appendChild(btn('← ' + prev.title, 'btn-ghost', function () { openSection(prev.id); }));
      else nav.appendChild(el('span'));
      if (next) nav.appendChild(btn(next.title + ' →', 'btn-ghost', function () { openSection(next.id); }));
      art.appendChild(nav);
    } else {
      var full = btn('教科書の画面で開く', 'btn-ghost btn-sm', function () {
        if (!ctx.canStart()) { closeModal(); return; }
        closeModal(); ctx.showScreen('textbook'); openSection(sec.id);
      });
      if (ctx.canStart()) art.appendChild(full);
    }

    box.appendChild(art);
  }

  function markRead(sec, art, opts) {
    var rec = lessonRec(sec.id);
    var first = !rec.readAt || rec.readAt < lastWrongAt(sectionMistakes(sec));
    rec.readAt = Date.now();
    save();
    var b = art.querySelector('.lesson-end .btn');
    if (b) b.textContent = '✓ 読みました';
    if (first) refreshChecklist(art, sec, opts);
  }

  function observeEnd(node, cb) {
    if (!('IntersectionObserver' in global)) return;
    var io = new global.IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { io.disconnect(); setTimeout(cb, 600); }
      });
    }, { threshold: 1 });
    // 開いた直後に画面内にあっても「読んだ」とみなさないよう、少し遅らせて監視を始める
    setTimeout(function () { if (doc.body.contains(node)) io.observe(node); }, 1500);
  }

  function mistakeItem(q, focus, chosenText) {
    var c = ctx.getState().cards[q.id] || {};
    var st = mistakeStatus(q);
    var d = el('details', 'mistake' + (focus ? ' focus' : ''));
    if (focus) d.open = true;
    var sum = el('summary');
    sum.appendChild(statusChip(st));
    sum.appendChild(el('span', 'mq', q.question));
    d.appendChild(sum);
    var body = el('div', 'mistake-body');
    var yours = chosenText || c.lastWrongChoice;
    if (yours) {
      var p1 = el('p', 'ans');
      p1.appendChild(el('span', 'k', 'あなたの解答'));
      p1.appendChild(el('span', 'your', yours));
      body.appendChild(p1);
    }
    var p2 = el('p', 'ans');
    p2.appendChild(el('span', 'k', '正解'));
    p2.appendChild(el('b', '', q.choices[q.answer]));
    body.appendChild(p2);
    body.appendChild(el('p', 'exp', q.explanation));
    var REASON_NAMES = { knowledge: '知識不足', calc: '計算ミス', misread: '問題文の読み違い', confuse: '用語の混同', careless: 'ケアレスミス' };
    if (c.wrong) body.appendChild(el('p', 'hint', '誤答 ' + c.wrong + '回 / 正解 ' + (c.correct || 0) + '回' +
      (c.lastReason && REASON_NAMES[c.lastReason] ? '  ・前回の理由: ' + REASON_NAMES[c.lastReason] : '')));
    d.appendChild(body);
    return d;
  }

  function statusChip(st) {
    var map = { open: ['未克服', 'open'], reviewing: ['復習中', 'reviewing'], done: ['克服', 'done'] };
    var m = map[st] || ['—', ''];
    return el('span', 'status-chip ' + m[1], m[0]);
  }

  function checklist(sec, opts) {
    var p = reviewProgress(sec);
    var box = el('div', 'review-steps');
    box.appendChild(el('div', 'review-steps-title', '復習の3ステップ'));
    var items = [
      [p.read, '① 下の解説を読む', '最後までスクロールすると完了'],
      [p.visual, '② 体感ビジュアルで確かめる', p.hasVisual ? '下の図を操作すると完了' : 'この節は図なし'],
      [p.retried, '③ 間違えた問題を解き直す', 'ページ下部のボタンから']
    ];
    items.forEach(function (it) {
      var row = el('div', 'review-step' + (it[0] ? ' done' : ''));
      row.appendChild(el('span', 'ck', it[0] ? '✓' : ''));
      row.appendChild(el('span', 'tx', it[1]));
      row.appendChild(el('span', 'sub', it[2]));
      box.appendChild(row);
    });
    if (opts && opts.inModal) box.classList.add('compact');
    return box;
  }

  function refreshChecklist(art, sec, opts) {
    var old = art.querySelector('.review-steps');
    if (old) old.parentNode.replaceChild(checklist(sec, opts), old);
  }

  function tableEl(t) {
    var wrap = el('div', 'lesson-table-wrap');
    var tb = el('table', 'lesson-table');
    var tr = el('tr');
    t.head.forEach(function (h) { tr.appendChild(rich('th', '', h)); });
    tb.appendChild(tr);
    t.rows.forEach(function (r) {
      var row = el('tr');
      r.forEach(function (c) { row.appendChild(rich('td', '', c)); });
      tb.appendChild(row);
    });
    wrap.appendChild(tb);
    return wrap;
  }

  function listBox(cls, title, items) {
    var b = el('section', cls);
    b.appendChild(el('h3', '', title));
    var ul = el('ul');
    items.forEach(function (x) { ul.appendChild(rich('li', '', x)); });
    b.appendChild(ul);
    return b;
  }

  /* ============ 教科書画面 ============ */
  function setView(v) {
    view = v;
    ['toc', 'notebook', 'lab', 'reader'].forEach(function (k) {
      $('tb-' + k).hidden = (k !== v);
    });
    Array.prototype.forEach.call(doc.querySelectorAll('#tbTabs .tb-tab'), function (b) {
      var on = b.dataset.view === v || (v === 'reader' && b.dataset.view === 'toc');
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  function renderScreen() {
    updateTabBadge();
    if (view === 'reader' && readerSection) { setView('reader'); return; }
    if (view === 'notebook') { renderNotebook(); setView('notebook'); return; }
    if (view === 'lab') { renderLab(); setView('lab'); return; }
    renderToc(); setView('toc');
  }

  function updateTabBadge() {
    var c = counts();
    var b = $('tbNoteBadge');
    if (!b) return;
    b.textContent = c.open + c.reviewing;
    b.hidden = (c.open + c.reviewing) === 0;
  }

  function openSection(sid, opts) {
    var sec = sectionById[sid];
    if (!sec) return;
    readerSection = sec;
    renderSection(sec, $('tb-reader'), opts || {});
    setView('reader');
    global.scrollTo(0, 0);
  }

  function sectionText(sec) {
    return [sec.title, sec.lead, (sec.body || []).join(' '), (sec.points || []).join(' '), (sec.traps || []).join(' '),
      (sec.topics || []).join(' '), sec.chapter.title,
      (sec.formulas || []).map(function (f) { return f.join(' '); }).join(' ')].join(' ').toLowerCase();
  }

  function renderToc() {
    var box = $('tbTocList');
    box.innerHTML = '';
    var kw = tocKeyword.trim().toLowerCase();
    var st = ctx.getState();

    // 全体の進み具合
    var readCount = sections.filter(function (s) { return st.lessons && st.lessons[s.id] && st.lessons[s.id].readAt; }).length;
    $('tbProgress').textContent = '読んだ節 ' + readCount + ' / ' + sections.length + '  ・  体感ビジュアル ' +
      sections.filter(function (s) { return s.visual; }).length + '種';

    var cats = [];
    BOOK.forEach(function (ch) { if (cats.indexOf(ch.category) < 0) cats.push(ch.category); });
    var hits = 0;
    cats.forEach(function (cat) {
      var chapters = BOOK.filter(function (ch) { return ch.category === cat; });
      var catBox = el('div', 'tb-cat');
      catBox.appendChild(el('h3', 'flow-cat', cat));
      var any = false;
      chapters.forEach(function (ch) {
        var secs = ch.sections.filter(function (s) { return !kw || sectionText(s).indexOf(kw) >= 0; });
        if (!secs.length) return;
        any = true; hits += secs.length;
        var card = el('div', 'card tb-chapter');
        var head = el('div', 'tb-chapter-head');
        head.appendChild(el('span', 'tb-icon', ch.icon));
        head.appendChild(el('span', 'tb-chapter-title', ch.title));
        var nRead = ch.sections.filter(function (s) { return st.lessons && st.lessons[s.id] && st.lessons[s.id].readAt; }).length;
        head.appendChild(el('span', 'tb-chapter-prog', nRead + ' / ' + ch.sections.length));
        card.appendChild(head);
        var ul = el('ul', 'tb-sections');
        secs.forEach(function (s) {
          var li = el('li');
          var b = el('button', 'tb-section');
          b.type = 'button';
          var read = st.lessons && st.lessons[s.id] && st.lessons[s.id].readAt;
          b.appendChild(el('span', 'tb-read' + (read ? ' on' : ''), read ? '✓' : ''));
          b.appendChild(el('span', 'tb-section-title', s.title));
          var meta = el('span', 'tb-meta');
          var open = sectionMistakes(s).filter(function (q) { return mistakeStatus(q) === 'open'; }).length;
          if (open) meta.appendChild(el('span', 'status-chip open', '未克服 ' + open));
          if (s.visual) meta.appendChild(el('span', 'tb-vis', '🎛 体感'));
          var nq = (questionsBySection[s.id] || []).length;
          if (nq) meta.appendChild(el('span', 'tb-nq', nq + '問'));
          b.appendChild(meta);
          b.addEventListener('click', function () { openSection(s.id); });
          li.appendChild(b);
          ul.appendChild(li);
        });
        card.appendChild(ul);
        catBox.appendChild(card);
      });
      if (any) box.appendChild(catBox);
    });
    if (!hits) box.appendChild(el('p', 'empty', '該当する節がありません。'));
  }

  /* ============ 間違いノート ============ */
  function renderNotebook() {
    var box = $('tbNotebookBody');
    box.innerHTML = '';
    var c = counts();
    updateTabBadge();

    var tiles = el('div', 'stat-grid');
    [[c.open, '未克服', 'open'], [c.reviewing, '復習中', 'reviewing'], [c.done, '克服した', 'done']].forEach(function (t) {
      var tile = el('div', 'stat-tile nb-tile ' + t[2]);
      tile.appendChild(el('div', 'v', t[0] + '問'));
      tile.appendChild(el('div', 'l', t[1]));
      tiles.appendChild(tile);
    });
    box.appendChild(tiles);

    if (c.open + c.reviewing + c.done === 0) {
      var empty = el('div', 'card nb-empty');
      empty.appendChild(el('h3', '', 'まだ間違えた問題はありません'));
      empty.appendChild(el('p', 'muted', '演習で間違えた問題は、ここに単元ごとに集まります。教科書で解説を読み、体感ビジュアルで確かめてから解き直すと、2回連続で正解した時点で「克服」になります。'));
      box.appendChild(empty);
      return;
    }

    var guide = el('p', 'muted nb-guide', '間違えた問題を単元ごとにまとめました。各単元で「① 解説を読む → ② 体感ビジュアルで確かめる → ③ 解き直す」の順に進めると効果的です。2回連続で正解すると「克服」になります。');
    box.appendChild(guide);

    var bar = el('div', 'nb-bar');
    var seg = el('div', 'chip-group');
    [['open', '未克服・復習中'], ['all', 'すべて(克服済みも)']].forEach(function (f) {
      var b = el('button', 'chip' + (notebookFilter === f[0] ? ' is-active' : ''), f[1]);
      b.type = 'button';
      b.addEventListener('click', function () { notebookFilter = f[0]; renderNotebook(); });
      seg.appendChild(b);
    });
    bar.appendChild(seg);
    var allOpen = QUESTIONS.filter(function (q) { var s = mistakeStatus(q); return s === 'open' || s === 'reviewing'; }).map(function (q) { return q.id; });
    if (allOpen.length) {
      var all = btn('🔁 未克服をまとめて解き直す(' + allOpen.length + '問)', 'btn-primary', function () { ctx.startQuestions(allOpen); });
      if (!ctx.canStart()) all.disabled = true;
      bar.appendChild(all);
    }
    box.appendChild(bar);

    var groups = sections.map(function (sec) {
      var ms = sectionMistakes(sec).filter(function (q) { return notebookFilter === 'all' || mistakeStatus(q) !== 'done'; });
      return { sec: sec, ms: ms, open: ms.filter(function (q) { return mistakeStatus(q) === 'open'; }).length };
    }).filter(function (g) { return g.ms.length; });
    groups.sort(function (a, b) { return b.open - a.open || a.sec.index - b.sec.index; });

    if (!groups.length) {
      box.appendChild(el('p', 'empty', '未克服の問題はありません。よく頑張りました!「すべて」で過去の間違いを見返せます。'));
      return;
    }

    groups.forEach(function (g) {
      var sec = g.sec;
      var card = el('div', 'card nb-card');
      var head = el('div', 'nb-head');
      var t = el('div', 'nb-title');
      t.appendChild(el('span', 'nb-chapter', sec.chapter.icon + ' ' + sec.chapter.title));
      t.appendChild(el('span', 'nb-sec', sec.title));
      head.appendChild(t);
      card.appendChild(head);

      var p = reviewProgress(sec);
      if (p.open.length) {
        var steps = el('div', 'nb-steps');
        [[p.read, '読む'], [p.visual, p.hasVisual ? '体感' : '体感(図なし)'], [p.retried, '解き直す']].forEach(function (s, i) {
          steps.appendChild(el('span', 'nb-step' + (s[0] ? ' done' : ''), (s[0] ? '✓ ' : (i + 1) + ' ') + s[1]));
        });
        card.appendChild(steps);
      }

      var list = el('div', 'nb-list');
      g.ms.forEach(function (q) { list.appendChild(mistakeItem(q, false)); });
      card.appendChild(list);

      var row = el('div', 'btn-row');
      row.appendChild(btn('📖 教科書で復習する', 'btn-primary', function () { openSection(sec.id); }));
      var ids = g.ms.filter(function (q) { return mistakeStatus(q) !== 'done'; }).map(function (q) { return q.id; });
      if (ids.length) {
        var rb = btn('🔁 解き直す(' + ids.length + '問)', 'btn-secondary', function () { ctx.startQuestions(ids); });
        if (!ctx.canStart()) rb.disabled = true;
        row.appendChild(rb);
      }
      card.appendChild(row);
      box.appendChild(card);
    });
  }

  /* ============ 体感ラボ ============ */
  function renderLab() {
    var box = $('tbLabBody');
    box.innerHTML = '';
    if (labVisual) {
      var sec = sections.filter(function (s) { return s.visual === labVisual; })[0];
      var top = el('div', 'btn-row');
      top.appendChild(btn('← ラボ一覧へ', 'btn-ghost', function () { labVisual = null; renderLab(); }));
      if (sec) top.appendChild(btn('📖 教科書「' + sec.title + '」を読む', 'btn-secondary', function () { openSection(sec.id); }));
      box.appendChild(top);
      var holder = el('div', 'lesson-visual');
      box.appendChild(holder);
      global.Visuals.mount(labVisual, holder, function () {
        if (sec) { lessonRec(sec.id).visualAt = Date.now(); save(); }
      });
      return;
    }
    var cats = {};
    var order = [];
    sections.forEach(function (s) {
      if (!s.visual || !global.Visuals.has(s.visual)) return;
      var key = s.chapter.category;
      if (!cats[key]) { cats[key] = []; order.push(key); }
      if (cats[key].some(function (x) { return x.visual === s.visual; })) return;
      cats[key].push(s);
    });
    order.forEach(function (cat) {
      box.appendChild(el('h3', 'flow-cat', cat));
      var grid = el('div', 'lab-grid');
      cats[cat].forEach(function (s) {
        var def = global.Visuals.get(s.visual);
        var b = el('button', 'lab-card');
        b.type = 'button';
        b.appendChild(el('span', 'lab-field', s.chapter.icon + ' ' + s.chapter.title));
        b.appendChild(el('span', 'lab-title', def.title));
        b.appendChild(el('span', 'lab-desc', def.desc || ''));
        var open = sectionMistakes(s).filter(function (q) { return mistakeStatus(q) === 'open'; }).length;
        if (open) b.appendChild(el('span', 'status-chip open', 'この単元で未克服 ' + open + '問'));
        b.addEventListener('click', function () { labVisual = s.visual; renderLab(); global.scrollTo(0, 0); });
        grid.appendChild(b);
      });
      box.appendChild(grid);
    });
  }

  /* ============ モーダル ============ */
  var lastFocus = null;
  function openModal(sid, opts) {
    var sec = sectionById[sid];
    if (!sec) return;
    lastFocus = doc.activeElement;
    var m = $('lessonModal');
    m.hidden = false;
    doc.body.classList.add('modal-open');
    renderSection(sec, $('lessonModalBody'), Object.assign({ inModal: true }, opts || {}));
    $('lessonModalBody').scrollTop = 0;
    $('lessonModalClose').focus();
  }
  function closeModal() {
    var m = $('lessonModal');
    if (!m || m.hidden) return;
    m.hidden = true;
    $('lessonModalBody').innerHTML = '';
    doc.body.classList.remove('modal-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    if (ctx.onModalClose) ctx.onModalClose();
  }
  function isModalOpen() { var m = $('lessonModal'); return !!m && !m.hidden; }

  /** 問題・フローに対応する「教科書で確認」ボタン */
  function lessonButton(item, label, opts) {
    var sec = sectionFor(item);
    if (!sec) return null;
    var b = el('button', 'btn btn-lesson btn-sm');
    b.type = 'button';
    b.appendChild(el('span', '', '📖 ' + (label || '教科書で確認')));
    b.appendChild(el('span', 'btn-lesson-sec', sec.title));
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      openModal(sec.id, Object.assign({ focusQid: item.choices ? item.id : null }, opts || {}));
    });
    return b;
  }

  /* ============ 初期化 ============ */
  function init(c) {
    Object.keys(c || {}).forEach(function (k) { ctx[k] = c[k]; });

    Array.prototype.forEach.call(doc.querySelectorAll('#tbTabs .tb-tab'), function (b) {
      b.addEventListener('click', function () {
        var v = b.dataset.view;
        if (v === 'toc') { readerSection = null; renderToc(); }
        if (v === 'notebook') renderNotebook();
        if (v === 'lab') { labVisual = null; renderLab(); }
        setView(v);
      });
    });
    $('tbSearch').addEventListener('input', function () { tocKeyword = this.value; renderToc(); });
    $('lessonModalClose').addEventListener('click', closeModal);
    $('lessonModal').addEventListener('click', function (e) { if (e.target.classList.contains('modal-backdrop')) closeModal(); });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isModalOpen()) { closeModal(); e.preventDefault(); }
    });
    updateTabBadge();
  }

  global.Textbook = {
    init: init,
    renderScreen: renderScreen,
    openSection: function (sid) { openSection(sid); },
    showNotebook: function () { view = 'notebook'; renderScreen(); },
    openModal: openModal,
    closeModal: closeModal,
    isModalOpen: isModalOpen,
    sectionFor: sectionFor,
    lessonButton: lessonButton,
    counts: counts,
    sections: sections,
    questionsBySection: questionsBySection
  };
})(window);
