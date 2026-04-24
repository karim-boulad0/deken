/// <reference types="vite/client" />

declare global {
  interface Window {
    deken: {
      appVersion: string
    }
  }
}

export {}
