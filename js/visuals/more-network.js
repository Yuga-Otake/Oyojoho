/**
 * visuals/more-network.js - ネットワーク分野の体感ビジュアル(追加分)
 *  encap / tcpudp / napt / routing / arp
 */
(function (global) {
  'use strict';

  var V = global.Visuals;
  var ui = V.ui, h = ui.h, s = ui.s, clear = ui.clear, fmt = ui.fmt, metric = ui.metric;

  /** 色クラスの代わりに CSS 変数を直接使う小物 */
  function tint(color, op) {
    return 'fill:var(' + color + ');fill-opacity:' + (op || 0.22) + ';stroke:var(' + color + ');stroke-width:1.6';
  }
  function setVerdict(el, tone, text) {
    el.className = 'v-verdict' + (tone ? ' ' + tone : '');
    el.textContent = text;
  }
  /** 表のセルを折り返し可能にする(狭い画面で横スクロールを減らす) */
  function wrapCells(table) {
    var cs = table.querySelectorAll('td, th');
    for (var i = 0; i < cs.length; i++) cs[i].style.whiteSpace = 'normal';
    return table;
  }
  function txt(x, y, text, cls, anchor, extra) {
    var a = { x: x, y: y, class: cls || 'v-tick', text: text };
    if (anchor) a['text-anchor'] = anchor;
    if (extra) Object.keys(extra).forEach(function (k) { a[k] = extra[k]; });
    return s('text', a);
  }
  /** 疑似乱数(mulberry32) */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ------------------------------------------------------------------
   * 1. カプセル化とネットワーク機器
   * ------------------------------------------------------------------ */
  V.register('encap', {
    title: 'カプセル化とネットワーク機器',
    desc: 'クライアントが Web サーバへ「GET /index.html」を送る流れを1ステップずつ追います。各層のヘッダが付いて(カプセル化)、機器ごとに読む場所が違うこと、IP アドレスは変わらず MAC アドレスは区間ごとに付け替わることを確かめましょう。',
    mount: function (root) {
      var C_IP = '192.168.1.10', S_IP = '203.0.113.80';
      var STEPS = [
        { loc: 'c', read: 'data', tcp: false, ip: false, eth: null, ttl: 64, tone: '',
          text: '【アプリケーション層】ブラウザが送りたいデータ「GET /index.html」を作ります。まだヘッダは何も付いていません。' },
        { loc: 'c', read: 'tcp', tcp: true, ip: false, eth: null, ttl: 64, tone: '',
          text: '【トランスポート層】TCP ヘッダを追加(カプセル化)。送信元ポート 49152、宛先ポート 80 で「どのアプリ宛か」を表します。この単位がセグメントです。' },
        { loc: 'c', read: 'ip', tcp: true, ip: true, eth: null, ttl: 64, tone: '',
          text: '【ネットワーク層】IP ヘッダを追加。送信元 192.168.1.10、宛先 203.0.113.80、TTL 64。この単位がパケットです。' },
        { loc: 'c', read: 'eth', tcp: true, ip: true, eth: { src: 'C-MAC', dst: 'R1-MAC' }, fcs: true, ttl: 64, tone: '',
          text: '【データリンク層】Ethernet ヘッダ(送信元=自分の MAC、宛先=次の機器であるルータの MAC)と、誤り検出用の FCS を追加。この単位がフレームです。宛先 MAC は「次の1ホップ先」であり、最終宛先のサーバではない点に注意。' },
        { loc: 'c', read: null, tcp: true, ip: true, eth: { src: 'C-MAC', dst: 'R1-MAC' }, fcs: true, ttl: 64, tone: '',
          text: '【物理層】フレームをビット列として電気信号(または光・電波)に変えて送り出します。' },
        { loc: 'sw', read: 'eth', tcp: true, ip: true, eth: { src: 'C-MAC', dst: 'R1-MAC' }, fcs: true, ttl: 64, tone: '',
          text: '【L2スイッチ】読むのは Ethernet ヘッダの宛先 MAC だけ。MAC アドレステーブルを引いて、R1-MAC のポートへ転送します。IP ヘッダは見ません。' },
        { loc: 'r', read: 'ip', tcp: true, ip: true, eth: null, ttl: 63, tone: 'warn',
          text: '【ルータ(受信)】宛先 MAC が自分宛と確認したら Ethernet ヘッダを外し、IP ヘッダの宛先 203.0.113.80 を見て経路表から送り先を決めます。TTL を 1 減らして 63 に。TTL が 0 になるとパケットは破棄されます(ループ防止)。' },
        { loc: 'r', read: 'eth', tcp: true, ip: true, eth: { src: 'R2-MAC', dst: 'S-MAC' }, fcs: true, ttl: 63, tone: 'warn',
          text: '【ルータ(送信)】次の区間用に新しい Ethernet ヘッダ(送信元=ルータの MAC、宛先=サーバの MAC)を付け直して送り出します。IP アドレスはそのまま、MAC アドレスだけが付け替わりました。' },
        { loc: 's', read: 'data', tcp: false, ip: false, eth: null, ttl: 63, tone: 'ok',
          text: '【Web サーバ】下の層から順に外します。Ethernet(宛先 MAC・FCS を確認)→ IP(宛先が自分)→ TCP(ポート 80 のアプリへ)→ データ。IP アドレスは端から端まで変わらず、MAC アドレスは区間ごとに付け替わる、が要点です。' }
      ];
      var pos = 0;
      var svg = s('svg', { class: 'v-svg', viewBox: '0 0 340 190', role: 'img', 'aria-label': 'カプセル化の様子' });
      var tbl = h('div', { class: 'v-scroll' });
      var verdict = h('div', { class: 'v-verdict' });
      var prevB = ui.button('← 前へ', function () { if (pos > 0) { pos--; draw(); } });
      var nextB = ui.button('次へ →', function () { if (pos < STEPS.length - 1) { pos++; draw(); } }, 'primary');
      var resetB = ui.button('最初から', function () { pos = 0; draw(); });
      root.appendChild(svg);
      root.appendChild(verdict);
      root.appendChild(h('div', { class: 'v-row' }, [prevB, nextB, resetB]));
      root.appendChild(tbl);

      var DEV = [
        { k: 'c', x: 38, name: 'クライアント' },
        { k: 'sw', x: 125, name: 'L2スイッチ' },
        { k: 'r', x: 215, name: 'ルータ' },
        { k: 's', x: 302, name: 'Webサーバ' }
      ];
      var READ_LABEL = { eth: 'MAC を読む', ip: 'IP を読む', tcp: 'ポートを読む', data: 'データを扱う' };

      function block(x, w, color, label, sub, present, hot) {
        var g = s('g');
        if (present) {
          g.appendChild(s('rect', { x: x, y: 100, width: w, height: 46, rx: 4, style: tint(color, hot ? 0.5 : 0.22) }));
          g.appendChild(txt(x + w / 2, 118, label, 'v-tick strong', 'middle'));
          if (sub) g.appendChild(txt(x + w / 2, 135, sub, 'v-tick', 'middle'));
        } else {
          g.appendChild(s('rect', { x: x, y: 100, width: w, height: 46, rx: 4, class: 'v-guide', style: 'fill:none' }));
          g.appendChild(txt(x + w / 2, 127, '—', 'v-tick', 'middle'));
        }
        if (hot && present) g.appendChild(s('rect', { x: x - 2, y: 98, width: w + 4, height: 50, rx: 5, style: 'fill:none;stroke:var(' + color + ');stroke-width:3' }));
        return g;
      }

      function draw() {
        var st = STEPS[pos];
        clear(svg);
        // 機器とリンク
        for (var i = 0; i < DEV.length - 1; i++) {
          svg.appendChild(s('line', { x1: DEV[i].x, y1: 36, x2: DEV[i + 1].x, y2: 36, class: 'v-edge' }));
        }
        DEV.forEach(function (d) {
          var on = d.k === st.loc;
          svg.appendChild(s('rect', { x: d.x - 34, y: 16, width: 68, height: 40, rx: 8, class: 'v-state' + (on ? ' cur' : '') }));
          svg.appendChild(txt(d.x, 40, d.name, 'v-node-label', 'middle', { style: 'font-size:11px' }));
          if (on && st.read) {
            svg.appendChild(txt(d.x, 74, READ_LABEL[st.read], 'v-tick strong', 'middle', { style: 'fill:var(--primary)' }));
            svg.appendChild(s('path', { d: 'M' + d.x + ',58 L' + (d.x - 4) + ',65 L' + (d.x + 4) + ',65 z', style: 'fill:var(--primary)' }));
          }
        });
        svg.appendChild(txt(6, 94, 'フレームの中身(外側 = 左)', 'v-tick'));
        // フレーム
        var x = 8;
        svg.appendChild(block(x, 62, '--primary', 'Eth', st.eth ? '宛 ' + st.eth.dst : '', !!st.eth, st.read === 'eth')); x += 66;
        svg.appendChild(block(x, 58, '--success', 'IP', 'TTL ' + st.ttl, st.ip, st.read === 'ip')); x += 62;
        svg.appendChild(block(x, 52, '--warn', 'TCP', '→ 80', st.tcp, st.read === 'tcp')); x += 56;
        svg.appendChild(block(x, 100, '--text-muted', 'データ', 'GET /index.html', true, st.read === 'data')); x += 104;
        svg.appendChild(block(x, 36, '--danger', 'FCS', '', !!st.fcs && !!st.eth, false));
        // 凡例
        svg.appendChild(txt(8, 166, 'Eth = L2(MAC)  IP = L3(IPアドレス)  TCP = L4(ポート)', 'v-tick'));
        svg.appendChild(txt(8, 182, 'ステップ ' + (pos + 1) + ' / ' + STEPS.length, 'v-tick strong'));

        // 表
        var rows = [];
        rows.push(['L2 MAC', st.eth ? st.eth.src + ' → ' + st.eth.dst : '(外した/まだ無い)', st.read === 'eth', st.eth && pos >= 7]);
        rows.push(['L3 IP', st.ip ? C_IP + ' → ' + S_IP + '(TTL ' + st.ttl + ')' : '(外した/まだ無い)', st.read === 'ip', false]);
        rows.push(['L4 ポート', st.tcp ? '49152 → 80' : '(外した/まだ無い)', st.read === 'tcp', false]);
        clear(tbl);
        tbl.appendChild(wrapCells(h('table', { class: 'v-table' }, [
          h('thead', null, h('tr', null, [h('th', { text: '層' }), h('th', { text: '送信元 → 宛先' })])),
          h('tbody', null, rows.map(function (r) {
            return h('tr', { class: r[2] ? 'hl' : (r[3] ? 'crit' : '') }, [h('td', { text: r[0] }), h('td', { text: r[1] })]);
          }))
        ])));
        setVerdict(verdict, st.tone, st.text);
        prevB.disabled = pos === 0;
        nextB.disabled = pos >= STEPS.length - 1;
      }
      draw();
    }
  });

  /* ------------------------------------------------------------------
   * 2. TCP と UDP
   * ------------------------------------------------------------------ */
  V.register('tcpudp', {
    title: 'TCP と UDP の違い',
    desc: '10個のデータを送ってみます。パケット損失率を上げると、TCP は再送で全部届けるぶん時間がかかり、UDP は速いけれど欠けたままになります。ボタンを押すたびに別の損失パターンになります。',
    mount: function (root) {
      var mode = 'tcp', runNo = 1, N = 10;
      var seg = ui.segmented([{ value: 'tcp', label: 'TCP' }, { value: 'udp', label: 'UDP' }], mode, function (v) { mode = v; run(); });
      var loss = ui.slider({ label: 'パケット損失率', min: 0, max: 50, step: 5, value: 20, fmt: function (v) { return v + ' %'; }, onInput: function () { run(); } });
      var sendB = ui.button('10個のデータを送る', function () { runNo++; run(); }, 'primary');
      var metrics = h('div', { class: 'v-metrics' });
      var wrap = h('div', { class: 'v-scroll', style: { 'max-height': '300px', 'overflow-y': 'auto' } });
      var verdict = h('div', { class: 'v-verdict' });
      root.appendChild(h('div', { class: 'v-row' }, [seg.el]));
      root.appendChild(loss.el);
      root.appendChild(h('div', { class: 'v-row' }, [sendB]));
      root.appendChild(metrics);
      root.appendChild(verdict);
      root.appendChild(wrap);
      root.appendChild(h('p', { class: 'v-caption', text: '時間は往復時間(RTT)を単位にした簡易モデルです。TCP は未確認の分をまとめて送り、ACK が来なければ1 RTT 待って(タイムアウト)再送します。' }));

      function simTcp(p, r) {
        var rows = [], t = 0, retr = 0;
        ['SYN', 'SYN/ACK', 'ACK'].forEach(function (name, i) {
          var tries = 1;
          while (r() < p && tries < 6) { tries++; retr++; t += 2; }
          t += 0.5;
          rows.push({ a: '接続 ' + (i + 1) + ': ' + name + (i === 1 ? ' ←' : ' →'), b: tries > 1 ? tries + '回目で成功(再送 ' + (tries - 1) + ')' : '成功', t: t, cls: tries > 1 ? 'crit' : '' });
        });
        var att = [], i;
        for (i = 0; i < N; i++) att.push([]);
        var pending = [], round = 0;
        for (i = 0; i < N; i++) pending.push(i);
        while (pending.length && round < 30) {
          round++;
          var next = [];
          pending.forEach(function (k) {
            var lostIt = round < 30 && r() < p;
            att[k].push(!lostIt);
            if (lostIt) { next.push(k); retr++; }
          });
          t += 1 + (next.length ? 1 : 0);
          pending.forEach(function (k) { if (att[k][att[k].length - 1]) att[k].t = t - (next.length ? 1 : 0); });
          pending = next;
        }
        for (i = 0; i < N; i++) {
          var cur = att[i], parts = cur.map(function (ok, j) { return (j + 1) + '回目' + (ok ? '✓' : '✗'); });
          rows.push({ a: 'データ ' + (i + 1) + ' →', b: parts.join(' → ') + (cur.length > 1 ? '(ACK なし→再送)' : ' ACK 受信'), t: att[i].t, cls: cur.length > 1 ? 'crit' : '' });
        }
        return { rows: rows, got: N, retr: retr, time: t };
      }
      function simUdp(p, r) {
        var rows = [], got = 0;
        for (var i = 0; i < N; i++) {
          var ok = r() >= p;
          if (ok) got++;
          rows.push({ a: 'データ ' + (i + 1) + ' →', b: ok ? '届いた' : '消失(誰も気づかない)', t: 0.5, cls: ok ? '' : 'crit' });
        }
        return { rows: rows, got: got, retr: 0, time: 0.5 };
      }

      function run() {
        var p = loss.value / 100;
        var r = rng(runNo * 7919 + 13);
        var res = mode === 'tcp' ? simTcp(p, r) : simUdp(p, r);
        clear(metrics);
        metrics.appendChild(metric('届いた数', res.got + ' / ' + N, res.got === N ? 'good' : 'neg'));
        metrics.appendChild(metric('再送回数', String(res.retr), res.retr ? 'neg' : ''));
        metrics.appendChild(metric('所要時間', fmt(res.time, 1) + ' RTT', ''));
        clear(wrap);
        wrap.appendChild(wrapCells(h('table', { class: 'v-table' }, [
          h('thead', null, h('tr', null, [h('th', { text: '送信' }), h('th', { text: '結果' }), h('th', { text: '完了(RTT)' })])),
          h('tbody', null, res.rows.map(function (x) {
            return h('tr', { class: x.cls }, [h('td', { text: x.a }), h('td', { text: x.b }), h('td', { text: fmt(x.t, 1) })]);
          }))
        ])));
        if (mode === 'tcp') {
          setVerdict(verdict, res.retr ? 'warn' : 'ok',
            res.retr
              ? 'TCP は 3ウェイハンドシェイクで接続を確立し、ACK が返らなかった ' + res.retr + ' 回ぶんを再送して、10個すべてを順番どおりに届けました。信頼性と引き換えに ' + fmt(res.time, 1) + ' RTT かかっています。Web・メール・ファイル転送など、欠けると困る用途は TCP。'
              : 'TCP は 3ウェイハンドシェイク(SYN → SYN/ACK → ACK)で接続してからデータを送り、ACK で到達を確認します。損失がなければ再送なしで全部届きます。損失率を上げてみましょう。');
        } else {
          setVerdict(verdict, res.got === N ? 'ok' : 'ng',
            res.got === N
              ? 'UDP は接続の確立も ACK もなく、送りっぱなし(コネクションレス)です。損失が無ければ速く全部届きます。損失率を上げてみましょう。'
              : 'UDP は欠けた ' + (N - res.got) + ' 個を再送せず、送信側は損失に気づきません。そのかわり ' + fmt(res.time, 1) + ' RTT と短時間で済みます。音声・動画のストリーミング、DNS 問い合わせなど、遅延が小さいことが重要で多少欠けても許容できる用途は UDP。');
        }
      }
      run();
    }
  });

  /* ------------------------------------------------------------------
   * 3. NAPT(IP マスカレード)
   * ------------------------------------------------------------------ */
  V.register('napt', {
    title: 'NAT と NAPT(IP マスカレード)',
    desc: 'プライベートIPの PC が外のサーバへ接続すると、ルータがアドレス(とポート)を書き換えて変換表に記録します。1つのグローバル IP を複数台で共有できる仕組みと、外から突然届いたパケットが破棄される理由を確かめましょう。',
    mount: function (root) {
      var PCS = [{ n: 'PC-1', ip: '192.168.1.10' }, { n: 'PC-2', ip: '192.168.1.11' }, { n: 'PC-3', ip: '192.168.1.12' }];
      var SRV = '198.51.100.10';
      var mode = 'napt', conns, perPc, nextExt, sel, last;

      var seg = ui.segmented([{ value: 'nat', label: 'NAT(1対1)' }, { value: 'napt', label: 'NAPT(ポートも変換)' }], mode, function (v) { mode = v; init(); });
      var svg = s('svg', { class: 'v-svg', viewBox: '0 0 340 170', role: 'img', 'aria-label': 'NAPT の構成図' });
      var verdict = h('div', { class: 'v-verdict' });
      var metrics = h('div', { class: 'v-metrics' });
      var pktBox = h('div', { class: 'v-scroll' });
      var tblBox = h('div', { class: 'v-scroll' });
      var pcBtns = PCS.map(function (pc, i) { return ui.button(pc.n + ' → Web サーバへ接続', function () { connect(i); }); });
      var replyB = ui.button('サーバからの応答を返す', function () { reply(); }, 'primary');
      var attackB = ui.button('外から突然パケットが届く', function () { unsolicited(); });
      var resetB = ui.button('変換表を初期化', function () { init(); });
      root.appendChild(seg.el);
      root.appendChild(svg);
      root.appendChild(verdict);
      root.appendChild(h('div', { class: 'v-row' }, pcBtns));
      root.appendChild(h('div', { class: 'v-row' }, [replyB, attackB, resetB]));
      root.appendChild(h('div', { class: 'v-label', text: 'ヘッダの書き換え(ルータを通る前 → 後)' }));
      root.appendChild(pktBox);
      root.appendChild(h('div', { class: 'v-label', text: 'ルータの変換表(行をタップで選択)' }));
      root.appendChild(tblBox);
      root.appendChild(metrics);

      function extIpOf(i) { return mode === 'nat' ? '203.0.113.' + (5 + i) : '203.0.113.5'; }

      function init() {
        conns = []; perPc = [0, 0, 0]; nextExt = 60001; sel = -1; last = null;
        add(0); add(1);
        last = { kind: 'req', c: conns[conns.length - 1] };
        sel = conns.length - 1;
        note('init');
        draw();
      }
      function add(i) {
        var c;
        if (mode === 'nat') {
          for (var k = 0; k < conns.length; k++) if (conns[k].pc === i) return conns[k];
        }
        var sp = 50000 + (perPc[i] % 4);
        perPc[i]++;
        c = { pc: i, sp: sp, eip: extIpOf(i), ep: mode === 'nat' ? sp : nextExt++ };
        conns.push(c);
        if (conns.length > 8) conns.shift();
        return c;
      }
      var verdictState = { tone: '', text: '' };
      function connect(i) {
        var before = conns.length;
        var c = add(i);
        sel = conns.indexOf(c);
        last = { kind: 'req', c: c };
        if (mode === 'napt') {
          note('req', 'ok', PCS[i].n + ' が送信元ポート ' + c.sp + ' で接続。ルータは送信元を「' + c.eip + ':' + c.ep + '」に書き換え、変換表に記録しました。他の PC も同じポート ' + c.sp + ' を使い得ますが、外側ポートで区別できます。');
        } else {
          note('req', 'ok', PCS[i].n + ' の送信元 IP をグローバル IP ' + c.eip + ' に書き換えました(ポートは据え置き)。1対1変換では PC 1台ごとにグローバル IP が1つ必要です。' + (before === conns.length ? '(すでに対応済みの PC なので表は増えません)' : ''));
        }
        draw();
      }
      function reply() {
        if (sel < 0 || !conns[sel]) { note('none', 'warn', '先に PC から接続してください。応答を返す相手(変換表の行)がありません。'); draw(); return; }
        var c = conns[sel];
        last = { kind: 'reply', c: c };
        note('reply', 'ok', 'サーバからの応答の宛先は ' + c.eip + ':' + c.ep + '。ルータが変換表を引いて ' + PCS[c.pc].n + '(' + PCS[c.pc].ip + ':' + c.sp + ')へ書き戻して転送します。表があるから、同じグローバル IP 宛の応答を正しい PC に振り分けられます。');
        draw();
      }
      function unsolicited() {
        if (mode === 'nat') {
          last = { kind: 'inNat', c: conns[0] };
          note('inNat', 'warn', '1対1の NAT は変換の対応が固定なので、グローバル IP ' + conns[0].eip + ' 宛のパケットはそのまま PC-1 に届いてしまいます。外部から内部へ通すかどうかは、別途ファイアウォールなどで制御が必要です。');
        } else {
          last = { kind: 'drop' };
          note('drop', 'ng', '宛先 203.0.113.5:60099 に対応する行が変換表にないため、ルータはどの PC 宛か判断できず破棄します。NAPT は「内側から始めた通信」しか表に載らないので、外部からの不意の接続を結果的に防げます。1つのグローバル IP を複数台で共有できるのは、ポート番号で通信を区別するからです。');
        }
        draw();
      }
      function note(kind, tone, text) {
        if (kind === 'init') {
          tone = '';
          text = mode === 'napt'
            ? 'NAPT:PC-1・PC-2 がすでに接続中です。どちらも送信元ポートは 50000 ですが、外側ポートは 60001・60002 に振り分けられ、グローバル IP は 203.0.113.5 の1つだけです。ボタンで試してみましょう。'
            : 'NAT(1対1):PC ごとに別のグローバル IP(203.0.113.5, .6, .7)を割り当てる方式です。ポートは変換しないので、PC の台数ぶんグローバル IP が必要です。';
        }
        verdictState.tone = tone || ''; verdictState.text = text;
        setVerdict(verdict, tone, text);
      }

      function pcBox(i, y, active) {
        var g = s('g');
        g.appendChild(s('rect', { x: 4, y: y, width: 92, height: 40, rx: 6, class: 'v-state' + (active ? ' cur' : '') }));
        g.appendChild(txt(50, y + 17, PCS[i].n, 'v-node-label', 'middle', { style: 'font-size:11px' }));
        g.appendChild(txt(50, y + 32, PCS[i].ip, 'v-tick', 'middle'));
        return g;
      }

      function draw() {
        clear(svg);
        var ys = [10, 65, 120], cy = 85;
        var act = last && last.c ? last.c.pc : -1;
        var dropMode = last && last.kind === 'drop';
        ys.forEach(function (y, i) {
          var on = i === act && last.kind !== 'drop';
          svg.appendChild(s('line', { x1: 96, y1: y + 20, x2: 140, y2: cy, class: 'v-edge' + (on ? ' good' : '') }));
        });
        svg.appendChild(s('line', { x1: 214, y1: cy, x2: 262, y2: cy, class: 'v-edge' + (last && last.kind !== 'drop' && last.kind !== 'inNat' ? ' good' : '') }));
        ys.forEach(function (y, i) { svg.appendChild(pcBox(i, y, i === act && !dropMode)); });
        svg.appendChild(s('rect', { x: 140, y: 55, width: 74, height: 60, rx: 8, class: 'v-state cur' }));
        svg.appendChild(txt(177, 77, mode === 'napt' ? 'ルータ' : 'ルータ', 'v-node-label', 'middle', { style: 'font-size:11px' }));
        svg.appendChild(txt(177, 92, mode === 'napt' ? 'NAPT' : 'NAT', 'v-tick strong', 'middle'));
        svg.appendChild(txt(177, 106, mode === 'napt' ? '203.0.113.5' : '.5 / .6 / .7', 'v-tick', 'middle'));
        svg.appendChild(s('rect', { x: 262, y: 63, width: 74, height: 44, rx: 6, class: 'v-state' }));
        svg.appendChild(txt(299, 82, 'Web サーバ', 'v-node-label', 'middle', { style: 'font-size:11px' }));
        svg.appendChild(txt(299, 97, SRV, 'v-tick', 'middle'));
        svg.appendChild(txt(177, 30, 'グローバル側 →', 'v-tick', 'middle'));
        if (last && (last.kind === 'drop' || last.kind === 'inNat')) {
          var bad = last.kind === 'drop';
          svg.appendChild(s('line', { x1: 262, y1: cy + 30, x2: 218, y2: cy + 12, style: 'stroke:var(' + (bad ? '--danger' : '--warn') + ');stroke-width:2.4;stroke-dasharray:5 3' }));
          svg.appendChild(txt(240, cy + 48, bad ? '外部から ✕破棄' : '外部から → 到達', 'v-tick strong', 'middle', { style: 'fill:var(' + (bad ? '--danger' : '--warn') + ')' }));
        }
        // パケット表
        clear(pktBox);
        var rowsP = [];
        if (last && last.kind === 'req') {
          var c = last.c;
          rowsP.push(['送信元', PCS[c.pc].ip + ':' + c.sp, c.eip + ':' + c.ep, true]);
          rowsP.push(['宛先', SRV + ':80', SRV + ':80', false]);
        } else if (last && last.kind === 'reply') {
          var d = last.c;
          rowsP.push(['送信元', SRV + ':80', SRV + ':80', false]);
          rowsP.push(['宛先', d.eip + ':' + d.ep, PCS[d.pc].ip + ':' + d.sp, true]);
        } else if (last && last.kind === 'drop') {
          rowsP.push(['送信元', '198.51.100.99:4444', '(破棄)', false]);
          rowsP.push(['宛先', '203.0.113.5:60099', '表に無い → 破棄', true]);
        } else if (last && last.kind === 'inNat') {
          rowsP.push(['送信元', '198.51.100.99:4444', '198.51.100.99:4444', false]);
          rowsP.push(['宛先', last.c.eip + ':' + last.c.sp, PCS[0].ip + ':' + last.c.sp, true]);
        }
        if (rowsP.length) {
          pktBox.appendChild(wrapCells(h('table', { class: 'v-table' }, [
            h('thead', null, h('tr', null, [h('th', { text: '' }), h('th', { text: '変換前' }), h('th', { text: '変換後' })])),
            h('tbody', null, rowsP.map(function (r) {
              return h('tr', { class: r[3] ? 'hl' : '' }, [h('td', { text: r[0] }), h('td', { text: r[1] }), h('td', { text: r[2] })]);
            }))
          ])));
        } else {
          pktBox.appendChild(h('p', { class: 'v-muted', text: '操作するとここに書き換えの様子が出ます。' }));
        }
        // 変換表
        clear(tblBox);
        var tb = h('tbody');
        conns.forEach(function (c, idx) {
          var tr = h('tr', { class: idx === sel ? 'hl' : '', 'data-touch': '1', style: { cursor: 'pointer' } }, [
            h('td', { text: PCS[c.pc].ip + ':' + c.sp }),
            h('td', { text: c.eip + ':' + c.ep })
          ]);
          tr.addEventListener('click', function () { sel = idx; draw(); });
          tb.appendChild(tr);
        });
        tblBox.appendChild(wrapCells(h('table', { class: 'v-table' }, [
          h('thead', null, h('tr', null, [h('th', { text: '内部 IP:ポート' }), h('th', { text: '外部 IP:ポート' })])),
          tb
        ])));
        // 指標
        var used = {};
        conns.forEach(function (c) { used[c.eip] = true; });
        clear(metrics);
        metrics.appendChild(metric('使うグローバル IP', Object.keys(used).length + ' 個', mode === 'napt' ? 'good' : 'neg'));
        metrics.appendChild(metric('変換表の行数', String(conns.length), ''));
      }
      init();
    }
  });

  /* ------------------------------------------------------------------
   * 4. RIP と OSPF の経路選択
   * ------------------------------------------------------------------ */
  V.register('routing', {
    title: 'RIP と OSPF の経路選択',
    desc: 'ルータ A から E への経路を、RIP(ホップ数)と OSPF(帯域から決めるコスト)で比べます。リンクをタップすると断線でき、経路が切り替わる様子も確認できます。',
    mount: function (root) {
      var NODES = { A: [30, 100], B: [160, 35], C: [110, 166], D: [230, 166], E: [310, 100] };
      var EDGES = [
        { id: 'AB', a: 'A', b: 'B', bw: 10 }, { id: 'BE', a: 'B', b: 'E', bw: 10 },
        { id: 'AC', a: 'A', b: 'C', bw: 1000 }, { id: 'CD', a: 'C', b: 'D', bw: 1000 },
        { id: 'DE', a: 'D', b: 'E', bw: 1000 }, { id: 'CB', a: 'C', b: 'B', bw: 100 }
      ];
      EDGES.forEach(function (e) { e.cost = 1000 / e.bw; e.down = false; });
      var proto = 'rip';
      var seg = ui.segmented([{ value: 'rip', label: 'RIP(ホップ数)' }, { value: 'ospf', label: 'OSPF(コスト)' }], proto, function (v) { proto = v; draw(); });
      var svg = s('svg', { class: 'v-svg', viewBox: '0 0 340 198', role: 'img', 'aria-label': 'ルータ A から E の経路' });
      var verdict = h('div', { class: 'v-verdict' });
      var metrics = h('div', { class: 'v-metrics' });
      var btns = EDGES.map(function (e) { return ui.button('', function () { toggle(e); }); });
      var resetB = ui.button('全リンク復旧', function () { EDGES.forEach(function (e) { e.down = false; }); draw(); });
      root.appendChild(seg.el);
      root.appendChild(svg);
      root.appendChild(h('p', { class: 'v-caption', text: '図のリンク(または下のボタン)をタップすると断線/復旧します。' }));
      root.appendChild(h('div', { class: 'v-row' }, btns.concat([resetB])));
      root.appendChild(metrics);
      root.appendChild(verdict);

      function toggle(e) { e.down = !e.down; draw(); }
      function bwText(bw) { return bw >= 1000 ? (bw / 1000) + 'G' : bw + 'M'; }
      function weight(e, p) { return p === 'rip' ? 1 : e.cost; }

      function dijkstra(p) {
        var names = Object.keys(NODES), dist = {}, prev = {}, done = {};
        names.forEach(function (n) { dist[n] = Infinity; });
        dist.A = 0;
        for (var it = 0; it < names.length; it++) {
          var u = null;
          names.forEach(function (n) { if (!done[n] && dist[n] < Infinity && (u === null || dist[n] < dist[u])) u = n; });
          if (u === null) break;
          done[u] = true;
          EDGES.forEach(function (e) {
            if (e.down) return;
            var v = e.a === u ? e.b : (e.b === u ? e.a : null);
            if (!v) return;
            var nd = dist[u] + weight(e, p);
            if (nd < dist[v]) { dist[v] = nd; prev[v] = { n: u, e: e }; }
          });
        }
        if (dist.E === Infinity) return null;
        var path = ['E'], es = [], cur = 'E';
        while (cur !== 'A') { es.push(prev[cur].e); cur = prev[cur].n; path.unshift(cur); }
        var minBw = Infinity;
        es.forEach(function (e) { if (e.bw < minBw) minBw = e.bw; });
        return { path: path, edges: es, cost: dist.E, hops: es.length, minBw: minBw };
      }

      function draw() {
        var res = dijkstra(proto), other = dijkstra(proto === 'rip' ? 'ospf' : 'rip');
        var ripR = proto === 'rip' ? res : other, ospfR = proto === 'rip' ? other : res;
        var onPath = {};
        if (res) res.edges.forEach(function (e) { onPath[e.id] = true; });
        clear(svg);
        EDGES.forEach(function (e) {
          var p1 = NODES[e.a], p2 = NODES[e.b];
          var cls = 'v-edge' + (e.down ? ' bad' : (onPath[e.id] ? ' good' : ''));
          var g = s('g', { 'data-touch': '1', style: 'cursor:pointer' });
          g.appendChild(s('line', { x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1], class: cls, style: e.down ? '' : (onPath[e.id] ? 'stroke-width:4' : '') }));
          g.appendChild(s('line', { x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1], style: 'stroke:transparent;stroke-width:22' }));
          var mx = (p1[0] + p2[0]) / 2, my = (p1[1] + p2[1]) / 2;
          var label = e.down ? '断' : (weight(e, proto) + ' (' + bwText(e.bw) + ')');
          g.appendChild(s('rect', { x: mx - 29, y: my - 8, width: 58, height: 16, rx: 4, style: 'fill:var(--surface);stroke:var(--text-muted);stroke-width:1' }));
          g.appendChild(txt(mx, my + 4, label, 'v-tick strong', 'middle', e.down ? { style: 'fill:var(--danger)' } : null));
          g.addEventListener('click', function () { toggle(e); });
          svg.appendChild(g);
        });
        var onNode = {};
        if (res) res.path.forEach(function (n) { onNode[n] = true; });
        Object.keys(NODES).forEach(function (n) {
          var p = NODES[n];
          svg.appendChild(s('circle', { cx: p[0], cy: p[1], r: 15, class: 'v-state' + (onNode[n] ? ' cur' : '') }));
          svg.appendChild(txt(p[0], p[1] + 5, n, 'v-node-label', 'middle'));
        });
        svg.appendChild(txt(4, 14, 'ラベル = ' + (proto === 'rip' ? 'ホップ数 (帯域)' : 'コスト (帯域)'), 'v-tick'));

        EDGES.forEach(function (e, i) {
          btns[i].textContent = e.a + '–' + e.b + (e.down ? ' 復旧' : ' 断線');
          btns[i].className = 'v-btn' + (e.down ? ' primary' : '');
        });

        clear(metrics);
        if (res) {
          metrics.appendChild(metric(proto === 'rip' ? 'ホップ数' : 'コスト合計', String(res.cost), ''));
          metrics.appendChild(metric('経路', res.path.join(' → '), ''));
          metrics.appendChild(metric('最小帯域', bwText(res.minBw) + 'bps', res.minBw >= 1000 ? 'good' : 'neg'));
        } else {
          metrics.appendChild(metric('経路', 'なし', 'neg'));
        }

        var txtOut;
        if (!res) {
          setVerdict(verdict, 'ng', 'A から E への経路がありません(経路なし)。リンクが断線して到達不能になりました。「全リンク復旧」で戻せます。');
          return;
        }
        var ripTxt = ripR ? ripR.path.join('→') + '(' + ripR.hops + 'ホップ、最小帯域 ' + bwText(ripR.minBw) + 'bps)' : '経路なし';
        var ospfTxt = ospfR ? ospfR.path.join('→') + '(コスト ' + ospfR.cost + '、最小帯域 ' + bwText(ospfR.minBw) + 'bps)' : '経路なし';
        var same = ripR && ospfR && ripR.path.join() === ospfR.path.join();
        if (proto === 'rip') {
          txtOut = 'RIP はホップ数だけで選ぶため ' + ripTxt + ' を使います。' + (same ? 'この状況では OSPF と同じ経路です。' : '帯域は考慮しないので、遅い回線を通ることがあります。OSPF なら ' + ospfTxt + ' です。') + 'RIP の最大ホップ数は 15 で、16 は到達不能を表します。';
          setVerdict(verdict, same || res.minBw >= 1000 ? 'ok' : 'warn', txtOut);
        } else {
          txtOut = 'OSPF は リンクコスト = 10^9 ÷ 帯域(bps) の合計が最小の経路を選び、' + ospfTxt + ' を使います(1Gbps→1、100Mbps→10、10Mbps→100)。' + (same ? 'この状況では RIP と同じ経路です。' : 'RIP なら ' + ripTxt + ' で、遅い回線を通ってしまいます。');
          setVerdict(verdict, 'ok', txtOut);
        }
      }
      draw();
    }
  });

  /* ------------------------------------------------------------------
   * 5. ARP スプーフィング
   * ------------------------------------------------------------------ */
  V.register('arp', {
    title: 'ARP スプーフィング(中間者攻撃)',
    desc: 'ARP は「この IP アドレスの MAC は?」を LAN 内で問い合わせる仕組みですが、認証がありません。偽の応答で PC-A の ARP テーブルを書き換え、通信が攻撃者を経由するようになる様子と、対策の効果を確かめましょう。',
    mount: function (root) {
      var GW_IP = '10.0.0.1', GG = 'GG:GG', EE = 'EE:EE';
      var table = GG, defense = 'none', ev = 'send';
      var seg = ui.segmented([{ value: 'none', label: '対策なし' }, { value: 'dai', label: 'DAI(スイッチ)' }, { value: 'static', label: '静的 ARP' }], defense, function (v) {
        defense = v;
        if (v === 'static') {
          table = GG; ev = 'send';
          setVerdict(verdict, 'ok', '静的 ARP エントリ:管理者が 10.0.0.1 → GG:GG を固定登録しました。以後、偽の ARP 応答が来ても上書きされません。ただし端末が多いと管理が大変です。');
        } else if (v === 'dai') {
          setVerdict(verdict, '', 'DAI(Dynamic ARP Inspection):スイッチが ARP パケットを検査し、DHCP スヌーピングの対応表(IP と MAC と接続ポート)に合わない ARP を破棄します。偽の応答を送ってみましょう。');
        } else {
          setVerdict(verdict, '', '対策なし:ARP は後から届いた応答でテーブルを更新するため、偽の応答も受け入れてしまいます。');
        }
        draw();
      });
      var svg = s('svg', { class: 'v-svg', viewBox: '0 0 340 212', role: 'img', 'aria-label': 'ARP スプーフィングの構成図' });
      var verdict = h('div', { class: 'v-verdict' });
      var tblBox = h('div', { class: 'v-scroll' });
      var reqB = ui.button('PC-A が ARP 要求(10.0.0.1 の MAC は?)', function () { doReq(); });
      var forgeB = ui.button('攻撃者が偽の ARP 応答を送る', function () { doForge(); }, 'primary');
      var sendB = ui.button('PC-A がインターネットへ送信', function () { doSend(); });
      var resetB = ui.button('最初の状態に戻す', function () { table = GG; defense = 'none'; seg.set('none'); ev = 'send'; setVerdict(verdict, '', '正常な状態に戻しました。'); draw(); });
      root.appendChild(seg.el);
      root.appendChild(svg);
      root.appendChild(verdict);
      root.appendChild(h('div', { class: 'v-row' }, [reqB, forgeB, sendB, resetB]));
      root.appendChild(h('div', { class: 'v-label', text: 'PC-A の ARP テーブル' }));
      root.appendChild(tblBox);

      function doReq() {
        table = GG; ev = 'req';
        setVerdict(verdict, 'ok', 'PC-A が「10.0.0.1 の MAC アドレスは?」とブロードキャストし、ゲートウェイが正しく応答しました。ARP テーブルは 10.0.0.1 → GG:GG になります。');
        draw();
      }
      function doForge() {
        if (defense === 'dai') {
          ev = 'blocked';
          setVerdict(verdict, 'ok', 'スイッチの DAI が、攻撃者のポートから来た「10.0.0.1 は EE:EE」という ARP 応答を、DHCP スヌーピングの対応表と照合して破棄しました。PC-A のテーブルは書き換わりません。');
        } else if (defense === 'static') {
          ev = 'ignored';
          setVerdict(verdict, 'ok', '偽の ARP 応答は届きましたが、10.0.0.1 は静的エントリで固定されているため無視されました。テーブルは GG:GG のままです。');
        } else {
          table = EE; ev = 'forge';
          setVerdict(verdict, 'ng', '攻撃者が「10.0.0.1 の MAC は EE:EE」という偽の ARP 応答を送り、PC-A はそのまま受け入れてテーブルを上書きしました。ARP には認証がないため、要求していない応答でも信じてしまいます(ARP キャッシュポイズニング)。');
        }
        draw();
      }
      function doSend() {
        ev = 'send';
        if (table === EE) {
          setVerdict(verdict, 'ng', 'PC-A はゲートウェイ宛のフレームを MAC=EE:EE に送るため、通信が攻撃者を経由します(中間者攻撃)。攻撃者は盗聴・改ざんができ、転送すれば PC-A は気づきにくい。対策は DAI・静的 ARP エントリ、そして TLS などで通信自体を暗号化しておくこと(盗聴されても読めない)です。');
        } else {
          setVerdict(verdict, 'ok', 'PC-A はゲートウェイ宛のフレームを MAC=GG:GG に送り、通信はまっすぐゲートウェイへ向かいます。IP パケットの宛先はインターネット側ですが、同一 LAN 内ではまずデフォルトゲートウェイの MAC を宛先にします。');
        }
        draw();
      }

      function node(x, y, w, hh, name, ip, mac, cls) {
        var g = s('g');
        g.appendChild(s('rect', { x: x, y: y, width: w, height: hh, rx: 7, class: 'v-state' + (cls ? ' ' + cls : ''), style: cls === 'bad' ? 'stroke:var(--danger);fill:var(--danger-soft);stroke-width:2.4' : '' }));
        g.appendChild(txt(x + w / 2, y + 17, name, 'v-node-label', 'middle', { style: 'font-size:11px' }));
        if (ip) g.appendChild(txt(x + w / 2, y + 32, ip, 'v-tick', 'middle'));
        if (mac) g.appendChild(txt(x + w / 2, y + 46, mac, 'v-tick', 'middle'));
        return g;
      }
      function poly(pts, color, dashed, width) {
        return s('polyline', { points: pts, fill: 'none', style: 'stroke:var(' + color + ');stroke-width:' + (width || 3) + ';' + (dashed ? 'stroke-dasharray:6 4' : '') });
      }

      function draw() {
        clear(svg);
        // リンク
        svg.appendChild(s('line', { x1: 90, y1: 56, x2: 125, y2: 56, class: 'v-edge' }));
        svg.appendChild(s('line', { x1: 215, y1: 56, x2: 250, y2: 56, class: 'v-edge' }));
        svg.appendChild(s('line', { x1: 170, y1: 78, x2: 170, y2: 130, class: 'v-edge' }));
        // 経路・メッセージ
        var cap = '', capColor = '--text-muted';
        if (ev === 'send' && table === GG) {
          svg.appendChild(poly('90,50 250,50', '--success', false, 3.5));
          cap = '通信:PC-A → ゲートウェイ(正常)'; capColor = '--success';
        } else if (ev === 'send') {
          svg.appendChild(poly('90,50 150,50 150,130', '--danger', false, 3.5));
          svg.appendChild(poly('190,130 190,62 250,62', '--danger', false, 3.5));
          cap = '通信:PC-A → 攻撃者 → ゲートウェイ(中間者)'; capColor = '--danger';
        } else if (ev === 'req') {
          svg.appendChild(poly('250,64 90,64', '--success', true, 2.5));
          cap = 'ARP 応答:10.0.0.1 は GG:GG(正当)'; capColor = '--success';
        } else if (ev === 'forge') {
          svg.appendChild(poly('170,130 170,64 90,64', '--danger', true, 2.5));
          cap = '偽の ARP 応答:10.0.0.1 は EE:EE'; capColor = '--danger';
        } else if (ev === 'blocked') {
          svg.appendChild(poly('170,130 170,86', '--danger', true, 2.5));
          svg.appendChild(txt(170, 108, '✕', 'v-node-label', 'middle', { style: 'fill:var(--danger);font-size:20px' }));
          cap = '偽の ARP 応答を DAI が破棄'; capColor = '--success';
        } else if (ev === 'ignored') {
          svg.appendChild(poly('170,130 170,64 90,64', '--danger', true, 1.5));
          cap = '偽の応答は届くが、静的エントリのため無視'; capColor = '--success';
        }
        svg.appendChild(txt(170, 204, cap, 'v-tick strong', 'middle', { style: 'fill:var(' + capColor + ')' }));
        svg.appendChild(node(4, 30, 86, 52, 'PC-A', '10.0.0.2', 'AA:AA'));
        svg.appendChild(node(125, 34, 90, 44, 'スイッチ', defense === 'dai' ? 'DAI 有効' : '', null, defense === 'dai' ? 'cur' : ''));
        svg.appendChild(node(250, 30, 86, 52, 'ゲートウェイ', GW_IP, GG));
        svg.appendChild(node(125, 130, 90, 56, '攻撃者', '10.0.0.66', EE, table === EE ? 'bad' : ''));
        // 表
        clear(tblBox);
        var bad = table === EE;
        tblBox.appendChild(h('table', { class: 'v-table' }, [
          h('thead', null, h('tr', null, [h('th', { text: 'IP アドレス' }), h('th', { text: 'MAC アドレス' }), h('th', { text: '備考' })])),
          h('tbody', null, h('tr', { class: bad ? 'crit' : 'hl' }, [
            h('td', { text: GW_IP }),
            h('td', { text: table }),
            h('td', { text: bad ? '偽(攻撃者の MAC)' : (defense === 'static' ? '静的に固定' : '正当(ゲートウェイ)') })
          ]))
        ]));
      }
      setVerdict(verdict, '', 'PC-A の ARP テーブルは正しく 10.0.0.1 → GG:GG になっています。「偽の ARP 応答」を送ると何が起きるでしょう。');
      draw();
    }
  });
})(window);
