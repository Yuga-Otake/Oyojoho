/**
 * 用語・公式集 : 情報処理安全確保支援士試験(SC)
 */
window.SC_GLOSSARY = [
  {
    group: 'ポート番号・プロトコル',
    items: [
      { term: 'SSH', formula: 'TCP 22', desc: '暗号化された遠隔ログイン。パスワード認証より公開鍵認証が望ましい。' },
      { term: 'SMTP / サブミッション', formula: 'TCP 25 / TCP 587', desc: 'サーバ間の転送は25番、利用者からの送信は587番 + SMTP-AUTH(OP25B 対策)。SMTPS は 465番。' },
      { term: 'DNS', formula: 'UDP / TCP 53', desc: '応答が大きいときやゾーン転送は TCP。DoT は 853番、DoH は 443番を使う。' },
      { term: 'HTTPS', formula: 'TCP 443(HTTP/3 は UDP 443)', desc: 'TLS で保護された HTTP。' },
      { term: 'IKE / NAT トラバーサル', formula: 'UDP 500 / UDP 4500', desc: 'IPsec の鍵交換。NAT を越える場合は ESP を UDP 4500 でカプセル化する。' },
      { term: 'RDP', formula: 'TCP 3389', desc: 'リモートデスクトップ。インターネットに直接公開するとランサムウェアの侵入口になる。' },
      { term: 'NTP', formula: 'UDP 123', desc: '時刻同期。ログの突合せと Kerberos に必須。リフレクション攻撃にも悪用される。' }
    ]
  },
  {
    group: '暗号・認証',
    items: [
      { term: '前方秘匿性', formula: '(EC)DHE で実現', desc: '長期の秘密鍵が漏えいしても過去のセッションは復号されない性質。' },
      { term: 'AEAD', formula: 'AES-GCM, ChaCha20-Poly1305', desc: '暗号化と改ざん検知を同時に行う認証付き暗号。TLS 1.3 で必須。' },
      { term: 'HMAC', formula: 'H(K ⊕ opad ‖ H(K ⊕ ipad ‖ M))', desc: '共通鍵とハッシュ関数によるメッセージ認証コード。否認防止はできない。' },
      { term: 'ソルト / ストレッチング', formula: '', desc: 'ソルトはレインボーテーブル対策、ストレッチングは総当たりを遅くする。bcrypt・Argon2 など。' },
      { term: 'FIDO2 / WebAuthn', formula: '', desc: '認証器の秘密鍵でチャレンジに署名。サーバは公開鍵だけを保持。フィッシング耐性がある。' },
      { term: 'OAuth 2.0 / OIDC', formula: 'アクセストークン / ID トークン', desc: 'OAuth は認可の委譲、OpenID Connect はその上で認証結果を連携する。' },
      { term: 'PKCE', formula: 'code_verifier / code_challenge', desc: '認可コードの横取りを防ぐ OAuth の拡張。' }
    ]
  },
  {
    group: '攻撃手法',
    items: [
      { term: 'パスワードスプレー', formula: 'パスワード固定 × 多数の ID', desc: 'アカウントロックを回避する。対策は多要素認証。' },
      { term: 'パスワードリスト攻撃', formula: '漏えいした ID / PW の組', desc: 'パスワードの使い回しを狙う。' },
      { term: 'XSS / CSRF / SSRF', formula: '', desc: 'XSS は閲覧者のブラウザでスクリプト実行、CSRF は本人の権限で意図しない操作、SSRF はサーバに内部へアクセスさせる。' },
      { term: 'DNS キャッシュポイズニング', formula: '当たる確率 = 1 / (ID 2^16 × ポート数)', desc: '対策はソースポートランダマイゼーションと DNSSEC。' },
      { term: 'リフレクション攻撃', formula: '攻撃量 = 要求量 × 増幅率', desc: '送信元を詐称して第三者のサーバの応答を集中させる DDoS。' },
      { term: '二重恐喝', formula: '', desc: 'ランサムウェアで暗号化し、さらに窃取データの公開をちらつかせる。' }
    ]
  },
  {
    group: '対策技術',
    items: [
      { term: 'SPF / DKIM / DMARC', formula: 'IP / 署名 / ヘッダ From の一致', desc: '送信ドメイン認証。ヘッダ From の偽装対策には DMARC が必要。' },
      { term: 'HSTS', formula: 'Strict-Transport-Security', desc: 'HTTPS のみで接続させ、SSL ストリッピングを防ぐ。' },
      { term: 'CSP', formula: 'Content-Security-Policy', desc: 'スクリプトの取得元などを制限し、XSS の被害を軽減する。frame-ancestors はクリックジャッキング対策。' },
      { term: 'Cookie 属性', formula: 'HttpOnly / Secure / SameSite', desc: 'スクリプトから読めない / HTTPS のみ / 他サイト起点で送らない。' },
      { term: 'IPsec', formula: 'ESP = 暗号化 + 認証、AH = 認証のみ', desc: 'トンネルモードは元の IP パケット全体を保護する。' },
      { term: 'EDR / SIEM / SOAR', formula: '', desc: '端末の振る舞い検知 / ログの相関分析 / 対応の自動化。' }
    ]
  },
  {
    group: '管理・法規',
    items: [
      { term: '年間予想損失額', formula: 'ALE = SLE × ARO', desc: '1回の損失額 × 年間発生率。対策費用と比較する。' },
      { term: 'CVE / CWE / CVSS', formula: '', desc: '脆弱性の識別番号 / 脆弱性の種類 / 深刻度(基本・現状・環境の3評価基準)。' },
      { term: '適用宣言書', formula: 'ISO/IEC 27001 附属書 A', desc: '管理策の採否と理由を記載する ISMS の文書。' },
      { term: '登録セキスペの義務', formula: '3年ごとの更新', desc: '秘密保持(資格喪失後も)、信用失墜行為の禁止、講習の受講。' },
      { term: '不正指令電磁的記録に関する罪', formula: '刑法', desc: '正当な理由のないウイルスの作成・提供・供用・取得・保管を処罰。' }
    ]
  }
];
