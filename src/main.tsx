import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { initTheme } from './store/themeStore'
import './index.css'

// 渲染前应用主题（CSP 禁止内联脚本，无法像网页一样在 <head> 里预置）
initTheme()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
