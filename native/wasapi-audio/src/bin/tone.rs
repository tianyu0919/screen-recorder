//! 调试探针（不进交付物）：向默认渲染设备（eConsole）用 WASAPI 播放 440Hz 正弦音 4 秒，
//! 与 loopback-test.ps1 配合做闭环验证——保证播放一定落在 helper 采集的同一个端点上。

use std::thread::sleep;
use std::time::{Duration, Instant};

use windows::core::Result;
use windows::Win32::Media::Audio::{
    AUDCLNT_SHAREMODE_SHARED, DEVICE_STATE_ACTIVE, IAudioClient, IAudioRenderClient, IMMDevice,
    IMMDeviceEnumerator, MMDeviceEnumerator, eConsole, eRender,
};
use windows::Win32::System::Com::{CLSCTX_ALL, COINIT_MULTITHREADED, CoCreateInstance, CoInitializeEx};

/// 可选参数：设备 id 子串，不传则用 eConsole 默认渲染设备
unsafe fn pick_device(enumerator: &IMMDeviceEnumerator, filter: Option<String>) -> Result<IMMDevice> {
    let Some(f) = filter else {
        return enumerator.GetDefaultAudioEndpoint(eRender, eConsole);
    };
    let collection = enumerator.EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE)?;
    for i in 0..collection.GetCount()? {
        let dev = collection.Item(i)?;
        if let Ok(id) = dev.GetId().and_then(|s| s.to_string().map_err(windows::core::Error::from)) {
            if id.contains(&f) {
                return Ok(dev);
            }
        }
    }
    Err(windows::core::Error::new(windows::core::HRESULT(-1), "no matching device"))
}

fn main() -> Result<()> {
    let filter = std::env::args().nth(1);
    unsafe {
        CoInitializeEx(None, COINIT_MULTITHREADED).ok()?;
        let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
        let device = pick_device(&enumerator, filter)?;
        let client: IAudioClient = device.Activate(CLSCTX_ALL, None)?;
        let fmt = client.GetMixFormat()?;
        let rate = (*fmt).nSamplesPerSec as f32;
        let ch = (*fmt).nChannels as usize;
        client.Initialize(AUDCLNT_SHAREMODE_SHARED, 0, 1_000_000, 0, fmt, None)?;
        let render: IAudioRenderClient = client.GetService()?;
        let buffer_frames = client.GetBufferSize()?;
        client.Start()?;

        let start = Instant::now();
        let mut phase: f32 = 0.0;
        let step = 2.0 * std::f32::consts::PI * 440.0 / rate;
        let mut written: u64 = 0;
        while start.elapsed() < Duration::from_secs(4) {
            sleep(Duration::from_millis(10));
            let pad = client.GetCurrentPadding()?;
            let avail = buffer_frames.saturating_sub(pad) as usize;
            if avail == 0 {
                continue;
            }
            let p = render.GetBuffer(avail as u32)?;
            let buf = std::slice::from_raw_parts_mut(p as *mut f32, avail * ch);
            for frame in buf.chunks_exact_mut(ch) {
                let v = phase.sin() * 0.5;
                for s in frame.iter_mut() {
                    *s = v;
                }
                phase = (phase + step) % (2.0 * std::f32::consts::PI);
            }
            render.ReleaseBuffer(avail as u32, 0)?;
            written += avail as u64;
        }
        client.Stop()?;
        eprintln!("tone: 写入 {written} 帧 @ {rate}Hz/{ch}ch（buffer={buffer_frames}）");
        println!("tone done");
    }
    Ok(())
}
