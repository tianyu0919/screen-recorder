export const INITIAL_SESSION_COUNT = 20
export const SESSION_BATCH_SIZE = 20

export function nextSessionCount(current: number, total: number): number {
  return Math.min(Math.max(0, total), Math.max(INITIAL_SESSION_COUNT, current + SESSION_BATCH_SIZE))
}
