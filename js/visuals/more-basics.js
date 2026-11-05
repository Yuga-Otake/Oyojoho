/**
 * visuals/more-basics.js - 基礎理論・コンピュータ構成・ソフトウェアの体感ビジュアル(追加分)
 *   floaterr: 浮動小数点の誤差 / dp: 動的計画法 / dma: 入出力制御方式
 *   virt: 仮想化方式 / ml: 教師あり学習と過学習
 */
(function (global) {
  'use strict';

  var V = global.Visuals;
  var ui = V.ui, h = ui.h, s = ui.s, clear = ui.clear, fmt = ui.fmt, metric = ui.metric;

  /** SVG 要素に CSS 変数ベースのスタイルを付けて作る */
  function sv(tag, attrs, style, kids) {
    var n = s(tag, attrs, kids);
    if (style) Object.keys(style).forEach(function (k) { n.style.setProperty(k, style[k]); });
    return n;
  }
  function pad(str, len, ch) { str = String(str); while (str.length < len) str = ch + str; return str; }
  function setVerdict(el, tone, text) { el.className = 'v-verdict' + (tone ? ' ' + tone : ''); el.textContent = text; }
  function legendItem(color, label, opacity) {
    var i = h('i'); i.style.background = color; if (opacity) i.style.opacity = opacity;
    return h('span', null, [i, label]);
  }

  /* ------------------------------------------------------------------
   * 1. 浮動小数点の誤差(桁落ちと情報落ち)
   * ------------------------------------------------------------------ */
  V.register('floaterr', {
    title: '浮動小数点の誤差(桁落ちと情報落ち)を体感する',
    desc: '10進で有効桁数が限られた計算機を想定します。桁数を変えながら、ほぼ等しい数の引き算(桁落ち)と、大きさが極端に違う数の足し算(情報落ち)で、結果がどう狂うかを確かめましょう。',
    mount: function (root) {
      var BIG = 1000000, SMALL = 0.4;
      var PRESETS = [
        { a: 1.234567, b: 1.234321 },
        { a: 5.678912, b: 5.678345 },
        { a: 0.912345, b: 0.912001 }
      ];
      var mode = 'cancel', preset = 0, digitsBy = { cancel: 4, absorb: 6 }, kCount = 100;

      function sig(x, n) { return x === 0 ? 0 : parseFloat(x.toPrecision(n)); }

      var modeSeg = ui.segmented([{ value: 'cancel', label: '桁落ち(引き算)' }, { value: 'absorb', label: '情報落ち(足し算)' }], 'cancel', function (v) {
        mode = v; nSl.set(digitsBy[v]); syncControls(); render();
      });
      var presetSeg = ui.segmented([{ value: 0, label: '例1' }, { value: 1, label: '例2' }, { value: 2, label: '例3' }], 0, function (v) { preset = v; render(); });
      var nSl = ui.slider({ label: '有効桁数 N', min: 3, max: 7, step: 1, value: 4, fmt: function (v) { return v + ' 桁'; }, onInput: function (v) { digitsBy[mode] = v; render(); } });
      var kSl = ui.slider({ label: '小さい数(0.4)を足す回数 k', min: 1, max: 1000, step: 1, value: kCount, fmt: function (v) { return v + ' 回'; }, onInput: function (v) { kCount = v; render(); } });
      var presetRow = h('div', { class: 'v-row' }, [h('span', { class: 'v-muted', text: 'ほぼ等しい数の組:' }), presetSeg.el]);
      var view = h('div', { class: 'v-tables' });
      var metrics = h('div', { class: 'v-metrics' });
      var verdict = h('div', { class: 'v-verdict' });

      function syncControls() {
        presetRow.style.display = mode === 'cancel' ? '' : 'none';
        kSl.el.style.display = mode === 'absorb' ? '' : 'none';
      }

      function digitRow(label, str, cls) {
        var cells = h('div', { class: 'v-cells' });
        str.split('').forEach(function (ch, i) {
          var c = cls[i] || '';
          cells.appendChild(h('span', { class: 'v-cellbox ' + c, style: { 'min-width': '28px', cursor: 'default' }, text: ch }));
        });
        return h('div', { class: 'v-row' }, [h('span', { class: 'v-label', style: { 'min-width': '84px' }, text: label }), cells]);
      }

      function renderCancel() {
        var n = digitsBy.cancel, p = PRESETS[preset];
        var e = Math.floor(Math.log(Math.abs(p.a)) / Math.LN10 + 1e-12);
        var unit = Math.pow(10, e - (n - 1));
        var ka = Math.round(p.a / unit), kb = Math.round(p.b / unit), kd = ka - kb;
        var dec = Math.max(0, n - 1 - e);
        var exact = p.a - p.b, got = kd * unit;
        var validDigits = kd > 0 ? String(kd).length : 0;
        var relErr = Math.abs(got - exact) / exact;
        clear(view);
        view.appendChild(h('p', { class: 'v-caption', text: '元の値: a = ' + p.a.toFixed(6) + ' , b = ' + p.b.toFixed(6) + '(正確な差 a − b = ' + exact.toFixed(6) + ')。まず N 桁に丸めてから引きます。' }));
        var sa = pad(ka, n, '0'), sb = pad(kb, n, '0'), sd = pad(kd, n, '0');
        var clsA = [], clsB = [], clsD = [];
        for (var i = 0; i < n; i++) {
          clsD[i] = (i >= n - validDigits) ? 'found' : 'out';
        }
        view.appendChild(digitRow('a (' + (ka * unit).toFixed(dec) + ')', sa, clsA));
        view.appendChild(digitRow('b (' + (kb * unit).toFixed(dec) + ')', sb, clsB));
        view.appendChild(digitRow('a − b', sd, clsD));
        view.appendChild(h('p', { class: 'v-caption', text: '緑の桁が意味のある桁(有効桁)。薄い先頭の 0 は、上位の桁が打ち消し合って消えた跡です。' }));
        clear(metrics);
        metrics.appendChild(metric('N桁での計算結果', got.toFixed(dec)));
        metrics.appendChild(metric('正確な差', exact.toFixed(6)));
        metrics.appendChild(metric('結果の有効桁', validDigits + ' 桁', validDigits <= 1 ? 'neg' : (validDigits >= n - 1 ? 'good' : '')));
        metrics.appendChild(metric('相対誤差', fmt(relErr * 100, 1) + ' %', relErr > 0.05 ? 'neg' : 'good'));
        if (relErr > 0.05) {
          setVerdict(verdict, 'ng', '桁落ち発生。ほぼ等しい数を引くと上位の桁が消え、結果の有効桁が ' + n + ' 桁から ' + validDigits + ' 桁に減りました(相対誤差 ' + fmt(relErr * 100, 1) + ' %)。試験では「絶対値がほぼ等しい数の減算で有効桁が失われる誤差=桁落ち」。式を変形して引き算を避けるのが対策です。');
        } else if (relErr > 0) {
          setVerdict(verdict, 'warn', '桁数を増やして誤差は小さくなりましたが、有効桁は ' + n + ' 桁から ' + validDigits + ' 桁に減っています。引き算で桁が減ること自体が桁落ちです。');
        } else {
          setVerdict(verdict, 'ok', '桁数が十分なので誤差はありません。N を小さくすると、引き算の結果の有効桁が急に減る(桁落ち)のが見えます。');
        }
      }

      function renderAbsorb() {
        var n = digitsBy.absorb, k = kCount;
        var a = BIG, i;
        for (i = 0; i < k; i++) a = sig(a + SMALL, n);
        var t = 0;
        for (i = 0; i < k; i++) t = sig(t + SMALL, n);
        var b = sig(BIG + t, n);
        var exact = BIG + SMALL * k;
        function err(x) { return Math.abs(x - exact) / exact * 100; }
        clear(view);
        view.appendChild(h('p', { class: 'v-caption', text: n + ' 桁の計算機で 1,000,000 に 0.4 を ' + k + ' 回足します(加算のたびに ' + n + ' 桁へ丸める)。' }));
        view.appendChild(h('div', { class: 'v-row' }, [
          h('span', { class: 'v-chip', text: 'A: ((1,000,000 + 0.4) + 0.4) + … と大きい数に1つずつ足す' })
        ]));
        view.appendChild(h('div', { class: 'v-row' }, [
          h('span', { class: 'v-chip', text: 'B: 0.4 どうしを先に合計 → その合計を 1,000,000 に足す' })
        ]));
        clear(metrics);
        metrics.appendChild(metric('正確な値', fmt(exact, 1)));
        metrics.appendChild(metric('A 大きい数から', fmt(a, 1), a === exact ? 'good' : 'neg'));
        metrics.appendChild(metric('B 小さい数から', fmt(b, 1), Math.abs(b - exact) < 1e-9 ? 'good' : (err(b) < err(a) ? '' : 'neg')));
        metrics.appendChild(metric('A / B の誤差', fmt(err(a), 4) + ' % / ' + fmt(err(b), 4) + ' %'));
        var lost = exact - a;
        if (err(a) > 0 && err(b) < err(a)) {
          setVerdict(verdict, 'ng', 'A では 0.4 を足すたびに ' + n + ' 桁に収まらず切り捨てられ、合計に ' + fmt(lost, 1) + ' 分の足し算が反映されませんでした(情報落ち)。B は小さい数どうしを先に足すので ' + fmt(b, 1) + ' まで近づきます。絶対値の大きく異なる数の加算では小さい方が無視される。対策は、絶対値の小さい数から順に足すことです。');
        } else if (err(a) === 0) {
          setVerdict(verdict, 'ok', '桁数が十分で、A も正しい結果になりました。N を小さくする(5 以下など)と、0.4 が桁からあふれて消える情報落ちが起こります。');
        } else {
          setVerdict(verdict, 'warn', '桁数が少なすぎて、A も B も正確にはなりません。ただし B の方が小さい数の寄与を多く残しています。N を増やす、k を増やすと違いがはっきりします。');
        }
      }

      function render() { if (mode === 'cancel') renderCancel(); else renderAbsorb(); }

      root.appendChild(modeSeg.el);
      root.appendChild(presetRow);
      root.appendChild(nSl.el);
      root.appendChild(kSl.el);
      root.appendChild(view);
      root.appendChild(metrics);
      root.appendChild(verdict);
      syncControls();
      render();
    }
  });

  /* ------------------------------------------------------------------
   * 2. 動的計画法(メモ化)と単純な再帰
   * ------------------------------------------------------------------ */
  V.register('dp', {
    title: '動的計画法と単純な再帰(フィボナッチ数列)',
    desc: 'fib(n) = fib(n−1) + fib(n−2) を、そのまま再帰で計算する場合と、表に記録しながら計算する場合とで、計算回数がどれだけ違うかを比べます。',
    mount: function (root) {
      var n = 6, filled = 4;
      var fibs = [0, 1];
      for (var q = 2; q <= 40; q++) fibs[q] = fibs[q - 1] + fibs[q - 2];
      function naiveCalls(m) { return 2 * fibs[m + 1] - 1; }

      var nSl = ui.slider({ label: 'n(fib(n) を求める)', min: 5, max: 30, step: 1, value: n, fmt: function (v) { return 'n = ' + v; }, onInput: function (v) { n = v; filled = Math.min(filled, 4); render(); } });
      var metrics = h('div', { class: 'v-metrics' });
      var barBox = h('div');
      var treeTitle = h('div', { class: 'v-label' });
      var treeBox = h('div');
      var cellsBox = h('div', { class: 'v-cells' });
      var stepLog = h('p', { class: 'v-note' });
      var verdict = h('div', { class: 'v-verdict' });

      function bars() {
        var c1 = naiveCalls(n), c2 = n + 1, W = 400, H = 96, x0 = 86, wmax = 300, maxExp = 7;
        function w(c) { return Math.max(3, Math.log(c) / Math.LN10 / maxExp * wmax); }
        var svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'v-svg', role: 'img', 'aria-label': '呼出し回数の対数目盛りの比較' });
        var ticks = ['1', '10', '100', '1千', '1万', '10万', '100万', '1千万'];
        for (var i = 0; i <= maxExp; i++) {
          var x = x0 + i / maxExp * wmax;
          svg.appendChild(s('line', { x1: x, y1: 8, x2: x, y2: 66, class: 'v-guide' }));
          svg.appendChild(s('text', { x: x, y: 82, 'text-anchor': 'middle', class: 'v-tick', text: ticks[i] }));
        }
        svg.appendChild(s('text', { x: 4, y: 28, class: 'v-tick strong', text: '単純な再帰' }));
        svg.appendChild(sv('rect', { x: x0, y: 14, width: w(c1), height: 22, rx: 3 }, { fill: 'var(--danger)' }));
        svg.appendChild(s('text', { x: 4, y: 58, class: 'v-tick strong', text: 'メモ化/DP' }));
        svg.appendChild(sv('rect', { x: x0, y: 44, width: w(c2), height: 22, rx: 3 }, { fill: 'var(--success)' }));
        svg.appendChild(s('text', { x: W - 4, y: 94, 'text-anchor': 'end', class: 'v-tick', text: '※ 横軸は対数目盛り' }));
        return svg;
      }

      /** 呼出し木(n<=7) */
      function tree() {
        var leaves = 0, nodes = [], maxDepth = 0;
        function build(m, d) {
          var node = { n: m, d: d, kids: [] };
          nodes.push(node);
          if (d > maxDepth) maxDepth = d;
          if (m >= 2) { node.kids.push(build(m - 1, d + 1)); node.kids.push(build(m - 2, d + 1)); node.x = null; }
          else { node.x = leaves++; }
          return node;
        }
        var rootNode = build(n, 0);
        var W = 440, sp = W / leaves, dy = 34, H = (maxDepth + 1) * dy + 8;
        function place(nd) {
          if (nd.kids.length) { nd.kids.forEach(place); nd.x = (nd.kids[0].x + nd.kids[1].x) / 2; }
        }
        place(rootNode);
        var seen = {}, dup = 0;
        nodes.forEach(function (nd) { if (seen[nd.n]) { nd.dup = true; dup++; } else seen[nd.n] = true; });
        var svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'v-svg', role: 'img', 'aria-label': 'fib(' + n + ') の呼出し木' });
        function px(nd) { return (nd.x + 0.5) * sp; }
        function py(nd) { return 18 + nd.d * dy; }
        nodes.forEach(function (nd) {
          nd.kids.forEach(function (k) { svg.appendChild(s('line', { x1: px(nd), y1: py(nd), x2: px(k), y2: py(k), class: 'v-edge thin' })); });
        });
        nodes.forEach(function (nd) {
          var c = sv('circle', { cx: px(nd), cy: py(nd), r: 10, class: 'v-node' }, nd.dup ? { fill: 'var(--danger-soft)', stroke: 'var(--danger)', 'stroke-width': '2' } : { fill: 'var(--primary-soft)', stroke: 'var(--primary)' });
          svg.appendChild(c);
          svg.appendChild(s('text', { x: px(nd), y: py(nd) + 4, 'text-anchor': 'middle', class: 'v-node-label', style: 'font-size:11px', text: String(nd.n) }));
        });
        return { svg: svg, dup: dup, total: nodes.length };
      }

      function renderCells() {
        clear(cellsBox);
        for (var i = 0; i <= n; i++) {
          var cls = 'v-cellbox', body;
          if (i < filled) {
            body = String(fibs[i]);
            if (i === filled - 1) cls += ' mid';
            else if (i === filled - 2 || i === filled - 3) { if (filled - 1 >= 2) cls += ' target'; }
          } else { body = '?'; cls += ' out'; }
          cellsBox.appendChild(h('span', { class: cls, style: { cursor: 'default', 'min-width': n >= 26 ? '58px' : '44px' } }, [
            h('div', { style: { 'font-size': '.62rem', opacity: '.75' }, text: 'fib[' + i + ']' }),
            h('div', { style: { 'font-weight': '700' }, text: body })
          ]));
        }
      }

      function render() {
        var c1 = naiveCalls(n), c2 = n + 1;
        clear(metrics);
        metrics.appendChild(metric('単純な再帰の呼出し回数', fmt(c1, 0) + ' 回', 'neg'));
        metrics.appendChild(metric('メモ化/DP の計算回数', fmt(c2, 0) + ' 回', 'good'));
        metrics.appendChild(metric('回数の比', '約 ' + fmt(c1 / c2, 1) + ' 倍'));
        clear(barBox); barBox.appendChild(bars());
        clear(treeBox);
        if (n <= 7) {
          var t = tree();
          treeTitle.textContent = 'fib(' + n + ') の呼出し木(丸の中は引数。赤は同じ引数の2回目以降=重複計算)';
          treeBox.appendChild(t.svg);
          treeBox.appendChild(h('p', { class: 'v-caption', text: '全 ' + t.total + ' 回の呼出しのうち、重複は ' + t.dup + ' 回。異なる引数は ' + (n + 1) + ' 種類(0〜' + n + ')しかありません。' }));
        } else {
          treeTitle.textContent = '呼出し木は n が 7 以下のときだけ描きます(n = ' + n + ' では ' + fmt(c1, 0) + ' 個にもなります)';
        }
        renderCells();
        if (filled < 3) stepLog.textContent = '「1ステップ」で表を左から埋めていきます。fib[0]=0、fib[1]=1 は初期値です。';
        else {
          var i = filled - 1;
          stepLog.textContent = 'fib[' + i + '] = fib[' + (i - 1) + '] + fib[' + (i - 2) + '] = ' + fibs[i - 1] + ' + ' + fibs[i - 2] + ' = ' + fibs[i] + '(表を見るだけで、再帰呼出しは不要)';
        }
        setVerdict(verdict, 'ok', 'fib(' + n + ') は単純な再帰だと ' + fmt(c1, 0) + ' 回の呼出しが必要ですが、表に記録して再利用すれば ' + c2 + ' 回の計算で済みます。部分問題の解を表に記録して再利用し、重複計算を避けるのが動的計画法(メモ化も同じ考え方)。計算量は指数オーダ O(2ⁿ) から O(n) に減ります。');
      }

      root.appendChild(nSl.el);
      root.appendChild(metrics);
      root.appendChild(barBox);
      root.appendChild(treeTitle);
      root.appendChild(treeBox);
      root.appendChild(h('div', { class: 'v-label', text: 'DP の表(fib[0] から順に埋める)' }));
      root.appendChild(h('div', { class: 'v-row' }, [
        ui.button('1ステップ', function () { if (filled <= n) filled++; render(); }, 'primary'),
        ui.button('全部埋める', function () { filled = n + 1; render(); }),
        ui.button('リセット', function () { filled = 0; render(); })
      ]));
      root.appendChild(cellsBox);
      root.appendChild(stepLog);
      root.appendChild(verdict);
      render();
    }
  });

  /* ------------------------------------------------------------------
   * 3. 入出力制御方式(プログラム制御・割込み・DMA)
   * ------------------------------------------------------------------ */
  V.register('dma', {
    title: '入出力の制御方式 ― プログラム制御・割込み・DMA',
    desc: '装置から主記憶へデータを転送する間、CPU が何をしているかを時間軸で比べます。緑の部分が、CPU が別の処理に使える時間です。',
    mount: function (root) {
      var mode = 'poll', words = 8;
      var modeSeg = ui.segmented([
        { value: 'poll', label: 'プログラム制御' },
        { value: 'int', label: '割込み' },
        { value: 'dma', label: 'DMA' }
      ], 'poll', function (v) { mode = v; render(); });
      var wSl = ui.slider({ label: '転送するデータ量', min: 4, max: 16, step: 1, value: words, fmt: function (v) { return v + ' 語'; }, onInput: function (v) { words = v; render(); } });
      var svgBox = h('div');
      var legend = h('div', { class: 'v-legend' }, [
        legendItem('var(--danger)', 'CPU: 転送'),
        legendItem('var(--danger)', 'CPU: 待ち(ポーリング)', '.35'),
        legendItem('var(--success)', 'CPU: 別の処理ができる'),
        legendItem('var(--primary)', 'CPU: 割込み・起動処理'),
        legendItem('var(--text-muted)', '装置: データ準備中', '.5'),
        legendItem('var(--primary)', '装置: DMAC が主記憶へ転送', '.6')
      ]);
      var metrics = h('div', { class: 'v-metrics' });
      var verdict = h('div', { class: 'v-verdict' });

      function schedule() {
        var cpu = [], dev = [], w;
        if (mode === 'dma') { cpu.push('int'); dev.push('idle'); }
        for (w = 0; w < words; w++) {
          if (mode === 'poll') { cpu.push('wait', 'wait', 'xfer'); dev.push('prep', 'prep', 'ready'); }
          else if (mode === 'int') { cpu.push('free', 'free', 'int'); dev.push('prep', 'prep', 'ready'); }
          else { cpu.push('free', 'free', 'free'); dev.push('prep', 'prep', 'dmac'); }
        }
        if (mode === 'dma') { cpu.push('int'); dev.push('idle'); }
        return { cpu: cpu, dev: dev };
      }
      var CPU_STYLE = {
        wait: { fill: 'var(--danger)', 'fill-opacity': '.35' }, xfer: { fill: 'var(--danger)' },
        free: { fill: 'var(--success)' }, int: { fill: 'var(--primary)' }
      };
      var DEV_STYLE = {
        prep: { fill: 'var(--text-muted)', 'fill-opacity': '.5' }, ready: { fill: 'var(--text-muted)', 'fill-opacity': '.8' },
        dmac: { fill: 'var(--primary)', 'fill-opacity': '.6' }, idle: { fill: 'var(--surface)' }
      };

      function render() {
        var sc = schedule(), T = sc.cpu.length;
        var W = 400, x0 = 62, gw = (W - x0 - 6) / T, y1 = 30, y2 = 78, ch = 30;
        var svg = sv('svg', { viewBox: '0 0 ' + W + ' 128', class: 'v-svg', role: 'img', 'aria-label': 'CPU と入出力装置のタイムライン' });
        svg.appendChild(s('text', { x: 4, y: y1 + 19, class: 'v-tick strong', text: 'CPU' }));
        svg.appendChild(s('text', { x: 4, y: y2 + 12, class: 'v-tick strong', text: '入出力' }));
        svg.appendChild(s('text', { x: 4, y: y2 + 24, class: 'v-tick strong', text: '装置' }));
        var i;
        for (i = 0; i < T; i++) {
          svg.appendChild(sv('rect', { x: x0 + i * gw, y: y1, width: Math.max(1, gw - 1), height: ch, rx: 1 }, CPU_STYLE[sc.cpu[i]]));
          svg.appendChild(sv('rect', { x: x0 + i * gw, y: y2, width: Math.max(1, gw - 1), height: ch, rx: 1 }, DEV_STYLE[sc.dev[i]]));
        }
        var step = T > 30 ? 10 : 5;
        for (i = 0; i <= T; i += step) {
          svg.appendChild(s('line', { x1: x0 + i * gw, y1: 112, x2: x0 + i * gw, y2: 116, class: 'v-axis' }));
          svg.appendChild(s('text', { x: x0 + i * gw, y: 126, 'text-anchor': 'middle', class: 'v-tick', text: String(i) }));
        }
        svg.appendChild(s('text', { x: 4, y: 126, class: 'v-tick', text: '時間' }));
        svg.appendChild(s('text', { x: x0, y: 18, class: 'v-tick', text: mode === 'poll' ? '装置の準備ができるまで状態を確認し続け、1語ずつ CPU が転送' : (mode === 'int' ? '準備ができるたびに割込み → 割込み処理の中で1語転送' : '最初に DMA コントローラへ指示 → 最後に完了割込みだけ') }));
        clear(svgBox); svgBox.appendChild(svg);

        var free = 0, ints = 0;
        sc.cpu.forEach(function (c) { if (c === 'free') free++; if (c === 'int') ints++; });
        var pct = free / T * 100;
        var intCount = mode === 'poll' ? 0 : (mode === 'int' ? words : 1);
        clear(metrics);
        metrics.appendChild(metric('CPU が別の処理に使える割合', fmt(pct, 0) + ' %', pct >= 60 ? 'good' : (pct === 0 ? 'neg' : '')));
        metrics.appendChild(metric('CPU の占有(転送・待ち・割込み)', fmt(100 - pct, 0) + ' %'));
        metrics.appendChild(metric('割込みの回数', intCount + ' 回'));
        metrics.appendChild(metric('転送にかかる時間', T + ' 単位'));

        if (mode === 'poll') {
          setVerdict(verdict, 'ng', 'プログラム制御(ポーリング)では、CPU は装置の準備完了を確認し続け、データの転送も自分で行うため、転送が終わるまで CPU をほぼ 100 % 占有します。仕組みは単純ですが、その間 CPU は別の処理ができません。');
        } else if (mode === 'int') {
          setVerdict(verdict, 'warn', '割込み方式では、装置の準備を待つ間 CPU は別の処理を進められます(緑)。ただし 1 語ごとに ' + words + ' 回の割込み処理が入り、転送は CPU が行います。割込みのオーバヘッドが大量データでは無視できなくなります。');
        } else {
          setVerdict(verdict, 'ok', 'DMA では CPU が転送を DMA コントローラ(DMAC)に指示するだけで、DMAC が装置と主記憶の間を直接転送します。CPU が関わるのは開始の指示と完了割込みの 2 回だけなので、大量データの転送でも CPU を別の処理に回せます(主記憶へのアクセス競合で少し待たされることはあります)。');
        }
      }

      root.appendChild(modeSeg.el);
      root.appendChild(wSl.el);
      root.appendChild(svgBox);
      root.appendChild(legend);
      root.appendChild(metrics);
      root.appendChild(verdict);
      render();
    }
  });

  /* ------------------------------------------------------------------
   * 4. 仮想化方式の比較
   * ------------------------------------------------------------------ */
  V.register('virt', {
    title: '仮想化方式の比較(ハイパーバイザ型・ホスト型・コンテナ型)',
    desc: '稼働させる台数を変えながら、3 つの方式の層構造と、必要なメモリ・起動時間・動いている OS の数を比べます。数値はいずれも目安です。',
    mount: function (root) {
      var type = 'hyper', count = 3, win = false;
      var typeSeg = ui.segmented([
        { value: 'hyper', label: 'ハイパーバイザ型' },
        { value: 'host', label: 'ホスト型' },
        { value: 'cont', label: 'コンテナ型' }
      ], 'hyper', function (v) { type = v; render(); });
      var nSl = ui.slider({ label: '稼働させる台数(ワークロード数)', min: 1, max: 6, step: 1, value: count, fmt: function (v) { return v + ' 台'; }, onInput: function (v) { count = v; render(); } });
      var winBtn = h('button', { type: 'button', class: 'v-switch', text: 'Linux サーバ上で Windows のアプリも動かしたい', onclick: function () { win = !win; render(); } });
      var svgBox = h('div');
      var metrics = h('div', { class: 'v-metrics' });
      var verdict = h('div', { class: 'v-verdict' });

      var LAYER = {
        hw: { fill: 'var(--surface)', stroke: 'var(--text-muted)' },
        shared: { fill: 'var(--primary-soft)', stroke: 'var(--primary)' },
        guest: { fill: 'var(--warn-soft)', stroke: 'var(--warn)' },
        app: { fill: 'var(--success-soft)', stroke: 'var(--success)' },
        bad: { fill: 'var(--danger-soft)', stroke: 'var(--danger)' }
      };
      function box(svg, x, y, w, hgt, kind, label, fs, dashed) {
        var st = { fill: LAYER[kind].fill, stroke: LAYER[kind].stroke, 'stroke-width': '1.5' };
        if (dashed) st['stroke-dasharray'] = '4 3';
        svg.appendChild(sv('rect', { x: x, y: y, width: w, height: hgt, rx: 4 }, st));
        svg.appendChild(s('text', { x: x + w / 2, y: y + hgt / 2 + 4, 'text-anchor': 'middle', class: 'v-node-label', style: 'font-size:' + (fs || 12) + 'px', text: label }));
      }

      function render() {
        var W = 400, rh = 30, gap = 5, i;
        var rows = [{ k: 'hw', t: 'ハードウェア' }];
        if (type === 'hyper') rows.push({ k: 'shared', t: 'ハイパーバイザ(ハードウェア上で直接動く)' });
        else if (type === 'host') { rows.push({ k: 'shared', t: 'ホスト OS' }); rows.push({ k: 'shared', t: '仮想化ソフト(アプリとして動く)' }); }
        else { rows.push({ k: 'shared', t: 'ホスト OS(カーネルを全コンテナで共有)' }); rows.push({ k: 'shared', t: 'コンテナエンジン' }); }
        var hasGuest = type !== 'cont';
        var topRows = hasGuest ? 2 : 1;
        var H = 10 + (rows.length + topRows) * (rh + gap) + 4;
        var svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'v-svg', role: 'img', 'aria-label': '仮想化方式の層構造' });
        var y = H - 6 - rh;
        rows.forEach(function (r) { box(svg, 8, y, W - 16, rh, r.k, r.t, 12); y -= rh + gap; });
        var cw = (W - 16 - (count - 1) * 6) / count;
        for (i = 0; i < count; i++) {
          var x = 8 + i * (cw + 6), isWin = win && i === 0, yy = y;
          if (hasGuest) {
            box(svg, x, yy, cw, rh, 'guest', isWin ? 'Windows' : (count >= 5 ? 'ゲスト' : 'ゲストOS'), 11);
            yy -= rh + gap;
            box(svg, x, yy, cw, rh, 'app', isWin ? 'Winアプリ' : 'アプリ', 11);
          } else {
            var bad = win && i === 0;
            box(svg, x, yy, cw, rh, bad ? 'bad' : 'app', bad ? 'Winアプリ ✕' : 'アプリ', 11, bad);
          }
        }
        clear(svgBox); svgBox.appendChild(svg);

        var mem, boot, kernels, bootTxt;
        if (type === 'hyper') { mem = 0.5 + count * 1.5; boot = 40; kernels = count; bootTxt = '数十秒(約40秒)'; }
        else if (type === 'host') { mem = 1.5 + 0.3 + count * 1.5; boot = 50; kernels = count + 1; bootTxt = '数十秒(約50秒)'; }
        else { mem = 1.0 + 0.2 + count * 0.55; boot = 1; kernels = 1; bootTxt = '1〜数秒以下(約1秒)'; }
        var contMem = 1.2 + count * 0.55;
        clear(metrics);
        metrics.appendChild(metric('必要メモリ(目安)', fmt(mem, 1) + ' GB', type === 'cont' ? 'good' : ''));
        metrics.appendChild(metric('1台の起動時間(目安)', bootTxt, type === 'cont' ? 'good' : ''));
        metrics.appendChild(metric('動いている OS(カーネル)の数', kernels + ' 個', kernels === 1 ? 'good' : ''));
        metrics.appendChild(metric('コンテナ型との比(メモリ)', type === 'cont' ? '基準' : '約 ' + fmt(mem / contMem, 1) + ' 倍'));

        var msg, tone;
        if (type === 'cont') {
          if (win) { tone = 'ng'; msg = 'コンテナ型はホスト OS のカーネルを共有するため、Linux 上で Windows のアプリは動かせません(赤)。OS の種類が違うなら、ゲスト OS ごと動かせるハイパーバイザ型などを選びます。'; }
          else { tone = 'ok'; msg = 'コンテナ型はゲスト OS を持たず、カーネルを共有するので軽量です。メモリ・起動時間とも有利で、' + count + ' 台でも OS は 1 つだけ。ただし OS が異なる環境は作れず、カーネルの脆弱性は全コンテナに影響します。'; }
        } else if (type === 'hyper') {
          tone = win ? 'ok' : 'warn';
          msg = (win ? 'ゲスト OS として Windows をインストールできるので、Linux と Windows の混在が可能です。' : '') + 'ハイパーバイザ型はハードウェア上で直接動くため、ホスト型より効率が良く、サーバ統合で多く使われます。ただしコンテナ型より、ゲスト OS 分のメモリと起動時間が余計にかかります。';
        } else {
          tone = win ? 'ok' : 'warn';
          msg = (win ? 'ホスト OS の上の仮想化ソフトでゲスト OS を動かすので、Windows のゲストも可能です。' : '') + 'ホスト型は手元の PC に導入しやすい反面、ホスト OS を経由するぶんオーバヘッドが大きく、ハイパーバイザ型より性能面で不利になりがちです。';
        }
        setVerdict(verdict, tone, msg);
      }

      root.appendChild(typeSeg.el);
      root.appendChild(nSl.el);
      root.appendChild(h('div', { class: 'v-row' }, [winBtn]));
      root.appendChild(svgBox);
      root.appendChild(metrics);
      root.appendChild(h('p', { class: 'v-caption', text: '数値は学習用の目安です(ゲスト OS 1台あたり約1GB+アプリ0.5GB、コンテナはアプリ0.5GB+わずかなオーバヘッドと仮定)。' }));
      root.appendChild(verdict);
      var origRender = render;
      render = function () { winBtn.className = 'v-switch' + (win ? ' on' : ''); winBtn.setAttribute('aria-pressed', win ? 'true' : 'false'); origRender(); };
      render();
    }
  });

  /* ------------------------------------------------------------------
   * 5. 教師あり学習と過学習(k 近傍法)
   * ------------------------------------------------------------------ */
  V.register('ml', {
    title: '教師あり学習と過学習(k 近傍法)',
    desc: '正解ラベル付きの訓練データ(塗りつぶし)から学習し、未知のテストデータ(白抜き)で評価します。k を変えて、訓練データとテストデータの正解率がどう変わるかを見ましょう。図をクリックすると訓練データを追加できます。',
    mount: function (root) {
      var W = 392, H = 252, GX = 28, GY = 18, CW = W / GX, CH = H / GY, MAXTRAIN = 120;
      var KS = [1, 3, 5, 7, 9, 11, 13, 15];

      function rngMaker(seed) {
        var a = seed >>> 0;
        return function () {
          a = (a + 0x6D2B79F5) >>> 0;
          var t = a;
          t = Math.imul(t ^ (t >>> 15), t | 1);
          t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
      }
      function genData() {
        var rnd = rngMaker(20240611);
        function gauss() { return Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd()); }
        var centers = [[0.28, 0.35, 0], [0.72, 0.68, 0], [0.72, 0.3, 1], [0.3, 0.7, 1]];
        function clamp(v) { return Math.min(0.97, Math.max(0.03, v)); }
        function make(per) {
          var out = [];
          centers.forEach(function (c) {
            for (var i = 0; i < per; i++) out.push({ x: clamp(c[0] + gauss() * 0.14), y: clamp(c[1] + gauss() * 0.14), c: c[2] });
          });
          return out;
        }
        var train = make(10), test = make(5);
        [3, 17, 28].forEach(function (i) { train[i].c = 1 - train[i].c; });
        return { train: train, test: test };
      }
      var base = genData();
      var train = base.train.slice(), test = base.test.slice();
      var k = 1, addClass = 0;
      var gridPts = [], i, j;
      for (j = 0; j < GY; j++) for (i = 0; i < GX; i++) gridPts.push({ x: (i + 0.5) / GX, y: (j + 0.5) / GY });
      var gridOrd, trainOrd, testOrd;

      function orders(queries) {
        return queries.map(function (q) {
          var d = train.map(function (p, idx) { return { idx: idx, d: (p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y) }; });
          d.sort(function (a, b) { return a.d - b.d; });
          return d.map(function (e) { return e.idx; });
        });
      }
      function predict(ord, kk) {
        var c1 = 0, m = Math.min(kk, ord.length);
        for (var t = 0; t < m; t++) c1 += train[ord[t]].c;
        return c1 * 2 > m ? 1 : 0;
      }
      function accuracy(ords, pts, kk) {
        var ok = 0;
        pts.forEach(function (p, idx) { if (predict(ords[idx], kk) === p.c) ok++; });
        return ok / pts.length;
      }
      function recompute() {
        gridOrd = orders(gridPts); trainOrd = orders(train); testOrd = orders(test);
      }

      var kSl = ui.slider({ label: '近傍の数 k(奇数)', min: 1, max: 15, step: 2, value: k, fmt: function (v) { return 'k = ' + v; }, onInput: function (v) { k = v; update(); } });
      var clsSeg = ui.segmented([{ value: 0, label: 'クラスA(青の丸)' }, { value: 1, label: 'クラスB(橙の四角)' }], 0, function (v) { addClass = v; });
      var plotBox = h('div');
      var legend = h('div', { class: 'v-legend' }, [
        legendItem('var(--primary)', '塗り: 訓練データ / 白抜き: テストデータ'),
        legendItem('var(--primary)', '背景: A と予測される領域', '.3'),
        legendItem('var(--warn)', '背景: B と予測される領域', '.3')
      ]);
      var chartBox = h('div');
      var metrics = h('div', { class: 'v-metrics' });
      var verdict = h('div', { class: 'v-verdict' });

      var CLS_FILL = ['var(--primary)', 'var(--warn)'];
      var cellEls = [], ptLayer;
      var svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'v-svg', role: 'img', 'aria-label': 'k近傍法の決定領域と訓練・テストデータ', 'data-touch': '1', style: 'cursor:crosshair' });
      for (j = 0; j < GY; j++) for (i = 0; i < GX; i++) {
        var r = sv('rect', { x: i * CW, y: j * CH, width: CW + 0.4, height: CH + 0.4, 'fill-opacity': '0.2' }, { fill: 'var(--primary)' });
        cellEls.push(r); svg.appendChild(r);
      }
      ptLayer = s('g');
      svg.appendChild(ptLayer);
      svg.addEventListener('click', function (e) {
        var rc = svg.getBoundingClientRect();
        if (!rc.width) return;
        var x = (e.clientX - rc.left) / rc.width, y = (e.clientY - rc.top) / rc.height;
        if (x < 0 || x > 1 || y < 0 || y > 1 || train.length >= MAXTRAIN) return;
        train.push({ x: x, y: y, c: addClass });
        recompute(); drawPoints(); update();
      });
      plotBox.appendChild(svg);

      function marker(p, hollow) {
        var cx = p.x * W, cy = p.y * H, col = CLS_FILL[p.c];
        var st = hollow ? { fill: 'var(--surface)', stroke: col, 'stroke-width': '2.2' } : { fill: col, stroke: 'var(--surface)', 'stroke-width': '1.2' };
        if (p.c === 0) return sv('circle', { cx: cx, cy: cy, r: hollow ? 5.5 : 4.6 }, st);
        var sz = hollow ? 5.2 : 4.4;
        return sv('rect', { x: cx - sz, y: cy - sz, width: sz * 2, height: sz * 2 }, st);
      }
      function drawPoints() {
        clear(ptLayer);
        train.forEach(function (p) { ptLayer.appendChild(marker(p, false)); });
        test.forEach(function (p) { ptLayer.appendChild(marker(p, true)); });
      }

      function drawChart(trainAccs, testAccs, curIdx) {
        var CWd = 400, CHt = 130, x0 = 40, x1 = 388, yTop = 12, yBot = 100, lo = 0.4;
        function px(idx) { return x0 + idx / (KS.length - 1) * (x1 - x0); }
        function py(a) { return yBot - (Math.max(lo, a) - lo) / (1 - lo) * (yBot - yTop); }
        var c = sv('svg', { viewBox: '0 0 ' + CWd + ' ' + CHt, class: 'v-svg', role: 'img', 'aria-label': 'k と正解率の関係' });
        [0.5, 0.75, 1].forEach(function (a) {
          c.appendChild(s('line', { x1: x0, y1: py(a), x2: x1, y2: py(a), class: 'v-guide' }));
          c.appendChild(s('text', { x: x0 - 4, y: py(a) + 3, 'text-anchor': 'end', class: 'v-tick', text: Math.round(a * 100) + '%' }));
        });
        KS.forEach(function (kk, idx) {
          c.appendChild(s('text', { x: px(idx), y: 118, 'text-anchor': 'middle', class: 'v-tick' + (idx === curIdx ? ' strong' : ''), text: String(kk) }));
        });
        c.appendChild(s('text', { x: 4, y: 126, class: 'v-tick', text: 'k →' }));
        function path(arr, cls, col) {
          var d = arr.map(function (a, idx) { return (idx ? 'L' : 'M') + px(idx).toFixed(1) + ' ' + py(a).toFixed(1); }).join(' ');
          c.appendChild(sv('path', { d: d, class: cls }, col ? { stroke: col } : null));
        }
        path(trainAccs, 'v-line', 'var(--primary)');
        path(testAccs, 'v-line', 'var(--warn)');
        if (curIdx >= 0) {
          c.appendChild(s('line', { x1: px(curIdx), y1: yTop - 4, x2: px(curIdx), y2: yBot, class: 'v-guide danger' }));
          c.appendChild(sv('circle', { cx: px(curIdx), cy: py(trainAccs[curIdx]), r: 4.5, class: 'v-dot' }, { fill: 'var(--primary)' }));
          c.appendChild(sv('circle', { cx: px(curIdx), cy: py(testAccs[curIdx]), r: 4.5, class: 'v-dot' }, { fill: 'var(--warn)' }));
        }
        clear(chartBox);
        chartBox.appendChild(h('div', { class: 'v-label', text: 'k を変えたときの正解率(青: 訓練データ / 橙: テストデータ)' }));
        chartBox.appendChild(c);
      }

      function update() {
        var n = cellEls.length, idx;
        for (idx = 0; idx < n; idx++) cellEls[idx].style.setProperty('fill', CLS_FILL[predict(gridOrd[idx], k)]);
        var trainAccs = KS.map(function (kk) { return accuracy(trainOrd, train, kk); });
        var testAccs = KS.map(function (kk) { return accuracy(testOrd, test, kk); });
        var ci = KS.indexOf(k);
        var tr = trainAccs[ci], te = testAccs[ci], bestTe = Math.max.apply(null, testAccs);
        drawChart(trainAccs, testAccs, ci);
        clear(metrics);
        metrics.appendChild(metric('訓練データの正解率', fmt(tr * 100, 0) + ' %', tr >= 0.99 ? 'good' : ''));
        metrics.appendChild(metric('テストデータの正解率', fmt(te * 100, 0) + ' %', te < bestTe - 0.04 ? 'neg' : 'good'));
        metrics.appendChild(metric('訓練 − テスト の差', fmt((tr - te) * 100, 0) + ' ポイント', tr - te >= 0.12 ? 'neg' : ''));
        metrics.appendChild(metric('訓練データ数', train.length + ' 個'));
        if (tr - te >= 0.12 && k <= 5) {
          setVerdict(verdict, 'ng', '訓練データでは ' + fmt(tr * 100, 0) + ' % 当たるのに、未知のテストデータでは ' + fmt(te * 100, 0) + ' % に下がっています。k が小さいと訓練データの偶然のノイズまで覚え込む(領域がギザギザ)=過学習。訓練データの成績だけで良し悪しは判断できません。');
        } else if (k >= 11 && te < bestTe - 0.04) {
          setVerdict(verdict, 'warn', 'k が大きすぎて領域が単純になり、訓練データもテストデータも正解率が下がりました(学習不足)。過学習を避けようとして単純にしすぎるのも問題です。');
        } else if (te >= bestTe - 0.001) {
          setVerdict(verdict, 'ok', 'ほどよい k です。訓練データとの差が小さく、テストデータでも高い正解率が得られています。教師あり学習は正解ラベル付きデータから規則を学び、未知データでの性能(汎化性能)で評価します。');
        } else {
          setVerdict(verdict, 'warn', 'k を動かして、テストデータの正解率(橙)が最も高くなる位置を探してみましょう。教師あり学習は、学習に使っていない未知データでの性能で評価します。');
        }
      }

      root.appendChild(kSl.el);
      root.appendChild(h('div', { class: 'v-row' }, [h('span', { class: 'v-muted', text: 'クリックで追加するクラス:' }), clsSeg.el]));
      root.appendChild(plotBox);
      root.appendChild(legend);
      root.appendChild(h('div', { class: 'v-row' }, [
        ui.button('データを元に戻す', function () { train = base.train.slice(); test = base.test.slice(); recompute(); drawPoints(); update(); })
      ]));
      root.appendChild(metrics);
      root.appendChild(chartBox);
      root.appendChild(verdict);
      recompute();
      drawPoints();
      update();
    }
  });
})(window);
