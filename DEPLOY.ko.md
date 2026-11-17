[English](DEPLOY.md) | [简体中文](DEPLOY.zh-CN.md) | [日本語](DEPLOY.ja.md) | [한국어](DEPLOY.ko.md)

# 배포 안내

## GitHub Pages

1. 저장소를 만듭니다. GitHub Free에서는 공개 저장소를 사용합니다.
2. ZIP 파일 자체가 아니라 이 폴더의 내용을 업로드합니다. index.html은 저장소 루트에 두고 app.js, presets.js, po33-fx.js, 두 CSS 파일과 이미지도 함께 올립니다. fonts 폴더와 라이선스를 유지하세요.
3. **Settings → Pages**에서 **Deploy from a branch → main → /(root)**를 선택해 저장합니다.
4. 배포 URL(보통 https://USERNAME.github.io/REPOSITORY/)이 생성되면 HTTPS로 앱이 정상 표시되는지 확인합니다.
5. 릴리스와 별도로 제공된 로컬 Creation QR 생성기를 열고 앱 주소를 입력합니다. 기본 아이콘 주소는 같은 디렉터리의 icon.png입니다.
6. r1에서 **Creations → create → add via QR code**를 열고 코드를 스캔합니다.

## Netlify

[Netlify Drop](https://app.netlify.com/drop)에 이 폴더나 ZIP을 푼 내용을 업로드합니다. 발급된 HTTPS 주소를 같은 QR 생성기에 입력합니다.

## 업데이트

같은 저장소／배포 프로젝트를 업데이트하면 기존 URL과 QR 코드를 유지할 수 있습니다. GitHub 소유자명, 저장소명, 진입 경로는 변경하지 마세요. rabbit의 기존 URL에서 GitHub Pages나 Netlify로 옮길 때는 새 설치 QR 코드가 필요합니다. 서로 다른 설치 간 저장 데이터의 자동 이전은 보장되지 않습니다.

패키지에는 실행 파일, 문서, 아이콘, 글꼴 라이선스가 포함됩니다. 개인 녹음, 브라우저 저장 데이터, 테스트, 디자인 원본, 백업, 미리듣기 음원은 포함하지 않습니다. 정적 사이트 배포에는 OS3 모델 호출이나 OpenAI API 키가 필요하지 않습니다. 설치 후 마이크 권한, 진동, 측면 버튼, 흔들기 감도를 r1 실기기에서 확인하세요.

참고: [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site) · [rabbit Creations](https://www.rabbit.tech/support/article/how-to-use-r1-creations)

[조작 안내](R1-CONTROLS.ko.md) · [프리셋 사운드와 패턴](PRESETS.ko.md) · [배포 안내](DEPLOY.ko.md)
