//! 流式 WAV 写入（48kHz/2ch/int16）：先写占位 header，退出时 patch dataSize。
//! 与 sck-audio 的 WavWriter 行为一致；append/finalize 线程安全（采集线程与
//! stdin 监听线程并发调用），finalize 幂等。

use std::fs::File;
use std::io::{self, Seek, SeekFrom, Write};
use std::sync::Mutex;

pub const SAMPLE_RATE: u32 = 48000;
pub const CHANNELS: u16 = 2;

pub struct WavWriter {
    inner: Mutex<Inner>,
}

struct Inner {
    file: File,
    data_bytes: u32,
    closed: bool,
}

impl WavWriter {
    pub fn new(path: &str) -> io::Result<Self> {
        let mut file = File::create(path)?;
        file.write_all(&header(0))?;
        Ok(Self {
            inner: Mutex::new(Inner {
                file,
                data_bytes: 0,
                closed: false,
            }),
        })
    }

    /// 追加 int16 交错采样（小端）
    pub fn append(&self, pcm: &[i16]) {
        let mut g = self.inner.lock().unwrap();
        if g.closed {
            return;
        }
        let mut buf = Vec::with_capacity(pcm.len() * 2);
        for s in pcm {
            buf.extend_from_slice(&s.to_le_bytes());
        }
        if g.file.write_all(&buf).is_ok() {
            g.data_bytes = g.data_bytes.saturating_add(buf.len() as u32);
        }
    }

    /// patch header 并落盘；幂等（stdin 路径与异常退出都可能调用）
    pub fn finalize(&self) {
        let mut g = self.inner.lock().unwrap();
        if g.closed {
            return;
        }
        g.closed = true;
        let data_bytes = g.data_bytes;
        let _ = g.file.seek(SeekFrom::Start(0));
        let _ = g.file.write_all(&header(data_bytes));
        let _ = g.file.sync_all();
    }
}

/// 标准 44 字节 PCM WAV header（int16 交错）
fn header(data_bytes: u32) -> [u8; 44] {
    let mut h = [0u8; 44];
    let byte_rate = SAMPLE_RATE * CHANNELS as u32 * 2;
    h[0..4].copy_from_slice(b"RIFF");
    h[4..8].copy_from_slice(&(36 + data_bytes).to_le_bytes());
    h[8..12].copy_from_slice(b"WAVE");
    h[12..16].copy_from_slice(b"fmt ");
    h[16..20].copy_from_slice(&16u32.to_le_bytes());
    h[20..22].copy_from_slice(&1u16.to_le_bytes()); // PCM
    h[22..24].copy_from_slice(&CHANNELS.to_le_bytes());
    h[24..28].copy_from_slice(&SAMPLE_RATE.to_le_bytes());
    h[28..32].copy_from_slice(&byte_rate.to_le_bytes());
    h[32..34].copy_from_slice(&(CHANNELS * 2).to_le_bytes());
    h[34..36].copy_from_slice(&16u16.to_le_bytes());
    h[36..40].copy_from_slice(b"data");
    h[40..44].copy_from_slice(&data_bytes.to_le_bytes());
    h
}
