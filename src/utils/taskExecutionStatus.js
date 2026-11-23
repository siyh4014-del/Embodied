import { getFocusSessionLocalDate, getFocusSessionMinutes } from './focusStats'
import {
  getTaskEndDate,
  getTaskRangeStatus,
  getTaskRangeStatusLabel,
  getTaskStartDate,
  isTaskActiveOnDate,
  normalizeLocalDate,
} from './taskDateUtils'

export { getTaskEndDate, getTaskRangeStatus, getTaskRangeStatusLabel, getTaskStartDate }

export const DAILY_EXECUTION_STATUS = {
  not_started: { id: 'not_started', dot: '❤️', label: '今日未启动' },
  in_progress: { id: 'in_progress', dot: '🟡', label: '今日进行中' },
  closed_out: { id: 'closed_out', dot: '🟢', label: '今日已收尾' },
}

export function isTaskActiveToday(task, today) {
  return isTaskActiveOnDate(task, today)
}

export function wasTaskCreatedToday(task, today) {
  const createdDate = normalizeLocalDate(task?.createdAt || task?.date || task?.startDate)
  return createdDate === today
}

export function getDailyExecutionStatus(task, today, focusSessions, activeFocusSession) {
  const todaySessions = getTodayTaskFocusSessions(task, today, focusSessions)
  const activeMatches = Boolean(
    activeFocusSession?.taskId && task?.id && activeFocusSession.taskId === task.id,
  )
  const hasClosedOut = todaySessions.some(isClosedOutSession)

  if (hasClosedOut) return DAILY_EXECUTION_STATUS.closed_out
  if (activeMatches || todaySessions.length > 0) return DAILY_EXECUTION_STATUS.in_progress
  return DAILY_EXECUTION_STATUS.not_started
}

export function getTodayTaskFocusSessions(task, today, focusSessions) {
  const safeSessions = Array.isArray(focusSessions) ? focusSessions : []
  const taskId = task?.id
  const taskTitle = task?.title
  const matchedByIdIds = new Set()
  const byId = safeSessions.filter((session) => {
    const matches = Boolean(taskId && session?.taskId === taskId)
    if (matches && session?.id) matchedByIdIds.add(session.id)
    return matches && getFocusSessionLocalDate(session, today) === today
  })
  const byTitle = safeSessions.filter((session) => {
    if (!taskTitle || session?.taskId) return false
    if (session?.id && matchedByIdIds.has(session.id)) return false
    const sessionTitle = session?.taskTitle || session?.label
    return sessionTitle === taskTitle && getFocusSessionLocalDate(session, today) === today
  })
  return [...byId, ...byTitle]
}

export function getTodayFocusedMinutesForTask(task, today, focusSessions) {
  return Math.min(
    180,
    getTodayTaskFocusSessions(task, today, focusSessions).reduce(
      (sum, session) => sum + getFocusSessionMinutes(session),
      0,
    ),
  )
}

export function isClosedOutSession(session) {
  if (!session) return false
  if (session.closedOut || session.closeoutSubmitted || session.completedToday) return true
  if (session.closeoutAt || session.closeoutDate) return true
  return false
}
