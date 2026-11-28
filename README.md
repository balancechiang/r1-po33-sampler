# Web Sampler

A browser sampler and 16-step sequencer for desktop, phones and tablets. Record, slice, sequence and exchange compatible audio-protocol projects. Inspired by the PO-33 workflow.

**Independent, unofficial open-source software. Not affiliated with, endorsed by or sponsored by Teenage Engineering.** PO-33 and K.O! identify compatibility references only; product names belong to their respective owners.

[Open Web Sampler](https://balancechiang.github.io/web-sampler/) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

## Development

Serve this directory over localhost or HTTPS. No framework or runtime package installation is required.

```sh
python -m http.server 8000
node scripts/build.mjs
node scripts/check.mjs
```

Open `http://localhost:8000/`. The build stamps runtime URLs using the version in `package.json`; it does not generate duplicate application pages.

[Architecture](docs/architecture.md) · [Direct browser transfer](docs/peer-transfer.md) · [Audio formats](docs/audio-backup.md) · [Sync](docs/sync.md) · [Factory preset](docs/presets.md) · [Testing](tests/README.md) · [Known limits](docs/remaining.md) · [Third-party notices](docs/third-party-notices.md)

Rabbit r1 Creations is an optional host: [compatibility adapter and installation code](compat/rabbit-r1/README.md).
