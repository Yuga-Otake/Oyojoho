/**
 * visuals/basics.js - 基礎理論・アルゴリズムの体感ビジュアル
 */
(function (global) {
  'use strict';

  var V = global.Visuals;
  var ui = V.ui, h = ui.h, s = ui.s, clear = ui.clear, fmt = ui.fmt, metric = ui.metric;

  /* ------------------------------------------------------------------
   * 2の補数ビット
   * ------------------------------------------------------------------ */
  V.register('bits', {
    title: '8ビットをさわって2の補数を確かめる',
    desc: 'ビットをクリックして 0/1 を切り替えると、同じビット列が「符号なし」「2の補数」でどう読まれるかが変わります。',
    mount: function (root) {
      var bits = [0, 0, 0, 0, 0, 1, 1, 0];
      var row = h('div', { class: 'v-bits' });
      var out = h('div', { class: 'v-metrics' });
      var log = h('p', { class: 'v-note' });
      function val() { return bits.reduce(function (a, b) { return a * 2 + b; }, 0); }
      function setVal(v, msg) {
        v = ((v % 256) + 256) % 256;
        for (var i = 7; i >= 0; i--) { bits[i] = v & 1; v >>= 1; }
        log.textContent = msg || '';
        render();
      }
      function render() {
        clear(row);
        bits.forEach(function (b, i) {
          var w = Math.pow(2, 7 - i);
          var cell = h('button', {
            type: 'button', class: 'v-bit' + (b ? ' on' : '') + (i === 0 ? ' sign' : ''),
            'aria-label': '第' + (7 - i) + 'ビット', onclick: function () { bits[i] = 1 - bits[i]; log.textContent = ''; render(); }
          }, [h('span', { class: 'v-bit-v', text: String(b) }), h('span', { class: 'v-bit-w', text: i === 0 ? '−128' : String(w) })]);
          row.appendChild(cell);
        });
        var u = val();
        var signed = u >= 128 ? u - 256 : u;
        clear(out);
        out.appendChild(metric('2進数', bits.slice(0, 4).join('') + ' ' + bits.slice(4).join('')));
        out.appendChild(metric('16進数', u.toString(16).toUpperCase().padStart(2, '0')));
        out.appendChild(metric('符号なし整数', String(u)));
        out.appendChild(metric('2の補数として', (signed > 0 ? '+' : '') + signed, signed < 0 ? 'neg' : ''));
      }
      root.appendChild(row);
      root.appendChild(h('p', { class: 'v-caption', text: '最上位ビット(赤枠)は2の補数では「−128」の重みをもつ。だから1が立つと負になる。' }));
      root.appendChild(h('div', { class: 'v-row' }, [
        ui.button('ビット反転', function () { setVal(255 - val(), '反転しただけ(1の補数)。まだ符号反転にはなっていない。'); }),
        ui.button('+1', function () { setVal(val() + 1, '1を足した。'); }),
        ui.button('2の補数をとる(反転+1)', function () {
          var before = val() >= 128 ? val() - 256 : val();
          setVal(256 - val(), before + ' の符号を反転 → ' + (-before === 128 ? '−128(範囲外のため −128 のまま)' : String(-before)));
        }, 'primary'),
        ui.button('左シフト(×2)', function () { setVal(val() << 1, '左に1ビットずらすと2倍(あふれたビットは消える)。'); }),
        ui.button('算術右シフト(÷2)', function () { var sgn = bits[0]; setVal((val() >> 1) | (sgn << 7), '符号ビットを保ったまま右へ。負の数も ÷2 になる。'); }),
        ui.button('−1 にする', function () { setVal(255, '−1 は全ビット 1。'); })
      ]));
      root.appendChild(out);
      root.appendChild(log);
      render();
    }
  });

  /* ------------------------------------------------------------------
   * 論理ゲートと半加算器
   * ------------------------------------------------------------------ */
  V.register('logic', {
    title: '論理ゲートと半加算器のスイッチ',
    desc: '入力 A・B のスイッチを切り替えると、各ゲートの出力ランプと真理値表の該当行が光ります。',
    mount: function (root) {
      var A = 0, B = 0;
      var gates = [
        ['AND', function (a, b) { return a & b; }],
        ['OR', function (a, b) { return a | b; }],
        ['XOR', function (a, b) { return a ^ b; }],
        ['NAND', function (a, b) { return 1 - (a & b); }],
        ['NOR', function (a, b) { return 1 - (a | b); }]
      ];
      var sw = h('div', { class: 'v-row' });
      var lamps = h('div', { class: 'v-lamps' });
      var table = h('table', { class: 'v-table' });
      var adder = h('div', { class: 'v-adder' });
      function swBtn(name, get, set) {
        return h('button', { type: 'button', class: 'v-switch' + (get() ? ' on' : ''), onclick: function () { set(1 - get()); render(); } },
          [h('span', { text: name + ' = ' }), h('b', { text: String(get()) })]);
      }
      function render() {
        clear(sw);
        sw.appendChild(swBtn('A', function () { return A; }, function (v) { A = v; }));
        sw.appendChild(swBtn('B', function () { return B; }, function (v) { B = v; }));
        clear(lamps);
        gates.forEach(function (g) {
          var o = g[1](A, B);
          lamps.appendChild(h('div', { class: 'v-lamp' + (o ? ' on' : '') }, [h('i'), h('span', { text: g[0] + ' → ' + o })]));
        });
        clear(table);
        table.appendChild(h('tr', null, [h('th', { text: 'A' }), h('th', { text: 'B' })].concat(gates.map(function (g) { return h('th', { text: g[0] }); }))));
        [[0, 0], [0, 1], [1, 0], [1, 1]].forEach(function (r) {
          var cur = r[0] === A && r[1] === B;
          table.appendChild(h('tr', { class: cur ? 'hl' : '' }, [h('td', { text: r[0] }), h('td', { text: r[1] })].concat(
            gates.map(function (g) { return h('td', { text: g[1](r[0], r[1]) }); }))));
        });
        clear(adder);
        adder.appendChild(h('div', { class: 'v-adder-title', text: '半加算器(A + B)' }));
        adder.appendChild(h('div', { class: 'v-adder-row' }, [
          h('span', { text: 'A + B = ' + (A + B) + '(2進で ' + (A & B) + (A ^ B) + ')' })
        ]));
        adder.appendChild(h('div', { class: 'v-lamps' }, [
          h('div', { class: 'v-lamp' + ((A ^ B) ? ' on' : '') }, [h('i'), h('span', { text: '和 S = A XOR B = ' + (A ^ B) })]),
          h('div', { class: 'v-lamp' + ((A & B) ? ' on' : '') }, [h('i'), h('span', { text: '桁上げ C = A AND B = ' + (A & B) })])
        ]));
      }
      root.appendChild(sw);
      root.appendChild(lamps);
      root.appendChild(h('div', { class: 'v-scroll' }, table));
      root.appendChild(adder);
      render();
    }
  });

  /* ------------------------------------------------------------------
   * ハフマン符号の木を作る
   * ------------------------------------------------------------------ */
  V.register('huffman', {
    title: 'ハフマン木を1手ずつ組み立てる',
    desc: '「最小の2つを併合」ボタンを押すたびに、確率の最も小さい2つがまとまります。出現確率を変えて、平均符号長の変化を確かめましょう。',
    mount: function (root) {
      var syms = [['A', 50], ['B', 25], ['C', 12.5], ['D', 12.5]];
      var nodes, steps;
      var inputs = h('div', { class: 'v-row' });
      var pool = h('div', { class: 'v-pool' });
      var logEl = h('ol', { class: 'v-log' });
      var result = h('div');
      function reset() {
        nodes = syms.map(function (x) { return { label: x[0], p: x[1], syms: [x[0]] }; });
        steps = 0;
        clear(logEl);
        render();
      }
      function mergeOnce() {
        if (nodes.length < 2) return;
        nodes.sort(function (a, b) { return a.p - b.p; });
        var a = nodes.shift(), b = nodes.shift();
        var n = { label: '(' + a.label + '+' + b.label + ')', p: a.p + b.p, left: a, right: b, syms: a.syms.concat(b.syms) };
        nodes.push(n);
        steps += 1;
        logEl.appendChild(h('li', { text: a.label + '(' + fmt(a.p) + '%) と ' + b.label + '(' + fmt(b.p) + '%) を併合 → ' + fmt(n.p) + '%' }));
        render();
      }
      function codes(node, prefix, outMap) {
        if (!node.left) { outMap[node.label] = prefix || '0'; return; }
        codes(node.left, prefix + '0', outMap);
        codes(node.right, prefix + '1', outMap);
      }
      function render() {
        clear(pool);
        nodes.slice().sort(function (a, b) { return a.p - b.p; }).forEach(function (n, i) {
          pool.appendChild(h('span', { class: 'v-chip' + (i < 2 && nodes.length > 1 ? ' hot' : ''), text: n.label + ' ' + fmt(n.p) + '%' }));
        });
        clear(result);
        if (nodes.length === 1) {
          var map = {};
          codes(nodes[0], '', map);
          var total = syms.reduce(function (a, x) { return a + x[1]; }, 0);
          var avg = 0;
          var t = h('table', { class: 'v-table' }, h('tr', null, [h('th', { text: '記号' }), h('th', { text: '確率' }), h('th', { text: '符号' }), h('th', { text: '符号長' }), h('th', { text: '確率×符号長' })]));
          syms.forEach(function (x) {
            var p = x[1] / total, c = map[x[0]];
            avg += p * c.length;
            t.appendChild(h('tr', null, [h('td', { text: x[0] }), h('td', { text: fmt(p, 3) }), h('td', { class: 'mono', text: c }), h('td', { text: c.length }), h('td', { text: fmt(p * c.length, 3) })]));
          });
          var fixed = Math.ceil(Math.log2(syms.length));
          result.appendChild(h('div', { class: 'v-scroll' }, t));
          result.appendChild(h('div', { class: 'v-metrics' }, [
            metric('平均符号長', fmt(avg, 3) + ' ビット', 'good'),
            metric('等長符号なら', fixed + ' ビット'),
            metric('削減率', fmt((1 - avg / fixed) * 100, 1) + '%')
          ]));
        }
      }
      syms.forEach(function (x, i) {
        var inp = h('input', { type: 'number', min: 1, max: 100, step: 0.5, value: x[1], class: 'v-num', 'aria-label': x[0] + ' の出現確率' });
        inp.addEventListener('change', function () { syms[i][1] = Math.max(0.5, parseFloat(inp.value) || 1); reset(); });
        inputs.appendChild(h('label', { class: 'v-inline' }, [h('span', { text: x[0] }), inp, h('span', { text: '%' })]));
      });
      root.appendChild(inputs);
      root.appendChild(h('div', { class: 'v-row' }, [ui.button('最小の2つを併合', mergeOnce, 'primary'), ui.button('最初から', reset)]));
      root.appendChild(pool);
      root.appendChild(logEl);
      root.appendChild(result);
      reset();
    }
  });

  /* ------------------------------------------------------------------
   * 待ち行列 M/M/1
   * ------------------------------------------------------------------ */
  V.register('queue', {
    title: '利用率と待ち時間の「爆発」',
    desc: '利用率 ρ を右に動かしてみてください。0.7 を超えたあたりから待ち時間が急に跳ね上がります。',
    mount: function (root) {
      var W = 320, H = 180, P = 30;
      var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'v-svg', role: 'img', 'aria-label': '利用率と平均待ち時間のグラフ' });
      var metrics = h('div', { class: 'v-metrics' });
      var lineQ = h('div', { class: 'v-people' });
      var rho = ui.slider({ label: '利用率 ρ', min: 0.05, max: 0.95, step: 0.01, value: 0.5, fmt: function (v) { return v.toFixed(2); }, onInput: render });
      var ts = ui.slider({ label: '平均サービス時間 Ts', min: 0.1, max: 2, step: 0.1, value: 0.5, fmt: function (v) { return v.toFixed(1) + ' 秒'; }, onInput: render });
      var yMax = 19;
      function x(r) { return P + r * (W - P - 10); }
      function y(v) { return H - P - Math.min(v, yMax) / yMax * (H - P - 10); }
      function render() {
        clear(svg);
        svg.appendChild(s('line', { x1: P, y1: H - P, x2: W - 10, y2: H - P, class: 'v-axis' }));
        svg.appendChild(s('line', { x1: P, y1: 10, x2: P, y2: H - P, class: 'v-axis' }));
        [0, 0.5, 1].forEach(function (r) { svg.appendChild(s('text', { x: x(r), y: H - P + 16, class: 'v-tick', 'text-anchor': 'middle', text: String(r) })); });
        [0, 5, 10, 15].forEach(function (v) { svg.appendChild(s('text', { x: P - 5, y: y(v) + 4, class: 'v-tick', 'text-anchor': 'end', text: v + '倍' })); });
        svg.appendChild(s('text', { x: W - 12, y: H - P - 6, class: 'v-tick', 'text-anchor': 'end', text: 'ρ' }));
        var d = '';
        for (var r = 0; r <= 0.95; r += 0.01) d += (d ? 'L' : 'M') + x(r).toFixed(1) + ',' + y(r / (1 - r)).toFixed(1);
        svg.appendChild(s('path', { d: d, class: 'v-line' }));
        var cur = rho.value, k = cur / (1 - cur);
        svg.appendChild(s('line', { x1: x(cur), y1: y(k), x2: x(cur), y2: H - P, class: 'v-guide' }));
        svg.appendChild(s('circle', { cx: x(cur), cy: y(k), r: 5, class: 'v-dot' }));
        var tw = k * ts.value;
        clear(metrics);
        metrics.appendChild(metric('ρ / (1 − ρ)', fmt(k, 2) + ' 倍'));
        metrics.appendChild(metric('平均待ち時間 Tw', fmt(tw, 2) + ' 秒', k > 4 ? 'neg' : ''));
        metrics.appendChild(metric('平均応答時間 Tw+Ts', fmt(tw + ts.value, 2) + ' 秒'));
        metrics.appendChild(metric('平均待ち人数', fmt(cur * cur / (1 - cur), 2) + ' 人'));
        clear(lineQ);
        var n = Math.min(30, Math.round(cur * cur / (1 - cur)));
        lineQ.appendChild(h('span', { class: 'v-server', text: '窓口' }));
        for (var i = 0; i < n; i++) lineQ.appendChild(h('span', { class: 'v-person' }));
        if (n === 0) lineQ.appendChild(h('span', { class: 'v-muted', text: '(ほぼ待ちなし)' }));
      }
      root.appendChild(rho.el);
      root.appendChild(ts.el);
      root.appendChild(svg);
      root.appendChild(lineQ);
      root.appendChild(metrics);
      render();
    }
  });

  /* ------------------------------------------------------------------
   * パリティで誤りを検出
   * ------------------------------------------------------------------ */
  V.register('parity', {
    title: '偶数パリティで誤りを見つける',
    desc: '受信側のビットをクリックすると、通信路でビットが化けたことになります。1ビットなら検出、2ビットだと…?',
    mount: function (root) {
      var data = [1, 0, 1, 1, 0, 0, 1];
      var flips = [0, 0, 0, 0, 0, 0, 0, 0];
      var sendRow = h('div', { class: 'v-bits small' });
      var recvRow = h('div', { class: 'v-bits small' });
      var verdict = h('div', { class: 'v-verdict' });
      function parity(arr) { return arr.reduce(function (a, b) { return a ^ b; }, 0); }
      function render() {
        var sent = data.concat([parity(data)]);
        clear(sendRow);
        sent.forEach(function (b, i) {
          sendRow.appendChild(h('button', {
            type: 'button', class: 'v-bit' + (b ? ' on' : '') + (i === 7 ? ' parity' : ''),
            onclick: i === 7 ? null : function () { data[i] = 1 - data[i]; flips = flips.map(function () { return 0; }); render(); }
          }, [h('span', { class: 'v-bit-v', text: String(b) }), h('span', { class: 'v-bit-w', text: i === 7 ? 'P' : 'd' + (i + 1) })]));
        });
        var recv = sent.map(function (b, i) { return b ^ flips[i]; });
        clear(recvRow);
        recv.forEach(function (b, i) {
          recvRow.appendChild(h('button', {
            type: 'button', class: 'v-bit' + (b ? ' on' : '') + (flips[i] ? ' err' : '') + (i === 7 ? ' parity' : ''),
            onclick: function () { flips[i] = 1 - flips[i]; render(); }
          }, [h('span', { class: 'v-bit-v', text: String(b) }), h('span', { class: 'v-bit-w', text: flips[i] ? '化け' : '' })]));
        });
        var ones = recv.reduce(function (a, b) { return a + b; }, 0);
        var nerr = flips.reduce(function (a, b) { return a + b; }, 0);
        var detected = ones % 2 === 1;
        verdict.className = 'v-verdict ' + (nerr === 0 ? 'ok' : (detected ? 'warn' : 'ng'));
        verdict.textContent = '受信データの1の個数 = ' + ones + '(' + (ones % 2 ? '奇数' : '偶数') + ') → ' +
          (nerr === 0 ? '誤りなし。正しく受信できた。'
            : detected ? nerr + 'ビットの誤りを検出!ただし、どのビットかはわからないので訂正はできない。'
              : nerr + 'ビットが化けているのに検出できない(偶数個の誤りは見逃す)。');
      }
      root.appendChild(h('div', { class: 'v-label', text: '送信側(データ7ビット + パリティ P)' }));
      root.appendChild(sendRow);
      root.appendChild(h('div', { class: 'v-label', text: '受信側(クリックでビット化け)' }));
      root.appendChild(recvRow);
      root.appendChild(verdict);
      root.appendChild(h('div', { class: 'v-row' }, ui.button('ビット化けをなくす', function () { flips = flips.map(function () { return 0; }); render(); })));
      render();
    }
  });

  /* ------------------------------------------------------------------
   * 標本化と量子化
   * ------------------------------------------------------------------ */
  V.register('sampling', {
    title: '標本化周波数と量子化ビット数',
    desc: '3Hz の波を標本化します。標本化周波数を 6Hz 以下にすると、点をつないだ波が元の波と別物(エイリアス)になります。',
    mount: function (root) {
      var W = 340, H = 170, f = 3;
      var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'v-svg', role: 'img', 'aria-label': '標本化のグラフ' });
      var fs = ui.slider({ label: '標本化周波数 fs', min: 2, max: 40, step: 1, value: 20, fmt: function (v) { return v + ' Hz'; }, onInput: render });
      var bits = ui.slider({ label: '量子化ビット数', min: 1, max: 6, step: 1, value: 3, fmt: function (v) { return v + ' ビット(' + Math.pow(2, v) + '段階)'; }, onInput: render });
      var verdict = h('div', { class: 'v-verdict' });
      function X(t) { return 10 + t * (W - 20); }
      function Y(v) { return H / 2 - v * (H / 2 - 12); }
      function render() {
        clear(svg);
        svg.appendChild(s('line', { x1: 10, y1: H / 2, x2: W - 10, y2: H / 2, class: 'v-axis' }));
        var d = '';
        for (var i = 0; i <= 300; i++) { var t = i / 300; d += (i ? 'L' : 'M') + X(t).toFixed(1) + ',' + Y(Math.sin(2 * Math.PI * f * t)).toFixed(1); }
        svg.appendChild(s('path', { d: d, class: 'v-line faint' }));
        var levels = Math.pow(2, bits.value);
        var q = function (v) { var k = Math.round((v + 1) / 2 * (levels - 1)); return k / (levels - 1) * 2 - 1; };
        var pts = [];
        for (var n = 0; n / fs.value <= 1 + 1e-9; n++) {
          var tt = n / fs.value;
          pts.push([tt, q(Math.sin(2 * Math.PI * f * tt))]);
        }
        var stair = '';
        pts.forEach(function (p, i) {
          stair += (i ? 'L' + X(p[0]).toFixed(1) + ',' + Y(pts[i - 1][1]).toFixed(1) : 'M' + X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)) + 'L' + X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1);
        });
        svg.appendChild(s('path', { d: stair, class: 'v-line warn' }));
        pts.forEach(function (p) { svg.appendChild(s('circle', { cx: X(p[0]), cy: Y(p[1]), r: 3, class: 'v-dot' })); });
        var ok = fs.value > 2 * f;
        verdict.className = 'v-verdict ' + (ok ? 'ok' : 'ng');
        verdict.textContent = 'fs = ' + fs.value + 'Hz、最高周波数の2倍 = ' + (2 * f) + 'Hz → ' +
          (ok ? '標本化定理を満たす。点から元の波を復元できる。' : '2倍以下なので、元の 3Hz の波を正しく復元できない。');
      }
      root.appendChild(fs.el);
      root.appendChild(bits.el);
      root.appendChild(svg);
      root.appendChild(h('p', { class: 'v-caption', text: '灰色 = 元のアナログ波、点 = 標本、オレンジの階段 = 量子化後のディジタル値' }));
      root.appendChild(verdict);
      render();
    }
  });

  /* ------------------------------------------------------------------
   * ベイズ(1000個の製品で数える)
   * ------------------------------------------------------------------ */
  V.register('bayes', {
    title: '1000個の製品で数えるベイズの定理',
    desc: '1マス = 製品1個。不良率や検査の精度を動かすと、「不良と判定されたもの」の中身が変わります。',
    mount: function (root) {
      var prev = ui.slider({ label: '不良率', min: 1, max: 30, step: 1, value: 5, fmt: function (v) { return v + '%'; }, onInput: render });
      var sens = ui.slider({ label: '不良を「不良」と判定する確率', min: 50, max: 100, step: 1, value: 90, fmt: function (v) { return v + '%'; }, onInput: render });
      var fp = ui.slider({ label: '良品を誤って「不良」と判定する確率', min: 0, max: 30, step: 1, value: 5, fmt: function (v) { return v + '%'; }, onInput: render });
      var W = 400, cols = 40, cell = 10;
      var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + (25 * cell), class: 'v-svg', role: 'img', 'aria-label': '1000個の製品の内訳' });
      var legend = h('div', { class: 'v-legend' });
      var metrics = h('div', { class: 'v-metrics' });
      function render() {
        var bad = Math.round(1000 * prev.value / 100);
        var tp = Math.round(bad * sens.value / 100);
        var fpos = Math.round((1000 - bad) * fp.value / 100);
        clear(svg);
        for (var i = 0; i < 1000; i++) {
          var cls;
          if (i < tp) cls = 'tp'; else if (i < bad) cls = 'fn'; else if (i < bad + fpos) cls = 'fp'; else cls = 'tn';
          svg.appendChild(s('rect', { x: (i % cols) * cell + 1, y: Math.floor(i / cols) * cell + 1, width: cell - 2, height: cell - 2, rx: 2, class: 'v-cell ' + cls }));
        }
        clear(legend);
        [['tp', '不良で「不良」判定 ' + tp], ['fn', '不良なのに見逃し ' + (bad - tp)], ['fp', '良品なのに「不良」判定 ' + fpos], ['tn', '良品で「良」判定 ' + (1000 - bad - fpos)]].forEach(function (l) {
          legend.appendChild(h('span', null, [h('i', { class: 'v-cell ' + l[0] }), l[1]]));
        });
        clear(metrics);
        var p = tp + fpos ? tp / (tp + fpos) : 0;
        metrics.appendChild(metric('「不良」と判定された数', (tp + fpos) + ' 個'));
        metrics.appendChild(metric('そのうち本当に不良', tp + ' 個'));
        metrics.appendChild(metric('P(不良 | 不良判定)', fmt(p * 100, 1) + '%', p < 0.5 ? 'neg' : 'good'));
      }
      root.appendChild(prev.el); root.appendChild(sens.el); root.appendChild(fp.el);
      root.appendChild(svg); root.appendChild(legend); root.appendChild(metrics);
      render();
    }
  });

  /* ------------------------------------------------------------------
   * 有限オートマトン
   * ------------------------------------------------------------------ */
  V.register('dfa', {
    title: 'オートマトンに文字を読ませる',
    desc: '0 と 1 のボタンで1文字ずつ入力します。読み終えたときに二重丸(受理状態)にいれば受理です。',
    mount: function (root) {
      var machines = {
        end1: { name: '(0|1)*1 … 1で終わる', start: 'q0', accept: ['q1'], states: ['q0', 'q1'],
          delta: { q0: { 0: 'q0', 1: 'q1' }, q1: { 0: 'q0', 1: 'q1' } } },
        even1: { name: '1の個数が偶数', start: 'E', accept: ['E'], states: ['E', 'O'],
          delta: { E: { 0: 'E', 1: 'O' }, O: { 0: 'O', 1: 'E' } } }
      };
      var key = 'end1', input = '', state;
      var svg = s('svg', { viewBox: '0 0 320 130', class: 'v-svg', role: 'img', 'aria-label': '状態遷移図' });
      var tape = h('div', { class: 'v-tape' });
      var verdict = h('div', { class: 'v-verdict' });
      var seg = ui.segmented([{ value: 'end1', label: machines.end1.name }, { value: 'even1', label: machines.even1.name }], key, function (v) { key = v; input = ''; run(); });
      function run() {
        var m = machines[key];
        state = m.start;
        for (var i = 0; i < input.length; i++) state = m.delta[state][input[i]];
        draw();
      }
      function draw() {
        var m = machines[key];
        var pos = {}; pos[m.states[0]] = [90, 70]; pos[m.states[1]] = [230, 70];
        clear(svg);
        svg.appendChild(s('defs', null, s('marker', { id: 'v-arr', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, s('path', { d: 'M0,0L10,5L0,10z', class: 'v-arrowhead' }))));
        var a = m.states[0], b = m.states[1];
        var lab = function (from, to) { return ['0', '1'].filter(function (c) { return m.delta[from][c] === to; }).join(','); };
        svg.appendChild(s('path', { d: 'M115,58 Q160,25 205,58', class: 'v-edge', 'marker-end': 'url(#v-arr)' }));
        svg.appendChild(s('text', { x: 160, y: 32, class: 'v-tick', 'text-anchor': 'middle', text: lab(a, b) }));
        svg.appendChild(s('path', { d: 'M205,82 Q160,115 115,82', class: 'v-edge', 'marker-end': 'url(#v-arr)' }));
        svg.appendChild(s('text', { x: 160, y: 118, class: 'v-tick', 'text-anchor': 'middle', text: lab(b, a) }));
        [a, b].forEach(function (st) {
          var p = pos[st];
          var self = lab(st, st);
          if (self) {
            svg.appendChild(s('path', { d: 'M' + (p[0] - 10) + ',' + (p[1] - 23) + ' C' + (p[0] - 30) + ',' + (p[1] - 60) + ' ' + (p[0] + 30) + ',' + (p[1] - 60) + ' ' + (p[0] + 10) + ',' + (p[1] - 23), class: 'v-edge', 'marker-end': 'url(#v-arr)' }));
            svg.appendChild(s('text', { x: p[0], y: p[1] - 50, class: 'v-tick', 'text-anchor': 'middle', text: self }));
          }
          var isCur = st === state;
          svg.appendChild(s('circle', { cx: p[0], cy: p[1], r: 24, class: 'v-state' + (isCur ? ' cur' : '') }));
          if (m.accept.indexOf(st) >= 0) svg.appendChild(s('circle', { cx: p[0], cy: p[1], r: 19, class: 'v-state-inner' + (isCur ? ' cur' : '') }));
          svg.appendChild(s('text', { x: p[0], y: p[1] + 5, class: 'v-state-label', 'text-anchor': 'middle', text: st }));
        });
        svg.appendChild(s('path', { d: 'M20,70 L64,70', class: 'v-edge', 'marker-end': 'url(#v-arr)' }));
        svg.appendChild(s('text', { x: 20, y: 62, class: 'v-tick', text: '開始' }));
        tape.textContent = input ? '入力: ' + input.split('').join(' ') : '入力: (空文字列)';
        var acc = m.accept.indexOf(state) >= 0;
        verdict.className = 'v-verdict ' + (acc ? 'ok' : 'ng');
        verdict.textContent = '現在の状態 ' + state + ' → ' + (acc ? '受理' : '受理しない');
      }
      root.appendChild(seg.el);
      root.appendChild(svg);
      root.appendChild(tape);
      root.appendChild(h('div', { class: 'v-row' }, [
        ui.button('0 を入力', function () { input += '0'; run(); }, 'primary'),
        ui.button('1 を入力', function () { input += '1'; run(); }, 'primary'),
        ui.button('1文字消す', function () { input = input.slice(0, -1); run(); }),
        ui.button('クリア', function () { input = ''; run(); })
      ]));
      root.appendChild(verdict);
      run();
    }
  });

  /* ------------------------------------------------------------------
   * 整列アルゴリズム
   * ------------------------------------------------------------------ */
  function sortFrames(arr, algo) {
    var a = arr.slice(), frames = [], cmp = 0, swp = 0;
    function snap(hi, note, sorted) { frames.push({ a: a.slice(), hi: hi || [], note: note || '', cmp: cmp, swp: swp, sorted: sorted || [] }); }
    function swap(i, j) { var t = a[i]; a[i] = a[j]; a[j] = t; swp++; }
    var n = a.length, i, j;
    if (algo === 'bubble') {
      for (i = 0; i < n - 1; i++) {
        for (j = 0; j < n - 1 - i; j++) {
          cmp++; snap([j, j + 1], a[j] + ' と ' + a[j + 1] + ' を比較', range(n - i, n));
          if (a[j] > a[j + 1]) { swap(j, j + 1); snap([j, j + 1], '交換', range(n - i, n)); }
        }
      }
    } else if (algo === 'select') {
      for (i = 0; i < n - 1; i++) {
        var m = i;
        for (j = i + 1; j < n; j++) { cmp++; if (a[j] < a[m]) m = j; snap([m, j], '最小値候補 ' + a[m], range(0, i)); }
        swap(i, m); snap([i], a[i] + ' を位置 ' + (i + 1) + ' へ', range(0, i + 1));
      }
    } else if (algo === 'insert') {
      for (i = 1; i < n; i++) {
        j = i;
        while (j > 0) {
          cmp++; snap([j - 1, j], a[j] + ' を挿入位置まで戻す', []);
          if (a[j - 1] > a[j]) { swap(j - 1, j); j--; } else break;
        }
      }
    } else {
      (function qs(lo, hi) {
        if (lo >= hi) return;
        var p = a[hi], k = lo;
        for (var x = lo; x < hi; x++) {
          cmp++; snap([x, hi], 'ピボット ' + p + ' と ' + a[x] + ' を比較', []);
          if (a[x] < p) { swap(x, k); k++; }
        }
        swap(k, hi); snap([k], 'ピボット ' + p + ' の位置が確定', []);
        qs(lo, k - 1); qs(k + 1, hi);
      })(0, n - 1);
    }
    snap([], '完了', range(0, n));
    return frames;
  }
  function range(a, b) { var r = []; for (var i = a; i < b; i++) r.push(i); return r; }

  V.register('sort', {
    title: '整列アルゴリズムの比較回数',
    desc: '同じデータを違う方法で並べ替えます。「整列済み」のデータでクイックソートを動かすと、比較回数が増える(最悪ケース)のがわかります。',
    mount: function (root) {
      var algo = 'bubble', dataKind = 'random', frames = [], pos = 0, timer = null;
      var bars = h('div', { class: 'v-bars' });
      var info = h('div', { class: 'v-metrics' });
      var note = h('p', { class: 'v-note' });
      var algoSeg = ui.segmented([{ value: 'bubble', label: 'バブル' }, { value: 'select', label: '選択' }, { value: 'insert', label: '挿入' }, { value: 'quick', label: 'クイック' }], algo, function (v) { algo = v; build(); });
      var dataSeg = ui.segmented([{ value: 'random', label: 'ランダム' }, { value: 'sorted', label: '整列済み' }, { value: 'reverse', label: '逆順' }], dataKind, function (v) { dataKind = v; build(); });
      var base;
      function makeData() {
        var n = 14, a = range(1, n + 1);
        if (dataKind === 'random') a = global.Quiz ? global.Quiz.shuffle(a) : a.sort(function () { return Math.random() - 0.5; });
        if (dataKind === 'reverse') a.reverse();
        return a;
      }
      function build() { stop(); base = makeData(); frames = sortFrames(base, algo); pos = 0; draw(); }
      function draw() {
        var f = frames[pos];
        clear(bars);
        f.a.forEach(function (v, i) {
          bars.appendChild(h('div', { class: 'v-bar' + (f.hi.indexOf(i) >= 0 ? ' hi' : '') + (f.sorted.indexOf(i) >= 0 ? ' done' : ''), style: { height: (v / f.a.length * 100) + '%' } }, h('span', { text: v })));
        });
        clear(info);
        info.appendChild(metric('比較回数', String(f.cmp)));
        info.appendChild(metric('交換回数', String(f.swp)));
        info.appendChild(metric('ステップ', (pos + 1) + ' / ' + frames.length));
        note.textContent = f.note;
      }
      function step() { if (pos < frames.length - 1) { pos++; draw(); } else stop(); }
      function play() {
        if (timer) { stop(); return; }
        if (pos >= frames.length - 1) pos = 0;
        playBtn.textContent = '一時停止';
        timer = setInterval(step, 120);
      }
      function stop() { clearInterval(timer); timer = null; if (playBtn) playBtn.textContent = '自動再生'; }
      var playBtn = ui.button('自動再生', play, 'primary');
      root.appendChild(algoSeg.el);
      root.appendChild(dataSeg.el);
      root.appendChild(bars);
      root.appendChild(note);
      root.appendChild(h('div', { class: 'v-row' }, [playBtn, ui.button('1ステップ', function () { stop(); step(); }), ui.button('最後まで', function () { stop(); pos = frames.length - 1; draw(); }), ui.button('データを作り直す', build)]));
      root.appendChild(info);
      build();
    }
  });

  /* ------------------------------------------------------------------
   * 2分探索
   * ------------------------------------------------------------------ */
  V.register('binsearch', {
    title: '2分探索で範囲を半分ずつ絞る',
    desc: '探す値を選んで「1回比較」を押します。線形探索なら何回かかるかと比べてみましょう。',
    mount: function (root) {
      var arr = range(0, 31).map(function (i) { return i * 3 + 2; });
      var target = arr[22], lo, hi, mid, count, found;
      var cells = h('div', { class: 'v-cells' });
      var info = h('div', { class: 'v-metrics' });
      var note = h('p', { class: 'v-note' });
      var big = ui.slider({ label: '要素数 n(計算だけ)', min: 1, max: 6, step: 1, value: 6, fmt: function (v) { return Math.pow(10, v).toLocaleString() + ' 件 → 最大 ' + (Math.floor(Math.log2(Math.pow(10, v))) + 1) + ' 回'; } });
      function reset() { lo = 0; hi = arr.length - 1; mid = -1; count = 0; found = false; note.textContent = '探す値: ' + target + '。セルをクリックすると探す値を変えられます。'; draw(); }
      function stepOnce() {
        if (found || lo > hi) return;
        mid = Math.floor((lo + hi) / 2); count++;
        if (arr[mid] === target) { found = true; note.textContent = count + '回目: 中央 ' + arr[mid] + ' = ' + target + ' → 発見!'; }
        else if (arr[mid] < target) { note.textContent = count + '回目: 中央 ' + arr[mid] + ' < ' + target + ' → 右半分へ'; lo = mid + 1; }
        else { note.textContent = count + '回目: 中央 ' + arr[mid] + ' > ' + target + ' → 左半分へ'; hi = mid - 1; }
        draw();
      }
      function draw() {
        clear(cells);
        arr.forEach(function (v, i) {
          var cls = 'v-cellbox';
          if (i < lo || i > hi) cls += ' out';
          if (i === mid) cls += found ? ' found' : ' mid';
          if (v === target) cls += ' target';
          cells.appendChild(h('button', { type: 'button', class: cls, text: v, onclick: function () { target = v; reset(); } }));
        });
        clear(info);
        info.appendChild(metric('2分探索の比較回数', String(count), found ? 'good' : ''));
        info.appendChild(metric('線形探索なら', (arr.indexOf(target) + 1) + ' 回'));
        info.appendChild(metric('31件での最大', (Math.floor(Math.log2(31)) + 1) + ' 回'));
      }
      root.appendChild(cells);
      root.appendChild(note);
      root.appendChild(h('div', { class: 'v-row' }, [ui.button('1回比較', stepOnce, 'primary'), ui.button('最初から', reset)]));
      root.appendChild(info);
      root.appendChild(big.el);
      reset();
    }
  });

  /* ------------------------------------------------------------------
   * 逆ポーランド記法とスタック
   * ------------------------------------------------------------------ */
  V.register('rpn', {
    title: 'スタックで逆ポーランド記法を計算する',
    desc: '式を1トークンずつ読みます。数値は積み、演算子が来たら上から2つ取り出して計算します。',
    mount: function (root) {
      var presets = ['5 3 2 * -', '3 4 + 2 *', '8 2 / 3 -', '1 2 3 4 + * +'];
      var tokens, pos, stack, logs, err;
      var input = h('input', { type: 'text', class: 'v-text', value: presets[0], 'aria-label': '逆ポーランド記法の式' });
      var tokRow = h('div', { class: 'v-tokens' });
      var stackEl = h('div', { class: 'v-stack' });
      var logEl = h('ol', { class: 'v-log' });
      function reset() {
        tokens = input.value.trim().split(/\s+/).filter(Boolean);
        pos = 0; stack = []; logs = []; err = '';
        draw();
      }
      function stepOnce() {
        if (pos >= tokens.length || err) return;
        var t = tokens[pos];
        if (/^-?\d+(\.\d+)?$/.test(t)) {
          stack.push(parseFloat(t)); logs.push(t + ' を積む');
        } else if ('+-*/'.indexOf(t) >= 0 && t.length === 1) {
          if (stack.length < 2) { err = 'オペランドが足りません'; draw(); return; }
          var r = stack.pop(), l = stack.pop(), v;
          v = t === '+' ? l + r : t === '-' ? l - r : t === '*' ? l * r : l / r;
          stack.push(v);
          logs.push('右=' + r + '、左=' + l + ' を取り出し ' + l + ' ' + t + ' ' + r + ' = ' + fmt(v, 3) + ' を積む');
        } else { err = '「' + t + '」は使えません(数値と + - * / のみ)'; }
        pos++; draw();
      }
      function draw() {
        clear(tokRow);
        tokens.forEach(function (t, i) { tokRow.appendChild(h('span', { class: 'v-token' + (i < pos ? ' done' : '') + (i === pos ? ' cur' : ''), text: t })); });
        clear(stackEl);
        if (stack.length === 0) stackEl.appendChild(h('div', { class: 'v-muted', text: '(空)' }));
        stack.slice().reverse().forEach(function (v, i) { stackEl.appendChild(h('div', { class: 'v-stack-item' + (i === 0 ? ' top' : ''), text: fmt(v, 3) })); });
        clear(logEl);
        logs.forEach(function (l) { logEl.appendChild(h('li', { text: l })); });
        if (err) logEl.appendChild(h('li', { class: 'v-err', text: err }));
        else if (pos >= tokens.length && stack.length === 1) logEl.appendChild(h('li', { class: 'v-ok', text: '結果 = ' + fmt(stack[0], 3) }));
      }
      var presetRow = h('div', { class: 'v-row' });
      presets.forEach(function (p) { presetRow.appendChild(ui.button(p, function () { input.value = p; reset(); }, 'ghost')); });
      input.addEventListener('change', reset);
      root.appendChild(presetRow);
      root.appendChild(input);
      root.appendChild(tokRow);
      root.appendChild(h('div', { class: 'v-split' }, [
        h('div', null, [h('div', { class: 'v-label', text: 'スタック(上が最上段)' }), stackEl]),
        h('div', null, [h('div', { class: 'v-label', text: '処理の記録' }), logEl])
      ]));
      root.appendChild(h('div', { class: 'v-row' }, [ui.button('1トークン進める', stepOnce, 'primary'), ui.button('最初から', reset)]));
      reset();
    }
  });

  /* ------------------------------------------------------------------
   * 2分探索木
   * ------------------------------------------------------------------ */
  V.register('bst', {
    title: '2分探索木に値を挿入する',
    desc: '値を挿入すると「左 < 親 < 右」になるよう配置されます。昇順に挿入すると木が一直線に偏るのを確かめましょう。',
    mount: function (root) {
      var root_ = null;
      var svg = s('svg', { viewBox: '0 0 360 200', class: 'v-svg', role: 'img', 'aria-label': '2分探索木' });
      var input = h('input', { type: 'number', class: 'v-num', value: 42, 'aria-label': '挿入する値' });
      var out = h('div', { class: 'v-note' });
      function insert(v) {
        var node = { v: v, l: null, r: null };
        if (!root_) { root_ = node; return; }
        var c = root_;
        while (true) {
          if (v === c.v) return;
          if (v < c.v) { if (!c.l) { c.l = node; return; } c = c.l; }
          else { if (!c.r) { c.r = node; return; } c = c.r; }
        }
      }
      function walk(n, kind, acc) {
        if (!n) return acc;
        if (kind === 'pre') acc.push(n.v);
        walk(n.l, kind, acc);
        if (kind === 'in') acc.push(n.v);
        walk(n.r, kind, acc);
        if (kind === 'post') acc.push(n.v);
        return acc;
      }
      function depth(n) { return n ? 1 + Math.max(depth(n.l), depth(n.r)) : 0; }
      function draw() {
        clear(svg);
        var inorder = [], idx = 0;
        (function lay(n, d) { if (!n) return; lay(n.l, d + 1); n.x = idx++; n.d = d; inorder.push(n); lay(n.r, d + 1); })(root_, 0);
        var n = inorder.length, dmax = Math.max(1, depth(root_));
        var X = function (i) { return n <= 1 ? 180 : 20 + i * (320 / (n - 1)); };
        var Y = function (d) { return 20 + d * Math.min(40, 160 / dmax); };
        inorder.forEach(function (nd) {
          [nd.l, nd.r].forEach(function (c) { if (c) svg.appendChild(s('line', { x1: X(nd.x), y1: Y(nd.d), x2: X(c.x), y2: Y(c.d), class: 'v-edge' })); });
        });
        inorder.forEach(function (nd) {
          svg.appendChild(s('circle', { cx: X(nd.x), cy: Y(nd.d), r: 13, class: 'v-state' }));
          svg.appendChild(s('text', { x: X(nd.x), y: Y(nd.d) + 4, class: 'v-state-label small', 'text-anchor': 'middle', text: nd.v }));
        });
        out.textContent = n ? '節点数 ' + n + '、木の高さ ' + depth(root_) + '(最小なら ' + Math.ceil(Math.log2(n + 1)) + ')' : '値を挿入してください。';
      }
      function show(kind, label) { out.textContent = label + ': ' + walk(root_, kind, []).join(' → '); }
      function fill(list) { root_ = null; list.forEach(insert); draw(); }
      root.appendChild(h('div', { class: 'v-row' }, [
        input,
        ui.button('挿入', function () { var v = parseInt(input.value, 10); if (!isNaN(v)) { insert(v); draw(); input.value = Math.floor(Math.random() * 99) + 1; } }, 'primary'),
        ui.button('ランダムに7個', function () { fill(global.Quiz.shuffle(range(1, 100)).slice(0, 7)); }),
        ui.button('昇順に7個', function () { fill([10, 20, 30, 40, 50, 60, 70]); }),
        ui.button('クリア', function () { fill([]); })
      ]));
      root.appendChild(svg);
      root.appendChild(h('div', { class: 'v-row' }, [
        ui.button('先行順(親→左→右)', function () { show('pre', '先行順'); }, 'ghost'),
        ui.button('中間順(左→親→右)', function () { show('in', '中間順(昇順になる)'); }, 'ghost'),
        ui.button('後行順(左→右→親)', function () { show('post', '後行順'); }, 'ghost')
      ]));
      root.appendChild(out);
      fill([50, 30, 70, 20, 40, 60, 80]);
    }
  });

  V.helpers = { range: range };
})(window);
