import { createRecordId } from './records'
import { isCompletedTaskStatus } from './taskStatus'

const dayMs = 24 * 60 * 60 * 1000

export function localToday() {
  return toLocalDate(new Date())
}

export function toLocalDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return toLocalDate(new Date())
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function nowIso() {
  return new Date().toISOString()
}

export function getRecordDate(record, fallbackDate = localToday()) {
  const value = record?.date || record?.startedAt || record?.createdAt || record?.endedAt || record?.completedAt || record?.reviewDate
  return value ? String(value).slice(0, 10) : fallbackDate
}

export function normalizeDatedRecord(record, fallbackDate = localToday()) {
  const date = getRecordDate(record, fallbackDate)
  return {
    ...record,
    date,
    createdAt: record?.createdAt || date,
  }
}

export function startOfWeek(dateString = localToday()) {
  const date = parseLocalDate(dateString)
  const day = date.getDay() || 7
  date.setDate(date.getDate() - day + 1)
  return toLocalDate(date)
}

export function endOfWeek(dateString = localToday()) {
  const date = parseLocalDate(startOfWeek(dateString))
  date.setDate(date.getDate() + 6)
  return toLocalDate(date)
}

export function getWeekDays(dateString = localToday()) {
  const start = parseLocalDate(startOfWeek(dateString))
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return toLocalDate(date)
  })
}

export function isDateInRange(dateString, startDate, endDate) {
  return dateString >= startDate && dateString <= endDate
}

export function isDateInWeek(dateString, weekDate = localToday()) {
  return isDateInRange(dateString, startOfWeek(weekDate), endOfWeek(weekDate))
}

export function monthOf(dateString = localToday()) {
  return String(dateString).slice(0, 7)
}

export function formatMonthLabel(month) {
  const [year, monthNumber] = String(month).split('-')
  return `${year}年${Number(monthNumber)}月`
}

export function getWeekIndexInMonth(weekStart) {
  const firstDay = `${monthOf(weekStart)}-01`
  const firstWeekStart = startOfWeek(firstDay)
  return Math.floor((parseLocalDate(weekStart) - parseLocalDate(firstWeekStart)) / (7 * dayMs)) + 1
}

export function summarizeDate(date, data) {
  const tasks = safeArray(data.tasks).map((task) => normalizeDatedRecord(task, date))
  const focusSessions = safeArray(data.focusSessions).map((session) => normalizeDatedRecord(session, date))
  const evidenceItems = safeArray(data.evidenceItems).map((item) => normalizeDatedRecord(item, date))
  const knowledgeCards = safeArray(data.knowledgeCards).map((card) => normalizeDatedRecord(card, date))
  const reviews = safeArray(data.reviews).map((review) => normalizeDatedRecord(review, date))

  const dayTasks = tasks.filter((task) => getRecordDate(task, date) === date)
  const dayFocusSessions = focusSessions.filter((session) => getRecordDate(session, date) === date)
  const dayEvidenceItems = evidenceItems.filter((item) => getRecordDate(item, date) === date)
  const dayKnowledgeCards = knowledgeCards.filter((card) => getRecordDate(card, date) === date)
  const dayReviews = reviews.filter((review) => getRecordDate(review, date) === date)
  const completedTasks = dayTasks.filter((task) => isCompletedTaskStatus(task.status))

  return {
    date,
    taskIds: dayTasks.map((task) => task.id).filter(Boolean),
    completedTaskIds: completedTasks.map((task) => task.id).filter(Boolean),
    focusSessionIds: dayFocusSessions.map((session) => session.id).filter(Boolean),
    evidenceIds: dayEvidenceItems.map((item) => item.id).filter(Boolean),
    knowledgeCardIds: dayKnowledgeCards.map((card) => card.id).filter(Boolean),
    reviewIds: dayReviews.map((review) => review.id).filter(Boolean),
    summary: {
      totalTasks: dayTasks.length,
      completedTasks: completedTasks.length,
      totalFocusMinutes: dayFocusSessions.reduce((sum, session) => sum + Number(session.actualMinutes || 0), 0),
      evidenceCount: dayEvidenceItems.length,
      knowledgeCardCount: dayKnowledgeCards.length,
      reviewCount: dayReviews.length,
    },
    items: {
      tasks: dayTasks,
      focusSessions: dayFocusSessions,
      evidenceItems: dayEvidenceItems,
      knowledgeCards: dayKnowledgeCards,
      reviews: dayReviews,
    },
  }
}

export function buildDailyLog(date, data, existingLog) {
  const summary = summarizeDate(date, data)
  const timestamp = nowIso()
  return {
    id: existingLog?.id || `daily-log-${date}`,
    date,
    taskIds: summary.taskIds,
    completedTaskIds: summary.completedTaskIds,
    focusSessionIds: summary.focusSessionIds,
    evidenceIds: summary.evidenceIds,
    knowledgeCardIds: summary.knowledgeCardIds,
    reviewIds: summary.reviewIds,
    summary: summary.summary,
    createdAt: existingLog?.createdAt || timestamp,
    updatedAt: timestamp,
  }
}

