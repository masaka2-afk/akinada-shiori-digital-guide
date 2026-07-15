# 安芸灘しおり Digital Guide β

「旅のしおりは、しおりちゃんにおまかせ♪」

Googleマイマップを管理用の原本として使い続けながら、スマホで見やすい公開用観光Webアプリを提供するプロジェクトです。

## β版

- 公開URL: https://masaka2-afk.github.io/akinada-shiori-digital-guide-beta/
- 管理用Googleマイマップ: https://www.google.com/maps/d/viewer?mid=1TbtYyvz6fS9qpn43ZbrWi6NnRYDaVXs

## 公開の仕組み

`main`ブランチへ反映すると、GitHub Actionsが次の処理を自動実行します。

1. 公開中のGoogleマイマップからKMLを取得
2. アプリ用JSONへ変換（失敗時は前回キャッシュを使用）
3. Google Maps API設定をGitHub Secretsから読み込み
4. GitHub Pages用アプリをビルド
5. GitHub Pagesへ公開

毎日05:17（日本時間）の自動同期と、Actions画面からの手動実行にも対応しています。

## 開発コマンド

```bash
pnpm install
pnpm dev
pnpm build
```

GitHub Pages版をローカルで作る場合:

```bash
pnpm sync:pages
pnpm config:pages
pnpm build:pages
```

## 環境変数

ローカルでは`.env`を使用します。`.env`はGit管理対象外です。

```env
GOOGLE_MAPS_API_KEY=your_google_maps_javascript_api_key
GOOGLE_MAPS_MAP_ID=optional_google_maps_javascript_map_id
```

GitHubでは`GOOGLE_MAPS_API_KEY`をRepository Secretとして保存します。Google Maps JavaScript APIのブラウザーキーは配信後の通信から確認できるため、Google Cloud Consoleで次のHTTPリファラー制限を必ず設定してください。

```text
https://masaka2-afk.github.io/akinada-shiori-digital-guide-beta/*
```
