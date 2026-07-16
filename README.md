# 安芸灘しおり Digital Guide

「旅のしおりは、しおりちゃんにおまかせ♪」

安芸灘とびしま海道の島々と人をつなぐ、安芸灘しおり公式デジタル観光ガイドです。白・水色・やさしい青を基調に、海を感じる地図としおりビー玉マーカーで、島の景色・歴史・グルメを案内します。

## 正式公開

- 正式版URL: https://masaka2-afk.github.io/akinada-shiori-digital-guide/
- GitHubリポジトリ: https://github.com/masaka2-afk/akinada-shiori-digital-guide
- 管理用Googleマイマップ: https://www.google.com/maps/d/viewer?mid=1TbtYyvz6fS9qpn43ZbrWi6NnRYDaVXs

## 管理と自動同期

Googleマイマップを管理用の原本として使い続け、公開画面はGitHub Pagesへ配信します。`main`へのPush、Actions画面からの手動実行、毎日05:17（日本時間）のスケジュール実行で、次の処理を自動化しています。

1. Googleマイマップの公開KMLを取得
2. スポット名、座標、説明、写真、YouTube、カテゴリーをJSONへ変換
3. 取得失敗時はリポジトリ内の前回キャッシュを使用
4. Google Maps API設定をGitHub Secretから読み込み
5. GitHub Pagesをビルド・公開

## 更新方法

1. Googleマイマップを更新
2. GitHubのActionsから「Deploy Digital Guide to GitHub Pages」を`Run workflow`
3. ビルド・同期・公開の完了を確認

アプリのコード変更は、`main`へPushするだけで同じワークフローが実行されます。大きな新機能は`version-2`などの開発ブランチで検証し、安定した変更だけを`main`へ反映します。

## 開発環境

```bash
pnpm install
pnpm dev
pnpm build
```

GitHub Pages版のローカルビルド:

```bash
pnpm sync:pages
pnpm config:pages
pnpm build:pages
```

ローカルの`.env`:

```env
GOOGLE_MAPS_API_KEY=your_google_maps_javascript_api_key
GOOGLE_MAPS_MAP_ID=optional_google_maps_map_id
```

`.env`と生成されたランタイム設定はGit管理対象外です。Google Mapsのブラウザーキーは配信後の通信から確認できるため、Google Cloud Consoleで正式版ドメインのHTTPリファラー制限を設定してください。
