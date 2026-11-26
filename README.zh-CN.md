# Web Sampler

面向桌面、手机和平板浏览器的采样器与 16 步音序器，支持录音、切片、编排及兼容音频协议的工程交换。操作流程参考 PO-33。

**独立开源、非官方项目，与 Teenage Engineering 没有任何关联、官方背书或赞助。** PO-33、K.O! 仅用于标识兼容对象，相关产品名称归各自权利人所有。

[打开网页](https://balancechiang.github.io/web-sampler/) · [English](README.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

本地运行：在项目目录执行 `python -m http.server 8000`，打开 `http://localhost:8000/`。使用 `node scripts/build.mjs` 更新资源版本，`node scripts/check.mjs` 运行核心检查。

[架构](docs/architecture.md) · [音频格式](docs/audio-backup.md) · [同步](docs/sync.md) · [预设](docs/presets.md) · [测试](tests/README.md) · [待完善项](docs/remaining.md) · [第三方许可](docs/third-party-notices.md)

rabbit r1 Creations 作为可选运行环境保留：[兼容说明与安装码](compat/rabbit-r1/README.md)。
