import { create } from 'zustand'
import type { UpdateSnapshot } from '@shared/types'

interface UpdateState {
  snapshot: UpdateSnapshot | null
  open: boolean
  initialize(): Promise<void>
  setOpen(open: boolean): void
  check(): Promise<void>
  download(): Promise<void>
  install(): Promise<void>
  openRelease(): Promise<void>
}

let initialized = false

export const useUpdateStore = create<UpdateState>((set) => ({
  snapshot: null,
  open: false,
  async initialize() {
    if (initialized) return
    initialized = true
    set({ snapshot: await window.api.getUpdateState() })
    window.api.onUpdateStatusChanged((snapshot) => set({ snapshot }))
  },
  setOpen: (open) => set({ open }),
  async check() { set({ snapshot: await window.api.checkForUpdates() }) },
  async download() { await window.api.downloadUpdate() },
  async install() { await window.api.installUpdate() },
  async openRelease() { await window.api.openUpdateRelease() }
}))
