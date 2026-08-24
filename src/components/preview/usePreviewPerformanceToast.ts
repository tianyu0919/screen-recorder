import { useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useSettingsStore } from '@/store/settingsStore'

const TOAST_ID = 'preview-performance-warning'

/** 每次打开会话最多提示一次；操作只改变本机预览偏好，不触碰 edit.json。 */
export function usePreviewPerformanceToast(sessionId: string | null): () => void {
  const issuedForRef = useRef<string | null>(null)
  const updateSettings = useSettingsStore((state) => state.update)

  useEffect(() => {
    issuedForRef.current = null
    toast.dismiss(TOAST_ID)
  }, [sessionId])

  return useCallback(() => {
    if (!sessionId || issuedForRef.current === sessionId) return
    issuedForRef.current = sessionId
    toast.warning('预览出现持续卡顿', {
      id: TOAST_ID,
      className: 'preview-performance-toast',
      duration: Infinity,
      description: '降低编辑预览清晰度可改善播放流畅度，最终导出质量不会改变。',
      action: {
        label: '切换到流畅',
        onClick: () => void updateSettings({ previewQuality: 'smooth' })
      },
      cancel: { label: '保持当前清晰度', onClick: () => undefined }
    })
  }, [sessionId, updateSettings])
}
