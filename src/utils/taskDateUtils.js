import { localToday, toLocalDate } from './dateRecords'

export const TASK_RANGE_STATUS_LABELS = {
  pending: '待执行',
  active: '执行中',
  finished: '已完成',
}

export function getTaskStartDate(task, fallbackDate = localToday()) {
  return normalizeLocalDate(task?.startDate) ||
    normalizeLocalDate(task?.date) ||
    normalizeLocalDate(task?.createdAt) ||
    fallbackDate
}

export function getTaskEndDate(task, fallbackDate = localToday()) {
  const startDate = getTaskStartDate(task, fallbackDate)
  return normalizeLocalDate(task?.endDate) || normalizeLocalDate(task?.deadline) || startDate
}

export function isTaskActiveOnDate(task, date) {
  const targetDate = normalizeLocalDate(date) || localToday()
  const startDate = getTaskStartDate(task, targetDate)
  const endDate = getTaskEndDate(task, targetDate)
  return startDate <= targetDate && targetDate <= endDate
}

export function doesTaskOverlapRange(task, rangeStart, rangeEnd) {
  const start = normalizeLocalDate(rangeStart) || localToday()
  const end = normalizeLocalDate(rangeEnd) || start
  const taskStart = getTaskStartDate(task, start)
  const taskEnd = getTaskEndDate(task, start)
  return taskStart <= end && taskEnd >= start
}

export function getTaskRangeStatus(task, today = localToday()) {
  const targetDate = normalizeLocalDate(today) || localToday()
  const startDate = getTaskStartDate(task, targetDate)
  const endDate = getTaskEndDate(task, targetDate)

  if (targetDate < startDate) return 'pending'
  if (targetDate > endDate) return 'finished'
  return 'active'
}

export function getTaskRangeStatusLabel(status) {
  return TASK_RANGE_STATUS_LABELS[status] || TASK_RANGE_STATUS_LABELS.active
}

export function normalizeLocalDate(value) {
  if (!value) return ''
  if (value instanceof Date) return toLocalDate(value)
  const text = String(value)
  const match = text.match(/^\d{4}-\d{2}-\d{2}/)
  if (match) return match[0]
  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? '' : toLocalDate(parsed)
}
