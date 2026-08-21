import type { WavData } from './audio'

/**
 * 自定义音轨的 PCM / AudioBuffer 模块级缓存（kr-05 custom-audio-track）：
 * 大对象不进 zustand（避免订阅方无谓重渲染），store 里只放 clip 元数据。
 * 预览由 Web Audio 复用 AudioBuffer；导出从本缓存取 PCM 给 worker。
 */

interface ClipAsset {
  wav: WavData
  audioBuffer: AudioBuffer
}

const cache = new Map<string, ClipAsset>()

export function setClipAsset(id: string, asset: ClipAsset): void {
  cache.set(id, asset)
}

export function getClipAsset(id: string): ClipAsset | undefined {
  return cache.get(id)
}

export function removeClipAsset(id: string): void {
  cache.delete(id)
}

/** 会话切换/关闭时清空（自定义轨本期不持久化） */
export function clearClipAssets(): void {
  for (const id of [...cache.keys()]) removeClipAsset(id)
}
