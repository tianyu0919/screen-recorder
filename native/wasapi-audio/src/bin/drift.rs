//! 调试探针（不进交付物）：测量 mic.wav 与 system.wav 之间的延迟漂移。
//! 用法: drift.exe <dir>  —— 在 t≈10s 和 t≈100s 各取 2s 窗口做互相关，
//! 输出两个时间点的延迟（ms），差值即漂移量。

use std::fs;

fn read_wav(path: &str) -> (u32, u16, Vec<i16>) {
    let b = fs::read(path).unwrap();
    let ch = u16::from_le_bytes([b[22], b[23]]);
    let sr = u32::from_le_bytes([b[24], b[25], b[26], b[27]]);
    // 找 data chunk
    let mut off = 12usize;
    let mut data_off = 44usize;
    let mut data_len = b.len() - 44;
    while off + 8 <= b.len() {
        let id = &b[off..off + 4];
        let size = u32::from_le_bytes([b[off + 4], b[off + 5], b[off + 6], b[off + 7]]) as usize;
        if id == b"data" {
            data_off = off + 8;
            data_len = size.min(b.len() - data_off);
            break;
        }
        off += 8 + size + (size % 2);
    }
    let mut v = Vec::with_capacity(data_len / 2);
    for i in (data_off..data_off + data_len - 1).step_by(2) {
        v.push(i16::from_le_bytes([b[i], b[i + 1]]));
    }
    (sr, ch, v)
}

/// 取某声道、某秒起 len 秒的样本（单声道化）
fn window(samples: &[i16], ch: u16, sr: u32, at_s: f64, len_s: f64, c: usize) -> Vec<f64> {
    let start = (at_s * sr as f64) as usize * ch as usize;
    let len = (len_s * sr as f64) as usize;
    (0..len)
        .map(|i| {
            let idx = start + i * ch as usize + c.min(ch as usize - 1);
            samples.get(idx).copied().unwrap_or(0) as f64
        })
        .collect()
}

/// 降采样因子 ds 的互相关，搜 ±max_ms，返回 system 相对 mic 的延迟（ms，正=system 更晚）
fn delay_at(mic: &[i16], sys: &[i16], sr: u32, mic_ch: u16, sys_ch: u16, at_s: f64) -> f64 {
    let ds = 6usize; // 48k → 8k
    let sr_ds = sr as f64 / ds as f64;
    let len_s = 2.0;
    let len_ds = (len_s * sr_ds) as usize;
    let m = window(mic, mic_ch, sr, at_s, len_s, 0);
    let s = window(sys, sys_ch, sr, at_s, len_s + 1.0, 0); // system 多取 1s 余量
    let m_ds: Vec<f64> = m.chunks(ds).map(|c| c.iter().sum::<f64>() / ds as f64).collect();
    let s_ds: Vec<f64> = s.chunks(ds).map(|c| c.iter().sum::<f64>() / ds as f64).collect();
    let max_lag = (0.5 * sr_ds) as usize; // ±500ms
    let mut best_lag = 0i64;
    let mut best = f64::MIN;
    for lag in -(max_lag as i64)..=max_lag as i64 {
        let mut acc = 0.0;
        for i in 0..len_ds {
            let j = i as i64 + lag;
            if j < 0 || j >= s_ds.len() as i64 {
                continue;
            }
            acc += m_ds[i] * s_ds[j as usize];
        }
        if acc > best {
            best = acc;
            best_lag = lag;
        }
    }
    // lag > 0 表示 system 窗口内同一内容出现在更晚位置 → system 落后 mic
    best_lag as f64 / sr_ds * 1000.0
}

fn main() {
    let dir = std::env::args().nth(1).expect("用法: drift.exe <session_dir>");
    let (sr_m, ch_m, mic) = read_wav(&format!(r"{dir}\mic.wav"));
    let (sr_s, ch_s, sys) = read_wav(&format!(r"{dir}\system.wav"));
    println!("mic: {}s {}Hz {}ch", mic.len() as f64 / sr_m as f64 / ch_m as f64, sr_m, ch_m);
    println!("sys: {}s {}Hz {}ch", sys.len() as f64 / sr_s as f64 / ch_s as f64, sr_s, ch_s);
    for t in [10.0, 30.0, 60.0, 100.0] {
        let d = delay_at(&mic, &sys, sr_m, ch_m, ch_s, t);
        println!("t={t:>5.1}s  system 相对 mic 延迟: {d:+.1}ms");
    }
}
