/**
 * visuals/more-business.js - 業務・システム設計・ストラテジ系の追加の体感ビジュアル
 */
(function (global) {
  'use strict';

  var V = global.Visuals;
  var ui = V.ui, h = ui.h, s = ui.s, clear = ui.clear, fmt = ui.fmt, metric = ui.metric;

  /* ------------------------------------------------------------------
   * 同時更新とロック
   * ------------------------------------------------------------------ */
  V.register('lostupdate', {
    title: '同時更新とロック',
    desc: '2 つのトランザクションが同じ在庫数を同時に更新すると、片方の更新が消えることがあります。「専有ロック」を使うと結果がどう変わるか、比べてみましょう。',
    mount: function (root) {
      var QTY = { 1: 3, 2: 5 };
      var LABELS = ['①在庫数を読む', '②引いた値を計算', '③在庫数を書き込む(コミット)'];
      var lockOn = false;
      var stock, pc, read, calc, holder, waiting;

      var lockBtn = h('button', { type: 'button', class: 'v-key' });
      var big = h('div', { class: 'vx-biz-big' });
      var chips = h('div', { class: 'v-row' });
      var view = h('div', { class: 'v-split' });
      var verdict = h('div', { class: 'v-verdict' });
      lockBtn.addEventListener('click', function () { lockOn = !lockOn; reset(); });

      function reset() {
        stock = 10;
        pc = { 1: 0, 2: 0 };
        read = { 1: null, 2: null };
        calc = { 1: null, 2: null };
        holder = null;
        waiting = { 1: false, 2: false };
        draw();
      }

      function step(tid) {
        var i = pc[tid];
        if (i >= 3) return;
        if (i === 0) {
          if (lockOn) {
            if (holder && holder !== tid) { waiting[tid] = true; draw(); return; }
            holder = tid;
          }
          read[tid] = stock;
        } else if (i === 1) {
          calc[tid] = read[tid] - QTY[tid];
        } else {
          stock = calc[tid];
          if (lockOn && holder === tid) holder = null;
        }
        waiting[tid] = false;
        pc[tid] = i + 1;
        draw();
      }

      function draw() {
        lockBtn.className = 'v-key' + (lockOn ? ' is-on' : '');
        lockBtn.textContent = (lockOn ? '✓ ' : '') + '専有ロックを使う';
        big.textContent = stock + ' 個';
        clear(chips);
        chips.appendChild(h('span', {
          class: 'v-chip' + (lockOn && holder ? ' hot' : ''),
          text: !lockOn ? 'ロックなし' : holder ? '専有ロック: T' + holder + ' が保持' : '専有ロック: 空き'
        }));

        clear(view);
        [1, 2].forEach(function (tid) {
          var ol = h('ol', { class: 'v-steps' });
          LABELS.forEach(function (lab, i) {
            var txt = lab;
            if (i === 0 && pc[tid] > 0) txt += ' → ' + read[tid];
            if (i === 1 && pc[tid] > 1) txt += ' → ' + read[tid] + ' − ' + QTY[tid] + ' = ' + calc[tid];
            if (i === 2 && pc[tid] > 2) txt += ' → 在庫数を ' + calc[tid] + ' に';
            var cls = i < pc[tid] ? 'done' : i === pc[tid] ? (waiting[tid] ? 'wait' : 'cur') : '';
            if (i === pc[tid] && waiting[tid]) txt += '(待ち…)';
            ol.appendChild(h('li', { class: cls, text: txt }));
          });
          var done = pc[tid] >= 3;
          var btn = ui.button(done ? '完了' : 'T' + tid + ' を次へ', function () { step(tid); }, 'primary');
          btn.disabled = done;
          view.appendChild(h('div', { class: 'v-task' }, [
            h('div', { class: 'v-label', text: 'T' + tid + '(' + QTY[tid] + ' 個売る)' }),
            ol,
            btn
          ]));
        });

        var both = pc[1] >= 3 && pc[2] >= 3;
        var racing = !lockOn && pc[1] >= 1 && pc[2] >= 1 && pc[1] < 3 && pc[2] < 3;
        if (both) {
          if (stock === 2) {
            verdict.className = 'v-verdict ok';
            verdict.textContent = '在庫数は 2 になった(10 − 3 − 5 = 2)。' +
              (lockOn ? '専有ロックで、後の処理は前の書き込み結果を読んだので、更新が消えなかった。' : '');
          } else {
            verdict.className = 'v-verdict ng';
            verdict.textContent = 'ロストアップデート(更新の喪失): 片方の更新が上書きされて消えた。在庫数は ' + stock + ' になったが、正しくは 2 である。';
          }
        } else if (waiting[1] || waiting[2]) {
          verdict.className = 'v-verdict warn';
          verdict.textContent = '待ちが発生した。ロックを持つ方を ③ まで進めると、待っていた方が在庫数を読めるようになる。';
        } else if (racing) {
          verdict.className = 'v-verdict warn';
          verdict.textContent = '両方が在庫数を読んだ。このまま書き込むと、後から書いた方が先の更新を上書きしてしまう。';
        } else {
          verdict.className = 'v-verdict';
          verdict.textContent = lockOn
            ? '専有ロックを取ると、もう一方の ① は ③ で解放されるまで待つ。'
            : '2 つを交互に進めて、最後の在庫数がどうなるか見てみよう。';
        }
      }

      root.appendChild(lockBtn);
      root.appendChild(h('div', { class: 'v-label', text: '共有の在庫数(データベース上の値)' }));
      root.appendChild(big);
      root.appendChild(chips);
      root.appendChild(view);
      root.appendChild(verdict);
      root.appendChild(h('div', { class: 'v-row' }, ui.button('最初から', reset)));
      reset();
    }
  });

  /* ------------------------------------------------------------------
   * ファンクションポイント法
   * ------------------------------------------------------------------ */
  V.register('fp', {
    title: 'ファンクションポイント法で規模を測る',
    desc: '機能の種類ごとに件数と複雑さを選ぶと、ファンクションポイント(FP)の合計が出ます。生産性を動かすと、見積り工数がどう変わるかも分かります。',
    mount: function (root) {
      var LEVELS = ['低', '中', '高'];
      var types = [
        { name: '外部入力(EI)', w: [3, 4, 6], n: 6, c: 1 },
        { name: '外部出力(EO)', w: [4, 5, 7], n: 4, c: 1 },
        { name: '外部照会(EQ)', w: [3, 4, 6], n: 3, c: 0 },
        { name: '内部論理ファイル(ILF)', w: [7, 10, 15], n: 3, c: 1 },
        { name: '外部インタフェースファイル(EIF)', w: [5, 7, 10], n: 1, c: 0 }
      ];
      var prod = 10;
      var slider = ui.slider({
        label: '生産性(1人月あたりの FP)', min: 5, max: 20, step: 1, value: prod,
        fmt: function (v) { return v + ' FP/人月'; },
        onInput: function (v) { prod = v; draw(); }
      });
      var table = h('div', { class: 'v-scroll' });
      var metrics = h('div', { class: 'v-metrics' });
      var note = h('p', { class: 'v-caption' });

      function fpOf(t) { return t.n * t.w[t.c]; }

      function draw() {
        var total = 0;
        var rows = types.map(function (t) {
          var fp = fpOf(t);
          total += fp;
          var sel = h('select', {
            class: 'vx-biz-select', 'aria-label': t.name + 'の複雑さ',
            onchange: function (e) { t.c = e.target.selectedIndex; draw(); }
          }, LEVELS.map(function (lv) { return h('option', { text: lv }); }));
          sel.selectedIndex = t.c;
          var stepper = h('span', { class: 'v-stepper' }, [
            ui.button('−', function () { if (t.n > 0) { t.n--; draw(); } }, 'mini'),
            h('span', { text: String(t.n) }),
            ui.button('+', function () { if (t.n < 20) { t.n++; draw(); } }, 'mini')
          ]);
          return h('tr', null, [
            h('td', { style: { 'text-align': 'left', 'white-space': 'normal' }, text: t.name }),
            h('td', null, stepper),
            h('td', null, sel),
            h('td', { text: String(t.w[t.c]) }),
            h('td', { text: String(fp) })
          ]);
        });

        clear(table).appendChild(h('table', { class: 'v-table' }, [
          h('thead', null, h('tr', null, ['機能の種類', '件数(0〜20)', '複雑さ', '重み', 'FP'].map(function (x) { return h('th', { text: x }); }))),
          h('tbody', null, rows),
          h('tfoot', null, h('tr', { class: 'hl' }, [
            h('td', { colspan: 4, text: '未調整 FP の合計' }),
            h('td', { text: String(total) })
          ]))
        ]));

        clear(metrics);
        metrics.appendChild(metric('未調整 FP の合計', total + ' FP', 'good'));
        metrics.appendChild(metric('見積り工数', fmt(total / prod, 1) + ' 人月'));
        note.textContent = '見積り工数 = ' + total + ' FP ÷ ' + prod + ' FP/人月 = ' + fmt(total / prod, 1) + ' 人月';
      }

      root.appendChild(slider.el);
      root.appendChild(table);
      root.appendChild(metrics);
      root.appendChild(note);
      root.appendChild(h('div', {
        class: 'v-verdict ok',
        text: '画面・帳票・ファイルなど外部から見える機能の数で見積もるので、設計の早い段階から使え、プログラム言語に依存しない。'
      }));
      draw();
    }
  });

  /* ------------------------------------------------------------------
   * ITSM のプロセス仕分け
   * ------------------------------------------------------------------ */
  V.register('itsm', {
    title: 'ITSM のプロセスを仕分ける',
    desc: '場面ごとに、どのプロセスの仕事かを選びましょう。答えるたびに正誤と理由が出ます。8 問終わったら、正解数が表示されます。',
    mount: function (root) {
      var ANS = ['サービスデスク', 'インシデント管理', '問題管理', '変更管理', '構成管理', 'リリース管理及び展開管理'];
      var Q = [
        { t: '利用者から『メールが送れない』と電話があり受け付けた', a: 'サービスデスク', r: '利用者からの連絡を最初に受け付ける窓口は、サービスデスクの役割です。' },
        { t: '回避策を案内して、とにかく早く業務を再開させる', a: 'インシデント管理', r: '回避策などで業務を早く復旧させることが、インシデント管理の目的です。' },
        { t: '同じ障害が毎月起きるので根本原因を調査する', a: '問題管理', r: '繰り返す障害の根本原因を突き止めて再発を防ぐのは、問題管理の仕事です。' },
        { t: '根本原因は判明したが恒久対策が未実施なので、既知の誤りとして記録する', a: '問題管理', r: '原因は分かっているが解決していない問題を「既知の誤り」として記録するのは、問題管理です。' },
        { t: '本番サーバの OS 更新を実施してよいか、リスクを評価して承認する', a: '変更管理', r: '変更のリスクを評価して、実施してよいか承認するのは、変更管理の仕事です。' },
        { t: 'サーバのソフトウェアのバージョンや設定を CMDB に正しく記録する', a: '構成管理', r: 'IT の構成情報を CMDB で管理するのは、構成管理の仕事です。' },
        { t: '障害の対応順を、影響度と緊急度から決める', a: 'インシデント管理', r: '影響度と緊急度で対応の優先順位を決めるのは、インシデント管理です。' },
        { t: '承認された変更を本番環境へ展開する', a: 'リリース管理及び展開管理', r: '承認された変更を本番環境へ届けるのは、リリース管理及び展開管理の仕事です。' }
      ];
      var idx = 0, score = 0, answered = false, last = null;
      var wrap = h('div', { class: 'v-body' });
      root.appendChild(wrap);

      function reset() { idx = 0; score = 0; answered = false; last = null; draw(); }
      function answer(a) {
        if (answered) return;
        answered = true;
        last = { ok: a === Q[idx].a };
        if (last.ok) score++;
        draw();
      }
      function next() { idx++; answered = false; last = null; draw(); }

      function draw() {
        clear(wrap);
        var n = Q.length;
        if (idx < n) {
          var q = Q[idx];
          wrap.appendChild(h('div', { class: 'v-label', text: '場面 ' + (idx + 1) + ' / ' + n }));
          wrap.appendChild(h('div', { class: 'vx-biz-card', text: '「' + q.t + '」' }));
          wrap.appendChild(h('div', { class: 'v-row' }, ANS.map(function (a) {
            var b = ui.button(a, function () { answer(a); });
            b.disabled = answered;
            return b;
          })));
          var v = h('div', { class: 'v-verdict' });
          if (!answered) {
            v.textContent = 'この場面を担当するプロセスを選んでみよう。';
          } else if (last.ok) {
            v.className = 'v-verdict ok';
            v.textContent = '正解です。' + q.r;
          } else {
            v.className = 'v-verdict ng';
            v.textContent = 'ちがいます。正解は「' + q.a + '」です。' + q.r;
          }
          wrap.appendChild(v);
          if (answered) {
            wrap.appendChild(h('div', { class: 'v-row' }, ui.button(idx + 1 < n ? '次の場面へ' : '結果を見る', next, 'primary')));
          }
        } else {
          wrap.appendChild(h('div', { class: 'v-label', text: '結果' }));
          wrap.appendChild(h('div', { class: 'vx-biz-big', text: score + ' / ' + n + ' 問正解' }));
          wrap.appendChild(h('div', {
            class: 'v-verdict ' + (score === n ? 'ok' : 'warn'),
            text: score === n ? '全問正解です。役割の違いは「誰の、何のための仕事か」で判断できます。' : 'もう一度挑戦すると、プロセスごとの役割の違いが整理できます。'
          }));
        }
        wrap.appendChild(h('div', { class: 'v-row' }, [
          h('span', { class: 'v-chip', text: '正解 ' + score + ' / ' + n }),
          ui.button('もう一度', reset)
        ]));
      }

      draw();
    }
  });

  /* ------------------------------------------------------------------
   * 貸借対照表のバランス
   * ------------------------------------------------------------------ */
  V.register('bs', {
    title: '取引で貸借対照表がどう変わるか',
    desc: '取引ボタンを押すと、貸借対照表の左(資産)と右(負債+純資産)の高さと合計が変わります。どの取引の後も、左右の合計は必ず一致します。',
    mount: function (root) {
      var st, log, lastMsg;
      var TX = [
        { label: '銀行から 500 借りる', can: function () { return true; },
          run: function () { st.cash += 500; st.loan += 500; },
          msg: '現金と借入金が同時に 500 増えた。資産 = 負債 + 純資産 の形を保ったまま、両側が増えている。' },
        { label: '商品を 300 で仕入れ(現金払い)', can: function () { return st.cash >= 300; },
          run: function () { st.cash -= 300; st.stock += 300; },
          msg: '現金が商品に変わっただけで、資産の合計は変わらない。資産 = 負債 + 純資産 は変わらず成り立つ。' },
        { label: '商品(原価 300)を 400 で売る(現金受取)', can: function () { return st.stock >= 300; },
          run: function () { st.cash += 400; st.stock -= 300; st.ret += 100; },
          msg: '資産は現金 +400、商品 −300 で 100 増えた。その 100 は利益で、利益剰余金(純資産)を増やす。利益は純資産を増やす(損益計算書とつながる)。資産 = 負債 + 純資産 は保たれている。' },
        { label: '設備を 600 で購入(現金払い)', can: function () { return st.cash >= 600; },
          run: function () { st.cash -= 600; st.equip += 600; },
          msg: '現金が設備に変わっただけで、資産の内訳が入れ替わった。資産 = 負債 + 純資産 は変わらない。' },
        { label: '借入金を 200 返済', can: function () { return st.cash >= 200 && st.loan >= 200; },
          run: function () { st.cash -= 200; st.loan -= 200; },
          msg: '現金と借入金が同時に 200 減った。資産 = 負債 + 純資産 を保ったまま、両側が減っている。' }
      ];

      var txRow = h('div', { class: 'v-row' });
      var svg = s('svg', { viewBox: '0 0 440 258', class: 'v-svg', role: 'img', 'aria-label': '貸借対照表の図' });
      var met = h('div', { class: 'v-metrics' });
      var verdict = h('div', { class: 'v-verdict' });
      var logEl = h('ol', { class: 'v-log' });

      function totals() {
        var A = st.cash + st.stock + st.equip;
        return { A: A, L: st.loan, E: st.cap + st.ret };
      }

      function reset() {
        st = { cash: 1000, stock: 0, equip: 0, loan: 0, cap: 1000, ret: 0 };
        log = []; lastMsg = '';
        draw();
      }

      function doTx(i) {
        var t = TX[i];
        if (!t.can()) return;
        t.run();
        lastMsg = '「' + t.label + '」を実行した。' + t.msg;
        var tt = totals();
        log.push(t.label + '  →  資産 ' + fmt(tt.A, 0) + ' = 負債 ' + fmt(tt.L, 0) + ' + 純資産 ' + fmt(tt.E, 0));
        draw();
      }

      function column(segs, x, side, total, title) {
        var base = 220, k = 200 / total.max;
        var y = base;
        var labels = [];
        svg.appendChild(s('rect', { x: x, y: 20, width: 80, height: 200, class: 'vx-biz-frame' }));
        segs.forEach(function (g) {
          var hh = g.v * k;
          y -= hh;
          if (g.v > 0) svg.appendChild(s('rect', { x: x, y: y, width: 80, height: hh, class: 'vx-biz-seg ' + g.cls }));
          labels.push({ text: g.name + ' ' + fmt(g.v, 0), cy: y + hh / 2, zero: g.v === 0 });
        });
        // 同じ列のラベルが重ならないように、上から順に間隔を空けて配置する
        labels.sort(function (p, q) { return p.cy - q.cy; });
        var prev = -100;
        labels.forEach(function (l) {
          l.y = Math.max(l.cy, prev + 14, 14);
          prev = l.y;
          var left = side === 'L';
          svg.appendChild(s('text', {
            x: left ? x - 8 : x + 88, y: l.y + 4,
            class: 'vx-biz-lbl' + (l.zero ? ' zero' : ''),
            'text-anchor': left ? 'end' : 'start', text: l.text
          }));
        });
        svg.appendChild(s('text', { x: x + 40, y: 236, class: 'vx-biz-ttl', 'text-anchor': 'middle', text: title }));
        svg.appendChild(s('text', { x: x + 40, y: 251, class: 'vx-biz-lbl', 'text-anchor': 'middle', text: '合計 ' + fmt(total.v, 0) }));
      }

      function draw() {
        var tt = totals();
        var maxV = Math.max(tt.A, tt.L + tt.E, 1000);
        var sumOk = tt.A === tt.L + tt.E;

        clear(txRow);
        TX.forEach(function (t, i) {
          var b = ui.button(t.label, function () { doTx(i); });
          b.disabled = !t.can();
          txRow.appendChild(b);
        });

        clear(svg);
        column([
          { name: '現金', v: st.cash, cls: 'vx-biz-seg-cash' },
          { name: '商品', v: st.stock, cls: 'vx-biz-seg-stock' },
          { name: '設備', v: st.equip, cls: 'vx-biz-seg-equip' }
        ], 140, 'L', { max: maxV, v: tt.A }, '資産');
        column([
          { name: '借入金', v: st.loan, cls: 'vx-biz-seg-loan' },
          { name: '資本金', v: st.cap, cls: 'vx-biz-seg-cap' },
          { name: '利益剰余金', v: st.ret, cls: 'vx-biz-seg-ret' }
        ], 260, 'R', { max: maxV, v: tt.L + tt.E }, '負債+純資産');
        svg.appendChild(s('text', { x: 240, y: 130, class: 'vx-biz-eq', 'text-anchor': 'middle', text: '＝' }));

        clear(met);
        met.appendChild(metric('資産の合計', fmt(tt.A, 0)));
        met.appendChild(metric('負債の合計', fmt(tt.L, 0)));
        met.appendChild(metric('純資産の合計', fmt(tt.E, 0)));
        met.appendChild(metric('資産 − (負債 + 純資産)', fmt(tt.A - tt.L - tt.E, 0), sumOk ? 'good' : 'neg'));

        if (!sumOk) {
          verdict.className = 'v-verdict ng';
          verdict.textContent = '資産と負債+純資産の合計がずれている。';
        } else if (lastMsg) {
          verdict.className = 'v-verdict ok';
          verdict.textContent = lastMsg;
        } else {
          verdict.className = 'v-verdict';
          verdict.textContent = '取引ボタンを押して、貸借対照表の変化を見てみよう。資産 = 負債 + 純資産 は、どの取引の後も必ず成り立つ。';
        }

        clear(logEl);
        log.forEach(function (line) { logEl.appendChild(h('li', { text: line })); });
        if (!log.length) logEl.appendChild(h('li', { class: 'v-muted', text: '(まだ取引はありません)' }));
      }

      root.appendChild(txRow);
      root.appendChild(svg);
      root.appendChild(met);
      root.appendChild(verdict);
      root.appendChild(h('div', { class: 'v-label', text: '取引の記録' }));
      root.appendChild(logEl);
      root.appendChild(h('div', { class: 'v-row' }, ui.button('最初から', reset)));
      reset();
    }
  });

  /* ------------------------------------------------------------------
   * SWOT 分析の仕分け
   * ------------------------------------------------------------------ */
  V.register('swot', {
    title: 'SWOT 分析で要因を仕分ける',
    desc: 'カフェチェーンの例で、各文を S(強み)・W(弱み)・O(機会)・T(脅威)のどれに入れるか選びましょう。自社の内部か外部か、プラスかマイナスかで決まります。',
    mount: function (root) {
      var NAME = { S: '強み', W: '弱み', O: '機会', T: '脅威' };
      var ITEMS = [
        { t: '自家焙煎の豆で味の評価が高い', k: 'S', r: '自社の特徴(内部)で、プラスに働く強みです。' },
        { t: '店舗が駅から遠く集客力が弱い', k: 'W', r: '自社の立地(内部)で、マイナスに働く弱みです。' },
        { t: '在宅勤務の普及で住宅街のカフェ需要が増えている', k: 'O', r: '市場の変化(外部)で、プラスに働く機会です。' },
        { t: '大手チェーンが近隣に出店予定', k: 'T', r: '競合の変化(外部)で、マイナスに働く脅威です。' },
        { t: '写真映えする店が SNS で話題になりやすい', k: 'O', r: '社会や市場の変化(外部)で、プラスに働く機会です。' },
        { t: '店長以外にコーヒーを淹れられる人がいない', k: 'W', r: '人材という自社の特徴(内部)で、マイナスに働く弱みです。' },
        { t: 'コーヒー豆の国際価格が高騰している', k: 'T', r: '市場の変化(外部)で、マイナスに働く脅威です。' },
        { t: '常連客が多く口コミ評価が 4.5', k: 'S', r: '自社の顧客や評判(内部)で、プラスに働く強みです。' }
      ];
      var placed = {}, count = 0, score = 0, last = null;
      var wrap = h('div', { class: 'v-body' });
      root.appendChild(wrap);

      function reset() { placed = {}; count = 0; score = 0; last = null; draw(); }

      function answer(i, k) {
        if (i in placed) return;
        placed[i] = k;
        count++;
        var ok = ITEMS[i].k === k;
        if (ok) score++;
        last = { i: i, ok: ok };
        draw();
      }

      function cell(k) {
        var box = h('div', { class: 'vx-biz-cell' + (k === 'W' || k === 'T' ? ' neg' : '') });
        box.appendChild(h('div', { class: 'vx-biz-cell-key', text: k + ' ' + NAME[k] }));
        ITEMS.forEach(function (it, i) {
          if (placed[i] !== k) return;
          var ok = it.k === k;
          box.appendChild(h('div', {
            class: 'vx-biz-item ' + (ok ? 'ok' : 'ng'),
            text: it.t + (ok ? '' : '(正: ' + it.k + ')')
          }));
        });
        return box;
      }

      function draw() {
        clear(wrap);
        var remain = ITEMS.map(function (it, i) { return i; }).filter(function (i) { return !(i in placed); });

        wrap.appendChild(h('div', { class: 'v-label', text: '未仕分けの文 (' + remain.length + ' 件)' }));
        if (!remain.length) {
          wrap.appendChild(h('div', { class: 'v-muted', text: 'すべて仕分けました。' }));
        } else {
          remain.forEach(function (i) {
            var row = h('div', { class: 'vx-biz-row' }, [h('div', { class: 'vx-biz-stmt', text: ITEMS[i].t })]);
            ['S', 'W', 'O', 'T'].forEach(function (k) {
              row.appendChild(ui.button(k + ' ' + NAME[k], function () { answer(i, k); }));
            });
            wrap.appendChild(row);
          });
        }

        wrap.appendChild(h('div', { class: 'v-label', text: '仕分けの結果' }));
        var quad = h('div', { class: 'vx-biz-quad' });
        quad.appendChild(h('span'));
        quad.appendChild(h('div', { class: 'vx-biz-quad-h', text: 'プラス' }));
        quad.appendChild(h('div', { class: 'vx-biz-quad-h', text: 'マイナス' }));
        quad.appendChild(h('div', { class: 'vx-biz-quad-r', text: '内部環境' }));
        quad.appendChild(cell('S'));
        quad.appendChild(cell('W'));
        quad.appendChild(h('div', { class: 'vx-biz-quad-r', text: '外部環境' }));
        quad.appendChild(cell('O'));
        quad.appendChild(cell('T'));
        wrap.appendChild(quad);

        var v = h('div', { class: 'v-verdict' });
        if (!last) {
          v.textContent = '文を読み、自社の内部の話か外部の話か、プラスかマイナスかを考えて仕分けよう。';
        } else if (last.ok) {
          v.className = 'v-verdict ok';
          v.textContent = '正解です。' + ITEMS[last.i].r;
        } else {
          v.className = 'v-verdict ng';
          v.textContent = 'ちがいます。「' + ITEMS[last.i].t + '」は ' + ITEMS[last.i].k + '(' + NAME[ITEMS[last.i].k] + ')です。' + ITEMS[last.i].r;
        }
        wrap.appendChild(v);

        wrap.appendChild(h('div', { class: 'v-row' }, [
          h('span', { class: 'v-chip', text: '正解 ' + score + ' / ' + count }),
          ui.button('もう一度', reset)
        ]));
      }

      draw();
    }
  });
})(window);
