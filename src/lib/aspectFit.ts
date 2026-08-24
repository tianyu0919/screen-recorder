/** 等比居中适配：内容按宽高比缩放进容器并居中，返回目标矩形（容器坐标系）。 */
export function fitRectCentered(
  containerWidth: number,
  containerHeight: number,
  contentWidth: number,
  contentHeight: number
): { x: number; y: number; width: number; height: number } {
  if (contentWidth <= 0 || contentHeight <= 0 || containerWidth <= 0 || containerHeight <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }
  const scale = Math.min(containerWidth / contentWidth, containerHeight / contentHeight)
  const width = contentWidth * scale
  const height = contentHeight * scale
  return {
    x: (containerWidth - width) / 2,
    y: (containerHeight - height) / 2,
    width,
    height
  }
}