export function upsertDailyLog(logs, date, data) {
  const safeLogs = safeArray(logs)
  const existingLog = safeLogs.find((log) => log.date === date)
  const nextLog = buildDailyLog(date, data, existingLog)
  if (existingLog) return safeLogs.map((log) => (log.date === date ? nextLog : log))
  return [nextLog, ...safeLogs]
}

export function buildWeeklyArchive({ weekStart, dailyLogs, data, existingArchive }) {
  const weekEnd = endOfWeek(weekStart)
  const logs = getWeekDays(weekStart).map((date) => buildDailyLog(date, data, safeArray(dailyLogs).find((log) => log.date === date)))
  const timestamp = nowIso()
  const summary = logs.reduce(
    (total, log) => ({
      totalFocusMinutes: total.totalFocusMinutes + log.summary.totalFocusMinutes,
      completedTasks: total.completedTasks + log.summary.completedTasks,
      totalTasks: total.totalTasks + log.summary.totalTasks,
      evidenceCount: total.evidenceCount + log.summary.evidenceCount,
      knowledgeCardsCreated: total.knowledgeCardsCreated + log.summary.knowledgeCardCount,
      reviewCount: total.reviewCount + log.summary.reviewCount,
    }),
    emptyArchiveSummary(),
  )

  const weekIndexInMonth = getWeekIndexInMonth(weekStart)
  return {
    id: existingArchive?.id || `weekly-archive-${weekStart}`,
    weekIndexInMonth,
    label: `第${weekIndexInMonth}周`,
    weekStart,
    weekEnd,
    month: monthOf(weekStart),
    dailyLogDates: logs.map((log) => log.date),
    summary,
    reflection: existingArchive?.reflection || '',
    nextWeekSuggestion: existingArchive?.nextWeekSuggestion || '',
    source: existingArchive?.source || 'manual',
    createdAt: existingArchive?.createdAt || timestamp,
    updatedAt: timestamp,
  }
}

export function upsertWeeklyArchive(archives, archive) {
  const safeArchives = safeArray(archives)
  const exists = safeArchives.some((item) => item.weekStart === archive.weekStart)
  if (exists) return safeArchives.map((item) => (item.weekStart === archive.weekStart ? archive : item))
  return [archive, ...safeArchives]
}

export function buildMonthlyArchive({ month, weeklyArchives, existingArchive }) {
  const monthArchives = safeArray(weeklyArchives).filter((archive) => archive.month === month)
  const timestamp = nowIso()
  const summary = monthArchives.reduce(
    (total, archive) => ({
      totalFocusMinutes: total.totalFocusMinutes + Number(archive.summary?.totalFocusMinutes || 0),
      completedTasks: total.completedTasks + Number(archive.summary?.completedTasks || 0),
      totalTasks: total.totalTasks + Number(archive.summary?.totalTasks || 0),
      evidenceCount: total.evidenceCount + Number(archive.summary?.evidenceCount || 0),
      knowledgeCardsCreated: total.knowledgeCardsCreated + Number(archive.summary?.knowledgeCardsCreated || 0),
      reviewCount: total.reviewCount + Number(archive.summary?.reviewCount || 0),
    }),
    emptyArchiveSummary(),
  )

  return {
    id: existingArchive?.id || `monthly-archive-${month}`,
    month,
    label: formatMonthLabel(month),
    weekArchiveIds: monthArchives.map((archive) => archive.id),
    summary,
    reflection: existingArchive?.reflection || '',
    nextMonthSuggestion: existingArchive?.nextMonthSuggestion || '',
    source: existingArchive?.source || 'manual',
    createdAt: existingArchive?.createdAt || timestamp,
    updatedAt: timestamp,
  }
}

export function upsertMonthlyArchive(archives, archive) {
  const safeArchives = safeArray(archives)
  const exists = safeArchives.some((item) => item.month === archive.month)
  if (exists) return safeArchives.map((item) => (item.month === archive.month ? archive : item))
  return [archive, ...safeArchives]
}

export function emptyArchiveSummary() {
  return {
    totalFocusMinutes: 0,
    completedTasks: 0,
    totalTasks: 0,
    evidenceCount: 0,
    knowledgeCardsCreated: 0,
    reviewCount: 0,
  }
}

export function safeArray(value) {
  return Array.isArray(value) ? value : []
}

function parseLocalDate(dateString) {
  const [year, month, day] = String(dateString || localToday()).split('-').map(Number)
  return new Date(year, month - 1, day)
}
