import type { RecorderApi } from '../../electron/preload/index'

declare global {
  interface Window {
    api: RecorderApi
  }
}

export {}
