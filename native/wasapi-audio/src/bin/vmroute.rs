//! 调试探针（不进交付物）：Voicemeeter Remote API —— 读取/设置条带路由与总线电平。
//! 用法:
//!   vmroute                      打印 Strip[3].A1/B1 状态与 A1/B1 总线峰值电平
//!   vmroute b1 on|off          打开/关闭 Strip[3]（VAIO 虚拟输入条带）→ B1 路由

use std::ffi::{CString, c_char, c_float, c_long};

use windows::core::Result;
use windows::Win32::Foundation::HMODULE;
use windows::Win32::System::LibraryLoader::{GetProcAddress, LoadLibraryW};
use windows::core::PCSTR;

const DLL: &str = r"C:\Program Files (x86)\VB\Voicemeeter\VoicemeeterRemote64.dll";

#[allow(non_snake_case)]
struct Remote {
    _h: HMODULE,
    login: unsafe extern "C" fn() -> c_long,
    logout: unsafe extern "C" fn() -> c_long,
    set_param: unsafe extern "C" fn(*const c_char, c_float) -> c_long,
    get_param: unsafe extern "C" fn(*const c_char, *mut c_float) -> c_long,
    get_level: unsafe extern "C" fn(c_long, c_long, *mut c_float) -> c_long,
    get_vm_type: unsafe extern "C" fn(*mut c_long) -> c_long,
}

macro_rules! sym {
    ($h:expr, $name:literal, $ty:ty) => {{
        let p = GetProcAddress($h, PCSTR(concat!($name, "\0").as_ptr()));
        let p: unsafe extern "system" fn() -> isize = p.ok_or_else(|| {
            windows::core::Error::new(windows::core::HRESULT(-1), concat!("缺少符号 ", $name))
        })?;
        std::mem::transmute::<unsafe extern "system" fn() -> isize, $ty>(p)
    }};
}

unsafe fn load() -> Result<Remote> {
    let wide: Vec<u16> = DLL.encode_utf16().chain(std::iter::once(0)).collect();
    let h = LoadLibraryW(windows::core::PCWSTR(wide.as_ptr()))?;
    Ok(Remote {
        _h: h,
        login: sym!(h, "VBVMR_Login", unsafe extern "C" fn() -> c_long),
        logout: sym!(h, "VBVMR_Logout", unsafe extern "C" fn() -> c_long),
        set_param: sym!(h, "VBVMR_SetParameterFloat", unsafe extern "C" fn(*const c_char, c_float) -> c_long),
        get_param: sym!(h, "VBVMR_GetParameterFloat", unsafe extern "C" fn(*const c_char, *mut c_float) -> c_long),
        get_level: sym!(h, "VBVMR_GetLevel", unsafe extern "C" fn(c_long, c_long, *mut c_float) -> c_long),
        get_vm_type: sym!(h, "VBVMR_GetVoicemeeterType", unsafe extern "C" fn(*mut c_long) -> c_long),
    })
}

fn main() -> Result<()> {
    unsafe {
        let r = load()?;
        let rc = (r.login)();
        println!("login rc={rc}");
        if rc != 0 {
            return Ok(()); // rc=1 表示启动了 Voicemeeter，稍等再调也可，这里直接退出重跑
        }
        let mut vm_type: c_long = 0;
        (r.get_vm_type)(&mut vm_type);
        println!("voicemeeter type={vm_type}（1=标准 2=Banana 3=Potato）");

        // Potato 虚拟输入条带从索引 5 起（Banana 从 3 起）；用命令行可选指定
        // watch 模式：vmroute watch <秒数> —— 每秒打印 A1/B1 总线峰值，观察引擎实时状态
        let arg1 = std::env::args().nth(1);
        let arg2 = std::env::args().nth(2);
        if arg1.as_deref() == Some("watch") {
            let secs: u64 = arg2.as_deref().and_then(|s| s.parse().ok()).unwrap_or(10);
            // 总线索引：Banana A1=0..A3=2, B1=3；Potato A1=0..A5=4, B1=5
            let b1_bus: c_long = if vm_type == 3 { 5 } else { 3 };
            for _ in 0..secs {
                let mut a1: c_float = -200.0;
                let mut b1: c_float = -200.0;
                (r.get_level)(3, 0, &mut a1); // A1 L
                (r.get_level)(3, b1_bus * 8, &mut b1); // B1 L
                let mut v: c_float = -1.0;
                let p = CString::new("Strip[3].B1").unwrap();
                (r.get_param)(p.as_ptr(), &mut v);
                println!("A1={a1:.2} B1={b1:.2}  Strip[3].B1(get)={v}");
                std::thread::sleep(std::time::Duration::from_secs(1));
            }
            (r.logout)();
            return Ok(());
        }

        let strip: i64 = std::env::args().nth(3).and_then(|s| s.parse().ok()).unwrap_or(3);
        if let (Some(bus), Some(state)) = (arg1.as_deref(), arg2.as_deref()) {
            // bus 直接作为参数名段（如 B1 / Mute / Gain），支持任意参数验证写入是否生效
            let name = CString::new(format!("Strip[{strip}].{}", bus)).unwrap();
            let v: c_float = if state == "on" { 1.0 } else { 0.0 };
            let rc = (r.set_param)(name.as_ptr(), v);
            std::thread::sleep(std::time::Duration::from_millis(800));
            println!("set {} = {} rc={rc}", name.to_string_lossy(), v);
        }

        for p in ["A1", "B1", "B2"] {
            let name = CString::new(format!("Strip[{strip}].{p}")).unwrap();
            let mut v: c_float = -1.0;
            let rc = (r.get_param)(name.as_ptr(), &mut v);
            println!("Strip[{strip}].{p} = {v} (rc={rc})");
        }
        // 总线峰值电平（type 3 = output bus peak，线性 0..1；Banana B1=bus3，Potato B1=bus5）
        let b1_bus: c_long = if vm_type == 3 { 5 } else { 3 };
        for (label, bus) in [("A1", 0i32), ("B1", b1_bus)] {
            let mut l: c_float = -200.0;
            let mut rr: c_float = -200.0;
            (r.get_level)(3, bus * 8, &mut l);
            (r.get_level)(3, bus * 8 + 1, &mut rr);
            println!("bus {label} peak L={l:.3} R={rr:.3}");
        }
        (r.logout)();
    }
    Ok(())
}
