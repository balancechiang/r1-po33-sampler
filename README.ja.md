# Web Sampler

デスクトップ、スマートフォン、タブレットのブラウザーで使えるサンプラーと16ステップシーケンサーです。録音、スライス、シーケンス、対応する音声プロトコルのプロジェクト交換を扱います。PO-33 の操作フローを参考にしています。

**独立した非公式オープンソースプロジェクトです。Teenage Engineering との提携、同社の承認や支援はありません。** PO-33、K.O! は互換性の参照にのみ使用し、製品名は各権利者に帰属します。

[アプリを開く](https://balancechiang.github.io/web-sampler/) · [English](README.md) · [简体中文](README.zh-CN.md) · [한국어](README.ko.md)

ローカルでは `python -m http.server 8000` を実行し、`http://localhost:8000/` を開きます。ビルドは `node scripts/build.mjs`、コア検証は `node scripts/check.mjs` です。

[構成](docs/architecture.md) · [音声形式](docs/audio-backup.md) · [同期](docs/sync.md) · [プリセット](docs/presets.md) · [検証](tests/README.md) · [制限](docs/remaining.md) · [第三者ライセンス](docs/third-party-notices.md)

rabbit r1 Creations は任意の実行環境です：[互換アダプターとインストールコード](compat/rabbit-r1/README.md)。
