/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEFAULT_WEAVIATE_URL?: string;
  readonly VITE_DEFAULT_API_KEY?: string;
  readonly VITE_APP_TITLE?: string;
  readonly VITE_GA_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
