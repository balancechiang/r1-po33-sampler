# Install Web Sampler on rabbit r1

Open Creations → create → add via QR code and scan `creation-qr.png`.
The code embeds the complete creation JSON directly, matching the official SDK generator.
`creation.json` is the editable source descriptor, not the QR payload URL.
A fresh image is also available as `web-sampler-install-qr.png`.
The stable entry is https://balancechiang.github.io/web-sampler/creation.html.

Web Sampler is independent open-source software and is not affiliated with,
endorsed by or sponsored by Teenage Engineering. PO-33 appears only as a
hardware compatibility and workflow reference.

The repository was renamed on 2026-11-26. Use the new installation QR; old
Pages addresses and QR codes are not retained as compatibility endpoints.
This test migration starts a fresh user-data namespace and attempts a bounded,
project-only cleanup of accessible legacy test stores. It does not clear other
applications' data or claim to reach data isolated inside an old Creation.

简体中文：扫描新的 `creation-qr.png` 安装 Web Sampler。仓库已迁移到
`web-sampler`，旧安装码不再作为固定入口。本次测试迁移会启用干净的数据区，
载入出厂预设；旧 Creation 内隔离保存、无法访问的数据需要从设备端删除旧应用。

Format reference: https://github.com/rabbit-hmi-oss/creations-sdk/blob/main/qr/final/js/app.js (`JSON.stringify(data)` is passed directly as QR data). Project-download codes inside the application still encode HTTPS URLs; installation codes use JSON.
