//! wasapi-audio — Windows 系统音频原生采集 helper（kr-01 system-audio）
//! 用法: wasapi-audio <output.wav>
//!
//! 替代 getDisplayMedia loopback + MediaRecorder 路径（Chromium 回环采样率不匹配
//! 爆音 + 默认低码率 Opus 失真），直接走 WASAPI shared-mode loopback 采默认渲染
//! 设备混音，float32 → int16，非 48k 设备用 rubato sinc 重采样，
//! 输出 48kHz/2ch/int16 WAV（与 mic.wav / sck-audio 同规格）。
//!
//! 协议与 sck-audio 完全一致：启动失败打 stderr 并非零退出；启动成功 stdout 打一行
//! "listening"；关停靠父进程关闭 stdin（EOF）→ patch WAV header 后 exit 0。

use std::process::exit;
use std::sync::Arc;
use std::thread;

mod capture;
mod vb;
mod wav;

fn main() {
    // 进程启动 ≈ 录制开始（Main 在 start-recording 时 spawn），用于启动延迟静音补齐
    let t0 = std::time::Instant::now();
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        eprintln!("wasapi-audio: 用法: wasapi-audio <output.wav> [设备id子串] [capture]");
        exit(1);
    }
    let device_filter = args.get(2).cloned();
    let capture_mode = args.get(3).is_some_and(|a| a == "capture");
    let writer = match wav::WavWriter::new(&args[1]) {
        Ok(w) => Arc::new(w),
        Err(e) => {
            eprintln!("wasapi-audio: 创建输出文件失败: {e}");
            exit(1);
        }
    };

    // 采集线程（COM 在本线程内初始化/释放）；失败打 stderr 非零退出
    let cap_writer = writer.clone();
    let cap_handle = thread::spawn(move || capture::run(cap_writer, device_filter, capture_mode, t0));

    // 关停通道：stdin EOF（父进程停止或意外死亡时 pipe 断开都会触发）。
    // 读到任意字节或 EOF 都视为停止指令；用裸线程阻塞 read，与 sck-audio 同策略。
    let stop_writer = writer.clone();
    thread::spawn(move || {
        use std::io::Read;
        let mut buf = [0u8; 1];
        let _ = std::io::stdin().read(&mut buf);
        stop_writer.finalize();
        vb::restore_routing();
        exit(0);
    });

    match cap_handle.join() {
        Ok(Ok(())) => {} // 正常结束（实际不会走到，采集循环只在出错时返回）
        Ok(Err(e)) => {
            eprintln!("wasapi-audio: 采集中断: {e}");
            writer.finalize();
            vb::restore_routing();
            exit(1);
        }
        Err(_) => {
            eprintln!("wasapi-audio: 采集线程 panic");
            writer.finalize();
            vb::restore_routing();
            exit(1);
        }
    }
    writer.finalize();
    vb::restore_routing();
}
