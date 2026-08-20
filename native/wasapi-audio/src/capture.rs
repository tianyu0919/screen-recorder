//! WASAPI shared-mode loopback 采集：默认渲染设备（eConsole）混音 → 立体声 float32。
//! - 设备采样率 ≠ 48k 时用 rubato FftFixedIn（sinc 质量）重采样到 48k；
//! - 声道数 > 2（如 Voicemeeter VAIO 8ch）取 ch0/ch1 主立体声，单声道复制成双声道；
//! - 静音包（AUDCLNT_BUFFERFLAGS_SILENT）写零，不丢时长；
//! - 设备被拔出/失效时 GetBuffer 报错返回 Err，由 main 落盘后非零退出。

use std::sync::Arc;
use std::thread::sleep;
use std::time::Duration;

use rubato::{FftFixedIn, Resampler};
use windows::core::{Error, GUID, HRESULT, Result};
use windows::Win32::Media::Audio::{
    AUDCLNT_BUFFERFLAGS_SILENT, AUDCLNT_SHAREMODE_SHARED, AUDCLNT_STREAMFLAGS_LOOPBACK,
    DEVICE_STATE_ACTIVE, EDataFlow, IAudioCaptureClient, IAudioClient, IMMDevice, IMMDeviceEnumerator,
    MMDeviceEnumerator, WAVEFORMATEX, WAVEFORMATEXTENSIBLE, eCapture, eConsole, eRender,
};
use windows::Win32::System::Com::{CLSCTX_ALL, COINIT_MULTITHREADED, CoCreateInstance, CoInitializeEx};

use crate::vb;
use crate::wav::{SAMPLE_RATE, WavWriter};

const WAVE_FORMAT_IEEE_FLOAT_TAG: u16 = 3;
const WAVE_FORMAT_EXTENSIBLE_TAG: u16 = 0xFFFE;
/// KSDATAFORMAT_SUBTYPE_IEEE_FLOAT
const IEEE_FLOAT_GUID: GUID =
    GUID::from_values(0x00000003, 0x0000, 0x0010, [0x80, 0x00, 0x00, 0xaa, 0x00, 0x38, 0x9b, 0x71]);
/// 重采样输入块大小（帧）
const RESAMPLE_CHUNK: usize = 1024;

/// 选采集设备：不传 id 用 eConsole 默认渲染设备（loopback）；
/// 传 id 子串则枚举活跃端点匹配（调试/诊断用，`capture` 模式取采集端点）
unsafe fn pick_device(
    enumerator: &IMMDeviceEnumerator,
    filter: Option<&str>,
    flow: EDataFlow,
) -> Result<IMMDevice> {
    let Some(f) = filter else {
        return enumerator.GetDefaultAudioEndpoint(flow, eConsole);
    };
    let collection = enumerator.EnumAudioEndpoints(flow, DEVICE_STATE_ACTIVE)?;
    for i in 0..collection.GetCount()? {
        let dev = collection.Item(i)?;
        if let Ok(id) = dev.GetId().and_then(|s| s.to_string().map_err(Error::from)) {
            if id.contains(f) {
                return Ok(dev);
            }
        }
    }
    Err(Error::new(HRESULT(-1), format!("找不到匹配 {f} 的音频端点")))
}

pub fn run(
    writer: Arc<WavWriter>,
    device_filter: Option<String>,
    capture_mode: bool,
    t0: std::time::Instant,
) -> Result<()> {
    unsafe {
        CoInitializeEx(None, COINIT_MULTITHREADED).ok()?;
        let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;

        // VB-Audio 虚拟设备绕行：默认渲染设备是 Voicemeeter/VB-Cable 时 loopback tap 返回全零，
        // 改采对应的总线镜像采集端点（vb.rs）。仅默认路径生效，显式指定设备时不干预。
        let mut capture_mode = capture_mode;
        let device = if device_filter.is_none() && !capture_mode {
            match vb::resolve_capture_endpoint(&enumerator) {
                Some(dev) => {
                    capture_mode = true;
                    dev
                }
                None => enumerator.GetDefaultAudioEndpoint(eRender, eConsole)?,
            }
        } else {
            let flow = if capture_mode { eCapture } else { eRender };
            pick_device(&enumerator, device_filter.as_deref(), flow)?
        };
        let stream_flags = if capture_mode { 0 } else { AUDCLNT_STREAMFLAGS_LOOPBACK };
        let client: IAudioClient = device.Activate(CLSCTX_ALL, None)?;
        // fmt 由 COM 分配（CoTaskMem），进程一次性使用，随退出回收
        let fmt = client.GetMixFormat()?;
        let (src_rate, src_ch) = check_format(fmt)?;
        // 诊断：采集设备名 + 混音格式（stderr，父进程 pipe 到 console，不影响协议）
        let dev_id = device
            .GetId()
            .and_then(|id| id.to_string().map_err(Error::from))
            .unwrap_or_default();
        eprintln!(
            "wasapi-audio: 采集设备 {}（{}），混音格式 {src_rate}Hz/{src_ch}ch",
            vb::friendly_name(&device),
            dev_id
        );
        // 请求 100ms 缓冲（hns = 100ns 单位），轮询周期 5ms 远低于此，不会溢出
        client.Initialize(AUDCLNT_SHAREMODE_SHARED, stream_flags, 1_000_000, 0, fmt, None)?;
        let capture: IAudioCaptureClient = client.GetService()?;
        client.Start()?;

        // 启动延迟静音补齐：VB 绕行路径要等 Voicemeeter 引擎应用路由（~1s），
        // 视频/事件时间轴已从 t0 开始，补等长静音保持 system.wav 与画面对齐
        let pre_roll_frames = (t0.elapsed().as_secs_f64() * SAMPLE_RATE as f64) as usize;

        println!("listening");
        use std::io::Write as _;
        let _ = std::io::stdout().flush();

        let mut sink = SampleSink::new(src_rate, src_ch, writer);
        if pre_roll_frames > 0 {
            sink.push_silence(pre_roll_frames);
        }
        loop {
            sleep(Duration::from_millis(5));
            let mut packet = capture.GetNextPacketSize()?;
            while packet > 0 {
                let mut data: *mut u8 = std::ptr::null_mut();
                let mut frames: u32 = 0;
                let mut flags: u32 = 0;
                capture.GetBuffer(&mut data, &mut frames, &mut flags, None, None)?;
                if flags & (AUDCLNT_BUFFERFLAGS_SILENT.0 as u32) != 0 {
                    sink.push_silence(frames as usize);
                } else if !data.is_null() {
                    let samples =
                        std::slice::from_raw_parts(data as *const f32, frames as usize * src_ch);
                    sink.push(samples);
                }
                capture.ReleaseBuffer(frames)?;
                packet = capture.GetNextPacketSize()?;
            }
        }
    }
}

