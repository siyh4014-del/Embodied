export function createRecordId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function upsertById(items, item) {
  const exists = items.some((currentItem) => currentItem.id === item.id)
  if (!exists) return [item, ...items]
  return items.map((currentItem) => (currentItem.id === item.id ? item : currentItem))
}

export function deleteById(items, id) {
  return items.filter((item) => item.id !== id)
}
