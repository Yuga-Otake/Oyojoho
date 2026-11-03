/**
 * visuals/business.js - マネジメント系・ストラテジ系の体感ビジュアル
 */
(function (global) {
  'use strict';

  var V = global.Visuals;
  var ui = V.ui, h = ui.h, s = ui.s, clear = ui.clear, fmt = ui.fmt, metric = ui.metric;

  /* ------------------------------------------------------------------
   * クリティカルパス
   * ------------------------------------------------------------------ */
  V.register('cpm', {
    title: '日数を変えてクリティカルパスを動かす',
    desc: '各作業の − / + で所要日数を変えると、最長経路(赤)と余裕日数が再計算されます。',
    mount: function (root) {
      var acts = [
        { id: 'A', d: 3, pre: [], x: 60, y: 75 },
        { id: 'B', d: 4, pre: ['A'], x: 160, y: 30 },
        { id: 'C', d: 5, pre: ['A'], x: 160, y: 120 },
        { id: 'E', d: 6, pre: [], x: 160, y: 190 },
        { id: 'D', d: 2, pre: ['B', 'C', 'E'], x: 270, y: 100 }
      ];
      var byId = {};
      acts.forEach(function (a) { byId[a.id] = a; });
      var svg = s('svg', { viewBox: '0 0 330 225', class: 'v-svg', role: 'img', 'aria-label': '作業の依存関係' });
      var ctrls = h('div', { class: 'v-row' });
      var table = h('div', { class: 'v-scroll' });
      var metrics = h('div', { class: 'v-metrics' });
      function calc() {
        acts.forEach(function (a) { a.es = Math.max.apply(null, [0].concat(a.pre.map(function (p) { return byId[p].es + byId[p].d; }))); });
        var end = Math.max.apply(null, acts.map(function (a) { return a.es + a.d; }));
        for (var i = acts.length - 1; i >= 0; i--) {
          var a = acts[i];
          var succ = acts.filter(function (x) { return x.pre.indexOf(a.id) >= 0; });
          a.lf = succ.length ? Math.min.apply(null, succ.map(function (x) { return x.ls; })) : end;
          a.ls = a.lf - a.d;
          a.slack = a.ls - a.es;
        }
        return end;
      }
      function draw() {
        var end = calc();
        clear(svg);
        svg.appendChild(s('defs', null, s('marker', { id: 'v-arr2', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto' }, s('path', { d: 'M0,0L10,5L0,10z', class: 'v-arrowhead' }))));
        acts.forEach(function (a) {
          a.pre.forEach(function (p) {
            var f = byId[p];
            var crit = f.slack === 0 && a.slack === 0 && f.es + f.d === a.es;
            svg.appendChild(s('line', { x1: f.x + 30, y1: f.y, x2: a.x - 32, y2: a.y, class: 'v-edge' + (crit ? ' crit' : ''), 'marker-end': 'url(#v-arr2)' }));
          });
        });
        acts.forEach(function (a) {
          var crit = a.slack === 0;
          svg.appendChild(s('rect', { x: a.x - 30, y: a.y - 20, width: 60, height: 40, rx: 8, class: 'v-node' + (crit ? ' crit' : '') }));
          svg.appendChild(s('text', { x: a.x, y: a.y - 3, class: 'v-node-label', 'text-anchor': 'middle', text: a.id + '(' + a.d + '日)' }));
          svg.appendChild(s('text', { x: a.x, y: a.y + 12, class: 'v-tick', 'text-anchor': 'middle', text: crit ? '余裕 0' : '余裕 ' + a.slack }));
        });
        clear(ctrls);
        acts.forEach(function (a) {
          ctrls.appendChild(h('span', { class: 'v-stepper' }, [
            h('b', { text: a.id }),
            ui.button('−', function () { if (a.d > 1) { a.d--; draw(); } }, 'mini'),
            h('span', { text: a.d + '日' }),
            ui.button('+', function () { if (a.d < 12) { a.d++; draw(); } }, 'mini')
          ]));
        });
        var t = h('table', { class: 'v-table' }, h('tr', null, ['作業', '先行', '日数', '最早開始', '最遅開始', '余裕'].map(function (x) { return h('th', { text: x }); })));
        acts.forEach(function (a) {
          t.appendChild(h('tr', { class: a.slack === 0 ? 'crit' : '' }, [a.id, a.pre.join(',') || '—', a.d, a.es, a.ls, a.slack].map(function (x) { return h('td', { text: x }); })));
        });
        clear(table).appendChild(t);
        clear(metrics);
        var path = acts.filter(function (a) { return a.slack === 0; }).map(function (a) { return a.id; }).join(' → ');
        metrics.appendChild(metric('全体の所要日数', end + ' 日', 'good'));
        metrics.appendChild(metric('クリティカルパス', path, 'neg'));
      }
      root.appendChild(svg); root.appendChild(ctrls); root.appendChild(metrics); root.appendChild(table);
      draw();
    }
  });

  /* ------------------------------------------------------------------
   * EVM
   * ------------------------------------------------------------------ */
  V.register('evm', {
    title: 'PV・EV・AC を動かして進捗を診断する',
    desc: 'EV(出来高)を中心に、PV と比べれば遅れ、AC と比べれば赤字がわかります。',
    mount: function (root) {
      var mk = function (label, v) { return ui.slider({ label: label, min: 0, max: 1000, step: 10, value: v, fmt: function (x) { return x + ' 万円'; }, onInput: draw }); };
      var pv = mk('PV 計画価値(今日までに終わる予定の分)', 500);
      var ev = mk('EV 出来高(実際に終わった分の予算)', 400);
      var ac = mk('AC 実コスト(実際に使ったお金)', 450);
      var svg = s('svg', { viewBox: '0 0 320 130', class: 'v-svg', role: 'img', 'aria-label': 'PV・EV・AC の比較' });
      var metrics = h('div', { class: 'v-metrics' });
      var verdict = h('div', { class: 'v-verdict' });
      function draw() {
        var P = pv.value, E = ev.value, A = ac.value, max = Math.max(P, E, A, 1);
        clear(svg);
        [['PV', P, 'pv'], ['EV', E, 'ev'], ['AC', A, 'ac']].forEach(function (r, i) {
          var y = 15 + i * 38, w = r[1] / max * 230;
          svg.appendChild(s('text', { x: 4, y: y + 17, class: 'v-node-label', text: r[0] }));
          svg.appendChild(s('rect', { x: 36, y: y, width: Math.max(w, 1), height: 26, rx: 4, class: 'v-evbar ' + r[2] }));
          svg.appendChild(s('text', { x: 40 + w, y: y + 17, class: 'v-tick', text: r[1] }));
        });
        var sv = E - P, cv = E - A, spi = P ? E / P : 0, cpi = A ? E / A : 0;
        clear(metrics);
        metrics.appendChild(metric('SV = EV − PV', (sv > 0 ? '+' : '') + sv, sv < 0 ? 'neg' : 'good'));
        metrics.appendChild(metric('CV = EV − AC', (cv > 0 ? '+' : '') + cv, cv < 0 ? 'neg' : 'good'));
        metrics.appendChild(metric('SPI = EV / PV', fmt(spi, 2), spi < 1 ? 'neg' : 'good'));
        metrics.appendChild(metric('CPI = EV / AC', fmt(cpi, 2), cpi < 1 ? 'neg' : 'good'));
        var sch = sv < 0 ? 'スケジュールは遅延' : sv > 0 ? 'スケジュールは前倒し' : 'スケジュールは計画どおり';
        var cost = cv < 0 ? 'コストは超過' : cv > 0 ? 'コストは予算内(効率的)' : 'コストは計画どおり';
        verdict.className = 'v-verdict ' + (sv < 0 || cv < 0 ? 'ng' : 'ok');
        verdict.textContent = sch + '、' + cost + '。';
      }
      root.appendChild(pv.el); root.appendChild(ev.el); root.appendChild(ac.el);
      root.appendChild(svg); root.appendChild(metrics); root.appendChild(verdict);
      draw();
    }
  });

  /* ------------------------------------------------------------------
   * ブルックスの法則(コミュニケーション経路)
   * ------------------------------------------------------------------ */
  V.register('brooks', {
    title: '人数とコミュニケーション経路',
    desc: '人数を増やすと、線(調整が必要な関係)が人数の2乗に近い勢いで増えていきます。',
    mount: function (root) {
      var n = ui.slider({ label: 'チームの人数', min: 2, max: 16, value: 5, fmt: function (v) { return v + ' 人'; }, onInput: draw });
      var svg = s('svg', { viewBox: '0 0 240 240', class: 'v-svg narrow', role: 'img', 'aria-label': 'メンバー間のコミュニケーション経路' });
      var metrics = h('div', { class: 'v-metrics' });
      function draw() {
        var N = n.value, pts = [];
        for (var i = 0; i < N; i++) { var a = -Math.PI / 2 + i * 2 * Math.PI / N; pts.push([120 + 95 * Math.cos(a), 120 + 95 * Math.sin(a)]); }
        clear(svg);
        for (i = 0; i < N; i++) for (var j = i + 1; j < N; j++) svg.appendChild(s('line', { x1: pts[i][0], y1: pts[i][1], x2: pts[j][0], y2: pts[j][1], class: 'v-edge thin' }));
        pts.forEach(function (p) { svg.appendChild(s('circle', { cx: p[0], cy: p[1], r: 9, class: 'v-dot person' })); });
        clear(metrics);
        metrics.appendChild(metric('経路数 n(n−1)/2', String(N * (N - 1) / 2), 'neg'));
        metrics.appendChild(metric('1人あたりの相手', String(N - 1)));
      }
      root.appendChild(n.el); root.appendChild(svg); root.appendChild(metrics);
      root.appendChild(h('p', { class: 'v-caption', text: '遅れているプロジェクトに人を足すと、新メンバーの教育とこの調整コストで、かえって遅れることがある(ブルックスの法則)。' }));
      draw();
    }
  });

  /* ------------------------------------------------------------------
   * バックアップ方式と復旧
   * ------------------------------------------------------------------ */
  V.register('backup', {
    title: '障害が起きた日に必要なバックアップ',
    desc: '方式と障害発生日を選ぶと、復旧に使うバックアップが光ります。棒の高さは1回の取得量です。',
    mount: function (root) {
      var DAYS = ['日', '月', '火', '水', '木', '金', '土'];
      var kind = 'inc', fail = 4;
      var kindSeg = ui.segmented([{ value: 'full', label: '毎日フル' }, { value: 'diff', label: '日曜フル + 差分' }, { value: 'inc', label: '日曜フル + 増分' }], kind, function (v) { kind = v; draw(); });
      var failSeg = ui.segmented(DAYS.slice(1).map(function (d, i) { return { value: i + 1, label: d + '曜に障害' }; }), fail, function (v) { fail = v; draw(); });
      var chart = h('div', { class: 'v-backup' });
      var steps = h('ol', { class: 'v-log' });
      function draw() {
        clear(chart); clear(steps);
        var need = [];
        if (kind === 'full') need = [fail - 1];
        else if (kind === 'diff') need = fail - 1 === 0 ? [0] : [0, fail - 1];
        else for (var i = 0; i < fail; i++) need.push(i);
        DAYS.forEach(function (d, i) {
          var size = kind === 'full' || i === 0 ? 100 : kind === 'diff' ? 12 * i : 12;
          var label = kind === 'full' || i === 0 ? 'フル' : kind === 'diff' ? '差分' : '増分';
          var cls = 'v-bk' + (i >= fail ? ' future' : '') + (need.indexOf(i) >= 0 ? ' need' : '');
          chart.appendChild(h('div', { class: cls }, [
            h('div', { class: 'v-bk-bar', style: { height: Math.max(size, 6) + 'px' } }, h('span', { text: i < fail ? label : '' })),
            h('div', { class: 'v-bk-day', text: d + (i === fail ? ' ⚡' : '') })
          ]));
        });
        need.forEach(function (i, k) {
          steps.appendChild(h('li', { text: DAYS[i] + '曜の' + (kind === 'full' || i === 0 ? 'フルバックアップ' : kind === 'diff' ? '差分バックアップ' : '増分バックアップ') + 'を' + (k === 0 ? '復元' : '適用') }));
        });
        steps.appendChild(h('li', { class: 'v-muted', text: '(' + DAYS[fail] + '曜の障害発生までの更新はログなどで回復)' }));
      }
      root.appendChild(kindSeg.el); root.appendChild(failSeg.el); root.appendChild(chart);
      root.appendChild(h('div', { class: 'v-label', text: '復旧手順' })); root.appendChild(steps);
      draw();
    }
  });

  /* ------------------------------------------------------------------
   * RTO と RPO
   * ------------------------------------------------------------------ */
  V.register('rto', {
    title: 'RPO と RTO をタイムラインで見る',
    desc: 'バックアップの間隔と復旧にかかる時間を変えて、目標(RPO・RTO)を守れるか確かめます。',
    mount: function (root) {
      var bk = ui.slider({ label: '最後のバックアップから災害までの時間(=失うデータ)', min: 0, max: 24, value: 6, fmt: function (v) { return v + ' 時間'; }, onInput: draw });
      var rec = ui.slider({ label: '災害から業務再開までの時間', min: 1, max: 72, value: 12, fmt: function (v) { return v + ' 時間'; }, onInput: draw });
      var rpo = ui.slider({ label: '目標 RPO(許容できるデータ損失)', min: 0, max: 24, value: 4, fmt: function (v) { return v + ' 時間前の時点まで'; }, onInput: draw });
      var rto = ui.slider({ label: '目標 RTO(許容できる停止時間)', min: 1, max: 72, value: 24, fmt: function (v) { return v + ' 時間以内'; }, onInput: draw });
      var svg = s('svg', { viewBox: '0 0 340 110', class: 'v-svg', role: 'img', 'aria-label': 'RPO と RTO のタイムライン' });
      var verdict = h('div', { class: 'v-verdict' });
      function draw() {
        var X0 = 120, sc = 2.6, dis = X0;
        var X = function (hrs) { return dis + hrs * sc; };
        clear(svg);
        svg.appendChild(s('line', { x1: 10, y1: 55, x2: 330, y2: 55, class: 'v-axis' }));
        svg.appendChild(s('rect', { x: X(-bk.value), y: 40, width: bk.value * sc, height: 30, class: 'v-zone loss' }));
        svg.appendChild(s('rect', { x: dis, y: 40, width: Math.min(rec.value * sc, 330 - dis), height: 30, class: 'v-zone down' }));
        svg.appendChild(s('line', { x1: X(-rpo.value), y1: 30, x2: X(-rpo.value), y2: 80, class: 'v-guide' }));
        svg.appendChild(s('text', { x: X(-rpo.value), y: 26, class: 'v-tick', 'text-anchor': 'middle', text: '目標RPO' }));
        var rtoX = Math.min(X(rto.value), 328);
        svg.appendChild(s('line', { x1: rtoX, y1: 30, x2: rtoX, y2: 80, class: 'v-guide' }));
        svg.appendChild(s('text', { x: rtoX, y: 26, class: 'v-tick', 'text-anchor': 'middle', text: '目標RTO' }));
        svg.appendChild(s('line', { x1: dis, y1: 20, x2: dis, y2: 90, class: 'v-guide danger' }));
        svg.appendChild(s('text', { x: dis, y: 103, class: 'v-tick danger', 'text-anchor': 'middle', text: '⚡災害' }));
        svg.appendChild(s('text', { x: X(-bk.value), y: 103, class: 'v-tick', 'text-anchor': 'middle', text: '最終バックアップ' }));
        var okP = bk.value <= rpo.value, okT = rec.value <= rto.value;
        verdict.className = 'v-verdict ' + (okP && okT ? 'ok' : 'ng');
        verdict.textContent = 'RPO: ' + (okP ? '達成' : '未達(バックアップの頻度を上げる必要)') + ' / RTO: ' + (okT ? '達成' : '未達(復旧手順や待機系の見直しが必要)');
      }
      root.appendChild(bk.el); root.appendChild(rec.el); root.appendChild(rpo.el); root.appendChild(rto.el);
      root.appendChild(svg);
      root.appendChild(h('p', { class: 'v-caption', text: '赤 = 失われるデータの期間(過去側)、オレンジ = 業務が止まっている期間(未来側)' }));
      root.appendChild(verdict);
      draw();
    }
  });

  /* ------------------------------------------------------------------
   * クラウドの責任範囲
   * ------------------------------------------------------------------ */
  V.register('cloud', {
    title: 'IaaS・PaaS・SaaS の管理範囲',
    desc: '形態を選ぶと、利用者が管理する層(青)と事業者が管理する層(灰)が切り替わります。',
    mount: function (root) {
      var layers = ['アプリケーション', 'データ', 'ランタイム', 'ミドルウェア', 'OS', '仮想化', 'サーバ', 'ストレージ', 'ネットワーク'];
      var userTop = { onp: 9, iaas: 5, paas: 2, saas: 0 };
      var cur = 'iaas';
      var seg = ui.segmented([{ value: 'onp', label: 'オンプレミス' }, { value: 'iaas', label: 'IaaS' }, { value: 'paas', label: 'PaaS' }, { value: 'saas', label: 'SaaS' }], cur, function (v) { cur = v; draw(); });
      var stack = h('div', { class: 'v-cloud' });
      var note = h('p', { class: 'v-note' });
      var NOTES = {
        onp: '全部自分たちで用意して管理する。',
        iaas: 'サーバ・ストレージなどの基盤を借りる。OS から上は利用者が管理する。',
        paas: 'OS やミドルウェア、実行環境まで提供される。利用者はアプリとデータに集中する。',
        saas: 'アプリケーションの機能をそのまま使う。利用者はデータ(と設定)を扱うだけ。'
      };
      function draw() {
        clear(stack);
        layers.forEach(function (l, i) {
          var user = i < userTop[cur] || (cur === 'saas' && i === 1);
          stack.appendChild(h('div', { class: 'v-layer ' + (user ? 'user' : 'vendor') }, [h('span', { text: l }), h('small', { text: user ? '利用者' : '事業者' })]));
        });
        note.textContent = NOTES[cur];
      }
      root.appendChild(seg.el); root.appendChild(stack); root.appendChild(note);
      draw();
    }
  });

  /* ------------------------------------------------------------------
   * PPM
   * ------------------------------------------------------------------ */
  V.register('ppm', {
    title: '事業を PPM の4象限に置いてみる',
    desc: '市場成長率と相対的市場占有率を動かすと、事業の分類と取るべき方針が変わります。',
    mount: function (root) {
      var g = ui.slider({ label: '市場成長率', min: 0, max: 20, value: 4, fmt: function (v) { return v + '%'; }, onInput: draw });
      var sh = ui.slider({ label: '相対的市場占有率(自社 ÷ 最大の競合)', min: 0.1, max: 3, step: 0.1, value: 2, fmt: function (v) { return v.toFixed(1) + ' 倍'; }, onInput: draw });
      var svg = s('svg', { viewBox: '0 0 260 220', class: 'v-svg narrow', role: 'img', 'aria-label': 'PPM マトリクス' });
      var verdict = h('div', { class: 'v-verdict' });
      var Q = {
        star: ['花形', '高成長・高シェア。稼ぐが競争も激しく、投資も必要。シェアを維持して将来の金のなる木に。'],
        cow: ['金のなる木', '低成長・高シェア。追加投資が少なく済み、資金を生み出す。ここで得た資金を問題児へ回す。'],
        q: ['問題児', '高成長・低シェア。投資が必要だが稼ぎは少ない。投資して花形に育てるか、撤退するかを判断する。'],
        dog: ['負け犬', '低成長・低シェア。収益も成長も見込めない。撤退・売却を検討する。']
      };
      function draw() {
        clear(svg);
        var X = function (v) { return 230 - (v - 0.1) / 2.9 * 200; }, Y = function (v) { return 200 - v / 20 * 180; };
        var mx = X(1), my = Y(10);
        [['star', 30, 20, mx, my], ['q', mx, 20, 230, my], ['cow', 30, my, mx, 200], ['dog', mx, my, 230, 200]].forEach(function (r) {
          svg.appendChild(s('rect', { x: r[1], y: r[2], width: r[3] - r[1], height: r[4] - r[2], class: 'v-quad ' + r[0] }));
          svg.appendChild(s('text', { x: (r[1] + r[3]) / 2, y: (r[2] + r[4]) / 2, class: 'v-quad-label', 'text-anchor': 'middle', text: Q[r[0]][0] }));
        });
        svg.appendChild(s('text', { x: 130, y: 216, class: 'v-tick', 'text-anchor': 'middle', text: '← 相対的市場占有率 高い    低い →' }));
        svg.appendChild(s('text', { x: 14, y: 110, class: 'v-tick', 'text-anchor': 'middle', transform: 'rotate(-90 14 110)', text: '市場成長率 →' }));
        svg.appendChild(s('circle', { cx: X(sh.value), cy: Y(g.value), r: 9, class: 'v-dot big' }));
        var key = g.value >= 10 ? (sh.value >= 1 ? 'star' : 'q') : (sh.value >= 1 ? 'cow' : 'dog');
        verdict.className = 'v-verdict ok';
        verdict.textContent = Q[key][0] + ' — ' + Q[key][1];
      }
      root.appendChild(g.el); root.appendChild(sh.el); root.appendChild(svg); root.appendChild(verdict);
      draw();
    }
  });

  /* ------------------------------------------------------------------
   * 損益分岐点
   * ------------------------------------------------------------------ */
  V.register('bep', {
    title: '損益分岐点グラフ',
    desc: '固定費と変動費率を動かすと、売上線と総費用線の交点(損益分岐点)が動きます。',
    mount: function (root) {
      var F = ui.slider({ label: '固定費', min: 100, max: 1200, step: 50, value: 600, fmt: function (v) { return v + ' 万円'; }, onInput: draw });
      var vr = ui.slider({ label: '変動費率', min: 5, max: 90, step: 5, value: 40, fmt: function (v) { return v + '%'; }, onInput: draw });
      var sales = ui.slider({ label: '実際の売上高', min: 0, max: 3000, step: 50, value: 1500, fmt: function (v) { return v + ' 万円'; }, onInput: draw });
      var svg = s('svg', { viewBox: '0 0 320 210', class: 'v-svg', role: 'img', 'aria-label': '損益分岐点グラフ' });
      var metrics = h('div', { class: 'v-metrics' });
      function draw() {
        var f = F.value, v = vr.value / 100, S = sales.value, bep = f / (1 - v), MAX = 3000;
        var X = function (x) { return 35 + x / MAX * 275; }, Y = function (y) { return 190 - y / MAX * 180; };
        clear(svg);
        svg.appendChild(s('line', { x1: 35, y1: 190, x2: 312, y2: 190, class: 'v-axis' }));
        svg.appendChild(s('line', { x1: 35, y1: 8, x2: 35, y2: 190, class: 'v-axis' }));
        var cost = function (x) { return f + v * x; };
        var top = Math.min(MAX, Math.max(S, cost(S)));
        svg.appendChild(s('path', { d: 'M' + X(S) + ',' + Y(Math.min(S, MAX)) + 'L' + X(S) + ',' + Y(Math.min(cost(S), MAX)), class: S >= bep ? 'v-profit' : 'v-loss' }));
        svg.appendChild(s('line', { x1: X(0), y1: Y(f), x2: X(MAX), y2: Y(f), class: 'v-guide' }));
        svg.appendChild(s('text', { x: X(MAX), y: Y(f) - 4, class: 'v-tick', 'text-anchor': 'end', text: '固定費' }));
        svg.appendChild(s('line', { x1: X(0), y1: Y(0), x2: X(MAX), y2: Y(MAX), class: 'v-line' }));
        svg.appendChild(s('text', { x: X(MAX * 0.78), y: Y(MAX * 0.78) - 8, class: 'v-tick', text: '売上高' }));
        svg.appendChild(s('line', { x1: X(0), y1: Y(f), x2: X(MAX), y2: Y(Math.min(cost(MAX), MAX * 1.2)), class: 'v-line warn' }));
        svg.appendChild(s('text', { x: X(MAX) - 2, y: Y(Math.min(cost(MAX), MAX)) + 14, class: 'v-tick', 'text-anchor': 'end', text: '総費用' }));
        if (bep <= MAX) {
          svg.appendChild(s('line', { x1: X(bep), y1: Y(bep), x2: X(bep), y2: 190, class: 'v-guide' }));
          svg.appendChild(s('circle', { cx: X(bep), cy: Y(bep), r: 6, class: 'v-dot' }));
          svg.appendChild(s('text', { x: X(bep), y: 204, class: 'v-tick strong', 'text-anchor': 'middle', text: Math.round(bep) }));
        }
        void top;
        var profit = S - cost(S);
        clear(metrics);
        metrics.appendChild(metric('損益分岐点売上高', fmt(bep, 0) + ' 万円', 'good'));
        metrics.appendChild(metric('計算', f + ' ÷ (1 − ' + v.toFixed(2) + ')'));
        metrics.appendChild(metric('売上 ' + S + ' のときの利益', (profit >= 0 ? '+' : '') + fmt(profit, 0) + ' 万円', profit < 0 ? 'neg' : 'good'));
      }
      root.appendChild(F.el); root.appendChild(vr.el); root.appendChild(sales.el);
      root.appendChild(svg); root.appendChild(metrics);
      root.appendChild(h('p', { class: 'v-caption', text: '縦の緑の線 = 利益、赤い線 = 損失。売上が損益分岐点を超えた分だけ、限界利益率 (1 − 変動費率) の割合で利益が増える。' }));
      draw();
    }
  });

  /* ------------------------------------------------------------------
   * ABC 分析(パレート図)
   * ------------------------------------------------------------------ */
  V.register('abc', {
    title: 'パレート図で ABC 分析',
    desc: '品目を金額の大きい順に並べ、累計比率で A・B・C に分けます。境界の比率を動かしてみましょう。',
    mount: function (root) {
      var items = [['P1', 420], ['P2', 260], ['P3', 120], ['P4', 70], ['P5', 45], ['P6', 30], ['P7', 22], ['P8', 15], ['P9', 10], ['P10', 8]];
      var aTh = ui.slider({ label: 'A群の上限(累計比率)', min: 50, max: 85, step: 5, value: 70, fmt: function (v) { return v + '%'; }, onInput: draw });
      var bTh = ui.slider({ label: 'B群の上限(累計比率)', min: 86, max: 98, step: 1, value: 90, fmt: function (v) { return v + '%'; }, onInput: draw });
      var svg = s('svg', { viewBox: '0 0 320 190', class: 'v-svg', role: 'img', 'aria-label': 'パレート図' });
      var metrics = h('div', { class: 'v-metrics' });
      function draw() {
        var total = items.reduce(function (a, x) { return a + x[1]; }, 0), cum = 0, max = items[0][1];
        var bw = 26, X0 = 30, groups = { A: 0, B: 0, C: 0 }, gsum = { A: 0, B: 0, C: 0 };
        clear(svg);
        svg.appendChild(s('line', { x1: X0, y1: 165, x2: 310, y2: 165, class: 'v-axis' }));
        var d = '';
        items.forEach(function (it, i) {
          var prevCum = cum / total * 100;
          cum += it[1];
          var c = cum / total * 100;
          var g = prevCum < aTh.value ? 'A' : prevCum < bTh.value ? 'B' : 'C';
          groups[g]++; gsum[g] += it[1];
          var x = X0 + i * (bw + 2), hgt = it[1] / max * 140;
          svg.appendChild(s('rect', { x: x, y: 165 - hgt, width: bw, height: hgt, rx: 3, class: 'v-abc ' + g }));
          svg.appendChild(s('text', { x: x + bw / 2, y: 178, class: 'v-tick', 'text-anchor': 'middle', text: it[0] }));
          d += (i ? 'L' : 'M') + (x + bw / 2) + ',' + (165 - c / 100 * 150);
        });
        svg.appendChild(s('path', { d: d, class: 'v-line' }));
        [aTh.value, bTh.value].forEach(function (t) {
          svg.appendChild(s('line', { x1: X0, y1: 165 - t / 100 * 150, x2: 310, y2: 165 - t / 100 * 150, class: 'v-guide' }));
          svg.appendChild(s('text', { x: 310, y: 161 - t / 100 * 150, class: 'v-tick', 'text-anchor': 'end', text: t + '%' }));
        });
        clear(metrics);
        ['A', 'B', 'C'].forEach(function (g) {
          metrics.appendChild(metric(g + '群', groups[g] + '品目で金額の ' + fmt(gsum[g] / total * 100, 0) + '%', g === 'A' ? 'good' : ''));
        });
      }
      root.appendChild(aTh.el); root.appendChild(bTh.el); root.appendChild(svg); root.appendChild(metrics);
      root.appendChild(h('p', { class: 'v-caption', text: '少数の A 群が金額の大半を占める。A 群は定期発注などできめ細かく、C 群は簡便に管理する。' }));
      draw();
    }
  });

  /* ------------------------------------------------------------------
   * 派遣と請負
   * ------------------------------------------------------------------ */
  V.register('contract', {
    title: '派遣と請負:誰が指示を出せる?',
    desc: '契約形態を切り替え、「発注者が作業者に直接指示する」を押してみてください。',
    mount: function (root) {
      var kind = 'haken', direct = false;
      var seg = ui.segmented([{ value: 'haken', label: '労働者派遣' }, { value: 'ukeoi', label: '請負(準委任も同様)' }], kind, function (v) { kind = v; direct = false; draw(); });
      var svg = s('svg', { viewBox: '0 0 330 200', class: 'v-svg', role: 'img', 'aria-label': '契約関係の図' });
      var verdict = h('div', { class: 'v-verdict' });
      function node(x, y, label, sub) {
        svg.appendChild(s('rect', { x: x - 55, y: y - 22, width: 110, height: 44, rx: 9, class: 'v-node' }));
        svg.appendChild(s('text', { x: x, y: y - 3, class: 'v-node-label', 'text-anchor': 'middle', text: label }));
        svg.appendChild(s('text', { x: x, y: y + 13, class: 'v-tick', 'text-anchor': 'middle', text: sub }));
      }
      function arrow(x1, y1, x2, y2, label, cls) {
        svg.appendChild(s('line', { x1: x1, y1: y1, x2: x2, y2: y2, class: 'v-edge ' + (cls || ''), 'marker-end': 'url(#v-arr3)' }));
        svg.appendChild(s('text', { x: (x1 + x2) / 2 + (x1 === x2 ? 6 : 0), y: (y1 + y2) / 2 - 5, class: 'v-tick strong ' + (cls || ''), 'text-anchor': x1 === x2 ? 'start' : 'middle', text: label }));
      }
      function draw() {
        clear(svg);
        svg.appendChild(s('defs', null, s('marker', { id: 'v-arr3', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto' }, s('path', { d: 'M0,0L10,5L0,10z', class: 'v-arrowhead' }))));
        var left = kind === 'haken' ? ['派遣元', '雇用主'] : ['請負事業者', '受託者・雇用主'];
        var right = kind === 'haken' ? ['派遣先', '仕事を頼む側'] : ['発注者', '仕事を頼む側'];
        node(70, 40, left[0], left[1]);
        node(260, 40, right[0], right[1]);
        node(70, 160, '作業者', '労働者');
        arrow(125, 40, 205, 40, kind === 'haken' ? '派遣契約' : '請負契約');
        arrow(70, 62, 70, 138, '雇用関係');
        if (kind === 'haken') arrow(240, 62, 120, 145, '指揮命令 ○', 'good');
        else {
          arrow(50, 62, 50, 138, '');
          svg.appendChild(s('text', { x: 6, y: 120, class: 'v-tick strong good', text: '指揮命令' }));
          if (direct) arrow(240, 62, 120, 145, '直接指示 ✕', 'bad');
        }
        verdict.className = 'v-verdict ' + (kind === 'ukeoi' && direct ? 'ng' : 'ok');
        verdict.textContent = kind === 'haken'
          ? '派遣では、派遣先が作業者に業務上の指揮命令を行う。雇用関係は派遣元にある。'
          : direct ? '偽装請負!請負では発注者は作業者に直接指示できない。指示は請負事業者(の責任者)を通す。'
            : '請負では、作業者への指揮命令は請負事業者が行う。発注者は成果物の完成を求める立場。';
      }
      root.appendChild(seg.el); root.appendChild(svg);
      root.appendChild(h('div', { class: 'v-row' }, ui.button('発注者が作業者に直接指示する', function () { direct = true; draw(); })));
      root.appendChild(verdict);
      draw();
    }
  });
})(window);
