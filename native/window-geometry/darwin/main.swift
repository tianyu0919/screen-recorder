// macOS 窗口几何采样 helper（kr-01 window-capture-fixed-canvas）。
//
// 用法：window-geometry <cgWindowId> <t0UnixMs>
// 行为：以 ~60Hz 轮询 CGWindowList 中目标窗口的 bounds（points，主屏左上角原点，
// 与 Electron screen / uiohook 同一坐标系），变化时向 stdout 写一行 JSON：
//   {"t":相对t0的ms,"x":..,"y":..,"w":..,"h":..}
// 几何不变不重复输出；窗口从 CGWindowList 消失（关闭等）后退出（code 0）。
// 停止 = 父进程关闭 stdin（EOF），与 sck-audio 同约定（不依赖 SIGTERM）。
import CoreGraphics
import Foundation

func nowMs() -> Int64 { Int64(Date().timeIntervalSince1970 * 1000) }

guard CommandLine.arguments.count >= 3,
      let windowId = UInt32(CommandLine.arguments[1]),
      let t0 = Int64(CommandLine.arguments[2]) else {
    FileHandle.standardError.write("usage: window-geometry <cgWindowId> <t0UnixMs>\n".data(using: .utf8)!)
    exit(2)
}

// stdin EOF（父进程停止通知）→ 退出
FileHandle.standardInput.readabilityHandler = { handle in
    if handle.availableData.isEmpty { exit(0) }
}

var last: (Int, Int, Int, Int)? = nil

func poll() {
    let list = CGWindowListCopyWindowInfo([.optionIncludingWindow], CGWindowID(windowId))
    guard let infos = list as? [[String: Any]], let info = infos.first else {
        // 窗口已不可枚举：几何时间线到此为止
        exit(0)
    }
    guard let bounds = info[kCGWindowBounds as String] as? [String: Any],
          let x = bounds["X"] as? Double,
          let y = bounds["Y"] as? Double,
          let w = bounds["Width"] as? Double,
          let h = bounds["Height"] as? Double else {
        return
    }
    let rect = (Int(x.rounded()), Int(y.rounded()), Int(w.rounded()), Int(h.rounded()))
    guard rect.2 > 0, rect.3 > 0 else { return }
    if let previous = last,
       previous.0 == rect.0,
       previous.1 == rect.1,
       previous.2 == rect.2,
       previous.3 == rect.3 {
        return
    }
    last = rect
    let t = nowMs() - t0
    let line = "{\"t\":\(t),\"x\":\(rect.0),\"y\":\(rect.1),\"w\":\(rect.2),\"h\":\(rect.3)}\n"
    FileHandle.standardOutput.write(line.data(using: .utf8)!)
}

Timer.scheduledTimer(withTimeInterval: 1.0 / 60.0, repeats: true) { _ in poll() }
poll() // 立即产出首个样本（Main 据此定位窗口所在显示器）
RunLoop.main.run()
