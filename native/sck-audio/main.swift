import CoreMedia
import Foundation
import ScreenCaptureKit

// sck-audio — macOS 系统音频原生采集 helper（kr-01 system-audio）
// 用法: sck-audio <output.wav>
// getDisplayMedia loopback 在 macOS 上是坏的（electron#52738：音轨出生即 ended），
// 故 macOS 走 ScreenCaptureKit 原生采集；输出 48kHz/2ch/int16 WAV（与 mic.wav 同规格）。
// 启动失败打 stderr 并非零退出；启动成功 stdout 打一行 "listening"；
// 关停：父进程关闭 stdin（EOF）或 SIGTERM/SIGINT，patch WAV header 后 exit 0。

let SAMPLE_RATE: UInt32 = 48000
let CHANNELS: UInt16 = 2

func fatal(_ msg: String) -> Never {
    FileHandle.standardError.write(Data("sck-audio: \(msg)\n".utf8))
    exit(1)
}

/// 流式 WAV 写入：先写占位 header，退出时 patch dataSize
final class WavWriter {
    private let fh: FileHandle
    private var dataBytes: UInt32 = 0
    private let lock = NSLock()
    private var closed = false

    init(path: String) throws {
        guard FileManager.default.createFile(atPath: path, contents: nil) else {
            throw NSError(domain: "sck-audio", code: 1, userInfo: [NSLocalizedDescriptionKey: "无法创建 \(path)"])
        }
        fh = try FileHandle(forWritingTo: URL(fileURLWithPath: path))
        try fh.write(contentsOf: Self.header(dataBytes: 0))
    }

    /// 标准 44 字节 PCM WAV header（int16 交错）
    private static func header(dataBytes: UInt32) -> Data {
        var d = Data()
        func u32(_ v: UInt32) { var x = v.littleEndian; d.append(Data(bytes: &x, count: 4)) }
        func u16(_ v: UInt16) { var x = v.littleEndian; d.append(Data(bytes: &x, count: 2)) }
        d.append(contentsOf: [0x52, 0x49, 0x46, 0x46]) // RIFF
        u32(36 + dataBytes)
        d.append(contentsOf: [0x57, 0x41, 0x56, 0x45]) // WAVE
        d.append(contentsOf: [0x66, 0x6D, 0x74, 0x20]) // "fmt "
        u32(16); u16(1); u16(CHANNELS)
        u32(SAMPLE_RATE)
        u32(SAMPLE_RATE * UInt32(CHANNELS) * 2)
        u16(CHANNELS * 2); u16(16)
        d.append(contentsOf: [0x64, 0x61, 0x74, 0x61]) // "data"
        u32(dataBytes)
        return d
    }

    func append(_ data: Data) {
        lock.lock()
        defer { lock.unlock() }
        if closed { return }
        fh.write(data)
        dataBytes += UInt32(data.count)
    }

    /// patch header 并落盘；幂等（信号路径与正常退出都可能调用）
    func finalize() {
        lock.lock()
        defer { lock.unlock() }
        if closed { return }
        closed = true
        fh.seek(toFileOffset: 0)
        fh.write(Self.header(dataBytes: dataBytes))
        fh.synchronizeFile()
        try? fh.close()
    }
}

/// SCStreamOutput：收 .audio 的 CMSampleBuffer，float32 → int16 交错写入 WAV
final class AudioSink: NSObject, SCStreamOutput {
    let writer: WavWriter

    init(writer: WavWriter) {
        self.writer = writer
    }

    func stream(_ stream: SCStream, didOutputSampleBuffer sbuf: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .audio, sbuf.isValid, sbuf.numSamples > 0 else { return }

        // AudioBufferList 是变长结构：先问尺寸再分配
        var sizeNeeded = 0
        var status = CMSampleBufferGetAudioBufferListWithRetainedBlockBuffer(
            sbuf, bufferListSizeNeededOut: &sizeNeeded, bufferListOut: nil,
            bufferListSize: 0, blockBufferAllocator: nil, blockBufferMemoryAllocator: nil,
            flags: 0, blockBufferOut: nil
        )
        guard status == noErr, sizeNeeded > 0 else { return }
        let mem = UnsafeMutableRawPointer.allocate(
            byteCount: sizeNeeded, alignment: MemoryLayout<AudioBufferList>.alignment
        )
        defer { mem.deallocate() }
        let abl = mem.bindMemory(to: AudioBufferList.self, capacity: 1)
        var block: CMBlockBuffer?
        status = CMSampleBufferGetAudioBufferListWithRetainedBlockBuffer(
            sbuf, bufferListSizeNeededOut: nil,
            bufferListOut: abl,
            bufferListSize: sizeNeeded, blockBufferAllocator: nil, blockBufferMemoryAllocator: nil,
            flags: 0, blockBufferOut: &block
        )
        guard status == noErr else { return }

        writer.append(Self.toInt16Interleaved(UnsafeMutableAudioBufferListPointer(abl)))
    }

