# 구따지

## 이메일 전송 설정

1. [Web3Forms](https://web3forms.com/)에서 연락받을 이메일 주소로 무료 Access Key를 발급합니다.
2. 프로젝트 루트에 `.env.local` 파일을 만들고 아래 값을 추가합니다.

```env
VITE_WEB3FORMS_ACCESS_KEY=발급받은_Access_Key
```

3. 개발 서버를 다시 시작합니다. 환경 변수는 서버를 다시 시작해야 적용됩니다.

`.env.local`은 Git에서 제외됩니다. Access Key는 Web3Forms 정책상 브라우저에 공개되어도 되는 식별자지만, 저장소에는 개인별 설정을 남기지 않도록 분리했습니다.

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
