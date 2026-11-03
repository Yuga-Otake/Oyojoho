/**
 * drill-gen.js - 計算ドリルの問題ジェネレータ
 *
 * 各型は gen() で毎回数値の違う問題を作る。返す値:
 *   q       問題文
 *   answer  正解(数値)
 *   unit    単位(表示用)
 *   tol     許容誤差(省略時は answer の 0.5% か、prec 桁で四捨五入した差)
 *   prec    解答の小数点以下の桁数の目安(問題文に明記する)
 *   steps   解き方の手順
 *   traps   [{v, msg}] よくある誤答の値と、その誤りの指摘
 * exams: この型を出題する試験 / field・topic: 教科書の節への対応づけ
 */
(function (global) {
  'use strict';

  function ri(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function r(v, d) { var p = Math.pow(10, d || 0); return Math.round(v * p) / p; }
  function n(v) { return Number(v).toLocaleString('ja-JP', { maximumFractionDigits: 6 }); }

  var TYPES = [
    /* ---------------- 基礎理論 ---------------- */
    {
      id: 'hex', title: '16進数 → 10進数', exams: ['ap', 'sc'], field: '基礎理論', topic: '数値表現', level: 1,
      gen: function () {
        var v = ri(26, 4095), hex = v.toString(16).toUpperCase();
        var digits = hex.split('').map(function (c) { return parseInt(c, 16); });
        var asDec = Number(hex.replace(/[A-F]/g, function (c) { return parseInt(c, 16); }));
        return {
          q: '16進数 ' + hex + ' を10進数で表せ。', answer: v, unit: '',
          steps: digits.map(function (d, i) { return hex[i] + ' = ' + d + ' × 16^' + (digits.length - 1 - i) + ' = ' + d * Math.pow(16, digits.length - 1 - i); }).concat(['合計 ' + v]),
          traps: [{ v: asDec, msg: '各桁を10進の数字としてそのまま並べています。各桁には16の累乗の重みを掛けます。' },
            { v: digits.reduce(function (a, b) { return a + b; }, 0), msg: '各桁を足しただけです。桁の重み(16^k)を掛けてください。' }]
        };
      }
    },
    {
      id: 'twos', title: '8ビット2の補数の値', exams: ['ap'], field: '基礎理論', topic: '数値表現', level: 1,
      gen: function () {
        var v = ri(-128, -1), u = v + 256, bits = u.toString(2).padStart(8, '0');
        var mag = (~u & 255) + 1;
        return {
          q: '8ビットの2の補数表現で ' + bits.slice(0, 4) + ' ' + bits.slice(4) + ' が表す10進数を答えよ。', answer: v, unit: '',
          steps: ['最上位ビットが1なので負の数', 'ビット反転 → ' + (~u & 255).toString(2).padStart(8, '0') + '、+1 → ' + mag, 'よって −' + mag],
          traps: [{ v: u, msg: '符号なし整数として読んでいます。最上位ビットが1なら負の数です。' },
            { v: -(~u & 255), msg: '反転しただけ(1の補数)です。反転してから1を足します。' },
            { v: -(u - 128), msg: '符号+絶対値表現として読んでいます。2の補数では「反転して+1」で絶対値を求めます。' }]
        };
      }
    },
    {
      id: 'mm1', title: '待ち行列 M/M/1', exams: ['ap'], field: '基礎理論', topic: '待ち行列理論', level: 2,
      gen: function () {
        var ts = pick([0.2, 0.4, 0.5, 0.8, 1, 2]), rho = pick([0.5, 0.6, 0.75, 0.8, 0.9]);
        var lam = r(rho / ts, 4);
        var askResp = Math.random() < 0.5;
        var tw = rho / (1 - rho) * ts, tq = tw + ts;
        var given = Math.random() < 0.5;
        var q = (given
          ? '1件あたりの平均処理時間が ' + ts + ' 秒、平均到着率が毎秒 ' + n(lam) + ' 件の M/M/1 モデルがある。'
          : '利用率が ' + rho + '、平均サービス時間が ' + ts + ' 秒の M/M/1 モデルがある。') +
          (askResp ? '平均応答時間(待ち時間+サービス時間)' : '平均待ち時間') + 'は何秒か。小数第2位まで。';
        var ans = askResp ? tq : tw;
        return {
          q: q, answer: r(ans, 2), unit: '秒', prec: 2,
          steps: (given ? ['利用率 ρ = λ × Ts = ' + n(lam) + ' × ' + ts + ' = ' + rho] : []).concat([
            '平均待ち時間 = ρ / (1 − ρ) × Ts = ' + rho + ' / ' + r(1 - rho, 2) + ' × ' + ts + ' = ' + r(tw, 3)]).concat(askResp ? ['応答時間 = 待ち時間 + Ts = ' + r(tq, 3)] : []),
          traps: [{ v: r(askResp ? tw : tq, 2), msg: askResp ? 'それは待ち時間です。応答時間はサービス時間 Ts も足します。' : 'それは応答時間です。待ち時間には Ts を足しません。' },
            { v: r(rho * ts, 2), msg: 'ρ × Ts になっています。待ち時間は ρ / (1 − ρ) × Ts です。' },
            { v: r(rho / (1 - rho), 2), msg: 'ρ / (1 − ρ) で止まっています。Ts を掛けてください。' }]
        };
      }
    },
    {
      id: 'adc', title: 'A/D 変換の分解能', exams: ['ap'], field: 'ハードウェア', topic: 'A/D変換', level: 1,
      gen: function () {
        var v = pick([3.3, 5, 10]), bits = pick([8, 10, 12]);
        var ans = v * 1000 / Math.pow(2, bits);
        return {
          q: '0〜' + v + 'V のアナログ信号を ' + bits + ' ビットの A/D 変換器で量子化する。1ステップあたりの電圧は何 mV か。小数第2位まで。',
          answer: r(ans, 2), unit: 'mV', prec: 2,
          steps: ['段階数 = 2^' + bits + ' = ' + Math.pow(2, bits), v + 'V = ' + v * 1000 + 'mV', v * 1000 + ' ÷ ' + Math.pow(2, bits) + ' = ' + r(ans, 3) + ' mV'],
          traps: [{ v: r(v * 1000 / bits, 2), msg: 'ビット数で割っています。段階数は 2^ビット数 です。' },
            { v: r(v / Math.pow(2, bits), 4), msg: 'V のままです。mV に直すため1000倍してください。' }]
        };
      }
    },
    /* ---------------- アルゴリズム ---------------- */
    {
      id: 'binsearch', title: '2分探索の最大比較回数', exams: ['ap'], field: 'アルゴリズムとプログラミング', topic: '探索', level: 1,
      gen: function () {
        var N = pick([100, 500, 1000, 4000, 10000, 65000, 100000, 1000000]);
        var ans = Math.floor(Math.log2(N)) + 1;
        return {
          q: '要素数 ' + N.toLocaleString() + ' の整列済み配列を2分探索するとき、最大比較回数は何回か。', answer: ans, unit: '回', tol: 0,
          steps: ['2^' + (ans - 1) + ' = ' + Math.pow(2, ans - 1).toLocaleString() + ' ≦ ' + N.toLocaleString() + ' < 2^' + ans, '最大比較回数 = ⌊log₂N⌋ + 1 = ' + ans],
          traps: [{ v: Math.ceil(N / 2), msg: 'それは線形探索の平均比較回数です。2分探索は範囲を半分ずつ絞ります。' },
            { v: N, msg: 'それは線形探索の最大比較回数です。' }]
        };
      }
    },
    /* ---------------- コンピュータ構成要素 ---------------- */
    {
      id: 'eat', title: 'キャッシュの実効アクセス時間', exams: ['ap'], field: 'コンピュータ構成要素', topic: 'キャッシュ', level: 1,
      gen: function () {
        var h = pick([0.8, 0.85, 0.9, 0.95, 0.98]), tc = pick([5, 10, 15, 20]), tm = pick([50, 60, 80, 100, 120]);
        var ans = h * tc + (1 - h) * tm;
        return {
          q: 'キャッシュのアクセス時間 ' + tc + 'ns、主記憶のアクセス時間 ' + tm + 'ns、ヒット率 ' + r(h * 100) + '% のとき、実効アクセス時間は何 ns か(小数第1位まで)。',
          answer: r(ans, 1), unit: 'ns', prec: 1,
          steps: ['ヒット分 ' + h + ' × ' + tc + ' = ' + r(h * tc, 2), 'ミス分 ' + r(1 - h, 2) + ' × ' + tm + ' = ' + r((1 - h) * tm, 2), '合計 ' + r(ans, 2) + ' ns'],
          traps: [{ v: r((1 - h) * tc + h * tm, 1), msg: 'ヒット率とミス率が逆です。キャッシュの時間にヒット率を掛けます。' },
            { v: r(h * tc + (1 - h) * (tc + tm), 1), msg: 'ミス時にキャッシュの時間も足す方式で計算しています。この問題では主記憶の時間だけを使います(問題文の前提を確認)。' }]
        };
      }
    },
    {
      id: 'mips', title: 'MIPS の計算', exams: ['ap'], field: 'コンピュータ構成要素', topic: 'プロセッサ', level: 1,
      gen: function () {
        var g = pick([1, 1.5, 2, 2.4, 3, 3.2, 4]), cpi = pick([2, 4, 5, 8]);
        var ans = g * 1000 / cpi;
        return {
          q: 'クロック周波数 ' + g + 'GHz、平均 CPI が ' + cpi + ' のプロセッサの性能は何 MIPS か。', answer: r(ans, 1), unit: 'MIPS', prec: 1,
          steps: [g + 'GHz = ' + g * 1000 + ' × 10^6 Hz', '1秒間の命令数 = ' + g * 1000 + ' × 10^6 ÷ ' + cpi + ' = ' + r(ans, 2) + ' × 10^6', 'よって ' + r(ans, 2) + ' MIPS'],
          traps: [{ v: r(g * 1000 * cpi, 1), msg: 'CPI を掛けています。CPI は1命令あたりのクロック数なので割ります。' },
            { v: r(g / cpi, 3), msg: 'GHz のまま割っています。GHz = 1000 MHz なので MIPS にするには1000倍します。' }]
        };
      }
    },
    {
      id: 'pipeline', title: 'パイプラインの実行時間', exams: ['ap'], field: 'コンピュータ構成要素', topic: 'パイプライン', level: 1,
      gen: function () {
        var k = ri(4, 6), nn = pick([10, 20, 50, 100, 200]), t = pick([2, 5, 10, 20]);
        var ans = (k + nn - 1) * t;
        return {
          q: k + '段のパイプラインで、1段の処理時間が ' + t + 'ns のとき、' + nn + '個の命令をすべて実行するのに要する時間は何 ns か。分岐などによる乱れはないものとする。',
          answer: ans, unit: 'ns', tol: 0,
          steps: ['最初の命令が終わるまで ' + k + ' × ' + t + ' = ' + k * t + 'ns', '残り ' + (nn - 1) + ' 命令は1段ごとに1つずつ完了: ' + (nn - 1) + ' × ' + t, '(' + k + ' + ' + nn + ' − 1) × ' + t + ' = ' + ans + 'ns'],
          traps: [{ v: k * nn * t, msg: '命令を重ねずに計算しています。パイプラインは1段ずつずらして並行に処理します。' },
            { v: (k + nn) * t, msg: '−1 を忘れています。最初の命令の k 段のうち1段目は2番目以降と重なります。' },
            { v: nn * t, msg: '最初の命令が完了するまでの (k − 1) 段分が抜けています。' }]
        };
      }
    },
    /* ---------------- システム構成要素 ---------------- */
    {
      id: 'avail', title: '稼働率(直列と並列の組合せ)', exams: ['ap', 'sc'], field: 'システム構成要素', topic: '信頼性計算', level: 2,
      gen: function () {
        var a = pick([0.9, 0.95, 0.98, 0.99]), b = pick([0.8, 0.9, 0.95]);
        var shape = pick(['A-(B||B)', '(A-A)||(A-A)', 'A-A']);
        var ans, steps, traps;
        if (shape === 'A-(B||B)') {
          var par = 1 - (1 - b) * (1 - b);
          ans = a * par;
          steps = ['B 2台の並列: 1 − (1 − ' + b + ')² = ' + r(par, 4), 'A と直列: ' + a + ' × ' + r(par, 4) + ' = ' + r(ans, 4)];
          traps = [{ v: r(a * b * b, 4), msg: '並列部分を直列として掛けています。並列は 1 − (1 − A)(1 − B) です。' },
            { v: r(1 - (1 - a) * (1 - b) * (1 - b), 4), msg: '全体を並列として計算しています。A は直列につながっています。' }];
          return { q: '稼働率 ' + a + ' の装置 A と、稼働率 ' + b + ' の装置 B を2台並列にしたものを直列に接続したシステムの稼働率を、小数第4位まで求めよ。', answer: r(ans, 4), unit: '', prec: 4, steps: steps, traps: traps };
        }
        if (shape === '(A-A)||(A-A)') {
          var s2 = a * a;
          ans = 1 - (1 - s2) * (1 - s2);
          return {
            q: '稼働率 ' + a + ' の装置を2台直列にした系統を、2系統並列にしたシステムの稼働率を、小数第4位まで求めよ。', answer: r(ans, 4), unit: '', prec: 4,
            steps: ['1系統(直列2台): ' + a + '² = ' + r(s2, 4), '2系統の並列: 1 − (1 − ' + r(s2, 4) + ')² = ' + r(ans, 4)],
            traps: [{ v: r(1 - Math.pow(1 - a, 4), 4), msg: '4台すべてを並列として計算しています。各系統の中は直列です。' },
              { v: r(Math.pow(1 - (1 - a) * (1 - a), 2), 4), msg: '「並列2台を2組、直列に」と逆の構成で計算しています。' }]
          };
        }
        ans = a * a;
        return {
          q: '稼働率 ' + a + ' の装置を2台直列に接続したシステムの稼働率を、小数第4位まで求めよ。', answer: r(ans, 4), unit: '', prec: 4,
          steps: ['直列は掛け算: ' + a + ' × ' + a + ' = ' + r(ans, 4)],
          traps: [{ v: r(1 - (1 - a) * (1 - a), 4), msg: '並列の式で計算しています。直列は全部動いて初めて動くので掛け算です。' }]
        };
      }
    },
    {
      id: 'mtbf', title: 'MTBF・MTTR と稼働率', exams: ['ap'], field: 'システム構成要素', topic: 'MTBF・MTTR', level: 1,
      gen: function () {
        var mttr = pick([2, 4, 5, 10, 20]), mtbf = pick([95, 190, 245, 380, 495, 990]);
        var ans = mtbf / (mtbf + mttr);
        return {
          q: 'MTBF が ' + mtbf + ' 時間、MTTR が ' + mttr + ' 時間のシステムの稼働率を、小数第3位まで求めよ。', answer: r(ans, 3), unit: '', prec: 3,
          steps: ['稼働率 = MTBF / (MTBF + MTTR)', mtbf + ' / (' + mtbf + ' + ' + mttr + ') = ' + r(ans, 4)],
          traps: [{ v: r(mttr / (mtbf + mttr), 3), msg: 'それは停止している割合(不稼働率)です。分子は MTBF です。' },
            { v: r(mtbf / mttr, 3), msg: '分母が MTTR だけになっています。分母は MTBF + MTTR です。' }]
        };
      }
    },
    /* ---------------- ソフトウェア ---------------- */
    {
      id: 'paging', title: 'ページフォールトの回数', exams: ['ap'], field: 'ソフトウェア', topic: '仮想記憶', level: 2,
      gen: function () {
        var refs = [], i;
        for (i = 0; i < 10; i++) refs.push(ri(1, 5));
        var frames = 3, algo = pick(['FIFO', 'LRU']);
        function sim(a) {
          var mem = [], loaded = {}, last = {}, f = 0;
          refs.forEach(function (p, t) {
            if (mem.indexOf(p) < 0) {
              f++;
              if (mem.length >= frames) {
                var victim = mem.slice().sort(function (x, y) { return a === 'FIFO' ? loaded[x] - loaded[y] : last[x] - last[y]; })[0];
                mem[mem.indexOf(victim)] = p;
              } else mem.push(p);
              loaded[p] = t;
            }
            last[p] = t;
          });
          return f;
        }
        var ans = sim(algo), other = sim(algo === 'FIFO' ? 'LRU' : 'FIFO');
        var traps = [];
        if (other !== ans) traps.push({ v: other, msg: (algo === 'FIFO' ? 'LRU' : 'FIFO') + ' の回数になっています。' + (algo === 'FIFO' ? 'FIFO は「読み込んだ順」が最も古いものを追い出します。' : 'LRU は「最後に参照された時刻」が最も古いものを追い出します。') });
        var distinct = refs.filter(function (v, k) { return refs.indexOf(v) === k; }).length;
        if (distinct !== ans) traps.push({ v: distinct, msg: '最初の読込みだけを数えています。追い出したページを再び参照するとまたフォールトになります。' });
        return {
          q: 'ページ参照列 ' + refs.join(', ') + ' を、ページ枠 ' + frames + ' つ(初期状態は空)で ' + algo + ' 方式により処理したときのページフォールトの回数は何回か。',
          answer: ans, unit: '回', tol: 0,
          steps: ['空き枠への最初の読込みもフォールトに数える', algo === 'FIFO' ? '枠が埋まったら、最も古く読み込んだページを追い出す' : '枠が埋まったら、最も長く参照されていないページを追い出す', '順にたどると ' + ans + ' 回(教科書の「ページ置換え」の体感ビジュアルに参照列を入れると表で確認できます)'],
          traps: traps
        };
      }
    },
    /* ---------------- マルチメディア ---------------- */
    {
      id: 'image', title: '画像・音声のデータ量', exams: ['ap'], field: 'マルチメディア', topic: '画像データ量', level: 1,
      gen: function () {
        if (Math.random() < 0.5) {
          var wh = pick([[640, 480], [800, 600], [1024, 768], [1280, 720], [1920, 1080]]), bits = pick([8, 16, 24]);
          var bytes = wh[0] * wh[1] * bits / 8, ans = bytes / 1e6;
          return {
            q: wh[0] + '×' + wh[1] + ' 画素、1画素あたり ' + bits + ' ビットの非圧縮画像1枚のデータ量は何 Mバイトか(1Mバイト = 10^6 バイト、小数第2位まで)。',
            answer: r(ans, 2), unit: 'Mバイト', prec: 2,
            steps: ['画素数 ' + wh[0] + ' × ' + wh[1] + ' = ' + (wh[0] * wh[1]).toLocaleString(), '× ' + bits + ' ビット ÷ 8 = ' + bytes.toLocaleString() + ' バイト', '≒ ' + r(ans, 3) + ' Mバイト'],
            traps: [{ v: r(ans * 8, 2), msg: 'ビットのままです。8で割ってバイトにします。' }]
          };
        }
        var fs = pick([8, 16, 44.1, 48]), qb = pick([8, 16]), ch = pick([1, 2]), sec = pick([10, 30, 60]);
        var kb = fs * 1000 * qb * ch * sec / 8 / 1000;
        return {
          q: '標本化周波数 ' + fs + 'kHz、量子化ビット数 ' + qb + 'ビット、' + (ch === 2 ? 'ステレオ(2チャネル)' : 'モノラル') + 'で ' + sec + ' 秒間録音した PCM 音声のデータ量は何 kバイトか(1kバイト = 1000 バイト)。',
          answer: r(kb, 1), unit: 'kバイト', prec: 1,
          steps: [fs + '×1000 × ' + qb + ' × ' + ch + ' × ' + sec + ' = ' + (fs * 1000 * qb * ch * sec).toLocaleString() + ' ビット', '÷ 8 ÷ 1000 = ' + r(kb, 2) + ' kバイト'],
          traps: [{ v: r(kb * 8, 1), msg: 'ビットのままです。8で割ってバイトにします。' }].concat(ch === 2 ? [{ v: r(kb / 2, 1), msg: 'チャネル数(ステレオ = 2)を掛け忘れています。' }] : [])
        };
      }
    },
    /* ---------------- ネットワーク ---------------- */
    {
      id: 'hosts', title: 'サブネットのホスト数', exams: ['ap', 'sc'], field: 'ネットワーク', topic: 'IPアドレス', level: 1,
      gen: function () {
        var pre = ri(20, 29), h = 32 - pre, ans = Math.pow(2, h) - 2;
        return {
          q: 'IPv4 のネットワーク 10.' + ri(0, 200) + '.0.0/' + pre + ' において、ホストに割り当てられるアドレスの最大数はいくつか。', answer: ans, unit: '個', tol: 0,
          steps: ['ホスト部 = 32 − ' + pre + ' = ' + h + ' ビット', '2^' + h + ' = ' + Math.pow(2, h), 'ネットワークアドレスとブロードキャストアドレスを除いて ' + ans],
          traps: [{ v: Math.pow(2, h), msg: '−2 を忘れています。ホスト部が全0(ネットワーク)と全1(ブロードキャスト)は割り当てられません。' },
            { v: Math.pow(2, pre) - 2, msg: 'ネットワーク部のビット数で計算しています。ホスト部は 32 − プレフィックス長 です。' }]
        };
      }
    },
    {
      id: 'prefix', title: '必要ホスト数からプレフィックス長', exams: ['ap', 'sc'], field: 'ネットワーク', topic: 'サブネット', level: 2,
      gen: function () {
        var need = pick([25, 30, 50, 60, 62, 100, 120, 126, 200, 250, 500, 1000]);
        var h = 1;
        while (Math.pow(2, h) - 2 < need) h++;
        var ans = 32 - h;
        var h2 = 1;
        while (Math.pow(2, h2) < need) h2++;
        return {
          q: 'ホストを ' + need + ' 台接続するサブネットを設計する。アドレスの無駄が最も少なくなるプレフィックス長(/n の n)はいくつか。', answer: ans, unit: '', tol: 0,
          steps: ['2^h − 2 ≧ ' + need + ' を満たす最小の h を探す', '2^' + h + ' − 2 = ' + (Math.pow(2, h) - 2) + ' ≧ ' + need + (h > 1 ? '(2^' + (h - 1) + ' − 2 = ' + (Math.pow(2, h - 1) - 2) + ' では足りない)' : ''), 'プレフィックス長 = 32 − ' + h + ' = ' + ans],
          traps: (h2 !== h ? [{ v: 32 - h2, msg: '2 を引くのを忘れています。' + need + ' 台ならホスト部は ' + h + ' ビット必要です。' }] : []).concat([{ v: h, msg: 'ホスト部のビット数を答えています。プレフィックス長は 32 − ホスト部 です。' }])
        };
      }
    },
    {
      id: 'transfer', title: 'データ転送時間', exams: ['ap', 'sc'], field: 'ネットワーク', topic: 'データ転送', level: 1,
      gen: function () {
        var mb = pick([10, 50, 100, 250, 500, 1000]), sp = pick([10, 50, 100, 200, 1000]), eff = pick([0.5, 0.6, 0.8, 0.9]);
        var ans = mb * 8 / (sp * eff);
        return {
          q: mb + 'Mバイトのファイルを、' + sp + 'Mビット/秒の回線で転送する。伝送効率が ' + r(eff * 100) + '% のとき、転送時間は何秒か(小数第1位まで)。',
          answer: r(ans, 1), unit: '秒', prec: 1,
          steps: [mb + 'Mバイト × 8 = ' + mb * 8 + 'Mビット', '実効速度 ' + sp + ' × ' + eff + ' = ' + r(sp * eff, 2) + 'Mビット/秒', mb * 8 + ' ÷ ' + r(sp * eff, 2) + ' = ' + r(ans, 2) + '秒'],
          traps: [{ v: r(mb / (sp * eff), 1), msg: 'バイトをビットに直していません(×8)。' },
            { v: r(mb * 8 / sp, 1), msg: '伝送効率を考慮していません。実効速度 = 回線速度 × 効率 です。' },
            { v: r(mb * 8 * eff / sp, 1), msg: '伝送効率を掛ける場所が逆です。効率が下がると時間は長くなります。' }]
        };
      }
    },
    /* ---------------- セキュリティ ---------------- */
    {
      id: 'keys', title: '暗号鍵の必要数', exams: ['ap', 'sc'], field: 'セキュリティ', topic: '暗号技術', level: 1,
      sc: { field: '暗号技術', topic: '公開鍵暗号' },
      gen: function () {
        var people = pick([5, 10, 20, 50, 100]), pub = Math.random() < 0.5;
        var ans = pub ? 2 * people : people * (people - 1) / 2;
        return {
          q: people + '人が互いに暗号通信を行う。' + (pub ? '公開鍵暗号方式で、必要な鍵(公開鍵と秘密鍵)の総数はいくつか。' : '共通鍵暗号方式で、2人の組ごとに異なる鍵を使うとき、必要な鍵の総数はいくつか。'),
          answer: ans, unit: '個', tol: 0,
          steps: pub ? ['1人に1組(公開鍵・秘密鍵)', people + ' × 2 = ' + ans] : ['2人の組合せの数 = n(n − 1) / 2', people + ' × ' + (people - 1) + ' / 2 = ' + ans],
          traps: pub ? [{ v: people * (people - 1) / 2, msg: 'それは共通鍵の場合です。公開鍵暗号は1人1組(2個)で済みます。' }, { v: people, msg: '鍵ペアの数です。公開鍵と秘密鍵の2個ずつあります。' }]
            : [{ v: people * (people - 1), msg: '2で割り忘れています。A-B と B-A は同じ鍵です。' }, { v: 2 * people, msg: 'それは公開鍵暗号の場合です。' }]
        };
      }
    },
    {
      id: 'pwtime', title: 'パスワードの総当たり時間', exams: ['sc'], field: '認証', topic: 'パスワード攻撃', level: 1,
      gen: function () {
        var cs = pick([[10, '数字'], [26, '英小文字'], [36, '英小文字と数字']]), len = cs[0] === 10 ? ri(6, 8) : ri(4, 6), rate = pick([100, 1000, 10000]);
        while (Math.pow(cs[0], len) / rate < 600) len++;
        var combos = Math.pow(cs[0], len), secs = combos / rate;
        var hours = secs >= 3600 * 2, div = hours ? 3600 : 60, unitName = hours ? '時間' : '分';
        var ans = secs / div;
        return {
          q: cs[1] + '(' + cs[0] + '種類)' + len + '桁のパスワードを、毎秒 ' + rate.toLocaleString() + ' 回の速さで総当たりする。すべての組合せを試すのに最大何' + unitName + 'かかるか(小数第1位まで)。',
          answer: r(ans, 1), unit: unitName, prec: 1, tol: Math.max(0.05, ans * 0.005),
          steps: ['組合せ数 = ' + cs[0] + '^' + len + ' = ' + combos.toLocaleString(), '÷ ' + rate.toLocaleString() + ' = ' + r(secs, 1) + ' 秒', '÷ ' + div + ' = ' + r(ans, 2) + ' ' + unitName],
          traps: [{ v: r(Math.pow(len, cs[0]) / rate / div, 1), msg: '桁数と文字種が逆です。組合せ数は 文字種^桁数 です。' },
            { v: r(secs, 1), msg: '秒のままです。' + div + 'で割って' + unitName + 'にします。' }]
        };
      }
    },
    {
      id: 'ale', title: '年間予想損失額(ALE)', exams: ['sc'], field: 'セキュリティマネジメント', topic: 'リスク分析', level: 1,
      gen: function () {
        var sle = pick([100, 200, 300, 500, 800, 1000, 2000]), aro = pick([0.1, 0.2, 0.25, 0.5, 2]);
        var ans = sle * aro, cut = pick([0.5, 0.8, 0.9]);
        if (Math.random() < 0.5) {
          return {
            q: '1回の事故による損失額が ' + sle + '万円、年間発生頻度が ' + aro + '回と見積もられた。年間予想損失額は何万円か。', answer: r(ans, 1), unit: '万円', prec: 1,
            steps: ['ALE = SLE × ARO = ' + sle + ' × ' + aro + ' = ' + r(ans, 2)],
            traps: [{ v: r(sle / aro, 1), msg: '割っています。年間の損失は「1回の損失 × 年間の回数」です。' }]
          };
        }
        var benefit = ans * cut;
        return {
          q: '1回の損失額 ' + sle + '万円、年間発生頻度 ' + aro + '回のリスクに対し、発生頻度を ' + r(cut * 100) + '% 減らす対策を検討している。この対策で減る年間予想損失額は何万円か。',
          answer: r(benefit, 1), unit: '万円', prec: 1,
          steps: ['対策前 ALE = ' + sle + ' × ' + aro + ' = ' + r(ans, 2), '対策後 ALE = ' + sle + ' × ' + aro + ' × ' + r(1 - cut, 2) + ' = ' + r(ans * (1 - cut), 2), '減少額 = ' + r(benefit, 2) + '(この額より対策費用が安ければ費用対効果あり)'],
          traps: [{ v: r(ans * (1 - cut), 1), msg: 'それは対策後の ALE です。減った額は 対策前 − 対策後 です。' }, { v: r(ans, 1), msg: '対策前の ALE そのものです。' }]
        };
      }
    },
    {
      id: 'amp', title: 'リフレクション攻撃の通信量', exams: ['sc'], field: 'ネットワーク攻撃', topic: 'DDoS', level: 1,
      gen: function () {
        var bots = pick([100, 200, 500, 1000]), mbps = pick([1, 2, 5]), f = pick([20, 50, 100]);
        var ans = bots * mbps * f / 1000;
        return {
          q: 'ボット ' + bots + ' 台がそれぞれ ' + mbps + 'Mbps で、送信元を詐称した要求をオープンリゾルバに送る。応答の増幅率が ' + f + ' 倍のとき、攻撃対象に届く通信量は何 Gbps か。',
          answer: r(ans, 2), unit: 'Gbps', prec: 2,
          steps: ['要求の合計 ' + bots + ' × ' + mbps + ' = ' + bots * mbps + 'Mbps', '× ' + f + ' = ' + bots * mbps * f + 'Mbps', '÷ 1000 = ' + r(ans, 3) + 'Gbps'],
          traps: [{ v: r(bots * mbps / 1000, 2), msg: '増幅率を掛け忘れています。' }, { v: bots * mbps * f, msg: 'Mbps のままです。1000で割って Gbps にします。' }]
        };
      }
    },
    /* ---------------- マネジメント ---------------- */
    {
      id: 'evm', title: 'EVM の指標', exams: ['ap'], field: 'プロジェクトマネジメント', topic: 'EVM', level: 1,
      gen: function () {
        var pv = pick([400, 500, 600, 800]), ev = pv - pick([-50, 50, 100, 150]), ac = ev + pick([-50, 50, 80, 100]);
        var which = pick(['SV', 'CV', 'SPI', 'CPI']);
        var val = { SV: ev - pv, CV: ev - ac, SPI: r(ev / pv, 2), CPI: r(ev / ac, 2) }[which];
        var trapMap = {
          SV: [{ v: pv - ev, msg: '符号が逆です。SV = EV − PV(EV が基準)。' }, { v: ac - pv, msg: 'AC と PV を比べています。スケジュールは EV と PV を比べます。' }],
          CV: [{ v: ac - ev, msg: '符号が逆です。CV = EV − AC。' }, { v: pv - ac, msg: 'PV と AC を比べています。コストは EV と AC を比べます。' }],
          SPI: [{ v: r(pv / ev, 2), msg: '分子と分母が逆です。SPI = EV / PV。' }],
          CPI: [{ v: r(ac / ev, 2), msg: '分子と分母が逆です。CPI = EV / AC。' }]
        };
        return {
          q: 'PV = ' + pv + '万円、EV = ' + ev + '万円、AC = ' + ac + '万円 のとき、' + which + ' を求めよ' + (which.length === 3 ? '(小数第2位まで)。' : '(万円)。'),
          answer: val, unit: which.length === 3 ? '' : '万円', prec: which.length === 3 ? 2 : 0, tol: which.length === 3 ? 0.006 : 0,
          steps: [{ SV: 'SV = EV − PV = ' + ev + ' − ' + pv, CV: 'CV = EV − AC = ' + ev + ' − ' + ac, SPI: 'SPI = EV / PV = ' + ev + ' / ' + pv, CPI: 'CPI = EV / AC = ' + ev + ' / ' + ac }[which] + ' = ' + val,
            (which === 'SV' || which === 'SPI' ? (val < (which === 'SV' ? 0 : 1) ? 'スケジュールは遅れている' : 'スケジュールは計画どおりか前倒し') : (val < (which === 'CV' ? 0 : 1) ? 'コストは超過している' : 'コストは予算内'))],
          traps: trapMap[which]
        };
      }
    },
    {
      id: 'cpm', title: 'クリティカルパスと所要日数', exams: ['ap'], field: 'プロジェクトマネジメント', topic: 'スケジュール管理', level: 2,
      gen: function () {
        var A = ri(2, 5), B = ri(2, 6), C = ri(2, 6), D = ri(1, 4), E = ri(4, 10);
        var p1 = A + B + D, p2 = A + C + D, p3 = E + D;
        var ans = Math.max(p1, p2, p3);
        var askFloat = Math.random() < 0.4;
        var q0 = '作業 A(' + A + '日)の後に B(' + B + '日)と C(' + C + '日)を並行して行い、さらに作業 E(' + E + '日)を A と同時に開始する。B・C・E がすべて終わってから D(' + D + '日)を行う。';
        if (askFloat) {
          var ef = Math.max(A + B, A + C, E);
          var floatB = ef - (A + B);
          return {
            q: q0 + '作業 B の余裕日数(トータルフロート)は何日か。', answer: floatB, unit: '日', tol: 0,
            steps: ['D の最早開始日 = max(A+B, A+C, E) = max(' + (A + B) + ', ' + (A + C) + ', ' + E + ') = ' + ef, 'B の最遅終了日 = ' + ef + '、最早終了日 = A + B = ' + (A + B), '余裕 = ' + ef + ' − ' + (A + B) + ' = ' + floatB],
            traps: [{ v: Math.min(p1, p2, p3), msg: '経路の日数を答えています。余裕日数は「最遅 − 最早」です。' }]
          };
        }
        return {
          q: q0 + 'プロジェクト全体の最短所要日数は何日か。', answer: ans, unit: '日', tol: 0,
          steps: ['経路 A→B→D = ' + p1 + '日', '経路 A→C→D = ' + p2 + '日', '経路 E→D = ' + p3 + '日', '最長の経路(クリティカルパス)= ' + ans + '日'],
          traps: [{ v: Math.min(p1, p2, p3), msg: '最短の経路を選んでいます。全体の日数は最長の経路(クリティカルパス)で決まります。' },
            { v: A + B + C + D + E, msg: '全作業の日数を足しています。並行して行う作業は重なります。' }]
        };
      }
    },
    {
      id: 'comm', title: 'コミュニケーション経路の数', exams: ['ap'], field: 'プロジェクトマネジメント', topic: '要員管理', level: 1,
      gen: function () {
        var a = ri(4, 10), b = a + ri(2, 6), diff = Math.random() < 0.5;
        var ca = a * (a - 1) / 2, cb = b * (b - 1) / 2;
        return {
          q: diff ? 'メンバー ' + a + ' 人のチームに ' + (b - a) + ' 人を追加した。メンバー間のコミュニケーション経路は何本増えるか。' : 'メンバー ' + b + ' 人のチームで、メンバー間のコミュニケーション経路は何本あるか。',
          answer: diff ? cb - ca : cb, unit: '本', tol: 0,
          steps: diff ? ['追加前 ' + a + '×' + (a - 1) + '/2 = ' + ca, '追加後 ' + b + '×' + (b - 1) + '/2 = ' + cb, '増加 ' + (cb - ca)] : ['n(n − 1) / 2 = ' + b + ' × ' + (b - 1) + ' / 2 = ' + cb],
          traps: [{ v: diff ? b * (b - 1) - a * (a - 1) : b * (b - 1), msg: '2で割り忘れています。A-B と B-A は同じ経路です。' }].concat(diff ? [{ v: cb, msg: '追加後の総数です。増えた本数は差を取ります。' }] : [])
        };
      }
    },
    {
      id: 'threepoint', title: '三点見積り(PERT)', exams: ['ap'], field: 'プロジェクトマネジメント', topic: '見積り', level: 1,
      gen: function () {
        var o = ri(4, 8), m = o + ri(1, 4), p = m + ri(3, 10);
        var ans = (o + 4 * m + p) / 6;
        return {
          q: 'ある作業の所要日数を、楽観値 ' + o + '日、最可能値 ' + m + '日、悲観値 ' + p + '日 と見積もった。三点見積り(PERT)による期待値は何日か(小数第1位まで)。',
          answer: r(ans, 1), unit: '日', prec: 1,
          steps: ['(楽観 + 4 × 最可能 + 悲観) / 6', '(' + o + ' + 4 × ' + m + ' + ' + p + ') / 6 = ' + r(ans, 2)],
          traps: [{ v: r((o + m + p) / 3, 1), msg: '単純平均しています。最可能値に4倍の重みを付けて6で割ります。' }]
        };
      }
    },
    /* ---------------- ストラテジ ---------------- */
    {
      id: 'bep', title: '損益分岐点', exams: ['ap'], field: '企業活動', topic: '損益分岐点', level: 1,
      gen: function () {
        var f = pick([300, 400, 600, 800, 1200]), vr = pick([0.2, 0.25, 0.4, 0.5, 0.6]), target = Math.random() < 0.4 ? pick([100, 200, 300]) : 0;
        var ans = (f + target) / (1 - vr);
        return {
          q: '固定費 ' + f + '万円、変動費率 ' + r(vr * 100) + '% の会社がある。' + (target ? '利益 ' + target + '万円を達成するのに必要な売上高' : '損益分岐点売上高') + 'は何万円か(小数第1位まで)。',
          answer: r(ans, 1), unit: '万円', prec: 1,
          steps: ['限界利益率 = 1 − ' + vr + ' = ' + r(1 - vr, 2), '(' + f + (target ? ' + ' + target : '') + ') ÷ ' + r(1 - vr, 2) + ' = ' + r(ans, 2)],
          traps: [{ v: r((f + target) / vr, 1), msg: '変動費率で割っています。割るのは (1 − 変動費率)(限界利益率)です。' }].concat(target ? [{ v: r(f / (1 - vr), 1), msg: '目標利益を足し忘れています。それは損益分岐点です。' }] : [])
        };
      }
    },
    {
      id: 'ev', title: '期待値による意思決定', exams: ['ap'], field: '企業活動', topic: '意思決定', level: 1,
      gen: function () {
        var p = pick([0.3, 0.4, 0.6, 0.7, 0.8]), g = pick([100, 200, 300, 500]), l = -pick([20, 50, 100, 150]);
        var ans = p * g + (1 - p) * l;
        return {
          q: 'ある投資案は、確率 ' + r(p * 100) + '% で ' + g + '万円の利益、確率 ' + r((1 - p) * 100) + '% で ' + (-l) + '万円の損失となる。この案の期待値は何万円か。',
          answer: r(ans, 1), unit: '万円', prec: 1,
          steps: [p + ' × ' + g + ' = ' + r(p * g, 2), r(1 - p, 2) + ' × (' + l + ') = ' + r((1 - p) * l, 2), '合計 ' + r(ans, 2)],
          traps: [{ v: r(p * g - (1 - p) * l, 1), msg: '損失の符号を誤っています。損失はマイナスとして足します。' }, { v: r(p * g, 1), msg: '損失の場合を足し忘れています。' }]
        };
      }
    },
    {
      id: 'roi', title: 'ROI(投資利益率)', exams: ['ap'], field: '企業活動', topic: '会計', level: 1,
      gen: function () {
        var inv = pick([500, 800, 1000, 2000]), gain = pick([60, 100, 150, 240, 300]), years = pick([1, 3]);
        var total = gain * years, ans = (total - (years === 1 ? 0 : 0)) / inv * 100;
        return {
          q: '投資額 ' + inv + '万円のシステムを導入し、' + (years === 1 ? '年間 ' + gain + '万円の利益増加' : years + '年間で毎年 ' + gain + '万円、合計 ' + total + '万円の利益増加') + 'が得られた。この期間の ROI は何%か(小数第1位まで)。',
          answer: r(ans, 1), unit: '%', prec: 1,
          steps: ['ROI = 利益 ÷ 投資額 × 100', total + ' ÷ ' + inv + ' × 100 = ' + r(ans, 2) + '%'],
          traps: [{ v: r(inv / total * 100, 1), msg: '分子と分母が逆です。投資額に対する利益の割合です。' }].concat(years > 1 ? [{ v: r(gain / inv * 100, 1), msg: '1年分の利益で計算しています。問題の期間(' + years + '年)の利益を使います。' }] : [])
        };
      }
    }
  ];

  global.DrillGen = {
    all: TYPES,
    forExam: function (id) { return TYPES.filter(function (t) { return t.exams.indexOf(id) >= 0; }); },
    get: function (id) { return TYPES.filter(function (t) { return t.id === id; })[0]; },
    /** 問題を1つ作る。tol を補う */
    make: function (type) {
      var p = type.gen();
      p.type = type;
      if (p.tol === undefined) {
        p.tol = p.prec !== undefined ? 0.5 * Math.pow(10, -p.prec) + 1e-9 : Math.max(1e-9, Math.abs(p.answer) * 0.005);
      }
      p.traps = (p.traps || []).filter(function (t) { return Math.abs(t.v - p.answer) > p.tol; });
      return p;
    }
  };
})(window);
