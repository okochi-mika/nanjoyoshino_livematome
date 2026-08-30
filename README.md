# 南條愛乃セトリアーカイブ

南條愛乃さんのワンマンライブ・ツアーのセットリストをまとめる静的サイトです。
下川みくに版と同じ思想（静的サイト・ビルドツールなし・HTML + Tailwind(CDN) + Vanilla JS）で作られていますが、
今回は「1ツアー＝複数会場」という構造に対応しています。

**ログイン・お気に入り・参加記録・マイセトリ機能は無し**（お気に入り・参加記録・マイセトリ作成といった
アカウント機能は当初検討していましたが、想定ファン数が多く、閲覧者本人以外も見ることになるサイトの
性質上、ログイン機能自体を持たないシンプルな「閲覧・再生・検索」専用サイトにしています）。
そのためSupabaseなどのバックエンドは一切使わず、完全に静的なファイルだけで動きます。

## ディレクトリ構成

```
index.html          … ツアー一覧 + 曲名検索
tour.html            … ツアー詳細（会場一覧）
player.html          … セトリ再生（?id=liveId）

css/style.css        … Tailwindに重ねる独自トークン（Direction C「透明感・ガーデン」）
js/common.js         … normalize/dedupeKey・manifest/live読み込みなどの共通処理
js/search.js         … 曲名検索（全公演を横断し、ツアー/会場/日付を結果に表示）
js/index.js          … index.html用ロジック
js/tour.js           … tour.html用ロジック
js/player.js         … player.html用ロジック（YouTube IFrame API）

data/manifest.json   … ツアー一覧＋各ツアーの会場一覧（軽量・index.htmlが読む）
data/lives/{tourId}/{venueId}.json … 公演ごとのフルデータ（tourId/venueName/date/tracks）

scripts/generate-manifest.js … data/lives/ 配下を再帰的に走査してmanifest.jsonを再生成するNode製の補助スクリプト
```

## データモデル

- `tourId`（例: `2024_fantasic_garden`）… ツアー単位のID
- `venueId`（例: `osaka`）… ツアー内の会場ID
- `liveId`（`{tourId}_{venueId}`、例: `2024_fantasic_garden_osaka`）… 公演単位のID。
  `player.html?id={liveId}` で該当公演のセトリを再生する。

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

このサイトはバックエンド不要の完全な静的サイトなので、特別なセットアップは不要です。

1. リポジトリをVercel（またはNetlifyなど）に接続してデプロイする。
2. 以上。

## 下川みくに版から引き継いだ注意点・経緯

- **Vercelの Clean URLs**: デプロイ後に内部リンクの`.html`が消えることがあるため、
  JSでリンクをセレクタ検索する場合は `href*="player.html?id="` のような拡張子依存の書き方をしない
  （このサイトはリンクをJSで動的に生成しているので基本的に影響は受けないが、今後手を入れる際は注意）。
- **ログイン機能は一度検討したが撤去した**: 開発の途中まではSupabase + Google OAuthによる
  ログイン機能（お気に入り・参加記録・マイセトリ作成）を実装していたが、閲覧者が本人以外にも
  多く想定されるサイトの性質上、アカウント管理の仕組み自体を持たない方針に変更した。
  そのため `js/common.js` から認証関連の関数（`getSupabase`/`onAuthReady`/`renderAuthNav`等）は
  全て削除してあり、`mypage.html`/`mysetlist.html`とそのJS、`sql/schema.sql`も削除済み。
  もし将来的にログイン機能を復活させたい場合は、Supabaseプロジェクトを新規に用意するか、
  下川みくにサイトと共有する場合はテーブル名を`nanjo_`プレフィックス付きにするなど、
  既存の下川みくにサイトのデータと衝突しないようにすること。

## 曲データについて（要確認）

初回実装として「南條愛乃 Live Tour 2024 ～LIVE of The Fantasic Garden～ supported by animelo」
（愛知 06/02・大阪 06/23・神奈川 07/07）を入れています。

- 会場・日程は公開情報から確認済みです。
- 曲順は大阪公演(06/23)の参戦記録（ファンブログ）と、日替わり曲についてはファンによるまとめ記事(note)を
  参考にしたもので、**公式発表ではありません**。誤りがあれば該当の `data/lives/2024_fantasic_garden/*.json` を直接修正してください。
- 5曲目・16曲目は公演ごとに異なる日替わり枠（キャラクターソング等）でした（曲名のみ表示し、
  歌唱キャラクター名は付けていません）:
  - 愛知: 5曲目「藪の中のジンテーゼ」／16曲目「鏖鋸・シュルシャガナ」
  - 大阪: 5曲目「ジャーニーズ・トランク」／16曲目「SENSE OF DISTANCE」
  - 神奈川: 5曲目「iD*」／16曲目「この道をあなたと」
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
