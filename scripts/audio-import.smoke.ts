import { importCustomAudio } from '../src/store/customAudioImport'

let failures = 0
function check(name: string, condition: boolean): void {
  if (condition) console.log(`ok   ${name}`)
  else {
    failures++
    console.error(`FAIL ${name}`)
  }
}

class DetachingAudioContext {
  async decodeAudioData(data: ArrayBuffer): Promise<AudioBuffer> {
    // 模拟 Chromium/Web Audio 对输入 bytes 取得所有权并分离原 buffer。
    structuredClone(data, { transfer: [data] })
    return {
      numberOfChannels: 1,
      length: 4,
      sampleRate: 48_000,
      getChannelData: () => new Float32Array([0, 0.25, -0.25, 1])
    } as AudioBuffer
  }

  async close(): Promise<void> {}
}

const pickedData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer
;(globalThis as unknown as { AudioContext: typeof AudioContext }).AudioContext =
  DetachingAudioContext as unknown as typeof AudioContext
;(globalThis as unknown as {
  window: { api: { pickAudioFile(): Promise<{ name: string; path: string; data: ArrayBuffer }> } }
}).window = {
  api: {
    async pickAudioFile() {
      return { name: 'test.wav', path: 'test.wav', data: pickedData }
    }
  }
}

const result = await importCustomAudio(10_000, 2_000)
check('测试解码器确实分离输入 buffer', pickedData.byteLength === 0)
check(
  '音频导入为 IPC 持久化保留独立完整 bytes',
  result.kind === 'success' && result.sourceData.byteLength === 8
)
check(
  '右键目标时间传入新音轨 offset',
  result.kind === 'success' && result.clip.offsetMs === 2_000
)

console.log(failures === 0 ? '\n全部通过' : `\n${failures} 项失败`)
process.exit(failures === 0 ? 0 : 1)
