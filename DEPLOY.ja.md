[English](DEPLOY.md) | [简体中文](DEPLOY.zh-CN.md) | [日本語](DEPLOY.ja.md) | [한국어](DEPLOY.ko.md)

# 公開手順

## GitHub Pages

1. リポジトリを作成します。GitHub Free では公開リポジトリを使用します。
2. ZIP そのものではなく、このフォルダーの中身をアップロードします。index.html はリポジトリ直下に置き、app.js、presets.js, po33-fx.js, lcd-indicator.js、2 つの CSS、画像も一緒に配置します。fonts フォルダーとライセンスを残してください。
3. **Settings → Pages** で **Deploy from a branch → main → /(root)** を選び、保存します。
4. 公開 URL（通常は https://USERNAME.github.io/REPOSITORY/）の準備を待ち、HTTPS で正常に表示されることを確認します。
5. リリースと別途配布されるローカルの Creation QR コード生成ツールを開き、アプリの URL を入力します。既定のアイコンは同じディレクトリの icon.png です。
6. r1 で **Creations → create → add via QR code** を開き、コードを読み取ります。

## Netlify

[Netlify Drop](https://app.netlify.com/drop) にこのフォルダー、または ZIP を展開した内容をアップロードします。発行された HTTPS URL を同じ QR 生成ツールに入力します。

## 更新

同じリポジトリ／公開先を更新すれば、同じ URL と QR コードを使い続けられます。GitHub の所有者名、リポジトリ名、入口のパスは変更しないでください。rabbit の URL から GitHub Pages や Netlify へ移す場合は新しいインストール用 QR コードが必要です。別インストールへの保存データ移行は保証されません。

パッケージには実行ファイル、文書、アイコン、フォントライセンスが含まれます。個人の録音、ブラウザーの保存データ、テスト、デザイン原稿、バックアップ、試聴音声は含みません。静的サイトの公開に OS3 のモデル呼び出しや OpenAI API キーは不要です。マイク権限、振動、サイドボタン、シェイク感度を r1 実機で確認してください。

参考：[GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site) · [rabbit Creations](https://www.rabbit.tech/support/article/how-to-use-r1-creations)

[操作ガイド](R1-CONTROLS.ja.md) · [プリセット音色とパターン](PRESETS.ja.md) · [公開手順](DEPLOY.ja.md)

Hardware Backup I/O: include backup.html, backup.css, backup-ui.js, backup-wav.js and backup-worklet.js when publishing. AudioWorklet requires HTTPS or localhost; see [status and hardware tests](BACKUP-IO.md).
