export async function loadPreviewScreen(): Promise<typeof import('@/components/preview/PreviewScreen')> {
  return import('@/components/preview/PreviewScreen')
}

export function preloadPreview(): void {
  void loadPreviewScreen().catch(() => {})
}

export async function openPreviewSession(sessionId: string): Promise<void> {
  const { usePreviewStore } = await import('@/store/previewStore')
  await usePreviewStore.getState().openSession(sessionId)
}
