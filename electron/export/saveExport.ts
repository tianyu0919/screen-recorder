import { mkdir, open, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { ExportFormat } from '../../shared/types'

export async function saveExportWithoutOverwrite(
  directory: string,
  baseName: string,
  format: ExportFormat,
  data: ArrayBuffer
): Promise<string> {
  await mkdir(directory, { recursive: true })
  for (let index = 0; index < 10_000; index += 1) {
    const suffix = index === 0 ? '' : ` (${index})`
    const path = join(directory, `${baseName}${suffix}.${format}`)
    try {
      const file = await open(path, 'wx')
      try { await file.writeFile(Buffer.from(data)); await file.sync() }
      finally { await file.close() }
      return path
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        await rm(path, { force: true }).catch(() => {})
        throw error
      }
    }
  }
  throw new Error('同名导出文件过多，请清理目标目录后重试')
}
