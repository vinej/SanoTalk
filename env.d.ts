interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_APP_NAME: string
  // add all your VITE_ env variables here
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}