/**
 * flashcards.js - 用語・公式の暗記カード
 *
 * 用語集(GLOSSARY)の各項目をカードにし、表(用語)→ 裏(公式・説明)で覚える。
 * 「覚えた」「まだ」を記録し、まだのカードから優先して出す。
 */
(function (global) {
  'use strict';

  var doc = global.document;
  var EXAM = global.CURRENT_EXAM || { id: 'ap' };
  var deck = [], pos = 0, flipped = false, groupFilter = 'all';

  function $(id) { return doc.getElementById(id); }
  function el(tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function store() { var s = global.AppStorage.get(); if (!s.flash) s.flash = {}; return s.flash; }
  function key(it) { return EXAM.id + ':' + it.term; }

  function allCards() {
    var out = [];
    (global.GLOSSARY || []).forEach(function (g) {
      g.items.forEach(function (it) { out.push({ group: g.group, term: it.term, formula: it.formula, desc: it.desc }); });
    });
    return out;
  }

  function build() {
    var cards = allCards().filter(function (c) { return groupFilter === 'all' || c.group === groupFilter; });
    var s = store();
    var unknown = global.Quiz.shuffle(cards.filter(function (c) { return !(s[key(c)] && s[key(c)].known); }));
    var known = global.Quiz.shuffle(cards.filter(function (c) { return s[key(c)] && s[key(c)].known; }));
    deck = unknown.concat(known);
    pos = 0; flipped = false;
  }

  function render() {
    var box = $('flashBox');
    box.innerHTML = '';
    var cards = allCards();
    var s = store();
    var knownN = cards.filter(function (c) { return s[key(c)] && s[key(c)].known; }).length;

    var bar = el('div', 'flash-bar');
    var sel = el('select', 'flash-filter');
    [['all', 'すべての分類']].concat((global.GLOSSARY || []).map(function (g) { return [g.group, g.group]; })).forEach(function (o) {
      var opt = el('option', '', o[1]); opt.value = o[0]; if (o[0] === groupFilter) opt.selected = true; sel.appendChild(opt);
    });
    sel.addEventListener('change', function () { groupFilter = this.value; build(); render(); });
    bar.appendChild(sel);
    bar.appendChild(el('span', 'flash-prog', '覚えた ' + knownN + ' / ' + cards.length + ' 枚'));
    box.appendChild(bar);

    if (!deck.length) { box.appendChild(el('p', 'empty', 'カードがありません。')); return; }
    if (pos >= deck.length) {
      var done = el('div', 'card flash-done');
      done.appendChild(el('h3', '', '1周しました'));
      done.appendChild(el('p', 'muted', '「まだ」にしたカードから順に、もう一度出題します。'));
      var again = el('button', 'btn btn-primary', 'もう1周する');
      again.type = 'button';
      again.addEventListener('click', function () { build(); render(); });
      done.appendChild(again);
      box.appendChild(done);
      return;
    }
    var c = deck[pos];
    var card = el('button', 'flash-card' + (flipped ? ' flipped' : ''));
    card.type = 'button';
    card.setAttribute('aria-label', flipped ? '裏面(クリックで表に戻す)' : '表面(クリックで答えを見る)');
    card.appendChild(el('span', 'flash-group', c.group + '  ' + (pos + 1) + ' / ' + deck.length));
    card.appendChild(el('span', 'flash-term', c.term));
    if (flipped) {
      if (c.formula) card.appendChild(el('span', 'flash-formula', c.formula));
      card.appendChild(el('span', 'flash-desc', c.desc));
    } else {
      card.appendChild(el('span', 'flash-hint', 'タップして答えを見る(Space)'));
    }
    card.addEventListener('click', function () { flipped = !flipped; render(); });
    box.appendChild(card);

    var row = el('div', 'flash-actions');
    var no = el('button', 'btn btn-secondary', 'まだ(←)');
    no.type = 'button';
    no.addEventListener('click', function () { mark(false); });
    var yes = el('button', 'btn btn-primary', '覚えた(→)');
    yes.type = 'button';
    yes.addEventListener('click', function () { mark(true); });
    row.appendChild(no); row.appendChild(yes);
    box.appendChild(row);
  }

  function mark(known) {
    var c = deck[pos];
    if (!c) return;
    var s = store();
    var r = s[key(c)] || { known: false, seen: 0 };
    r.known = known; r.seen += 1; r.lastAt = Date.now();
    s[key(c)] = r;
    global.AppStorage.save();
    pos += 1; flipped = false;
    render();
  }

  function isOpen() { var b = $('flashBox'); return b && !b.hidden && $('screen-glossary').classList.contains('is-active'); }

  function init() {
    doc.addEventListener('keydown', function (e) {
      if (!isOpen() || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
      if (e.key === ' ') { flipped = !flipped; render(); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { mark(true); e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { mark(false); e.preventDefault(); }
    });
  }

  global.Flashcards = {
    init: init,
    open: function () { build(); render(); },
    knownCount: function () { var s = store(); return allCards().filter(function (c) { return s[key(c)] && s[key(c)].known; }).length; },
    total: function () { return allCards().length; }
  };
})(window);
