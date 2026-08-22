; 保留 electron-builder 默认 NSIS 安装/卸载与自动更新流程，仅扩展品牌页面。
!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "欢迎安装 Lenza"
  !define MUI_WELCOMEPAGE_TEXT "Lenza 是一款专业、轻量的桌面录屏工具。安装向导将引导你选择用户范围与安装位置。点击“下一步”继续。"
  !insertmacro MUI_PAGE_WELCOME
!macroend
