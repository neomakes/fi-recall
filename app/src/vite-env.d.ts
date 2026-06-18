/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** FI:RECALL 데모 접근 코드 (PasscodeGate). 미설정 시 fallback 사용. */
  readonly VITE_FIRECALL_PASSCODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
