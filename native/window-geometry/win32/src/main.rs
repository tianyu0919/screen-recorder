//! Windows 窗口几何采样 helper（kr-01 window-capture-fixed-canvas）。
//!
//! 用法：`window-geometry.exe <hwnd> <t0UnixMs>`
//! 行为：以 ~60Hz 轮询目标窗口的 DWM 扩展框架 bounds（可见边框，物理像素），
//! 原样输出物理像素，由 Electron Main 使用 screenToDipRect 转成全局 DIP，
//! 避免混合 DPI 多屏下全局坐标原点被错误缩放。变化时向 stdout 写一行 JSON：
//! `{"t":相对t0的ms,"x":..,"y":..,"w":..,"h":..}`
//! 几何不变不重复输出；最小化（IsIconic）时暂停输出（渲染端沿用最近有效样本）；
//! 窗口销毁后退出（code 0）。停止 = 父进程关闭 stdin（EOF），与 wasapi-audio 同约定。
use std::io::{BufWriter, Read, Write};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use windows::Win32::Foundation::{HWND, RECT};
use windows::Win32::Graphics::Dwm::{DwmGetWindowAttribute, DWMWA_EXTENDED_FRAME_BOUNDS};
use windows::Win32::UI::HiDpi::{
    SetProcessDpiAwarenessContext, DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2,
};
use windows::Win32::UI::WindowsAndMessaging::{GetWindowRect, IsIconic, IsWindow};

const POLL_INTERVAL: Duration = Duration::from_millis(16);

fn unix_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// 物理像素 rect（优先 DWM 可见边框，失败回退 GetWindowRect 含不可见缩放边框）。
fn frame_rect(hwnd: HWND) -> Option<RECT> {
    let mut rect = RECT::default();
    let hr = unsafe {
        DwmGetWindowAttribute(
            hwnd,
            DWMWA_EXTENDED_FRAME_BOUNDS,
            &mut rect as *mut RECT as *mut _,
            std::mem::size_of::<RECT>() as u32,
        )
    };
    if hr.is_ok() {
        return Some(rect);
    }
    let ok = unsafe { GetWindowRect(hwnd, &mut rect) };
    if ok.is_ok() {
        Some(rect)
    } else {
        None
    }
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 3 {
        eprintln!("usage: window-geometry <hwnd> <t0UnixMs>");
        std::process::exit(2);
    }
    let hwnd_raw = match args[1].parse::<isize>() {
        Ok(v) => v,
        Err(_) => {
            eprintln!("invalid hwnd: {}", args[1]);
            std::process::exit(2);
        }
    };
    let t0: i64 = args[2].parse().unwrap_or(0);
    let hwnd = HWND(hwnd_raw as *mut _);

    // Per-Monitor V2：GetWindowRect/DWM bounds 保持物理像素，交由 Electron 统一换算 DIP
    unsafe {
        let _ = SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
    }

    // stdin EOF（父进程停止通知）→ 退出；后台线程避免阻塞轮询
    std::thread::spawn(|| {
        let mut stdin = std::io::stdin();
        let mut buf = [0u8; 64];
        loop {
            match stdin.read(&mut buf) {
                Ok(0) | Err(_) => std::process::exit(0),
                Ok(_) => {}
            }
        }
    });

    let stdout = std::io::stdout();
    let mut out = BufWriter::new(stdout.lock());
    let mut last: Option<(i32, i32, i32, i32)> = None;

    loop {
        if unsafe { !IsWindow(Some(hwnd)).as_bool() } {
            // 窗口已销毁：几何时间线到此为止（渲染端沿用最后样本 / SOURCE_LOST 流程）
            let _ = out.flush();
            return;
        }
        let iconic = unsafe { IsIconic(hwnd).as_bool() };
        if !iconic {
            if let Some(rect) = frame_rect(hwnd) {
                let x = rect.left;
                let y = rect.top;
                let w = rect.right - rect.left;
                let h = rect.bottom - rect.top;
                if w > 0 && h > 0 && last != Some((x, y, w, h)) {
                    last = Some((x, y, w, h));
                    let t = unix_ms() - t0;
                    let _ = writeln!(out, "{{\"t\":{t},\"x\":{x},\"y\":{y},\"w\":{w},\"h\":{h}}}");
                    let _ = out.flush();
                }
            }
        }
        std::thread::sleep(POLL_INTERVAL);
    }
}