/// 校验混音格式必须是 float32（shared-mode 下事实标准；extensible 检查 SubFormat）
unsafe fn check_format(fmt: *const WAVEFORMATEX) -> Result<(u32, usize)> {
    let f = &*fmt;
    let is_float = if f.wFormatTag == WAVE_FORMAT_IEEE_FLOAT_TAG {
        f.wBitsPerSample == 32
    } else if f.wFormatTag == WAVE_FORMAT_EXTENSIBLE_TAG {
        // WAVEFORMATEXTENSIBLE 是 packed 结构，字段需 read_unaligned
        let ext = fmt as *const WAVEFORMATEXTENSIBLE;
        std::ptr::addr_of!((*ext).SubFormat).read_unaligned() == IEEE_FLOAT_GUID
    } else {
        false
    };
    if !is_float {
        return Err(Error::new(HRESULT(-1), "设备混音格式不是 float32，暂不支持"));
    }
    if f.nChannels == 0 {
        return Err(Error::new(HRESULT(-1), "设备混音格式声道数为 0"));
    }
    Ok((f.nSamplesPerSec, f.nChannels as usize))
}

#[inline]
fn f2i16(s: f32) -> i16 {
    let c = s.clamp(-1.0, 1.0);
    (if c < 0.0 { c * 32768.0 } else { c * 32767.0 }).round() as i16
}

/// 交错 float32 → 立体声帧（ch0/ch1；单声道复制）
fn downmix(samples: &[f32], src_ch: usize) -> impl Iterator<Item = (f32, f32)> + '_ {
    samples.chunks_exact(src_ch).map(move |frame| {
        let l = frame[0];
        let r = if src_ch > 1 { frame[1] } else { l };
        (l, r)
    })
}

/// 下混成立体声 + 可选重采样 + 写盘
struct SampleSink {
    src_ch: usize,
    writer: Arc<WavWriter>,
    resampler: Option<FftFixedIn<f32>>,
    /// 重采样输入缓冲（每声道独立，满 RESAMPLE_CHUNK 帧喂一次）
    pending: [Vec<f32>; 2],
}

impl SampleSink {
    fn new(src_rate: u32, src_ch: usize, writer: Arc<WavWriter>) -> Self {
        let resampler = if src_rate != SAMPLE_RATE {
            Some(
                FftFixedIn::new(src_rate as usize, SAMPLE_RATE as usize, RESAMPLE_CHUNK, 1, 2)
                    .expect("初始化重采样器失败"),
            )
        } else {
            None
        };
        Self {
            src_ch,
            writer,
            resampler,
            pending: [Vec::with_capacity(RESAMPLE_CHUNK * 2), Vec::with_capacity(RESAMPLE_CHUNK * 2)],
        }
    }

    fn push(&mut self, samples: &[f32]) {
        if self.resampler.is_some() {
            for (l, r) in downmix(samples, self.src_ch) {
                self.pending[0].push(l);
                self.pending[1].push(r);
            }
            self.drain_resampler();
        } else {
            let pcm: Vec<i16> =
                downmix(samples, self.src_ch).flat_map(|(l, r)| [f2i16(l), f2i16(r)]).collect();
            self.writer.append(&pcm);
        }
    }

    fn push_silence(&mut self, frames: usize) {
        if self.resampler.is_some() {
            for ch in &mut self.pending {
                ch.extend(std::iter::repeat(0.0).take(frames));
            }
            self.drain_resampler();
        } else {
            self.writer.append(&vec![0i16; frames * 2]);
        }
    }

    fn drain_resampler(&mut self) {
        let Some(r) = self.resampler.as_mut() else { return };
        while self.pending[0].len() >= RESAMPLE_CHUNK {
            let input = [
                self.pending[0].drain(..RESAMPLE_CHUNK).collect::<Vec<_>>(),
                self.pending[1].drain(..RESAMPLE_CHUNK).collect::<Vec<_>>(),
            ];
            let Ok(out) = r.process(&input, None) else { return };
            let frames = out[0].len().min(out[1].len());
            let mut pcm = Vec::with_capacity(frames * 2);
            for i in 0..frames {
                pcm.push(f2i16(out[0][i]));
                pcm.push(f2i16(out[1][i]));
            }
            self.writer.append(&pcm);
        }
    }
}