    /// float32 → int16；兼容平面（每 buffer 单声道）与已交错（单 buffer 多声道）两种布局
    private static func toInt16Interleaved(_ buffers: UnsafeMutableAudioBufferListPointer) -> Data {
        let conv = { (s: Float) -> Int16 in
            let c = max(-1.0, min(1.0, s))
            return Int16((c < 0 ? c * 32768 : c * 32767).rounded())
        }
        var out = Data()
        if buffers.count == 1, let buf = buffers.first, buf.mNumberChannels > 1 {
            // 已交错：逐采样转换，顺序不变
            let src = buf.mData!.assumingMemoryBound(to: Float.self)
            let count = Int(buf.mDataByteSize) / MemoryLayout<Float>.size
            out.reserveCapacity(count * 2)
            for i in 0 ..< count {
                var v = conv(src[i]).littleEndian
                out.append(Data(bytes: &v, count: 2))
            }
        } else {
            // 平面：frames × channels 交错
            guard let first = buffers.first else { return out }
            let frames = Int(first.mDataByteSize) / MemoryLayout<Float>.size
            let chs = buffers.count
            out.reserveCapacity(frames * chs * 2)
            for f in 0 ..< frames {
                for c in 0 ..< chs {
                    let src = buffers[c].mData!.assumingMemoryBound(to: Float.self)
                    var v = conv(src[f]).littleEndian
                    out.append(Data(bytes: &v, count: 2))
                }
            }
        }
        return out
    }
}

guard CommandLine.arguments.count == 2 else {
    fatal("用法: sck-audio <output.wav>")
}
let outPath = CommandLine.arguments[1]

let writer: WavWriter
do {
    writer = try WavWriter(path: outPath)
} catch {
    fatal("创建输出文件失败: \(error.localizedDescription)")
}

// 关停通道（两条，任一触发都会 patch WAV header 后 exit 0）：
// 1) 主通道 stdin EOF：父进程（Electron Main）停止时关闭 stdin pipe；父进程意外死亡
//    时 pipe 也会断，helper 不会泄漏成孤儿。用阻塞 read 的裸线程实现，不走 DispatchSource——
//    实测（Swift 6.3 + CLT）：Task 挂起期间主线程若阻塞等过信号量，此后 DispatchSourceSignal
//    永久不触发；即便不阻塞，挂上 SCStream 后信号源在本进程形态下也不触发。裸线程 read 最稳。
// 2) 辅助通道 SIGTERM/SIGINT：DispatchSourceSignal，在简单进程形态下有效，留作手动调试兜底。
let stdinWatcher = Thread {
    var buf: UInt8 = 0
    // 读到字节或 EOF（返回 0/负）都视为停止指令
    _ = read(STDIN_FILENO, &buf, 1)
    writer.finalize()
    exit(0)
}
stdinWatcher.name = "sck-audio.stdin-watcher"
stdinWatcher.start()

signal(SIGTERM, SIG_IGN)
signal(SIGINT, SIG_IGN)
let signalQueue = DispatchQueue(label: "sck-audio.signals")
for sig in [SIGTERM, SIGINT] {
    let src = DispatchSource.makeSignalSource(signal: sig, queue: signalQueue)
    src.setEventHandler {
        writer.finalize()
        exit(0)
    }
    src.resume()
}

// stream/sink 必须被顶层强引用：Task 闭包结束后局部变量释放，SCStream dealloc 会停采集。
var activeStream: SCStream?
var activeSink: AudioSink?
Task {
    do {
        let content = try await SCShareableContent.excludingDesktopWindows(
            false, onScreenWindowsOnly: false
        )
        // 音频 tap 只需要一个 content filter 载体，与所选屏幕/窗口无关
        guard let display = content.displays.first else {
            fatal("没有可用显示器（无屏幕录制权限？）")
        }
        let filter = SCContentFilter(display: display, excludingWindows: [])
        let config = SCStreamConfiguration()
        config.capturesAudio = true
        config.excludesCurrentProcessAudio = true
        config.sampleRate = Int(SAMPLE_RATE)
        config.channelCount = Int(CHANNELS)
        // 视频关掉：SDK 无 capturesVideo（macOS 15 也没进 CLT SDK），用最小视频开销兜底
        config.width = 2
        config.height = 2
        config.minimumFrameInterval = CMTime(value: 1, timescale: 1)
        let stream = SCStream(filter: filter, configuration: config, delegate: nil)
        let sink = AudioSink(writer: writer)
        try stream.addStreamOutput(sink, type: .audio, sampleHandlerQueue: .global(qos: .userInitiated))
        try await stream.startCapture()
        activeStream = stream
        activeSink = sink
        print("listening")
        fflush(stdout)
    } catch {
        fatal("启动采集失败: \(error.localizedDescription)")
    }
}

dispatchMain()
