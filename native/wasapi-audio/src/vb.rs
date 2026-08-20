//! VB-Audio 虚拟设备绕行（Voicemeeter / VB-Cable 用户）：
//! VB 虚拟渲染设备（"Voicemeeter Input" 等）的 WASAPI loopback tap 实测返回全零
//! （驱动怪异行为，Chromium loopback 同样中招），必须改采其对应的采集端点
//! （"Voicemeeter Out B1" 等总线镜像）。对应关系：
//!   "Voicemeeter Input"       → "Voicemeeter Out B1"（Strip[VAIO].B1 路由需打开）
//!   "Voicemeeter AUX Input"   → "Voicemeeter Out B2"
//!   "Voicemeeter VAIO3 Input" → "Voicemeeter Out B3"
//!   "CABLE Input" (VB-Cable)  → "CABLE Output"（无需额外路由）
//! Voicemeeter 的 Bx 条带路由默认可能关闭：通过 Voicemeeter Remote API 临时打开，
//! 录制停止时恢复原值（进程退出前调用 restore_routing）。

use std::ffi::{c_char, c_float, c_long};
use std::sync::Mutex;

use windows::Win32::Devices::FunctionDiscovery::PKEY_Device_FriendlyName;
use windows::Win32::Foundation::HMODULE;
use windows::Win32::Media::Audio::{DEVICE_STATE_ACTIVE, IMMDevice, IMMDeviceEnumerator, eCapture, eConsole, eRender};
use windows::Win32::System::Com::STGM_READ;
use windows::Win32::System::Com::StructuredStorage::PROPVARIANT;
use windows::Win32::UI::Shell::PropertiesSystem::IPropertyStore;
use windows::Win32::System::LibraryLoader::{GetProcAddress, LoadLibraryW};
use windows::Win32::System::Variant::VT_LPWSTR;
use windows::core::{Error, HRESULT, PCSTR, PCWSTR, Result};

const VM_REMOTE_DLL: &str = r"C:\Program Files (x86)\VB\Voicemeeter\VoicemeeterRemote64.dll";

/// (渲染端名, 采集端名, 总线名) —— 总线名为 None 表示无需路由（VB-Cable）
const VB_DEVICE_MAP: &[(&str, &str, Option<&str>)] = &[
    ("Voicemeeter VAIO3 Input", "Voicemeeter Out B3", Some("B3")),
    ("Voicemeeter AUX Input", "Voicemeeter Out B2", Some("B2")),
    ("Voicemeeter Input", "Voicemeeter Out B1", Some("B1")),
    ("CABLE Input", "CABLE Output", None),
];

/// 读取端点 friendly name
pub unsafe fn friendly_name(device: &IMMDevice) -> String {
    (|| -> Result<String> {
        let store: IPropertyStore = device.OpenPropertyStore(STGM_READ)?;
        let pv: PROPVARIANT = store.GetValue(&PKEY_Device_FriendlyName)?;
        // PROPVARIANT 是 packed 结构，字段需 read_unaligned
        let vt = std::ptr::addr_of!(pv.Anonymous.Anonymous.vt).read_unaligned();
        if vt != VT_LPWSTR {
            return Err(Error::new(HRESULT(-1), "friendly name 类型不是 LPWSTR"));
        }
        let p = std::ptr::addr_of!(pv.Anonymous.Anonymous.Anonymous.pwszVal).read_unaligned();
        Ok(PCWSTR(p.0 as *const u16).to_string()?)
    })()
    .unwrap_or_default()
}

/**
 * 默认渲染设备是 VB 虚拟设备时，返回应改采的采集端点（并确保 Voicemeeter 总线路由打开）。
 * 不是 VB 设备 / 找不到对应采集端点 → None（调用方回退标准 loopback）。
 */
pub unsafe fn resolve_capture_endpoint(enumerator: &IMMDeviceEnumerator) -> Option<IMMDevice> {
    let default_render = enumerator.GetDefaultAudioEndpoint(eRender, eConsole).ok()?;
    let name = friendly_name(&default_render);
    let (_, capture_name, bus) = VB_DEVICE_MAP
        .iter()
        .find(|(render_name, ..)| name.contains(render_name))?;
    eprintln!("wasapi-audio: 检测到 VB-Audio 虚拟默认设备 \"{name}\"，改采 \"{capture_name}\"");

    if let Some(bus) = bus {
        ensure_bus_routing(bus);
    }
    let collection = enumerator.EnumAudioEndpoints(eCapture, DEVICE_STATE_ACTIVE).ok()?;
    for i in 0..collection.GetCount().ok()? {
        if let Ok(dev) = collection.Item(i) {
            if friendly_name(&dev).contains(capture_name) {
                return Some(dev);
            }
        }
    }
    eprintln!("wasapi-audio: 未找到采集端点 \"{capture_name}\"，回退 loopback（可能是静音）");
    None
}

