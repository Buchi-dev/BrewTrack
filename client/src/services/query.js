export const DEFAULT_PAGE_SIZE = 10

export function getRange(page = 1, pageSize = DEFAULT_PAGE_SIZE) {
  const safePage = Math.max(Number(page) || 1, 1)
  const safePageSize = Math.max(Number(pageSize) || DEFAULT_PAGE_SIZE, 1)
  const from = (safePage - 1) * safePageSize

  return { from, to: from + safePageSize - 1 }
}

export function normalizeSearch(value) {
  return value?.trim() || ''
}
