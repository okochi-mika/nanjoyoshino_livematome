# 南條愛乃セトリアーカイブ

南條愛乃さんのワンマンライブ・ツアーのセットリストをまとめる静的サイトです。
下川みくに版と同じ思想（静的サイト・ビルドツールなし・HTML + Tailwind(CDN) + Vanilla JS・Supabaseバックエンド）で作られていますが、
今回は「1ツアー＝複数会場」という構造に対応しています。

## ディレクトリ構成

```
index.html          … ツアー一覧 + 曲名検索
tour.html            … ツアー詳細（会場一覧・参加記録トグル）
player.html          … セトリ再生（?id=liveId または ?mysetlist=uuid）
mypage.html          … 表示名編集・参加記録・お気に入り一覧
mysetlist.html       … マイセトリの作成・編集・削除

css/style.css        … Tailwindに重ねる独自トークン（Direction C「透明感・ガーデン」）
js/common.js         … Supabase初期化・認証・normalize/dedupeKey等の共通処理
js/search.js         … 曲名検索（全公演を横断し、ツアー/会場/日付を結果に表示）
js/index.js          … index.html用ロジック
js/tour.js           … tour.html用ロジック
js/player.js         … player.html用ロジック（YouTube IFrame API）
js/mypage.js         … mypage.html用ロジック
js/mysetlist.js      … mysetlist.html用ロジック
js/supabase-config.js… Supabaseの接続情報（要編集）

data/manifest.json   … ツアー一覧＋各ツアーの会場一覧（軽量・index.htmlが読む）
data/lives/{tourId}/{venueId}.json … 公演ごとのフルデータ（tourId/venueName/date/tracks）

sql/schema.sql        … Supabaseのテーブル定義（favorites / attended / mysetlists / mysetlist_tracks）
scripts/generate-manifest.js … data/lives/ 配下を再帰的に走査してmanifest.jsonを再生成するNode製の補助スクリプト
```

## データモデル

- `tourId`（例: `2024_fantasic_garden`）… ツアー単位のID
- `venueId`（例: `osaka`）… ツアー内の会場ID
- `liveId`（`{tourId}_{venueId}`、例: `2024_fantasic_garden_osaka`）… 公演単位のID。
  お気に入り・参加記録などは全てこの `liveId` を主キーとして扱う。

`data/manifest.json` はツアー・会場の一覧だけを持つ軽量なファイルで、index.html はこれだけを読み込む。
各会場のセットリスト本体は `data/lives/{tourId}/{venueId}.json` に分離してあり、tour.html → player.html と
辿ったときや、曲名検索のときにだけ個別に読み込まれる。ツアーごとにサブフォルダを分けているのは、
ツアー数が増えても `data/lives/` 直下がフラットに膨れ上がらないようにするため
（`js/common.js` の `loadLive()` が、manifest.jsonからliveId→tourId/venueIdを逆引きして
正しいパスを組み立てて読みに行く）。

新しい公演を追加する場合は、対象ツアーの `data/lives/{tourId}/` フォルダ（無ければ新規作成）に
`{venueId}.json` を追加してから、

```
node scripts/generate-manifest.js
```

を実行すると `data/manifest.json` が自動で再生成される（ツアー名やロゴなど、ライブJSONに無い情報は既存のmanifest.jsonの値を引き継ぐ。
このスクリプトは各JSONファイルの中身から `tourId`/`venueId` を読むので、フォルダ構成が多少ずれていても動く）。

## セットアップ

1. Supabaseプロジェクトを作成し、SQLエディタで `sql/schema.sql` を実行する。
2. `js/supabase-config.js` に Project URL と **Publishable key**（旧anon key相当）を入力する。クライアントに埋め込んでOK。
3. Googleログインを設定する（下記「Googleログインの設定」参照）。
4. Netlifyにリポジトリを接続してデプロイする。

## Googleログインの設定

下川みくに版はメールのマジックリンクだったが、南條愛乃版は想定ファン数がかなり多く、
Supabase組み込みメール送信のレート制限やカスタムSMTPの準備が間に合わない可能性が高いため、
**メール送信が発生しないGoogle OAuthログイン**に変更している。

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成し、
   「APIとサービス」→「OAuth同意画面」を設定する（外部/公開、スコープは `email`・`profile`・`openid` のみでOK。
   このレベルのスコープならGoogleの厳格な審査は不要）。