// ── Voicemeeter Remote API（确保 Strip[VAIO 主输入].Bx = 1，录制后恢复） ──

struct Remote {
    set_param: unsafe extern "C" fn(*const c_char, c_float) -> c_long,
    get_param: unsafe extern "C" fn(*const c_char, *mut c_float) -> c_long,
    get_type: unsafe extern "C" fn(*mut c_long) -> c_long,
    logout: unsafe extern "C" fn() -> c_long,
}

unsafe fn remote_connect() -> Result<Remote> {
    let wide: Vec<u16> = VM_REMOTE_DLL.encode_utf16().chain(std::iter::once(0)).collect();
    let h: HMODULE = LoadLibraryW(PCWSTR(wide.as_ptr()))?;
    macro_rules! sym {
        ($name:literal, $ty:ty) => {{
            let p: unsafe extern "system" fn() -> isize =
                GetProcAddress(h, PCSTR(concat!($name, "\0").as_ptr()))
                    .ok_or_else(|| Error::new(HRESULT(-1), concat!("缺少符号 ", $name)))?;
            std::mem::transmute::<unsafe extern "system" fn() -> isize, $ty>(p)
        }};
    }
    let login = sym!("VBVMR_Login", unsafe extern "C" fn() -> c_long);
    let r = Remote {
        set_param: sym!("VBVMR_SetParameterFloat", unsafe extern "C" fn(*const c_char, c_float) -> c_long),
        get_param: sym!("VBVMR_GetParameterFloat", unsafe extern "C" fn(*const c_char, *mut c_float) -> c_long),
        get_type: sym!("VBVMR_GetVoicemeeterType", unsafe extern "C" fn(*mut c_long) -> c_long),
        logout: sym!("VBVMR_Logout", unsafe extern "C" fn() -> c_long),
    };
    if login() != 0 {
        return Err(Error::new(HRESULT(-1), "Voicemeeter 未运行"));
    }
    Ok(r)
}

static RESTORE_PARAM: Mutex<Option<String>> = Mutex::new(None);

/// 录制停止/退出前恢复用户原有的路由配置（幂等）
pub fn restore_routing() {
    let param = RESTORE_PARAM.lock().unwrap().take();
    let Some(param) = param else { return };
    unsafe {
        if let Ok(r) = remote_connect() {
            let p = format!("{param}\0");
            (r.set_param)(p.as_ptr() as *const c_char, 0.0);
            // Remote 指令是异步投递的，客户端需保持登录片刻才会真正下发到引擎
            std::thread::sleep(std::time::Duration::from_millis(600));
            (r.logout)();
            eprintln!("wasapi-audio: 已恢复 Voicemeeter {param} = 0");
        }
    }
}

/// 打开 Strip[VAIO 主输入].<bus> 路由；原本已打开则不做事。Remote 不可用仅告警不阻断。
fn ensure_bus_routing(bus: &str) {
    unsafe {
        let r = match remote_connect() {
            Ok(r) => r,
            Err(e) => {
                eprintln!("wasapi-audio: Voicemeeter Remote 不可用（{e}），请在 Voicemeeter 中手动打开虚拟输入条带的 {bus} 按钮");
                return;
            }
        };
        let mut vm_type: c_long = 0;
        (r.get_type)(&mut vm_type);
        // 虚拟输入主条带索引：标准版=2，Banana=3，Potato=5
        let strip = match vm_type {
            1 => 2,
            3 => 5,
            _ => 3,
        };
        let param = format!("Strip[{strip}].{bus}");
        let p0 = format!("{param}\0");
        let mut cur: c_float = 0.0;
        (r.get_param)(p0.as_ptr() as *const c_char, &mut cur);
        // SET 只作用于引擎运行时（不写入用户持久配置，实测 GET 读的是 GUI 配置值），
        // 因此幂等：总是确保引擎侧为 1；仅当用户配置原本为 0 时才登记退出恢复。
        (r.set_param)(p0.as_ptr() as *const c_char, 1.0);
        // Remote 指令异步投递：保持登录 ~800ms 确保下发（实测立即 logout 指令会被丢弃）
        std::thread::sleep(std::time::Duration::from_millis(800));
        if cur == 1.0 {
            eprintln!("wasapi-audio: Voicemeeter {param} 路由已打开");
        } else {
            *RESTORE_PARAM.lock().unwrap() = Some(param.clone());
            eprintln!("wasapi-audio: 已临时打开 Voicemeeter {param}（录制结束后恢复）");
        }
        (r.logout)();
    }
}
