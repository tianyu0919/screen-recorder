import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertCircle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props { children: ReactNode; onBack(): void; onRetry(): void; canReload: boolean }
interface State { failed: boolean }

export class PreviewLoadBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State { return { failed: true } }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // 动态 chunk 错误不向用户暴露路径或堆栈；构建/运行日志由 Electron 捕获。
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6">
        <section className="w-full max-w-[420px] rounded-2xl border border-line bg-surface-1 p-5 text-center shadow-card" role="alert">
          <span className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent"><AlertCircle size={18} /></span>
          <h2 className="mt-3 text-sm font-semibold text-ink-1">预览编辑器加载失败</h2>
          <p className="mt-1.5 text-xs leading-5 text-ink-3">应用文件可能暂时不可用。你可以返回录制页，或在未录制时重新加载。</p>
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="outline" onClick={this.props.onBack}>返回录制</Button>
            <Button disabled={!this.props.canReload} onClick={this.props.onRetry}><RotateCcw size={14} />重新加载</Button>
          </div>
          {!this.props.canReload && <p className="mt-3 text-[11px] text-ink-3">请先结束当前录制，避免丢失正在写入的内容。</p>}
        </section>
      </div>
    )
  }
}
