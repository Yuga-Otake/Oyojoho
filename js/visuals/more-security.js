/**
 * visuals/more-security.js - 情報処理安全確保支援士向けの体感ビジュアル(追加分)
 * mfa / certchain / killchain / ir / idsroc
 */
(function (global) {
  'use strict';

  var V = global.Visuals;
  var ui = V.ui, h = ui.h, s = ui.s, clear = ui.clear, fmt = ui.fmt, metric = ui.metric;

  /** ON/OFF の切替ボタン(v-key) */
  function toggle(label, on, onClick) {
    var b = h('button', { type: 'button', class: 'v-key', text: label });
    function sync(v) { b.classList.toggle('is-on', v); b.setAttribute('aria-pressed', v ? 'true' : 'false'); }
    b.addEventListener('click', function () { onClick(); });
    sync(on);
    return { el: b, set: sync };
  }

  /* ------------------------------------------------------------------
   * 1. 多要素認証の判定
   * ------------------------------------------------------------------ */
  var CAT = { k: '知識', p: '所持', b: '生体' };
  var FACTORS = [
    { id: 'pw', label: 'パスワード', cat: 'k', relay: true },
    { id: 'qa', label: '秘密の質問', cat: 'k', relay: true, weak: true },
    { id: 'pin', label: 'PIN', cat: 'k', relay: true },
    { id: 'sms', label: 'SMS のワンタイムコード', cat: 'p', relay: true, sms: true, phone: true },
    { id: 'hw', label: 'ハードウェアトークン', cat: 'p', relay: true },
    { id: 'ic', label: 'IC カード', cat: 'p', relay: false },
    { id: 'app', label: 'スマホアプリの承認', cat: 'p', relay: true, phone: true },
    { id: 'fp', label: '指紋', cat: 'b', relay: false },
    { id: 'face', label: '顔', cat: 'b', relay: false },
    { id: 'fido', label: 'FIDO セキュリティキー', cat: 'p', relay: false, fido: true }
  ];

  V.register('mfa', {
    title: '多要素認証の判定と攻撃シナリオ',
    desc: '認証要素を1〜3個選んでください。「知識・所持・生体」のうち、異なる種類がいくつ含まれるかで判定します。続けて攻撃シナリオを ON にして、その組合せでアカウントを守れるか確かめましょう。',
    mount: function (root) {
      var picked = ['pw', 'sms'];
      var scen = { leak: false, phish: false, lost: false, swap: false };
      var SCEN = [
        { id: 'leak', label: 'パスワードが漏えいした' },
        { id: 'phish', label: '偽サイトでリアルタイムに中継された' },
        { id: 'lost', label: 'スマホを紛失した' },
        { id: 'swap', label: 'SIM スワップされた' }
      ];
      var fBtns = {}, sBtns = {};
      var cats = h('div', { class: 'v-metrics' });
      var verdict = h('div', { class: 'v-verdict' });
      var scenList = h('ol', { class: 'v-log' });
      var scenVerdict = h('div', { class: 'v-verdict' });

      function byId(id) { return FACTORS.filter(function (f) { return f.id === id; })[0]; }
      function pick(id) {
        var i = picked.indexOf(id);
        if (i >= 0) picked.splice(i, 1);
        else { picked.push(id); if (picked.length > 3) picked.shift(); }
        draw();
      }
      /* 各シナリオで破られる要素 */
      function broken(f, sc) {
        if (sc === 'leak') return f.id === 'pw';
        if (sc === 'phish') return !!f.relay;
        if (sc === 'lost') return !!f.phone;
        if (sc === 'swap') return !!f.sms;
        return false;
      }

      root.appendChild(h('div', { class: 'v-label', text: '認証要素を選ぶ(最大3つ)' }));
      var fbox = h('div', { class: 'v-pool' });
      FACTORS.forEach(function (f) {
        var t = toggle('[' + CAT[f.cat] + '] ' + f.label, false, function () { pick(f.id); });
        fBtns[f.id] = t; fbox.appendChild(t.el);
      });
      root.appendChild(fbox);
      root.appendChild(cats);
      root.appendChild(verdict);
      root.appendChild(h('div', { class: 'v-label', text: '攻撃シナリオ(複数選べます)' }));
      var sbox = h('div', { class: 'v-pool' });
      SCEN.forEach(function (sc) {
        var t = toggle(sc.label, false, function () { scen[sc.id] = !scen[sc.id]; draw(); });
        sBtns[sc.id] = t; sbox.appendChild(t.el);
      });
      root.appendChild(sbox);
      root.appendChild(scenList);
      root.appendChild(scenVerdict);
      root.appendChild(h('p', { class: 'v-caption', text: '生体情報は端末内で照合し、サーバへは送らない方式(FIDO など)が主流です。中継される恐れが残るのは、利用者が画面に入力したり承認したりする値です。' }));

      function draw() {
        var sel = picked.map(byId);
        FACTORS.forEach(function (f) { fBtns[f.id].set(picked.indexOf(f.id) >= 0); });
        var used = {};
        sel.forEach(function (f) { used[f.cat] = (used[f.cat] || 0) + 1; });
        var kinds = Object.keys(used).length;
        clear(cats);
        ['k', 'p', 'b'].forEach(function (c) {
          cats.appendChild(metric('「' + CAT[c] + '」', used[c] ? '✓ ' + used[c] + ' 個' : '—', used[c] ? 'good' : ''));
        });
        if (!sel.length) {
          verdict.className = 'v-verdict warn';
          verdict.textContent = '要素を選んでください。';
        } else if (kinds >= 2) {
          verdict.className = 'v-verdict ok';
          verdict.textContent = '多要素認証です。異なる種類の要素が' + kinds + '種類(' + Object.keys(used).map(function (c) { return CAT[c]; }).join('・') + ')含まれています。1つの要素が破られても、残りが攻撃者を止めます。';
        } else if (sel.length >= 2) {
          verdict.className = 'v-verdict ng';
          verdict.textContent = '二段階の認証ですが、多要素認証ではありません。「' + CAT[Object.keys(used)[0]] + '」だけを' + sel.length + '回確認しており、実質的に単要素です。同じ種類の要素は、同じ手口でまとめて破られやすいためです。' + (picked.indexOf('qa') >= 0 ? '秘密の質問の答えは SNS などから推測されることもあります。' : '');
        } else {
          verdict.className = 'v-verdict ng';
          verdict.textContent = '単要素認証です。「' + CAT[sel[0].cat] + '」の要素1つだけでは、漏えいや盗難に対して無防備です。もう1つ、異なる種類の要素を足してみましょう。';
        }

        SCEN.forEach(function (sc) { sBtns[sc.id].set(scen[sc.id]); });
        clear(scenList);
        var active = SCEN.filter(function (sc) { return scen[sc.id]; });
        var allBroken = true;
        sel.forEach(function (f) {
          var any = active.some(function (sc) { return broken(f, sc.id); });
          if (!any) allBroken = false;
        });
        if (!active.length) {
          scenList.style.display = 'none';
          scenVerdict.className = 'v-verdict';
          scenVerdict.textContent = '攻撃シナリオを ON にすると、選んだ組合せで守れるかを判定します。';
        } else if (!sel.length) {
          scenList.style.display = 'none';
          scenVerdict.className = 'v-verdict warn';
          scenVerdict.textContent = '認証要素が選ばれていません。';
        } else {
          scenList.style.display = '';
          active.forEach(function (sc) {
            var left = sel.filter(function (f) { return !broken(f, sc.id); });
            var alone = left.length > 0;
            var msg = reason(sc.id, sel, left, alone);
            scenList.appendChild(h('li', null, [
              h('b', { text: sc.label + ': ' }),
              h('span', { class: alone ? 'v-ok' : 'v-err', text: alone ? '守れる' : '突破される' }),
              ' ― ' + msg
            ]));
          });
          if (active.length >= 2) {
            scenVerdict.className = 'v-verdict ' + (allBroken ? 'ng' : 'ok');
            scenVerdict.textContent = allBroken
              ? 'シナリオが重なると、選んだ要素がすべて破られます。単独では防げる攻撃でも、組み合わさると突破される例です。'
              : '複数のシナリオが重なっても、破られない要素が残っているので守れます。';
          } else {
            var hasFido = picked.indexOf('fido') >= 0;
            scenVerdict.className = 'v-verdict ' + (allBroken ? 'ng' : 'ok');
            scenVerdict.textContent = active[0].id === 'phish'
              ? (hasFido ? '試験のポイント: FIDO は認証時に接続先のオリジン(ドメイン)を署名に含めるため、偽サイトでは使えません。フィッシング耐性のある認証方式です。' : '試験のポイント: ワンタイムコードやプッシュ承認は、利用者が偽サイトに入力・承認した値を攻撃者が本物のサイトへ即座に中継できます。多要素でも防げません。')
              : active[0].id === 'swap' || active[0].id === 'lost'
                ? '試験のポイント: SMS やスマホ上の要素は、SIM スワップや端末の紛失で一度に失われます。要素を別の機器に分散すると被害を抑えられます。'
                : '試験のポイント: パスワードが漏れても、所持や生体といった別の種類の要素があれば不正ログインを止められます。';
          }
        }
      }

      function reason(id, sel, left, ok) {
        if (id === 'leak') return ok ? 'パスワード以外の要素が残っています。' + (left.every(function (f) { return f.cat === 'k'; }) ? '(ただし同じ知識の要素なので強度は不十分です。)' : '') : 'パスワードだけ、または他の要素も破れる構成のため、そのままログインされます。';
        if (id === 'phish') return ok ? '中継できない要素(' + left.map(function (f) { return f.label; }).join('・') + ')が必要なため、ログインを完了できません。' : '入力した値や承認を本物のサイトへ中継され、すべての要素が通ってしまいます。';
        if (id === 'lost') return ok ? '端末上にない要素(' + left.map(function (f) { return f.label; }).join('・') + ')が必要なので、拾った人は完了できません。' : 'SMS やアプリ承認はスマホ上で完結するため、拾った人に使われるおそれがあります。画面ロックが前提です。';
        return ok ? 'SMS 以外の要素が残っているため、コードを奪われても完了できません。' : 'SMS のコードを攻撃者の SIM が受け取るため、SMS だけでは突破されます。';
      }
      draw();
    }
  });

  /* ------------------------------------------------------------------
   * 2. サーバ証明書の検証
   * ------------------------------------------------------------------ */
  V.register('certchain', {
    title: 'サーバ証明書の検証(ブラウザは何を確かめるか)',
    desc: '問題を ON にすると、証明書チェーンのどこが壊れるかが赤く表示されます。ブラウザは上から順に検証し、1つでも失敗すると警告を出します。',
    mount: function (root) {
      var P = [
        { id: 'expired', label: '有効期限切れ' },
        { id: 'host', label: 'アクセス先が shop.example.jp(ホスト名不一致)' },
        { id: 'inter', label: 'サーバに中間 CA 証明書が未設定' },
        { id: 'self', label: 'ルート CA が信頼されていない(自己署名)' },
        { id: 'revoked', label: '証明書が失効済み(CRL/OCSP で判明)' }
      ];
      var st = { expired: false, host: false, inter: false, self: false, revoked: false };
      var btns = {};
      var svg = s('svg', { class: 'v-svg', viewBox: '0 0 340 230', role: 'img', 'aria-label': '証明書チェーン' });
      var list = h('ol', { class: 'v-log' });
      var verdict = h('div', { class: 'v-verdict' });
      var why = h('ul', { class: 'v-log' });

      var pbox = h('div', { class: 'v-pool' });
      P.forEach(function (p) {
        var t = toggle(p.label, false, function () { st[p.id] = !st[p.id]; draw(); });
        btns[p.id] = t; pbox.appendChild(t.el);
      });
      root.appendChild(h('div', { class: 'v-label', text: '起こす問題を選ぶ' }));
      root.appendChild(pbox);
      root.appendChild(h('div', { class: 'v-row' }, ui.button('すべて解除', function () { Object.keys(st).forEach(function (k) { st[k] = false; }); draw(); })));
      root.appendChild(svg);
      root.appendChild(h('div', { class: 'v-label', text: 'ブラウザの検証手順' }));
      root.appendChild(list);
      root.appendChild(verdict);
      root.appendChild(why);

      function node(x, y, w, hh, title, sub, bad, good) {
        var fill = bad ? 'var(--danger-soft)' : 'var(--surface)';
        var stroke = bad ? 'var(--danger)' : good ? 'var(--success)' : 'var(--text-muted)';
        svg.appendChild(s('rect', { x: x, y: y, width: w, height: hh, rx: 8, style: 'fill:' + fill + ';stroke:' + stroke + ';stroke-width:' + (bad ? 2.6 : 1.6) }));
        svg.appendChild(s('text', { x: x + 10, y: y + 20, class: 'v-node-label', text: title }));
        svg.appendChild(s('text', { x: x + 10, y: y + 36, class: 'v-tick', text: sub }));
      }
      function arrow(y1, y2, bad, label) {
        svg.appendChild(s('line', { x1: 105, y1: y1, x2: 105, y2: y2 + 4, class: 'v-edge' + (bad ? ' bad' : ''), 'marker-end': 'url(#v-arr-cc)' }));
        svg.appendChild(s('text', { x: 115, y: (y1 + y2) / 2 + 3, class: 'v-tick' + (bad ? ' bad' : ''), text: label }));
      }

      function draw() {
        P.forEach(function (p) { btns[p.id].set(st[p.id]); });
        var host = st.host ? 'shop.example.jp' : 'www.example.jp';
        var c1 = !st.inter;
        var c2 = !st.self;
        var c3 = !st.expired;
        var c4 = !st.host;
        var c5 = !st.revoked;
        var ok = c1 && c2 && c3 && c4 && c5;

        clear(svg);
        svg.appendChild(s('defs', null, s('marker', { id: 'v-arr-cc', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto' }, s('path', { d: 'M0,0L10,5L0,10z', class: 'v-arrowhead' }))));
        node(10, 8, 190, 46, 'ルート CA', st.self ? '信頼リストにない(自己署名)' : 'ブラウザに組込み済み', st.self, !st.self);
        node(10, 88, 190, 46, '中間 CA', st.inter ? 'サーバが送ってこない' : 'ルート CA が署名', st.inter, false);
        node(10, 168, 190, 54, 'サーバ証明書', 'CN/SAN: www.example.jp', st.expired || st.host || st.revoked, false);
        arrow(88, 54, false, '署名');
        arrow(168, 134, st.inter, st.inter ? '連鎖が途切れる' : '署名');
        svg.appendChild(s('text', { x: 210, y: 28, class: 'v-tick', text: 'ここから信頼を' }));
        svg.appendChild(s('text', { x: 210, y: 41, class: 'v-tick', text: 'たどり始める' }));
        var flags = [];
        if (st.expired) flags.push('有効期限切れ');
        if (st.revoked) flags.push('失効済み');
        if (st.host) flags.push('ホスト名不一致');
        svg.appendChild(s('text', { x: 210, y: 186, class: 'v-tick strong', text: 'アクセス先:' }));
        svg.appendChild(s('text', { x: 210, y: 200, class: 'v-tick' + (st.host ? ' bad' : ' good'), text: host }));
        if (flags.length) svg.appendChild(s('text', { x: 210, y: 214, class: 'v-tick bad', text: flags.length > 1 ? flags[0] + ' ほか' : flags[0] }));

        var checks = [
          { t: '署名の連鎖をたどれる', ok: c1 },
          { t: '信頼されたルート CA に到達する', ok: c2 },
          { t: '有効期間内である', ok: c3 },
          { t: 'ホスト名(CN/SAN)がアクセス先と一致する', ok: c4 },
          { t: '失効していない(CRL/OCSP)', ok: c5 }
        ];
        clear(list);
        var first = -1;
        checks.forEach(function (c, i) {
          if (!c.ok && first < 0) first = i;
          list.appendChild(h('li', null, [
            h('span', { class: c.ok ? 'v-ok' : 'v-err', text: c.ok ? '✓ ' : '✕ ' }),
            c.t
          ]));
        });
        list.appendChild(h('li', null, [h('b', { text: '結果: ' }), ok ? '接続を続ける(暗号化+サーバの身元確認)' : 'ブラウザが警告を表示']));

        verdict.className = 'v-verdict ' + (ok ? 'ok' : 'ng');
        verdict.textContent = ok
          ? 'すべての検証に成功しました。通信は暗号化され、相手が www.example.jp の持ち主であることも確認できています。'
          : '検証に失敗したため、ブラウザは警告を表示します。警告を無視して進むと、偽サーバや中間者に接続していても気づけず、通信内容を盗聴・改ざんされます(中間者攻撃を許す)。';

        clear(why);
        var T = [
          [st.inter, '中間 CA 証明書が未設定: ルートまで署名をたどれず検証できません。サーバには、サーバ証明書に加えて中間 CA 証明書も設定します。'],
          [st.self, 'ルート CA が未信頼: 自己署名証明書は誰でも作れるため、信頼リストにないルートは身元の保証になりません。'],
          [st.expired, '有効期限切れ: 期限後は CA が保証しておらず、鍵が漏れていても気づけません。更新漏れの典型です。'],
          [st.host, 'ホスト名不一致: 別サイト用の証明書を使い回した偽サーバかもしれません。アクセス先と CN/SAN の一致で本人性を確認します。'],
          [st.revoked, '失効済み: 秘密鍵の漏えいなどで CA が取り消した証明書です。期限内でも CRL や OCSP で確認しないと見抜けません。']
        ];
        T.forEach(function (t) { if (t[0]) why.appendChild(h('li', { text: t[1] })); });
        why.style.display = why.firstChild ? '' : 'none';
      }
      draw();
    }
  });

  /* ------------------------------------------------------------------
   * 3. サイバーキルチェーンと多層防御
   * ------------------------------------------------------------------ */
  var STAGES = [
    { n: '偵察', d: '標的の組織・人・システムの情報を集める。防御側からは見えにくい段階。' },
    { n: '武器化', d: 'マルウェアと文書を組み合わせた攻撃ファイルを作る。攻撃者の手元で行われる。' },
    { n: '配送', d: '標的型メールなどで攻撃ファイルを届ける。' },
    { n: '攻撃', d: '脆弱性を悪用して、細工されたファイルの中身を実行させる。' },
    { n: 'インストール', d: 'バックドアなどを常駐させる。' },
    { n: 'C&C 通信', d: '外部のC&Cサーバと通信し、遠隔操作の足場を作る。' },
    { n: '目的の実行', d: '情報の窃取、破壊、暗号化などの目的を達成する。' }
  ];
  var CMS = [
    { id: 'train', stage: 2, label: '利用者への訓練と報告体制', how: '不審メールを開かず報告できる人が増え、届いた時点で気づける' },
    { id: 'sandbox', stage: 2, label: 'メール添付のサンドボックス検査', how: '隔離環境で添付ファイルを実行して、不審な挙動を事前に見つけられる' },
    { id: 'patch', stage: 3, label: '脆弱性修正の迅速な適用', how: '悪用できる脆弱性が残っておらず、攻撃コードが動かない' },
    { id: 'edr', stage: 4, label: 'EDR による振る舞い検知', how: '端末上の不審な振る舞いを検知して、常駐を止められる' },
    { id: 'proxy', stage: 5, label: '認証付きプロキシで外向き通信を限定', how: 'C&Cサーバへの通信が許可されず、遠隔操作を受けられない' },
    { id: 'dlp', stage: 6, label: '重要データの暗号化と DLP', how: '持ち出しを検知・遮断でき、盗まれても読めない' }
  ];

  V.register('killchain', {
    title: 'サイバーキルチェーンと多層防御',
    desc: '攻撃は7つの段階を順に進みます。防御策を ON にして「攻撃を進める」を押すと、最初に防御のある段階で止まります。「対策を1つすり抜ける」で、多層防御の意味を確かめましょう。',
    mount: function (root) {
      var on = { train: false, sandbox: true, patch: false, edr: true, proxy: false, dlp: false };
      var bypass = false;
      var reached = 7; /* 攻撃が試みた段階の数(0〜7) */
      var btns = {};
      var svg = s('svg', { class: 'v-svg', viewBox: '0 0 340 156', role: 'img', 'aria-label': 'キルチェーンの7段階' });
      var metrics = h('div', { class: 'v-metrics' });
      var verdict = h('div', { class: 'v-verdict' });

      var cbox = h('div', { class: 'v-pool' });
      CMS.forEach(function (c) {
        var t = toggle(c.label + '(' + STAGES[c.stage].n + ')', false, function () { on[c.id] = !on[c.id]; draw(); });
        btns[c.id] = t; cbox.appendChild(t.el);
      });
      var bypB = toggle('攻撃者が対策を1つすり抜ける', false, function () { bypass = !bypass; draw(); });

      root.appendChild(h('div', { class: 'v-label', text: '防御策(対応する段階)' }));
      root.appendChild(cbox);
      root.appendChild(bypB.el);
      root.appendChild(svg);
      root.appendChild(h('div', { class: 'v-row' }, [
        ui.button('攻撃を進める', function () { if (reached < 7 && stopAt() < 0) { reached++; } draw(); }, 'primary'),
        ui.button('最初から', function () { reached = 0; draw(); })
      ]));
      root.appendChild(metrics);
      root.appendChild(verdict);

      function enabledList() { return CMS.filter(function (c) { return on[c.id]; }); }
      function bypassed() { var l = enabledList(); return bypass && l.length ? l[0] : null; }
      /* その段階で攻撃を止める対策(すり抜けた1つを除く) */
      function stoppers(i) {
        var b = bypassed();
        return enabledList().filter(function (c) { return c.stage === i && c !== b; });
      }
      function stopAt() {
        for (var i = 0; i < reached; i++) { if (stoppers(i).length) return i; }
        return -1;
      }

      function draw() {
        CMS.forEach(function (c) { btns[c.id].set(on[c.id]); });
        bypB.set(bypass);
        var stop = stopAt();
        if (stop >= 0) reached = stop + 1;
        var b = bypassed();

        clear(svg);
        svg.appendChild(s('defs', null, s('marker', { id: 'v-arr-kc', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto' }, s('path', { d: 'M0,0L10,5L0,10z', class: 'v-arrowhead' }))));
        var W = 72, GAP = 14, X0 = 5, H = 54;
        function pos(i) { return i < 4 ? { x: X0 + i * (W + GAP), y: 8 } : { x: X0 + (i - 4) * (W + GAP), y: 92 }; }
        svg.appendChild(s('path', { d: 'M' + (X0 + 3 * (W + GAP) + W / 2) + ',' + (8 + H) + ' V' + 77 + ' H' + (X0 + W / 2) + ' V' + 90, class: 'v-edge thin', fill: 'none', 'marker-end': 'url(#v-arr-kc)' }));
        STAGES.forEach(function (stg, i) {
          var p = pos(i);
          if (i !== 3 && i !== 6) {
            svg.appendChild(s('line', { x1: p.x + W, y1: p.y + H / 2, x2: p.x + W + GAP - 1, y2: p.y + H / 2, class: 'v-edge', 'marker-end': 'url(#v-arr-kc)' }));
          }
          var done = i < reached, blocked = i === stop;
          var fill = blocked ? 'var(--success-soft)' : done ? 'var(--danger-soft)' : 'var(--surface)';
          var stroke = blocked ? 'var(--success)' : done ? 'var(--danger)' : 'var(--text-muted)';
          svg.appendChild(s('rect', { x: p.x, y: p.y, width: W, height: H, rx: 8, style: 'fill:' + fill + ';stroke:' + stroke + ';stroke-width:' + (done ? 2.4 : 1.4) }));
          svg.appendChild(s('text', { x: p.x + W / 2, y: p.y + 15, 'text-anchor': 'middle', class: 'v-tick', text: (i + 1) + '' }));
          svg.appendChild(s('text', { x: p.x + W / 2, y: p.y + 31, 'text-anchor': 'middle', class: 'v-tick strong', style: 'font-size:11px', text: stg.n }));
          var cnt = enabledList().filter(function (c) { return c.stage === i; }).length;
          var sub = blocked ? '阻止!' : (cnt ? '防御 ×' + cnt : (i < 2 ? '(攻撃側)' : '防御なし'));
          svg.appendChild(s('text', { x: p.x + W / 2, y: p.y + 46, 'text-anchor': 'middle', class: 'v-tick' + (blocked ? ' good' : cnt ? ' strong' : ''), text: sub }));
        });

        var layers = enabledList().length;
        clear(metrics);
        metrics.appendChild(metric('有効な防御層', layers + ' / ' + CMS.length, layers >= 3 ? 'good' : layers === 0 ? 'neg' : ''));
        metrics.appendChild(metric('攻撃の到達', reached === 0 ? '開始前' : stop >= 0 ? '「' + STAGES[stop].n + '」で停止' : reached >= 7 ? '目的を達成' : reached + ' 段階目まで', stop >= 0 ? 'good' : reached >= 7 ? 'neg' : ''));

        var bpNote = b ? '攻撃者は「' + b.label + '」をすり抜けましたが、' : '';
        if (reached === 0) {
          verdict.className = 'v-verdict';
          verdict.textContent = '攻撃はまだ始まっていません。「攻撃を進める」で1段階ずつ進めます。';
        } else if (stop >= 0) {
          var sc = stoppers(stop)[0];
          verdict.className = 'v-verdict ok';
          verdict.textContent = bpNote + '「' + STAGES[stop].n + '」で「' + sc.label + '」が攻撃を止めました。' + sc.how + 'ため、後続の段階には進めません。' + (b ? 'すり抜けられても次の層が止めるのが多層防御です。' : '攻撃は早い段階で止めるほど被害が小さくなります。');
        } else if (reached >= 7) {
          verdict.className = 'v-verdict ng';
          verdict.textContent = bpNote + '攻撃を止める層がなく、目的(情報窃取)まで到達しました。' + (layers === 0 ? '防御策を ON にして、最初からやり直してみましょう。' : (b && layers === 1 ? '防御が1層だけだと、すり抜けられた時点で終わりです。層を重ねましょう。' : '防御策が段階に対応していないため、素通りされました。'));
        } else {
          verdict.className = 'v-verdict warn';
          verdict.textContent = '「' + STAGES[reached - 1].n + '」まで進行中: ' + STAGES[reached - 1].d + 'ここには防御がありません。';
        }
      }
      draw();
    }
  });

  /* ------------------------------------------------------------------
   * 4. インシデント初動の判断トレーニング
   * ------------------------------------------------------------------ */
  var IR_STEPS = [
    {
      q: '① 最初の対応',
      ask: '経理部の PC がマルウェアに感染したかもしれない、と報告を受けました。最初に何をしますか。',
      opts: [
        { t: '電源を切る', ok: false, fb: '電源を切ると、メモリ上にしかない証拠(動作中のプロセス、通信先、暗号鍵など)が消えてしまいます。' },
        { t: 'ネットワークから隔離し、電源は切らない', ok: true, fb: '被害の拡大(他端末への感染、外部への送信)を止めつつ、メモリ上の証拠を保持できます。LAN ケーブルを抜く、無線を切るなどで隔離します。' },
        { t: '少し様子を見る', ok: false, fb: '様子を見ている間に、感染の横展開や情報の外部送信が進みます。封じ込めは迅速に行います。' },
        { t: '初期化して再インストールする', ok: false, fb: '証拠が消え、原因も影響範囲も分からないまま。侵入口が残れば再感染します。復旧は調査の後です。' }
      ]
    },
    {
      q: '② 証拠保全',
      ask: '隔離できました。この PC の証拠をどう扱いますか。',
      opts: [
        { t: '感染したファイルを直接開いて調べる', ok: false, fb: '原本を操作すると、証拠が変わってしまううえ、実行すればさらに感染します。調べるのは複製に対して行います。' },
        { t: 'メモリの内容を取得し、ディスクの複製を作ってハッシュ値を記録する', ok: true, fb: '揮発性の高いメモリから先に取得します。複製を調べ、ハッシュ値で「原本と同一で改ざんされていない」ことを示せるようにします(フォレンジックの基本)。' },
        { t: 'ログを削除して容量を空ける', ok: false, fb: 'ログは原因究明と影響範囲の調査に必要な証拠です。削除は証拠隠滅になりかねません。' }
      ]
    },
    {
      q: '③ 影響範囲の調査',
      ask: '他の端末にも広がっていないか、どう調べますか。',
      opts: [
        { t: '全社員にメールで心当たりを聞くだけにする', ok: false, fb: '利用者の自己申告だけでは、感染に気づいていない端末を見つけられません。ログなどの客観的な記録で調べます。' },
        { t: 'プロキシのログで、同じ不審な宛先と通信した端末を探す', ok: true, fb: '感染端末が通信していた C&C サーバなどの宛先(IoC)をキーに、プロキシや FW のログから、同じ宛先に通信した端末を洗い出します。' },
        { t: '感染した PC だけ調べれば十分', ok: false, fb: 'マルウェアは社内で横展開することがあります。1台で終わりとは限りません。' }
      ]
    },
    {
      q: '④ 報告',
      ask: '状況が見えてきました。誰にどう報告しますか。',
      opts: [
        { t: '社外に知られないよう、報告しない', ok: false, fb: '隠すと対応が遅れ、被害も信頼の損失も拡大します。法令上の報告義務に違反するおそれもあります。' },
        { t: '原因がはっきりするまで、誰にも言わない', ok: false, fb: '判明を待つと初動が遅れます。分かっている範囲で早く報告し、状況の更新を続けます。' },
        { t: 'CSIRT と経営層へ報告し、個人情報の漏えいのおそれがあれば、個人情報保護委員会への報告と本人への通知を検討する', ok: true, fb: '組織内の報告ルートで速やかに共有し、経営判断を仰ぎます。個人データの漏えいのおそれがあれば、個人情報保護法に基づき、速報(おおむね3〜5日以内)と確報(原則30日以内。不正の目的によるおそれがある場合は60日以内)の報告、本人への通知が必要です。' }
      ]
    }
  ];

  V.register('ir', {
    title: 'インシデント初動の判断トレーニング',
    desc: '「経理部の PC がマルウェアに感染したかもしれない」という報告から始まります。4つの場面で、最もよい初動を選んでください。選ぶとすぐに理由が表示されます。',
    mount: function (root) {
      var idx = 0, chosen = null, picks = [], score = 0;
      var prog = h('div', { class: 'v-progress' }, h('span'));
      var stat = h('div', { class: 'v-row' });
      var body = h('div', { class: 'v-task' });

      root.appendChild(prog);
      root.appendChild(stat);
      root.appendChild(body);

      function draw() {
        clear(body); clear(stat);
        var span = prog.firstChild;
        span.style.width = Math.max(8, (idx / IR_STEPS.length) * 100) + '%';
        span.textContent = idx >= IR_STEPS.length ? '完了' : '場面 ' + (idx + 1) + ' / ' + IR_STEPS.length;
        stat.appendChild(h('span', { class: 'v-chip', text: '正解 ' + score + ' / ' + IR_STEPS.length }));
        if (idx >= IR_STEPS.length) return summary();
        var st = IR_STEPS[idx];
        body.appendChild(h('div', { class: 'v-label', text: st.q }));
        body.appendChild(h('p', { class: 'v-note', text: st.ask }));
        var keys = h('div', { class: 'v-keyrow' });
        st.opts.forEach(function (o, i) {
          var cls = 'v-key';
          var mark = '';
          if (chosen !== null) {
            if (o.ok) { cls += ' is-on'; mark = '✓ '; }
            else if (i === chosen) { mark = '✕ '; }
          }
          var b = h('button', { type: 'button', class: cls, text: mark + o.t, style: 'text-align:left;justify-content:flex-start;' + (chosen === i && !o.ok ? 'border-color:var(--danger);color:var(--danger);' : '') });
          b.addEventListener('click', function () {
            if (chosen !== null) return;
            chosen = i; picks.push(i);
            if (o.ok) score++;
            draw();
          });
          keys.appendChild(b);
        });
        body.appendChild(keys);
        if (chosen !== null) {
          var o = st.opts[chosen];
          body.appendChild(h('div', { class: 'v-verdict ' + (o.ok ? 'ok' : 'ng'), text: (o.ok ? '正解です。' : '惜しい、不適切です。') + o.fb }));
          if (!o.ok) {
            var right = st.opts.filter(function (x) { return x.ok; })[0];
            body.appendChild(h('div', { class: 'v-verdict', text: '適切な対応: 「' + right.t + '」 ' + right.fb }));
          }
          body.appendChild(h('div', { class: 'v-row' }, ui.button(idx + 1 >= IR_STEPS.length ? '結果を見る' : '次の場面へ →', function () { idx++; chosen = null; draw(); }, 'primary')));
        }
      }

      function summary() {
        var tone = score === IR_STEPS.length ? 'ok' : score >= 2 ? 'warn' : 'ng';
        body.appendChild(h('div', { class: 'v-verdict ' + tone, text: '結果: ' + score + ' / ' + IR_STEPS.length + ' 問正解。' + (score === IR_STEPS.length ? '初動の流れ(封じ込め→証拠保全→影響範囲の調査→報告)を押さえています。' : '流れを見直しましょう: 封じ込め→証拠保全→影響範囲の調査→報告。') }));
        var ol = h('ol', { class: 'v-log' });
        IR_STEPS.forEach(function (st, i) {
          var o = st.opts[picks[i]];
          ol.appendChild(h('li', null, [
            h('b', { text: st.q + ' ' }),
            h('span', { class: o && o.ok ? 'v-ok' : 'v-err', text: o && o.ok ? '○ ' : '× ' }),
            st.opts.filter(function (x) { return x.ok; })[0].t
          ]));
        });
        body.appendChild(ol);
        body.appendChild(h('p', { class: 'v-caption', text: '共通する考え方: 証拠は揮発性の高いものから(メモリ→ディスク)。原本は触らず複製で調べる。判断を一人で抱えず、早く共有する。' }));
        body.appendChild(h('div', { class: 'v-row' }, ui.button('もう一度挑戦する', function () { idx = 0; chosen = null; picks = []; score = 0; draw(); }, 'primary')));
      }
      draw();
    }
  });

  /* ------------------------------------------------------------------
   * 5. 検知のしきい値と過検知・見逃し
   * ------------------------------------------------------------------ */
  function erf(x) {
    var sign = x < 0 ? -1 : 1; x = Math.abs(x);
    var t = 1 / (1 + 0.3275911 * x);
    var y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return sign * y;
  }
  function cdf(x, m, sd) { return 0.5 * (1 + erf((x - m) / (sd * Math.SQRT2))); }
  function pdf(x, m, sd) { var z = (x - m) / sd; return Math.exp(-z * z / 2) / (sd * Math.sqrt(2 * Math.PI)); }

  V.register('idsroc', {
    title: '検知のしきい値と過検知・見逃し',
    desc: '通信の「怪しさスコア」の分布です。しきい値以上を攻撃とみなして警告します。しきい値を動かして、過検知と見逃しがどう入れ替わるかを見てください。1日に正常通信 10,000 件、攻撃通信 50 件を想定します。',
    mount: function (root) {
      var N_NORM = 10000, N_ATK = 50;
      var M0 = 35, M1 = 70, SD = 12;
      var mode = 'ids';
      var th = ui.slider({ label: 'しきい値(これ以上を攻撃とみなす)', min: 0, max: 100, value: 55, fmt: function (v) { return String(v); }, onInput: function () { draw(); } });
      var seg = ui.segmented([{ value: 'ids', label: 'IDS(検知のみ)' }, { value: 'ips', label: 'IPS(検知して遮断)' }], mode, function (v) { mode = v; draw(); });
      var svg = s('svg', { class: 'v-svg', viewBox: '0 0 340 190', role: 'img', 'aria-label': '正常通信と攻撃通信のスコア分布' });
      var metrics = h('div', { class: 'v-metrics' });
      var verdict = h('div', { class: 'v-verdict' });

      root.appendChild(seg.el);
      root.appendChild(th.el);
      root.appendChild(svg);
      root.appendChild(h('div', { class: 'v-legend' }, [
        h('span', null, [h('i', { style: 'background:var(--warn)' }), '過検知(正常なのに警告)']),
        h('span', null, [h('i', { style: 'background:var(--danger)' }), '見逃し(攻撃なのに素通り)'])
      ]));
      root.appendChild(metrics);
      root.appendChild(verdict);
      root.appendChild(h('p', { class: 'v-caption', text: '2つの分布はそれぞれ面積を1にそろえて描いています(実際の件数は 10,000 対 50 で大きく違います)。' }));

      var X0 = 14, XW = 314, YB = 150, YH = 110, PEAK = pdf(0, 0, SD);
      function X(v) { return X0 + XW * v / 100; }
      function Y(p) { return YB - YH * p / PEAK; }
      function curve(m, from, to, close) {
        var d = '';
        for (var v = from; v <= to; v += 1) d += (d ? 'L' : 'M') + X(v).toFixed(1) + ',' + Y(pdf(v, m, SD)).toFixed(1);
        if (close) d += 'L' + X(to).toFixed(1) + ',' + YB + 'L' + X(from).toFixed(1) + ',' + YB + 'Z';
        return d;
      }

      function draw() {
        var t = th.value;
        var fpr = 1 - cdf(t, M0, SD), fnr = cdf(t, M1, SD);
        var fp = N_NORM * fpr, fn = N_ATK * fnr, tp = N_ATK - fn;
        var alerts = fp + tp;
        var real = alerts > 0 ? tp / alerts : 0;

        clear(svg);
        svg.appendChild(s('line', { x1: X0, y1: YB, x2: X0 + XW, y2: YB, class: 'v-axis' }));
        [0, 25, 50, 75, 100].forEach(function (v) {
          svg.appendChild(s('line', { x1: X(v), y1: YB, x2: X(v), y2: YB + 4, class: 'v-axis' }));
          svg.appendChild(s('text', { x: X(v), y: YB + 16, 'text-anchor': 'middle', class: 'v-tick', text: String(v) }));
        });
        svg.appendChild(s('text', { x: X0 + XW, y: YB + 30, 'text-anchor': 'end', class: 'v-tick', text: '怪しさスコア →' }));
        if (t < 100) svg.appendChild(s('path', { d: curve(M0, t, 100, true), style: 'fill:var(--warn);opacity:.5' }));
        if (t > 0) svg.appendChild(s('path', { d: curve(M1, 0, t, true), style: 'fill:var(--danger);opacity:.5' }));
        svg.appendChild(s('path', { d: curve(M0, 0, 100, false), class: 'v-line faint' }));
        svg.appendChild(s('path', { d: curve(M1, 0, 100, false), class: 'v-line' }));
        svg.appendChild(s('text', { x: X(M0 - 8), y: 24, 'text-anchor': 'middle', class: 'v-tick strong', text: '正常通信' }));
        svg.appendChild(s('text', { x: X(M1 + 8), y: 24, 'text-anchor': 'middle', class: 'v-tick strong', style: 'fill:var(--primary)', text: '攻撃通信' }));
        svg.appendChild(s('line', { x1: X(t), y1: 30, x2: X(t), y2: YB, class: 'v-guide danger' }));
        var anchor = t > 80 ? 'end' : 'start';
        svg.appendChild(s('text', { x: X(t) + (anchor === 'end' ? -4 : 4), y: 40, 'text-anchor': anchor, class: 'v-tick danger', text: 'しきい値 ' + t }));

        clear(metrics);
        var ipsWord = mode === 'ips';
        metrics.appendChild(metric(ipsWord ? '過検知(誤遮断)/日' : '過検知(FP)/日', fmt(fp, 0) + ' 件', fp > 500 ? 'neg' : ''));
        metrics.appendChild(metric('見逃し(FN)/日', fmt(fn, 1) + ' 件', fnr > 0.2 ? 'neg' : ''));
        metrics.appendChild(metric('過検知率(正常のうち)', fmt(fpr * 100, 1) + ' %'));
        metrics.appendChild(metric('見逃し率(攻撃のうち)', fmt(fnr * 100, 1) + ' %'));
        metrics.appendChild(metric('警告のうち本物の攻撃', fmt(real * 100, 1) + ' %', real < 0.2 ? 'neg' : 'good'));

        var tone, msg;
        if (fnr > 0.4) {
          tone = 'ng';
          msg = 'しきい値が高すぎます。攻撃の ' + fmt(fnr * 100, 0) + '% を見逃しており、' + (ipsWord ? '攻撃が遮断されずに通過します。' : '侵入されても気づけません。');
        } else if (fp > 500) {
          tone = 'ng';
          msg = 'しきい値が低すぎます。1日 ' + fmt(fp, 0) + ' 件の過検知で、' + (ipsWord ? '正常な業務通信が大量に遮断され、業務が止まります。' : '運用担当者が誤報の調査に追われ、本物の警告が埋もれます(アラート疲れ)。');
        } else if (fnr > 0.15 || fp > 150) {
          tone = 'warn';
          msg = 'まだどちらかに偏っています。過検知 ' + fmt(fp, 0) + ' 件・見逃し ' + fmt(fn, 1) + ' 件。' + (ipsWord ? 'IPS は誤遮断が業務に直撃するので、慎重に調整します。' : '運用できる警告数に収まるかも考えましょう。');
        } else {
          tone = 'ok';
          msg = '過検知 ' + fmt(fp, 0) + ' 件、見逃し ' + fmt(fn, 1) + ' 件でバランスがとれています。';
        }
        verdict.className = 'v-verdict ' + tone;
        verdict.textContent = msg + ' 試験のポイント: しきい値を上げると過検知は減るが見逃しが増え、下げると逆になる(トレードオフ)。' + (ipsWord ? 'IPS では過検知=正常な業務通信の遮断、見逃し=攻撃の通過。' : 'IDS では過検知=誤報、見逃し=侵入に気づけないこと。') + '攻撃は少数なので、警告の大半が誤報になりやすい点にも注意。';
      }
      draw();
    }
  });
})(window);
