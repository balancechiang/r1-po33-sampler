[English](DEPLOY.md) | [简体中文](DEPLOY.zh-CN.md) | [日本語](DEPLOY.ja.md) | [한국어](DEPLOY.ko.md)

# 发布说明

## GitHub Pages

1. 创建仓库；GitHub Free 使用公开仓库。
2. 上传本文件夹中的内容，不要只上传 ZIP。index.html 放在仓库根目录，与 app.js、presets.js、两个 CSS 文件及图片资源同级；保留 fonts 文件夹和许可。
3. 打开 **Settings → Pages**，选择 **Deploy from a branch → main → /(root)** 并保存。
4. 等待生成地址，通常为 https://用户名.github.io/仓库名/。打开并确认应用可通过 HTTPS 加载。
5. 打开随发布文件另外提供的本地 Creation 二维码生成器，填入应用网址；默认图标为同目录下的 icon.png。
6. 在 r1 打开 **Creations → create → add via QR code**，扫描生成的二维码。

## Netlify

通过 [Netlify Drop](https://app.netlify.com/drop) 上传本文件夹或 ZIP 解压后的内容，将得到的 HTTPS 地址填入同一个二维码生成器。

## 后续更新

持续更新同一个仓库／托管项目，可保留公开网址和二维码。GitHub 用户名、仓库名和入口路径应保持不变。从 rabbit 原托管地址迁移到 GitHub Pages 或 Netlify，需要新安装二维码；设备数据不保证在不同安装之间自动迁移。

发布包包含运行文件、文档、图标和字体许可，不含个人录音、浏览器存储、测试、设计稿、备份或音频试听。静态托管无需调用 OS3 模型，也不需要 OpenAI API Key。安装后请在 r1 上验证麦克风授权、震动、侧键映射及晃动灵敏度。

参考：[GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site) · [rabbit Creations](https://www.rabbit.tech/support/article/how-to-use-r1-creations)

[操作说明](R1-CONTROLS.zh-CN.md) · [预置音色与节奏](PRESETS.zh-CN.md) · [发布说明](DEPLOY.zh-CN.md)
