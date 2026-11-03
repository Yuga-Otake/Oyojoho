/**
 * visuals/systems.js - コンピュータ・システム・DB・ネットワーク・セキュリティ・開発の体感ビジュアル
 */
(function (global) {
  'use strict';

  var V = global.Visuals;
  var ui = V.ui, h = ui.h, s = ui.s, clear = ui.clear, fmt = ui.fmt, metric = ui.metric;
  var range = V.helpers.range;

  /* ------------------------------------------------------------------
   * パイプライン
   * ------------------------------------------------------------------ */
  V.register('pipeline', {
    title: 'パイプラインで命令を重ねて流す',
    desc: '段数と命令数を変えると、各命令がどのサイクルでどの段を処理するかの図と、所要時間が変わります。',
    mount: function (root) {
      var names = ['IF', 'ID', 'EX', 'MA', 'WB', 'X6'];
      var k = ui.slider({ label: '段数 k', min: 2, max: 6, value: 5, onInput: draw });
      var n = ui.slider({ label: '命令数 n', min: 1, max: 10, value: 6, onInput: draw });
      var t = ui.slider({ label: 'ピッチ t', min: 1, max: 20, value: 10, fmt: function (v) { return v + ' ns'; }, onInput: draw });
      var grid = h('div', { class: 'v-scroll' });
      var metrics = h('div', { class: 'v-metrics' });
      function draw() {
        var K = k.value, N = n.value, T = t.value, cyc = K + N - 1;
        var tbl = h('table', { class: 'v-gantt' });
        var head = h('tr', null, [h('th', { text: '' })]);
        for (var c = 1; c <= cyc; c++) head.appendChild(h('th', { text: c }));
        tbl.appendChild(head);
        for (var i = 0; i < N; i++) {
          var tr = h('tr', null, [h('th', { text: '命令' + (i + 1) })]);
          for (c = 0; c < cyc; c++) {
            var st = c - i;
            tr.appendChild(h('td', { class: st >= 0 && st < K ? 'on s' + st : '', text: st >= 0 && st < K ? names[st] : '' }));
          }
          tbl.appendChild(tr);
        }
        clear(grid).appendChild(tbl);
        clear(metrics);
        metrics.appendChild(metric('パイプライン', '(' + K + '+' + N + '−1)×' + T + ' = ' + (cyc * T) + ' ns', 'good'));
        metrics.appendChild(metric('重ねない場合', K + '×' + N + '×' + T + ' = ' + (K * N * T) + ' ns'));
        metrics.appendChild(metric('高速化率', fmt(K * N / cyc, 2) + ' 倍'));
      }
      root.appendChild(k.el); root.appendChild(n.el); root.appendChild(t.el);
      root.appendChild(grid); root.appendChild(metrics);
      root.appendChild(h('p', { class: 'v-caption', text: '最初の命令が終わるまで k サイクル、その後は毎サイクル1命令ずつ完了する。命令数が多いほど高速化率は段数 k に近づく。' }));
      draw();
    }
  });

  /* ------------------------------------------------------------------
   * キャッシュの実効アクセス時間
   * ------------------------------------------------------------------ */
  V.register('cache', {
    title: 'ヒット率と実効アクセス時間',
    desc: 'ヒット率を 99% → 90% → 80% と下げてみてください。わずかな低下で平均が大きく悪化します。',
    mount: function (root) {
      var hit = ui.slider({ label: 'ヒット率', min: 50, max: 100, value: 90, fmt: function (v) { return v + '%'; }, onInput: draw });
      var tc = ui.slider({ label: 'キャッシュのアクセス時間', min: 1, max: 30, value: 10, fmt: function (v) { return v + ' ns'; }, onInput: draw });
      var tm = ui.slider({ label: '主記憶のアクセス時間', min: 40, max: 200, step: 10, value: 100, fmt: function (v) { return v + ' ns'; }, onInput: draw });
      var bar = h('div', { class: 'v-stackbar' });
      var metrics = h('div', { class: 'v-metrics' });
      var svg = s('svg', { viewBox: '0 0 320 120', class: 'v-svg', role: 'img', 'aria-label': 'ヒット率と実効アクセス時間のグラフ' });
      function draw() {
        var p = hit.value / 100, eat = p * tc.value + (1 - p) * tm.value;
        clear(bar);
        var a = p * tc.value, b = (1 - p) * tm.value;
        bar.appendChild(h('div', { class: 'seg a', style: { width: (a / tm.value * 100) + '%' }, title: 'ヒット分' }));
        bar.appendChild(h('div', { class: 'seg b', style: { width: (b / tm.value * 100) + '%' }, title: 'ミス分' }));
        clear(metrics);
        metrics.appendChild(metric('ヒット分 ' + hit.value + '%×' + tc.value, fmt(a, 1) + ' ns'));
        metrics.appendChild(metric('ミス分 ' + (100 - hit.value) + '%×' + tm.value, fmt(b, 1) + ' ns', 'neg'));
        metrics.appendChild(metric('実効アクセス時間', fmt(eat, 1) + ' ns', 'good'));
        clear(svg);
        var X = function (r) { return 30 + (r - 0.5) / 0.5 * 280; }, Y = function (v) { return 105 - v / tm.value * 95; };
        var d = '';
        for (var r = 0.5; r <= 1.0001; r += 0.01) d += (d ? 'L' : 'M') + X(r).toFixed(1) + ',' + Y(r * tc.value + (1 - r) * tm.value).toFixed(1);
        svg.appendChild(s('line', { x1: 30, y1: 105, x2: 310, y2: 105, class: 'v-axis' }));
        svg.appendChild(s('path', { d: d, class: 'v-line' }));
        svg.appendChild(s('circle', { cx: X(p), cy: Y(eat), r: 5, class: 'v-dot' }));
        svg.appendChild(s('text', { x: 30, y: 118, class: 'v-tick', text: '50%' }));
        svg.appendChild(s('text', { x: 310, y: 118, class: 'v-tick', 'text-anchor': 'end', text: '100%' }));
      }
      root.appendChild(hit.el); root.appendChild(tc.el); root.appendChild(tm.el);
      root.appendChild(h('div', { class: 'v-label', text: '実効アクセス時間の内訳(全幅 = 主記憶の時間)' }));
      root.appendChild(bar); root.appendChild(metrics); root.appendChild(svg);
      draw();
    }
  });

  /* ------------------------------------------------------------------
   * RAID
   * ------------------------------------------------------------------ */
  V.register('raid', {
    title: 'ディスクを壊して RAID の耐障害性を試す',
    desc: 'ディスクをクリックすると故障させられます。何台まで壊れてもデータが残るか確かめましょう。',
    mount: function (root) {
      var level = 5, disks = 4, failed = [];
      var minDisks = { 0: 2, 1: 2, 5: 3, 6: 4 };
      var seg = ui.segmented([{ value: 0, label: 'RAID0' }, { value: 1, label: 'RAID1' }, { value: 5, label: 'RAID5' }, { value: 6, label: 'RAID6' }], level, function (v) {
        level = v; if (level === 1) disks = 2; disks = Math.max(disks, minDisks[level]); failed = []; num.set(disks); draw();
      });
      var num = ui.slider({ label: 'ディスク台数', min: 2, max: 8, value: disks, onInput: function (v) { disks = Math.max(v, minDisks[level]); if (level === 1) disks = 2; failed = []; draw(); } });
      var grid = h('div', { class: 'v-disks' });
      var verdict = h('div', { class: 'v-verdict' });
      var metrics = h('div', { class: 'v-metrics' });
      function layout() {
        var rows = 4, cols = [];
        for (var d = 0; d < disks; d++) cols.push([]);
        var blk = 1;
        for (var r = 0; r < rows; r++) {
          if (level === 0) { for (d = 0; d < disks; d++) cols[d].push('D' + blk++); }
          else if (level === 1) { cols[0].push('D' + blk); cols[1].push('D' + blk); blk++; }
          else {
            var np = level === 5 ? 1 : 2;
            var pIdx = [];
            for (var q = 0; q < np; q++) pIdx.push((disks - 1 - r - q + disks * 4) % disks);
            for (d = 0; d < disks; d++) {
              var pi = pIdx.indexOf(d);
              cols[d].push(pi >= 0 ? (pi === 0 ? 'P' : 'Q') + (r + 1) : 'D' + blk++);
            }
          }
        }
        return cols;
      }
      function draw() {
        num.set(disks);
        var cols = layout();
        clear(grid);
        cols.forEach(function (col, d) {
          var isF = failed.indexOf(d) >= 0;
          grid.appendChild(h('button', { type: 'button', class: 'v-disk' + (isF ? ' failed' : ''), onclick: function () {
            var i = failed.indexOf(d); if (i >= 0) failed.splice(i, 1); else failed.push(d); draw();
          } }, [h('div', { class: 'v-disk-name', text: 'Disk' + (d + 1) + (isF ? ' ✕' : '') })].concat(col.map(function (b) {
            return h('div', { class: 'v-blk' + (b[0] === 'P' || b[0] === 'Q' ? ' par' : ''), text: b });
          }))));
        });
        var tol = level === 0 ? 0 : level === 1 ? 1 : level === 5 ? 1 : 2;
        var ok = failed.length <= tol;
        var cap = level === 0 ? disks : level === 1 ? 1 : level === 5 ? disks - 1 : disks - 2;
        verdict.className = 'v-verdict ' + (failed.length === 0 ? 'ok' : ok ? 'warn' : 'ng');
        verdict.textContent = failed.length === 0 ? '全ディスク正常。ディスクをクリックして故障させてみよう。'
          : ok ? failed.length + '台故障でもデータは復元できる(' + (level === 1 ? 'ミラーから' : 'パリティから計算') + ')。'
            : failed.length + '台故障 → データ消失。RAID' + level + ' が耐えられるのは ' + tol + ' 台まで。';
        clear(metrics);
        metrics.appendChild(metric('実効容量', cap + ' 台分 / ' + disks + ' 台'));
        metrics.appendChild(metric('容量効率', fmt(cap / disks * 100, 0) + '%'));
        metrics.appendChild(metric('耐えられる故障', tol + ' 台'));
      }
      root.appendChild(seg.el); root.appendChild(num.el);
      root.appendChild(grid); root.appendChild(verdict); root.appendChild(metrics);
      draw();
    }
  });

  /* ------------------------------------------------------------------
   * 稼働率(直列・並列)
   * ------------------------------------------------------------------ */
  V.register('availability', {
    title: '直列・並列の稼働率を組み立てる',
    desc: '構成を選び、各装置の稼働率を動かすと、システム全体の稼働率と年間の停止時間が変わります。',
    mount: function (root) {
      var mode = 'mixed';
      var seg = ui.segmented([{ value: 'series', label: '直列 A−B' }, { value: 'parallel', label: '並列 A∥B' }, { value: 'mixed', label: 'A −(B∥C)' }], mode, function (v) { mode = v; draw(); });
      var pct = function (v) { return v.toFixed(2); };
      var a = ui.slider({ label: '装置 A の稼働率', min: 0.5, max: 0.999, step: 0.001, value: 0.9, fmt: pct, onInput: draw });
      var b = ui.slider({ label: '装置 B の稼働率', min: 0.5, max: 0.999, step: 0.001, value: 0.9, fmt: pct, onInput: draw });
      var c = ui.slider({ label: '装置 C の稼働率', min: 0.5, max: 0.999, step: 0.001, value: 0.9, fmt: pct, onInput: draw });
      var svg = s('svg', { viewBox: '0 0 340 120', class: 'v-svg', role: 'img', 'aria-label': '構成図' });
      var steps = h('ol', { class: 'v-log' });
      var metrics = h('div', { class: 'v-metrics' });
      function box(x, y, label, v) {
        var g = s('g');
        g.appendChild(s('rect', { x: x - 34, y: y - 17, width: 68, height: 34, rx: 7, class: 'v-node' }));
        g.appendChild(s('text', { x: x, y: y - 2, class: 'v-node-label', 'text-anchor': 'middle', text: label }));
        g.appendChild(s('text', { x: x, y: y + 12, class: 'v-tick', 'text-anchor': 'middle', text: v.toFixed(3) }));
        return g;
      }
      function line(x1, y1, x2, y2) { return s('line', { x1: x1, y1: y1, x2: x2, y2: y2, class: 'v-edge' }); }
      function draw() {
        c.el.style.display = mode === 'mixed' ? '' : 'none';
        clear(svg); clear(steps);
        var A = a.value, B = b.value, C = c.value, total;
        if (mode === 'series') {
          svg.appendChild(line(10, 60, 330, 60));
          svg.appendChild(box(120, 60, 'A', A)); svg.appendChild(box(220, 60, 'B', B));
          total = A * B;
          steps.appendChild(h('li', { text: '直列は掛け算: ' + A.toFixed(3) + ' × ' + B.toFixed(3) + ' = ' + total.toFixed(4) }));
        } else if (mode === 'parallel') {
          svg.appendChild(line(10, 60, 100, 60)); svg.appendChild(line(240, 60, 330, 60));
          svg.appendChild(line(100, 30, 100, 90)); svg.appendChild(line(240, 30, 240, 90));
          svg.appendChild(line(100, 30, 240, 30)); svg.appendChild(line(100, 90, 240, 90));
          svg.appendChild(box(170, 30, 'A', A)); svg.appendChild(box(170, 90, 'B', B));
          total = 1 - (1 - A) * (1 - B);
          steps.appendChild(h('li', { text: '両方止まる確率: (1−' + A.toFixed(3) + ')×(1−' + B.toFixed(3) + ') = ' + ((1 - A) * (1 - B)).toFixed(4) }));
          steps.appendChild(h('li', { text: '1 から引く: 1 − ' + ((1 - A) * (1 - B)).toFixed(4) + ' = ' + total.toFixed(4) }));
        } else {
          svg.appendChild(line(10, 60, 170, 60)); svg.appendChild(line(300, 60, 330, 60));
          svg.appendChild(line(170, 30, 170, 90)); svg.appendChild(line(300, 30, 300, 90));
          svg.appendChild(line(170, 30, 300, 30)); svg.appendChild(line(170, 90, 300, 90));
          svg.appendChild(box(80, 60, 'A', A)); svg.appendChild(box(235, 30, 'B', B)); svg.appendChild(box(235, 90, 'C', C));
          var bc = 1 - (1 - B) * (1 - C);
          total = A * bc;
          steps.appendChild(h('li', { text: '内側の並列 B∥C: 1 − (1−' + B.toFixed(3) + ')(1−' + C.toFixed(3) + ') = ' + bc.toFixed(4) }));
          steps.appendChild(h('li', { text: 'A と直列: ' + A.toFixed(3) + ' × ' + bc.toFixed(4) + ' = ' + total.toFixed(4) }));
        }
        clear(metrics);
        metrics.appendChild(metric('システム全体の稼働率', total.toFixed(4), 'good'));
        metrics.appendChild(metric('年間の停止時間(目安)', fmt((1 - total) * 8760, 1) + ' 時間'));
      }
      root.appendChild(seg.el);
      root.appendChild(svg);
      root.appendChild(a.el); root.appendChild(b.el); root.appendChild(c.el);
      root.appendChild(steps); root.appendChild(metrics);
      draw();
    }
  });

  /* ------------------------------------------------------------------
   * ページ置換え
   * ------------------------------------------------------------------ */
  function simulatePaging(refs, frames, algo) {
    var mem = [], last = {}, loaded = {}, faults = 0, cols = [];
    refs.forEach(function (p, t) {
      var hit = mem.indexOf(p) >= 0, out = null;
      if (!hit) {
        faults++;
        if (mem.length >= frames) {
          var victim = mem.slice().sort(function (x, y) { return algo === 'FIFO' ? loaded[x] - loaded[y] : last[x] - last[y]; })[0];
          out = victim;
          mem[mem.indexOf(victim)] = p;
        } else mem.push(p);
        loaded[p] = t;
      }
      last[p] = t;
      cols.push({ p: p, mem: mem.slice(), hit: hit, out: out });
    });
    return { faults: faults, cols: cols };
  }

  V.register('paging', {
    title: 'FIFO と LRU のページフォールトを数える',
    desc: '参照列とページ枠の数を変えると、2つの方式の動きが並んで表示されます。赤い列がページフォールトです。',
    mount: function (root) {
      var input = h('input', { type: 'text', class: 'v-text', value: '1,2,3,4,1,2,5,1,2,3,4,5', 'aria-label': 'ページ参照列' });
      var frames = ui.slider({ label: 'ページ枠の数', min: 1, max: 5, value: 3, onInput: draw });
      var out = h('div');
      function table(res, F) {
        var t = h('table', { class: 'v-gantt paging' });
        t.appendChild(h('tr', null, [h('th', { text: '参照' })].concat(res.cols.map(function (c) { return h('th', { text: c.p }); }))));
        for (var f = 0; f < F; f++) {
          t.appendChild(h('tr', null, [h('th', { text: '枠' + (f + 1) })].concat(res.cols.map(function (c) {
            var v = c.mem[f];
            return h('td', { class: (c.hit ? '' : 'fault') + (v === c.p && !c.hit ? ' new' : ''), text: v === undefined ? '' : v });
          }))));
        }
        t.appendChild(h('tr', null, [h('th', { text: '' })].concat(res.cols.map(function (c) {
          return h('td', { class: 'mark', text: c.hit ? '○' : (c.out !== null ? '✕' + c.out : '✕') });
        }))));
        return t;
      }
      function draw() {
        var refs = input.value.split(/[\s,、]+/).filter(Boolean);
        var F = frames.value;
        clear(out);
        ['FIFO', 'LRU'].forEach(function (algo) {
          var r = simulatePaging(refs, F, algo);
          out.appendChild(h('div', { class: 'v-label', text: algo + (algo === 'FIFO' ? '(最も古く読み込んだページを追い出す)' : '(最も長く使われていないページを追い出す)') + ' … フォールト ' + r.faults + ' 回' }));
          out.appendChild(h('div', { class: 'v-scroll' }, table(r, F)));
        });
        var a3 = simulatePaging(refs, 3, 'FIFO').faults, a4 = simulatePaging(refs, 4, 'FIFO').faults;
        if (a4 > a3) out.appendChild(h('p', { class: 'v-note', text: 'この参照列では FIFO で枠を3→4に増やすとフォールトが ' + a3 + '→' + a4 + ' 回に増える(ベラディの異常)。' }));
        out.appendChild(h('p', { class: 'v-caption', text: '○ = ヒット、✕n = フォールト(n を追い出した)' }));
      }
      input.addEventListener('input', draw);
      root.appendChild(input); root.appendChild(frames.el); root.appendChild(out);
      draw();
    }
  });

  /* ------------------------------------------------------------------
   * デッドロック
   * ------------------------------------------------------------------ */
  V.register('deadlock', {
    title: '2つのタスクでデッドロックを起こしてみる',
    desc: 'タスク1とタスク2の「次へ」を交互に押してみましょう。確保順序が逆だと、互いに待ち続けて止まります。',
    mount: function (root) {
      var mode = 'reverse';
      var plans, pc, holder, waiting;
      var seg = ui.segmented([{ value: 'reverse', label: '確保順序がバラバラ' }, { value: 'same', label: '確保順序を統一' }], mode, function (v) { mode = v; reset(); });
      var view = h('div', { class: 'v-split' });
      var verdict = h('div', { class: 'v-verdict' });
      var res = h('div', { class: 'v-row' });
      function reset() {
        plans = {
          1: [['lock', 'A'], ['lock', 'B'], ['work'], ['unlock', 'B'], ['unlock', 'A']],
          2: mode === 'same' ? [['lock', 'A'], ['lock', 'B'], ['work'], ['unlock', 'B'], ['unlock', 'A']]
            : [['lock', 'B'], ['lock', 'A'], ['work'], ['unlock', 'A'], ['unlock', 'B']]
        };
        pc = { 1: 0, 2: 0 }; holder = { A: null, B: null }; waiting = { 1: null, 2: null };
        draw();
      }
      function step(tid) {
        var plan = plans[tid];
        if (pc[tid] >= plan.length) return;
        var op = plan[pc[tid]];
        if (op[0] === 'lock') {
          if (holder[op[1]] && holder[op[1]] !== tid) { waiting[tid] = op[1]; draw(); return; }
          holder[op[1]] = tid; waiting[tid] = null;
        } else if (op[0] === 'unlock') {
          holder[op[1]] = null;
          [1, 2].forEach(function (o) { if (waiting[o] === op[1]) waiting[o] = null; });
        }
        pc[tid]++;
        draw();
      }
      function label(op) { return op[0] === 'lock' ? '資源' + op[1] + ' を確保' : op[0] === 'unlock' ? '資源' + op[1] + ' を解放' : '処理を実行'; }
      function draw() {
        clear(view);
        [1, 2].forEach(function (tid) {
          var col = h('div', { class: 'v-task' }, [h('div', { class: 'v-label', text: 'タスク' + tid })]);
          var ol = h('ol', { class: 'v-steps' });
          plans[tid].forEach(function (op, i) {
            ol.appendChild(h('li', { class: i < pc[tid] ? 'done' : i === pc[tid] ? (waiting[tid] ? 'wait' : 'cur') : '', text: label(op) + (i === pc[tid] && waiting[tid] ? '(待ち…)' : '') }));
          });
          col.appendChild(ol);
          col.appendChild(ui.button(pc[tid] >= plans[tid].length ? '完了' : 'タスク' + tid + ' を次へ', function () { step(tid); }, 'primary'));
          view.appendChild(col);
        });
        clear(res);
        ['A', 'B'].forEach(function (r) {
          res.appendChild(h('span', { class: 'v-chip' + (holder[r] ? ' hot' : ''), text: '資源' + r + ': ' + (holder[r] ? 'タスク' + holder[r] + ' が保持' : '空き') }));
        });
        var dead = waiting[1] && waiting[2];
        var done = pc[1] >= plans[1].length && pc[2] >= plans[2].length;
        verdict.className = 'v-verdict ' + (dead ? 'ng' : done ? 'ok' : '');
        verdict.textContent = dead ? 'デッドロック!タスク1は資源' + waiting[1] + '、タスク2は資源' + waiting[2] + 'を待ち、互いに相手の解放を待っている(循環待ち)。'
          : done ? '両方のタスクが完了した。' : (waiting[1] || waiting[2]) ? '一方が待っている。もう一方を進めれば解放される。' : '交互に進めてみよう。';
      }
      root.appendChild(seg.el); root.appendChild(res); root.appendChild(view); root.appendChild(verdict);
      root.appendChild(h('div', { class: 'v-row' }, ui.button('最初から', reset)));
      reset();
    }
  });

  /* ------------------------------------------------------------------
   * 正規化
   * ------------------------------------------------------------------ */
  V.register('normalize', {
    title: '受注表を第3正規形まで分解する',
    desc: '「次の段階へ」を押すと表が分解されていきます。下線 = 主キー。どの従属をなくしたのかに注目してください。',
    mount: function (root) {
      var stages = [
        { name: '非正規形', note: '1行の中に商品が繰り返し並んでいる(繰返し項目)。',
          tables: [{ name: '受注', key: ['受注番号'], cols: ['受注番号', '顧客番号', '顧客名', '商品コード1, 商品名1, 数量1', '商品コード2, 商品名2, 数量2'],
            rows: [['001', 'C1', '山田商店', 'P1, ペン, 10', 'P2, ノート, 5'], ['002', 'C2', '佐藤文具', 'P1, ペン, 3', '']] }] },
        { name: '第1正規形', note: '繰返しをなくし、1セル1値に。主キーは(受注番号, 商品コード)の複合キーになった。',
          tables: [{ name: '受注明細', key: ['受注番号', '商品コード'], cols: ['受注番号', '商品コード', '顧客番号', '顧客名', '商品名', '数量'],
            rows: [['001', 'P1', 'C1', '山田商店', 'ペン', '10'], ['001', 'P2', 'C1', '山田商店', 'ノート', '5'], ['002', 'P1', 'C2', '佐藤文具', 'ペン', '3']] }] },
        { name: '第2正規形', note: '主キーの一部だけで決まる列(部分関数従属)を分離。顧客番号・顧客名は受注番号だけで、商品名は商品コードだけで決まる。',
          tables: [
            { name: '受注', key: ['受注番号'], cols: ['受注番号', '顧客番号', '顧客名'], rows: [['001', 'C1', '山田商店'], ['002', 'C2', '佐藤文具']] },
            { name: '受注明細', key: ['受注番号', '商品コード'], cols: ['受注番号', '商品コード', '数量'], rows: [['001', 'P1', '10'], ['001', 'P2', '5'], ['002', 'P1', '3']] },
            { name: '商品', key: ['商品コード'], cols: ['商品コード', '商品名'], rows: [['P1', 'ペン'], ['P2', 'ノート']] }] },
        { name: '第3正規形', note: '主キー以外の列を経由して決まる列(推移的関数従属: 受注番号 → 顧客番号 → 顧客名)を分離。',
          tables: [
            { name: '受注', key: ['受注番号'], cols: ['受注番号', '顧客番号'], rows: [['001', 'C1'], ['002', 'C2']] },
            { name: '顧客', key: ['顧客番号'], cols: ['顧客番号', '顧客名'], rows: [['C1', '山田商店'], ['C2', '佐藤文具']] },
            { name: '受注明細', key: ['受注番号', '商品コード'], cols: ['受注番号', '商品コード', '数量'], rows: [['001', 'P1', '10'], ['001', 'P2', '5'], ['002', 'P1', '3']] },
            { name: '商品', key: ['商品コード'], cols: ['商品コード', '商品名'], rows: [['P1', 'ペン'], ['P2', 'ノート']] }] }
      ];
      var i = 0;
      var title = h('div', { class: 'v-stage' });
      var note = h('p', { class: 'v-note' });
      var tables = h('div', { class: 'v-tables' });
      var prevB = ui.button('← 前の段階', function () { if (i > 0) { i--; draw(); } });
      var nextB = ui.button('次の段階へ →', function () { if (i < stages.length - 1) { i++; draw(); } }, 'primary');
      function draw() {
        var st = stages[i];
        title.textContent = (i + 1) + ' / ' + stages.length + '  ' + st.name;
        note.textContent = st.note;
        clear(tables);
        st.tables.forEach(function (tb) {
          var t = h('table', { class: 'v-table' });
          t.appendChild(h('caption', { text: tb.name }));
          t.appendChild(h('tr', null, tb.cols.map(function (c) { return h('th', { class: tb.key.indexOf(c) >= 0 ? 'pk' : '', text: c }); })));
          tb.rows.forEach(function (r) { t.appendChild(h('tr', null, r.map(function (v) { return h('td', { text: v }); }))); });
          tables.appendChild(h('div', { class: 'v-scroll' }, t));
        });
        prevB.disabled = i === 0; nextB.disabled = i === stages.length - 1;
      }
      root.appendChild(title); root.appendChild(note); root.appendChild(tables);
      root.appendChild(h('div', { class: 'v-row' }, [prevB, nextB]));
      draw();
    }
  });

  /* ------------------------------------------------------------------
   * SQL: WHERE と HAVING
   * ------------------------------------------------------------------ */
  V.register('sql', {
    title: 'WHERE と HAVING が効くタイミング',
    desc: 'しきい値を動かして、WHERE(集計前に行を絞る)と HAVING(集計後にグループを絞る)の結果の違いを見比べましょう。',
    mount: function (root) {
      var rows = [['東京', 'ペン', 300], ['東京', 'ノート', 800], ['東京', 'のり', 150], ['大阪', 'ペン', 500], ['大阪', 'ノート', 200], ['名古屋', 'ペン', 900], ['名古屋', 'のり', 100], ['福岡', 'ノート', 250]];
      var mode = 'having';
      var seg = ui.segmented([{ value: 'where', label: 'WHERE 金額 >= x' }, { value: 'having', label: 'HAVING SUM(金額) >= x' }], mode, function (v) { mode = v; draw(); });
      var th = ui.slider({ label: 'しきい値 x', min: 0, max: 1500, step: 50, value: 1000, fmt: function (v) { return v + ' 円'; }, onInput: draw });
      var sqlEl = h('pre', { class: 'v-code' });
      var stages = h('div', { class: 'v-tables' });
      function tbl(caption, head, data, hl) {
        var t = h('table', { class: 'v-table' }, [h('caption', { text: caption }), h('tr', null, head.map(function (x) { return h('th', { text: x }); }))]);
        data.forEach(function (r, i) { t.appendChild(h('tr', { class: hl && hl(r, i) ? 'dim' : '' }, r.map(function (v) { return h('td', { text: v }); }))); });
        return h('div', { class: 'v-scroll' }, t);
      }
      function group(data) {
        var m = {}, order = [];
        data.forEach(function (r) { if (!m[r[0]]) { m[r[0]] = 0; order.push(r[0]); } m[r[0]] += r[2]; });
        return order.map(function (k) { return [k, m[k]]; });
      }
      function draw() {
        var x = th.value;
        sqlEl.textContent = mode === 'where'
          ? 'SELECT 店舗, SUM(金額)\n  FROM 売上\n WHERE 金額 >= ' + x + '\n GROUP BY 店舗'
          : 'SELECT 店舗, SUM(金額)\n  FROM 売上\n GROUP BY 店舗\nHAVING SUM(金額) >= ' + x;
        clear(stages);
        if (mode === 'where') {
          stages.appendChild(tbl('① FROM 売上(グレー = WHERE で除外)', ['店舗', '商品', '金額'], rows, function (r) { return r[2] < x; }));
          var g = group(rows.filter(function (r) { return r[2] >= x; }));
          stages.appendChild(tbl('② GROUP BY 店舗 → 結果', ['店舗', 'SUM(金額)'], g));
        } else {
          stages.appendChild(tbl('① FROM 売上', ['店舗', '商品', '金額'], rows));
          var g2 = group(rows);
          stages.appendChild(tbl('② GROUP BY 店舗(グレー = HAVING で除外)', ['店舗', 'SUM(金額)'], g2, function (r) { return r[1] < x; }));
          stages.appendChild(tbl('③ 結果', ['店舗', 'SUM(金額)'], g2.filter(function (r) { return r[1] >= x; })));
        }
      }
      root.appendChild(seg.el); root.appendChild(th.el); root.appendChild(sqlEl); root.appendChild(stages);
      draw();
    }
  });

  /* ------------------------------------------------------------------
   * 障害回復
   * ------------------------------------------------------------------ */
  V.register('recovery', {
    title: 'システム障害からの回復を判断する',
    desc: '各トランザクションをクリックして処理(何もしない/ロールフォワード/ロールバック)を選び、「答え合わせ」を押してください。',
    mount: function (root) {
      var CP = 140, FAIL = 300;
      var txs = [
        { id: 'T1', s: 30, e: 110, commit: true },
        { id: 'T2', s: 80, e: 200, commit: true },
        { id: 'T3', s: 170, e: 260, commit: true },
        { id: 'T4', s: 100, e: null, commit: false },
        { id: 'T5', s: 220, e: null, commit: false }
      ];
      var OPTS = ['何もしない', 'ロールフォワード', 'ロールバック'];
      var pick = {};
      var svg = s('svg', { viewBox: '0 0 340 170', class: 'v-svg', role: 'img', 'aria-label': 'トランザクションのタイムライン' });
      var result = h('div');
      function correct(t) { return t.commit ? (t.e <= CP ? 0 : 1) : 2; }
      function draw() {
        clear(svg);
        svg.appendChild(s('line', { x1: CP, y1: 8, x2: CP, y2: 150, class: 'v-guide' }));
        svg.appendChild(s('text', { x: CP, y: 165, class: 'v-tick', 'text-anchor': 'middle', text: 'チェックポイント' }));
        svg.appendChild(s('line', { x1: FAIL, y1: 8, x2: FAIL, y2: 150, class: 'v-guide danger' }));
        svg.appendChild(s('text', { x: FAIL, y: 165, class: 'v-tick danger', 'text-anchor': 'middle', text: '障害発生' }));
        txs.forEach(function (t, i) {
          var y = 20 + i * 27;
          var g = s('g', { class: 'v-tx', 'data-touch': '1', role: 'button', tabindex: 0 });
          var end = t.e || FAIL;
          g.appendChild(s('line', { x1: t.s, y1: y, x2: end, y2: y, class: 'v-txline' + (t.commit ? '' : ' open') }));
          if (t.commit) g.appendChild(s('circle', { cx: t.e, cy: y, r: 4, class: 'v-dot' }));
          g.appendChild(s('text', { x: t.s - 6, y: y + 4, class: 'v-node-label', 'text-anchor': 'end', text: t.id }));
          var p = pick[t.id];
          g.appendChild(s('text', { x: (t.commit ? t.e : FAIL) + 8, y: y + 4, class: 'v-tick strong', text: p === undefined ? '▶ クリックで選択' : OPTS[p] }));
          g.addEventListener('click', function () { pick[t.id] = ((pick[t.id] === undefined ? -1 : pick[t.id]) + 1) % 3; clear(result); draw(); });
          svg.appendChild(g);
        });
      }
      function check() {
        clear(result);
        var ok = 0;
        var ul = h('ul', { class: 'v-log' });
        txs.forEach(function (t) {
          var c = correct(t), good = pick[t.id] === c;
          if (good) ok++;
          ul.appendChild(h('li', { class: good ? 'v-ok' : 'v-err', text: t.id + ': 正解は「' + OPTS[c] + '」 — ' +
            (c === 0 ? 'チェックポイント前にコミット済みで、更新はディスクに反映されている。'
              : c === 1 ? 'チェックポイント後にコミット。更新後ログで再現する。'
                : '障害時点で未コミット。更新前ログで取り消す。') }));
        });
        result.appendChild(h('div', { class: 'v-verdict ' + (ok === txs.length ? 'ok' : 'warn'), text: txs.length + '問中 ' + ok + '問正解' }));
        result.appendChild(ul);
      }
      root.appendChild(svg);
      root.appendChild(h('p', { class: 'v-caption', text: '● = コミット、実線が障害まで伸びている = 未コミット' }));
      root.appendChild(h('div', { class: 'v-row' }, [ui.button('答え合わせ', check, 'primary'), ui.button('リセット', function () { pick = {}; clear(result); draw(); })]));
      root.appendChild(result);
      draw();
    }
  });

  /* ------------------------------------------------------------------
   * サブネット計算
   * ------------------------------------------------------------------ */
  V.register('subnet', {
    title: 'プレフィックス長とホスト数',
    desc: 'プレフィックス長を動かすと、32ビットのうちネットワーク部(青)とホスト部(緑)の境界が動きます。',
    mount: function (root) {
      var ipIn = h('input', { type: 'text', class: 'v-text', value: '192.168.10.77', 'aria-label': 'IPアドレス' });
      var pre = ui.slider({ label: 'プレフィックス長 /n', min: 8, max: 30, value: 26, fmt: function (v) { return '/' + v; }, onInput: draw });
      var bitsEl = h('div', { class: 'v-ipbits' });
      var metrics = h('div', { class: 'v-metrics' });
      function parse() {
        var p = ipIn.value.trim().split('.').map(Number);
        if (p.length !== 4 || p.some(function (x) { return isNaN(x) || x < 0 || x > 255; })) return null;
        return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
      }
      function str(v) { return [v >>> 24, (v >>> 16) & 255, (v >>> 8) & 255, v & 255].join('.'); }
      function draw() {
        var ip = parse(), n = pre.value;
        clear(bitsEl); clear(metrics);
        if (ip === null) { metrics.appendChild(h('p', { class: 'v-err', text: 'IPv4 アドレスの形式で入力してください(例 192.168.10.77)。' })); return; }
        var bin = (ip >>> 0).toString(2).padStart(32, '0');
        for (var i = 0; i < 32; i++) {
          bitsEl.appendChild(h('span', { class: 'b ' + (i < n ? 'net' : 'host') + (i % 8 === 7 && i < 31 ? ' sep' : ''), text: bin[i] }));
        }
        var mask = n === 0 ? 0 : (0xFFFFFFFF << (32 - n)) >>> 0;
        var net = (ip & mask) >>> 0, bc = (net | (~mask >>> 0)) >>> 0;
        var hostBits = 32 - n;
        metrics.appendChild(metric('サブネットマスク', str(mask)));
        metrics.appendChild(metric('ネットワークアドレス', str(net)));
        metrics.appendChild(metric('ブロードキャスト', str(bc)));
        metrics.appendChild(metric('割当て可能ホスト数', '2^' + hostBits + ' − 2 = ' + (Math.pow(2, hostBits) - 2).toLocaleString(), 'good'));
        metrics.appendChild(metric('ホストの範囲', str(net + 1) + ' 〜 ' + str(bc - 1)));
      }
      ipIn.addEventListener('input', draw);
      root.appendChild(ipIn); root.appendChild(pre.el); root.appendChild(bitsEl); root.appendChild(metrics);
      draw();
    }
  });

  /* ------------------------------------------------------------------
   * データ転送時間
   * ------------------------------------------------------------------ */
  V.register('transfer', {
    title: '転送時間の計算を単位ごとに追う',
    desc: 'データ量・回線速度・伝送効率を変えると、計算の各段階が更新されます。',
    mount: function (root) {
      var size = ui.slider({ label: 'データ量', min: 10, max: 1000, step: 10, value: 100, fmt: function (v) { return v + ' Mバイト'; }, onInput: draw });
      var speed = ui.slider({ label: '回線速度', min: 10, max: 1000, step: 10, value: 100, fmt: function (v) { return v + ' Mビット/秒'; }, onInput: draw });
      var eff = ui.slider({ label: '伝送効率', min: 10, max: 100, step: 5, value: 80, fmt: function (v) { return v + '%'; }, onInput: draw });
      var steps = h('ol', { class: 'v-log big' });
      var prog = h('div', { class: 'v-progress' }, h('span'));
      var timer = null;
      function draw() {
        var bits = size.value * 8, real = speed.value * eff.value / 100, sec = bits / real;
        clear(steps);
        steps.appendChild(h('li', { text: 'バイト → ビット: ' + size.value + ' × 8 = ' + bits + ' Mビット' }));
        steps.appendChild(h('li', { text: '実効速度: ' + speed.value + ' × ' + (eff.value / 100) + ' = ' + fmt(real, 1) + ' Mビット/秒' }));
        steps.appendChild(h('li', { class: 'v-ok', text: '転送時間: ' + bits + ' ÷ ' + fmt(real, 1) + ' = ' + fmt(sec, 2) + ' 秒' }));
        return sec;
      }
      function run() {
        clearInterval(timer);
        var sec = draw(), shown = Math.min(sec, 8), t0 = Date.now();
        var bar = prog.firstChild;
        timer = setInterval(function () {
          var r = Math.min(1, (Date.now() - t0) / 1000 / shown);
          bar.style.width = (r * 100) + '%';
          bar.textContent = fmt(r * sec, 1) + ' 秒';
          if (r >= 1) clearInterval(timer);
        }, 50);
      }
      root.appendChild(size.el); root.appendChild(speed.el); root.appendChild(eff.el);
      root.appendChild(steps);
      root.appendChild(h('div', { class: 'v-row' }, ui.button('転送してみる(最大8秒に短縮表示)', run, 'primary')));
      root.appendChild(prog);
      draw();
    }
  });

  /* ------------------------------------------------------------------
   * 公開鍵暗号とディジタル署名
   * ------------------------------------------------------------------ */
  V.register('keys', {
    title: 'どの鍵を使う?暗号化と署名の鍵選び',
    desc: 'アリスがボブにメッセージを送ります。目的を選び、使う鍵を2つ選んで「送信」してください。',
    mount: function (root) {
      var purpose = 'enc', k1 = null, k2 = null;
      var KEYS = [['ap', 'アリスの公開鍵'], ['as', 'アリスの秘密鍵'], ['bp', 'ボブの公開鍵'], ['bs', 'ボブの秘密鍵']];
      var seg = ui.segmented([{ value: 'enc', label: '盗み見されたくない(暗号化)' }, { value: 'sig', label: '本人が送ったと証明したい(署名)' }], purpose, function (v) { purpose = v; k1 = k2 = null; draw(); });
      var area = h('div');
      var verdict = h('div', { class: 'v-verdict' });
      function keyRow(label, cur, set) {
        var row = h('div', { class: 'v-keyrow' }, [h('div', { class: 'v-label', text: label })]);
        var wrap = h('div', { class: 'v-row' });
        KEYS.forEach(function (k) {
          wrap.appendChild(h('button', { type: 'button', class: 'v-key ' + k[0][1] + (cur === k[0] ? ' is-on' : ''), onclick: function () { set(k[0]); draw(); } }, [h('span', { text: k[0][1] === 'p' ? '🔓' : '🔑' }), k[1]]));
        });
        row.appendChild(wrap);
        return row;
      }
      function draw() {
        clear(area);
        area.appendChild(keyRow(purpose === 'enc' ? '① アリスが暗号化に使う鍵' : '① アリスが署名に使う鍵', k1, function (v) { k1 = v; }));
        area.appendChild(keyRow(purpose === 'enc' ? '② ボブが復号に使う鍵' : '② ボブが検証に使う鍵', k2, function (v) { k2 = v; }));
        verdict.className = 'v-verdict';
        verdict.textContent = '鍵を2つ選んでください。';
        if (!k1 || !k2) return;
        var pair = { ap: 'as', as: 'ap', bp: 'bs', bs: 'bp' };
        var msg, ok = false;
        if (pair[k1] !== k2) msg = '① と ② がペアの鍵ではないので、そもそも復号・検証できない。';
        else if (purpose === 'enc') {
          if (k1 === 'bp') { ok = true; msg = '正解!ボブの公開鍵で暗号化すると、ボブの秘密鍵を持つボブだけが復号できる。'; }
          else if (k1 === 'ap') msg = 'アリスの公開鍵で暗号化すると、復号できるのはアリス(秘密鍵の持ち主)だけ。ボブは読めない。';
          else if (k1 === 'as') msg = 'アリスの秘密鍵で暗号化すると、公開されているアリスの公開鍵で「誰でも」復号できる。盗み見を防げない(これは署名の使い方)。';
          else msg = 'ボブの秘密鍵はボブしか持っていない。アリスは使えない。';
        } else {
          if (k1 === 'as') { ok = true; msg = '正解!アリスの秘密鍵で署名し、アリスの公開鍵で検証。秘密鍵を持つのはアリスだけなので、本人が送ったと証明できる。'; }
          else if (k1 === 'bs') msg = 'ボブの秘密鍵はボブしか持っていない。アリスは使えない。';
          else msg = '公開鍵は誰でも入手できるので、それで作った署名は誰にでも作れる。本人の証明にならない。';
        }
        verdict.className = 'v-verdict ' + (ok ? 'ok' : 'ng');
        verdict.textContent = msg;
      }
      root.appendChild(seg.el); root.appendChild(area); root.appendChild(verdict);
      draw();
    }
  });

  /* ------------------------------------------------------------------
   * ハッシュ関数(SHA-256)
   * ------------------------------------------------------------------ */
  function sha256(str) {
    var bytes = unescape(encodeURIComponent(str)).split('').map(function (c) { return c.charCodeAt(0); });
    var K = [], H = [], i, j;
    function frac(x) { return ((x - Math.floor(x)) * 0x100000000) | 0; }
    var primes = [], n = 2;
    while (primes.length < 64) { var isP = true; for (j = 2; j * j <= n; j++) if (n % j === 0) { isP = false; break; } if (isP) primes.push(n); n++; }
    for (i = 0; i < 64; i++) K[i] = frac(Math.cbrt(primes[i]));
    for (i = 0; i < 8; i++) H[i] = frac(Math.sqrt(primes[i]));
    var l = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (l >>> (i * 8)) & 255);
    function rotr(x, r) { return (x >>> r) | (x << (32 - r)); }
    for (var off = 0; off < bytes.length; off += 64) {
      var w = [];
      for (i = 0; i < 16; i++) w[i] = (bytes[off + i * 4] << 24) | (bytes[off + i * 4 + 1] << 16) | (bytes[off + i * 4 + 2] << 8) | bytes[off + i * 4 + 3];
      for (i = 16; i < 64; i++) {
        var s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        var s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], hh = H[7];
      for (i = 0; i < 64; i++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var t1 = (hh + S1 + ch + K[i] + w[i]) | 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var mj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + mj) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + hh) | 0;
    }
    return H.map(function (x) { return (x >>> 0).toString(16).padStart(8, '0'); }).join('');
  }
  V.sha256 = sha256;

  V.register('hash', {
    title: '1文字変えるとハッシュ値はどうなる?',
    desc: '2つの入力欄に文字を入れると SHA-256 のハッシュ値が計算されます。1文字だけ違う文でも、約半分のビットが変わります(雪崩効果)。',
    mount: function (root) {
      var a = h('input', { type: 'text', class: 'v-text', value: '応用情報に合格する', 'aria-label': '入力1' });
      var b = h('input', { type: 'text', class: 'v-text', value: '応用情報に合格した', 'aria-label': '入力2' });
      var ha = h('div', { class: 'v-hash' }), hb = h('div', { class: 'v-hash' });
      var metrics = h('div', { class: 'v-metrics' });
      function draw() {
        var x = sha256(a.value), y = sha256(b.value), diffBits = 0;
        clear(ha); clear(hb);
        for (var i = 0; i < 64; i++) {
          var same = x[i] === y[i];
          ha.appendChild(h('span', { class: same ? '' : 'diff', text: x[i] }));
          hb.appendChild(h('span', { class: same ? '' : 'diff', text: y[i] }));
          var v = parseInt(x[i], 16) ^ parseInt(y[i], 16);
          while (v) { diffBits += v & 1; v >>= 1; }
        }
        clear(metrics);
        metrics.appendChild(metric('ハッシュ値の長さ', '256 ビット(入力の長さに関係なく固定)'));
        metrics.appendChild(metric('異なるビット数', diffBits + ' / 256', diffBits > 0 ? 'neg' : 'good'));
      }
      a.addEventListener('input', draw); b.addEventListener('input', draw);
      root.appendChild(h('div', { class: 'v-label', text: '入力1' })); root.appendChild(a); root.appendChild(ha);
      root.appendChild(h('div', { class: 'v-label', text: '入力2' })); root.appendChild(b); root.appendChild(hb);
      root.appendChild(metrics);
      root.appendChild(h('p', { class: 'v-caption', text: 'ハッシュ値から元の文章を逆算する方法はない(一方向性)。だから改ざん検知やパスワード保存に使える。' }));
      draw();
    }
  });

  /* ------------------------------------------------------------------
   * SQL インジェクション
   * ------------------------------------------------------------------ */
  V.register('sqli', {
    title: 'SQL インジェクションとプレースホルダ',
    desc: '利用者名に  \' OR \'1\'=\'1\' --  と入れてみてください。文字列連結だと SQL の構造そのものが書き換わります。',
    mount: function (root) {
      var mode = 'concat';
      var seg = ui.segmented([{ value: 'concat', label: '文字列連結(危険)' }, { value: 'bind', label: 'プレースホルダ(安全)' }], mode, function (v) { mode = v; draw(); });
      var user = h('input', { type: 'text', class: 'v-text', value: "' OR '1'='1' --", 'aria-label': '利用者名' });
      var pass = h('input', { type: 'text', class: 'v-text', value: 'てきとう', 'aria-label': 'パスワード' });
      var code = h('pre', { class: 'v-code' });
      var verdict = h('div', { class: 'v-verdict' });
      function draw() {
        clear(code);
        if (mode === 'concat') {
          code.appendChild(document.createTextNode("SELECT * FROM users\n WHERE name = '"));
          code.appendChild(h('mark', { text: user.value }));
          code.appendChild(document.createTextNode("'\n   AND pass = '"));
          code.appendChild(h('mark', { text: pass.value }));
          code.appendChild(document.createTextNode("'"));
          var u = user.value;
          var bypass = /'\s*(or|OR)\s*('?)(\w+)\2\s*=\s*\2\3\2/.test(u) || /'\s*--/.test(u) || /'\s*(or|OR)\s+1\s*=\s*1/.test(u);
          var broken = u.indexOf("'") >= 0 || pass.value.indexOf("'") >= 0;
          verdict.className = 'v-verdict ' + (bypass ? 'ng' : broken ? 'warn' : 'ok');
          verdict.textContent = bypass ? '認証回避!入力した文字が SQL の一部として解釈され、条件が常に真(または以降がコメント)になった。パスワードなしでログインできてしまう。'
            : broken ? '入力の \' で文字列が途中で閉じ、SQL の構造が変わった(構文エラーや予期しない動作の原因)。'
              : '普通の入力なら問題は起きない。でも攻撃者は普通の入力をしてくれない。';
        } else {
          code.textContent = "SELECT * FROM users\n WHERE name = ?\n   AND pass = ?\n\n-- バインドする値\n1: " + JSON.stringify(user.value) + '\n2: ' + JSON.stringify(pass.value);
          verdict.className = 'v-verdict ok';
          verdict.textContent = 'SQL 文の構造は先に確定し、入力は「ただの値」として渡される。どんな記号を入れても SQL として解釈されない。';
        }
      }
      user.addEventListener('input', draw); pass.addEventListener('input', draw);
      root.appendChild(seg.el);
      root.appendChild(h('div', { class: 'v-label', text: '利用者名' })); root.appendChild(user);
      root.appendChild(h('div', { class: 'v-label', text: 'パスワード' })); root.appendChild(pass);
      root.appendChild(code); root.appendChild(verdict);
      draw();
    }
  });

  /* ------------------------------------------------------------------
   * テストの網羅率と境界値
   * ------------------------------------------------------------------ */
  V.register('coverage', {
    title: 'テストケースを選んで網羅率を測る',
    desc: '判定「A かつ B」に対するテストケースを選ぶと、命令網羅・判定条件網羅・条件網羅の達成度がわかります。',
    mount: function (root) {
      var cases = [[1, 1], [1, 0], [0, 1], [0, 0]];
      var sel = [false, false, false, false];
      var code = h('pre', { class: 'v-code', text: 'if (A > 0 and B > 0) {\n    処理P\n}\n処理Q' });
      var list = h('div', { class: 'v-row' });
      var metrics = h('div', { class: 'v-metrics' });
      var hint = h('p', { class: 'v-note' });
      var bv = h('div', { class: 'v-numline' });
      var bvVerdict = h('div', { class: 'v-verdict' });
      var bvPicked = {};
      function tf(v) { return v ? '真' : '偽'; }
      function draw() {
        clear(list);
        cases.forEach(function (c, i) {
          list.appendChild(h('button', { type: 'button', class: 'v-key' + (sel[i] ? ' is-on' : ''), onclick: function () { sel[i] = !sel[i]; draw(); } },
            'A=' + tf(c[0]) + ', B=' + tf(c[1]) + ' → 判定' + tf(c[0] && c[1])));
        });
        var chosen = cases.filter(function (_, i) { return sel[i]; });
        var stmt = chosen.some(function (c) { return c[0] && c[1]; }) ? 100 : (chosen.length ? 50 : 0);
        var dT = chosen.some(function (c) { return c[0] && c[1]; }), dF = chosen.some(function (c) { return !(c[0] && c[1]); });
        var dec = (dT ? 50 : 0) + (dF ? 50 : 0);
        var cnt = 0;
        [0, 1].forEach(function (k) { [0, 1].forEach(function (v) { if (chosen.some(function (c) { return c[k] === v; })) cnt++; }); });
        var cond = cnt * 25;
        clear(metrics);
        metrics.appendChild(metric('命令網羅', stmt + '%', stmt === 100 ? 'good' : ''));
        metrics.appendChild(metric('判定条件網羅', dec + '%', dec === 100 ? 'good' : ''));
        metrics.appendChild(metric('条件網羅', cond + '%', cond === 100 ? 'good' : ''));
        hint.textContent = cond === 100 && dec < 100 ? 'ポイント: 条件網羅が100%でも、判定条件網羅が100%とは限らない(A,B が真偽を取っても判定全体が真にならない)。'
          : dec === 100 && cond < 100 ? 'ポイント: 判定の真偽は網羅できたが、個々の条件 A・B の真偽はそろっていない。'
            : stmt === 100 && dec < 100 ? 'ポイント: 命令網羅は「処理P を1回通す」だけで100%。判定の偽側は試していない。' : '';
      }
      function drawBv() {
        clear(bv);
        [-1, 0, 1, 2, 50, 99, 100, 101, 102].forEach(function (v) {
          bv.appendChild(h('button', { type: 'button', class: 'v-cellbox' + (bvPicked[v] ? ' mid' : '') + (v >= 1 && v <= 100 ? '' : ' invalid'), text: v, onclick: function () { bvPicked[v] = !bvPicked[v]; drawBv(); } }));
        });
        var picked = Object.keys(bvPicked).filter(function (k) { return bvPicked[k]; }).map(Number).sort(function (x, y) { return x - y; });
        var ideal = [0, 1, 100, 101];
        var ok = picked.length === 4 && ideal.every(function (v) { return picked.indexOf(v) >= 0; });
        bvVerdict.className = 'v-verdict ' + (ok ? 'ok' : picked.length ? 'warn' : '');
        bvVerdict.textContent = ok ? '正解!有効範囲 1〜100 の境界の両側 0, 1, 100, 101 を選べた。'
          : picked.length ? '選択中: ' + picked.join(', ') + ' — 境界の「内側」と「外側」を両端それぞれで選ぼう。' : '有効値 1〜100 の入力欄。境界値分析で選ぶべき4つの値をクリック。';
      }
      root.appendChild(code); root.appendChild(list); root.appendChild(metrics); root.appendChild(hint);
      root.appendChild(h('div', { class: 'v-label', text: '境界値分析にチャレンジ(緑 = 有効値、グレー = 無効値)' }));
      root.appendChild(bv); root.appendChild(bvVerdict);
      draw(); drawBv();
    }
  });
})(window);
