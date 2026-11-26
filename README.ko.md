# Web Sampler

데스크톱, 휴대폰, 태블릿 브라우저를 위한 샘플러와 16스텝 시퀀서입니다. 녹음, 슬라이싱, 시퀀싱과 호환 오디오 프로토콜의 프로젝트 교환을 지원하며 PO-33 작업 방식을 참고합니다.

**독립적인 비공식 오픈 소스 프로젝트이며 Teenage Engineering과 제휴 관계가 없고 공식 승인이나 후원을 받지 않았습니다.** PO-33 및 K.O!는 호환 대상을 나타내는 용도로만 사용되며 제품명은 각 권리자에게 귀속됩니다.

[웹 앱 열기](https://balancechiang.github.io/web-sampler/) · [English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md)

로컬 실행: `python -m http.server 8000` 후 `http://localhost:8000/`에 접속합니다. `node scripts/build.mjs`로 리소스 버전을 갱신하고 `node scripts/check.mjs`로 핵심 검사를 실행합니다.

[구조](docs/architecture.md) · [오디오 형식](docs/audio-backup.md) · [동기화](docs/sync.md) · [프리셋](docs/presets.md) · [테스트](tests/README.md) · [제한 사항](docs/remaining.md) · [라이선스](docs/third-party-notices.md)

rabbit r1 Creations는 선택적인 실행 환경입니다: [호환 어댑터와 설치 코드](compat/rabbit-r1/README.md).
