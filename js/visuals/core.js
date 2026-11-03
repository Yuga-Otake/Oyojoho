/**
 * visuals/core.js - 体感ビジュアルの登録と、部品づくりの共通ヘルパ
 *
 * 各ビジュアルは Visuals.register(id, { title, desc, mount(root) }) で登録する。
 * mount は root(空の div)に DOM を組み立てるだけでよい。外部ライブラリは使わない。
 */
(function (global) {
  'use strict';

  var doc = global.document;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var registry = {};
  var order = [];

  /** HTML 要素を作る。props の on* はイベント、style はオブジェクトまたは文字列 */
  function h(tag, props, kids) {
    var n = doc.createElement(tag);
    applyProps(n, props);
    appendKids(n, kids);
    return n;
  }

  /** SVG 要素を作る */
  function s(tag, attrs, kids) {
    var n = doc.createElementNS(SVGNS, tag);
    applyProps(n, attrs, true);
    appendKids(n, kids);
    return n;
  }

  function applyProps(n, props, isSvg) {
    if (!props) return;
    Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v === undefined || v === null || v === false) return;
      if (k.slice(0, 2) === 'on' && typeof v === 'function') {
        n.addEventListener(k.slice(2), v);
      } else if (k === 'text') {
        n.textContent = v;
      } else if (k === 'class') {
        if (isSvg) n.setAttribute('class', v); else n.className = v;
      } else if (k === 'style' && typeof v === 'object') {
        Object.keys(v).forEach(function (sk) { n.style.setProperty(sk, v[sk]); });
      } else if (!isSvg && (k === 'value' || k === 'checked' || k === 'disabled' || k === 'type')) {
        n[k] = v;
      } else {
        n.setAttribute(k, v === true ? '' : v);
      }
    });
  }

  function appendKids(n, kids) {
    if (kids === undefined || kids === null) return;
    if (!Array.isArray(kids)) kids = [kids];
    kids.forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      n.appendChild(typeof c === 'string' || typeof c === 'number' ? doc.createTextNode(String(c)) : c);
    });
  }

  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }

  /**
   * スライダ部品
   * opts: {label, min, max, step, value, fmt(v) -> 表示文字列, onInput(v)}
   */
  function slider(opts) {
    var valEl = h('span', { class: 'v-slider-val' });
    var input = h('input', { type: 'range', min: opts.min, max: opts.max, step: opts.step || 1, value: opts.value });
    var api = {
      get value() { return parseFloat(input.value); },
      set: function (v) { input.value = v; sync(); }
    };
    function sync() { valEl.textContent = opts.fmt ? opts.fmt(api.value) : String(api.value); }
    input.addEventListener('input', function () { sync(); if (opts.onInput) opts.onInput(api.value); });
    sync();
    api.el = h('label', { class: 'v-slider' }, [
      h('span', { class: 'v-slider-head' }, [h('span', { class: 'v-slider-label', text: opts.label }), valEl]),
      input
    ]);
    return api;
  }

  /**
   * 切替ボタン(セグメント)
   * items: [{value, label}] , onChange(value)
   */
  function segmented(items, value, onChange) {
    var cur = value;
    var wrap = h('div', { class: 'v-seg', role: 'group' });
    var btns = items.map(function (it) {
      var b = h('button', { type: 'button', class: 'v-seg-btn', text: it.label });
      b.addEventListener('click', function () { set(it.value); if (onChange) onChange(it.value); });
      wrap.appendChild(b);
      return { b: b, v: it.value };
    });
    function set(v) {
      cur = v;
      btns.forEach(function (x) { x.b.classList.toggle('is-on', x.v === v); x.b.setAttribute('aria-pressed', x.v === v ? 'true' : 'false'); });
    }
    set(value);
    return { el: wrap, get value() { return cur; }, set: set };
  }

  function button(label, onClick, cls) {
    return h('button', { type: 'button', class: 'v-btn' + (cls ? ' ' + cls : ''), text: label, onclick: onClick });
  }

  /** 数値を見やすく丸める */
  function fmt(v, digits) {
    var d = digits === undefined ? 2 : digits;
    if (!isFinite(v)) return '∞';
    var r = Math.round(v * Math.pow(10, d)) / Math.pow(10, d);
    return r.toLocaleString('ja-JP', { maximumFractionDigits: d });
  }

  /** 結果表示用の小さな「数値タイル」 */
  function metric(label, value, tone) {
    return h('div', { class: 'v-metric' + (tone ? ' ' + tone : '') }, [
      h('div', { class: 'v-metric-v', text: value }),
      h('div', { class: 'v-metric-l', text: label })
    ]);
  }

  function register(id, def) {
    if (!registry[id]) order.push(id);
    def.id = id;
    registry[id] = def;
  }

  /**
   * ビジュアルを container に描画する。
   * onTouch: 利用者が操作したときに一度だけ呼ばれる(学習記録用)
   */
  function mount(id, container, onTouch) {
    var def = registry[id];
    clear(container);
    if (!def) return false;
    var box = h('div', { class: 'v-box' });
    var head = h('div', { class: 'v-head' }, [
      h('span', { class: 'v-badge', text: '体感ビジュアル' }),
      h('span', { class: 'v-title', text: def.title })
    ]);
    box.appendChild(head);
    if (def.desc) box.appendChild(h('p', { class: 'v-desc', text: def.desc }));
    var body = h('div', { class: 'v-body' });
    box.appendChild(body);
    container.appendChild(box);
    try {
      def.mount(body);
    } catch (e) {
      body.appendChild(h('p', { class: 'v-note', text: 'ビジュアルの表示に失敗しました: ' + e.message }));
      if (global.console) global.console.error(e);
    }
    if (onTouch) {
      var fired = false;
      var fire = function () { if (!fired) { fired = true; onTouch(); } };
      body.addEventListener('input', fire);
      body.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('button, input, [data-touch]')) fire();
      });
    }
    return true;
  }

  global.Visuals = {
    register: register, mount: mount,
    has: function (id) { return !!registry[id]; },
    get: function (id) { return registry[id]; },
    list: function () { return order.map(function (id) { return registry[id]; }); },
    ui: { h: h, s: s, clear: clear, slider: slider, segmented: segmented, button: button, fmt: fmt, metric: metric }
  };
})(window);
