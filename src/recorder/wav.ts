/** AudioBuffer → 16bit PCM WAV（Task 2.3，mic.wav 落盘用） */
export function encodeWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = Math.min(buffer.numberOfChannels, 2)
  const sampleRate = buffer.sampleRate
  const length = buffer.length * numChannels
  const bytesPerSample = 2
  const dataSize = length * bytesPerSample
  const out = new ArrayBuffer(44 + dataSize)
  const view = new DataView(out)

  const writeStr = (offset: number, s: string): void => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
  }

  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true)
  view.setUint16(32, numChannels * bytesPerSample, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)

  const channels: Float32Array[] = []
  for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c))

  let offset = 44
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < numChannels; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]))
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
      offset += 2
    }
  }
  return out
}

/** 麦克风 MediaRecorder 产物（webm/opus）→ WAV；解码失败返回 null */
export async function micBlobToWav(blob: Blob): Promise<ArrayBuffer | null> {
  try {
    const ctx = new OfflineAudioContext(1, 1, 48000)
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer())
    return encodeWav(decoded)
  } catch {
    return null
  }
}
