[English](DEPLOY.md) | [简体中文](DEPLOY.zh-CN.md) | [日本語](DEPLOY.ja.md) | [한국어](DEPLOY.ko.md)

# Publishing

## GitHub Pages

1. Create a repository. Use a public repository if you use GitHub Free.
2. Upload this folder's contents, not the ZIP itself. Keep index.html at the repository root, alongside app.js, presets.js, po33-fx.js, lcd-indicator.js, both CSS files and the image assets. Keep the fonts folder and its license.
3. Open **Settings → Pages**. Choose **Deploy from a branch → main → /(root)** and save.
4. Wait for the deployment URL, normally https://USERNAME.github.io/REPOSITORY/. Open it and check that the app loads over HTTPS.
5. Open the separate local Creation QR generator supplied with the release. Enter the app URL; the default icon URL is icon.png in the same directory.
6. On r1, open **Creations → create → add via QR code** and scan the generated code.

## Netlify

Upload this folder, or the ZIP's extracted contents, through [Netlify Drop](https://app.netlify.com/drop). Use the resulting HTTPS app URL with the same QR generator.

## Updates

Update the same repository/deployment to keep the same public URL and QR code. Keep the GitHub owner, repository name and entry path unchanged. Moving from a rabbit-hosted URL to GitHub Pages or Netlify requires a new installation QR code; saved data is not guaranteed to migrate between installations.

The release includes runtime files, documentation, icons and the font license. It excludes personal recordings, browser storage, tests, design files, backups and audio previews. Creating a static deployment does not require an OS3 model call or an OpenAI API key. Test microphone permission, vibration, side-button mapping and shake sensitivity on the actual r1.

References: [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site) · [rabbit Creations](https://www.rabbit.tech/support/article/how-to-use-r1-creations)

[Controls](R1-CONTROLS.md) · [Factory sounds & patterns](PRESETS.md) · [Publishing](DEPLOY.md)
