export function getFocusedMinutesByTask(focusSessions) {
  const safeFocusSessions = Array.isArray(focusSessions) ? focusSessions : []

  return safeFocusSessions.reduce((minutesByTask, session) => {
    if (!session.taskId) return minutesByTask
    const actualMinutes = getFocusSessionMinutes(session)
    minutesByTask.set(session.taskId, (minutesByTask.get(session.taskId) ?? 0) + actualMinutes)
    return minutesByTask
  }, new Map())
}

export function formatFocusedMinutes(totalMinutes) {
  const minutes = Number(totalMinutes || 0)
  if (minutes < 60) return `${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  const restMinutes = minutes % 60
  return restMinutes ? `${hours} 小时 ${restMinutes} 分钟` : `${hours} 小时`
}

export function getFocusSessionMinutes(session) {
  const explicitMinutes = Number(session.actualMinutes ?? 0)
  if (explicitMinutes > 0) return explicitMinutes

  const startedAt = session.startedAt || session.createdAt
  const endedAt = session.endedAt || session.completedAt
  if (startedAt && endedAt) {
    const start = new Date(startedAt)
    const end = new Date(endedAt)
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start) {
      return Math.max(1, Math.round((end - start) / 60000))
    }
  }

  const timeMatch = String(session.time || '').match(/\d+/)
  return timeMatch ? Number(timeMatch[0]) : 0
}

export function getFocusSessionLocalDate(session, fallbackDate = '') {
  const explicitDate = session?.date ? String(session.date).slice(0, 10) : ''
  if (explicitDate) return explicitDate
  const source = session?.startedAt || session?.createdAt || session?.endedAt || session?.completedAt
  return source ? formatLocalDate(source) : fallbackDate
}

export function getFocusSessionTimeRange(session) {
  const startedAt = session?.startedAt || session?.createdAt || ''
  const explicitEndedAt = session?.endedAt || session?.completedAt || ''
  const estimated = !explicitEndedAt && Boolean(startedAt)
  const endedAt = explicitEndedAt || estimateEndedAt(startedAt, getFocusSessionMinutes(session))

  if (!startedAt || !endedAt) {
    return {
      startTimeLocal: '',
      endTimeLocal: '',
      startedAt: '',
      endedAt: '',
      estimated,
      drawable: false,
    }
  }

  return {
    startTimeLocal: session?.startTimeLocal || formatLocalTime(startedAt),
    endTimeLocal: session?.endTimeLocal || formatLocalTime(endedAt),
    startedAt,
    endedAt,
    estimated,
    drawable: true,
  }
}

export function formatLocalDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatLocalTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

function estimateEndedAt(startedAt, actualMinutes) {
  const start = new Date(startedAt)
  if (Number.isNaN(start.getTime())) return ''
  return new Date(start.getTime() + Number(actualMinutes || 0) * 60000).toISOString()
}
