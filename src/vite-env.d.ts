/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_VIRTUAL_OFFICE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