2. 「認証情報」→「OAuth クライアント ID」を作成する（アプリケーションの種類: ウェブアプリケーション）。
   承認済みのリダイレクトURIに、SupabaseのCallback URL
   `https://<プロジェクトref>.supabase.co/auth/v1/callback` を追加する。
3. 発行された クライアントID / クライアントシークレット を、Supabaseダッシュボードの
   Authentication > Providers > Google に入力して有効化する。
4. Authentication > URL Configuration の Site URL / Redirect URLs に、
   Netlifyの本番URL（例: `https://xxxx.netlify.app`）を追加する
   （ここに登録されていないURLへはOAuthログイン後にリダイレクトされない）。

表示名は、ログイン直後はGoogleアカウントの名前が自動で使われ、マイページから好きな表示名に変更できる
（`user_metadata.display_name` として保存され、Googleの名前より優先される）。

## 下川みくに版から引き継いだ注意点

- **RLSだけでは`permission denied`になる**: `sql/schema.sql` は各テーブルについて
  `DROP TABLE` → `CREATE TABLE` → `ENABLE ROW LEVEL SECURITY` → `CREATE POLICY` →
  `GRANT ... TO authenticated` → `NOTIFY pgrst, 'reload schema'` の順で書いてある。
- **Netlifyの Pretty URLs**: デプロイ後に内部リンクの`.html`が消えることがあるため、
  JSでリンクをセレクタ検索する場合は `href*="player.html?id="` のような拡張子依存の書き方をしない
  （このサイトはリンクをJSで動的に生成しているので基本的に影響は受けないが、今後手を入れる際は注意）。
- **onAuthStateChangeの二重初期化**: `js/common.js` の `onAuthReady` / `initAuthWatcher` は、
  認証状態が確定する前に登録されたコールバックと、確定後に登録されたコールバックの両方が
  正しく一度ずつ呼ばれるように、`_authHasFired` / `_lastAuthUser` でリプレイする仕組みにしてある
  （tour.html/player.htmlはmanifestやライブJSONのfetchを挟んでからauth callbackを登録するため、
  素朴な実装だとタイミング次第で一覧が表示されない不具合が起きることを実装時に確認して対処済み）。
- **メール送信を使わない**: 上記の通り、想定ファン数の多さからメールのマジックリンクではなく
  Googleログインを採用している。Supabaseのメールレート制限やカスタムSMTPを気にする必要はない。

## 曲データについて（要確認）

初回実装として「南條愛乃 Live Tour 2024 ～LIVE of The Fantasic Garden～ supported by animelo」
（愛知 06/02・大阪 06/23・神奈川 07/07）を入れています。

- 会場・日程は公開情報から確認済みです。
- 曲順は大阪公演(06/23)の参戦記録（ファンブログ）と、日替わり曲についてはファンによるまとめ記事(note)を
  参考にしたもので、**公式発表ではありません**。誤りがあれば該当の `data/lives/2024_fantasic_garden/*.json` を直接修正してください。
- 5曲目・16曲目は公演ごとに異なる日替わり枠（キャラクターソング等）でした（曲名のみ表示し、
  歌唱キャラクター名は付けていません）:
  - 愛知: 5曲目「藪の中のジンテーゼ」／16曲目「鏖鋸・シュルシャガナ」※16曲目は動画ID未確認
  - 大阪: 5曲目「ジャーニーズ・トランク」／16曲目「SENSE OF DISTANCE」※16曲目は動画ID未確認
  - 神奈川: 5曲目「iD*」※動画ID未確認／16曲目「この道をあなたと」
- それ以外の曲順（1-4, 6-15, 17-23）は3公演とも大阪公演の参戦記録をもとにした暫定のもので、
  実際に愛知・神奈川で同じだったかは未確認です。判明次第更新してください。

### 非公式音源を使っている曲

「鏖鋸・シュルシャガナ」（愛知16曲目）と「SENSE OF DISTANCE」（大阪16曲目）は、
キャラクターソングのため公式のYouTube音源が見当たらず、第三者がアップロードした動画を
代わりに使っています。トラックに `"note": "非公式アップロード"` を付けてあり、
player.html上でも曲名の横にバッジ表示されます。非公式アップロードのため、YouTube側の事情で
予告なく動画が削除される可能性があります。削除されて再生できなくなった場合は、
同じ曲の別の動画を探して `id` を差し替えてください（`note` ごと削除すればバッジも消えます）。

現時点でYouTube上に動画自体が見当たらず `"id": null` のままになっている曲はありません。
