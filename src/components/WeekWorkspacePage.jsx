import { useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, FileText, RotateCcw } from 'lucide-react'
import { storageKeys } from '../data/defaultData'
import {
  formatFocusedMinutes,
  getFocusSessionLocalDate,
  getFocusSessionMinutes,
  getFocusSessionTimeRange,
} from '../utils/focusStats'
import {
  buildMonthlyArchive,
  buildWeeklyArchive,
  formatMonthLabel,
  getWeekDays,
  localToday,
  monthOf,
  nowIso,
  startOfWeek,
  summarizeDate,
  toLocalDate,
  upsertDailyLog,
  upsertMonthlyArchive,
  upsertWeeklyArchive,
} from '../utils/dateRecords'
import { getTaskStatusLabel } from '../utils/taskStatus'

const weekLabels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

export function WeekWorkspacePage({
  tasks,
  focusSessions,
  evidenceItems,
  knowledgeCards,
  reviews,
  dailyLogs,
  setDailyLogs,
  weeklyArchives,
  setWeeklyArchives,
  monthlyArchives,
  setMonthlyArchives,
}) {
  const today = localToday()
  const [weekAnchor, setWeekAnchor] = useState(today)
  const [selectedDate, setSelectedDate] = useState(today)
  const [selectedMonth, setSelectedMonth] = useState(monthOf(today))
  const [archiveMessage, setArchiveMessage] = useState('')
  const [weeklyReportState, setWeeklyReportState] = useState({ loading: false, error: '', result: null })
  const weekStart = startOfWeek(weekAnchor)
  const weekDays = getWeekDays(weekAnchor)
  const month = monthOf(weekStart)
  const data = { tasks, focusSessions, evidenceItems, knowledgeCards, reviews }

  const daySummaries = useMemo(
    () => weekDays.map((date) => summarizeDate(date, data)),
    [weekDays.join('|'), tasks, focusSessions, evidenceItems, knowledgeCards, reviews],
  )
  const selectedDay = daySummaries.find((day) => day.date === selectedDate) ?? daySummaries[0]
  const currentWeekArchive = weeklyArchives.find((archive) => archive.weekStart === weekStart)
  const monthWeeklyArchives = weeklyArchives
    .filter((archive) => archive.month === month)
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
  const selectedMonthlyArchive = monthlyArchives.find((archive) => archive.month === selectedMonth)
  const weekSummary = daySummaries.reduce(
    (total, day) => ({
      totalTasks: total.totalTasks + day.summary.totalTasks,
      completedTasks: total.completedTasks + day.summary.completedTasks,
      totalFocusMinutes: total.totalFocusMinutes + day.summary.totalFocusMinutes,
      evidenceCount: total.evidenceCount + day.summary.evidenceCount,
      knowledgeCardCount: total.knowledgeCardCount + day.summary.knowledgeCardCount,
      reviewCount: total.reviewCount + day.summary.reviewCount,
    }),
    { totalTasks: 0, completedTasks: 0, totalFocusMinutes: 0, evidenceCount: 0, knowledgeCardCount: 0, reviewCount: 0 },
  )

  function moveWeek(offset) {
    const nextDate = new Date(`${weekStart}T00:00:00`)
    nextDate.setDate(nextDate.getDate() + offset * 7)
    const nextAnchor = toLocalDate(nextDate)
    setWeekAnchor(nextAnchor)
    setSelectedDate(nextAnchor)
  }

  function returnToToday() {
    setWeekAnchor(today)
    setSelectedDate(today)
  }

  function updateTodayLog() {
    setDailyLogs((logs) => upsertDailyLog(logs, today, data))
    setArchiveMessage('今日日志已更新。')
  }

  function generateWeeklyArchive() {
    let nextDailyLogs = dailyLogs
    weekDays.forEach((date) => {
      nextDailyLogs = upsertDailyLog(nextDailyLogs, date, data)
    })
    setDailyLogs(nextDailyLogs)

    setWeeklyArchives((archives) => {
      const existingArchive = archives.find((archive) => archive.weekStart === weekStart)
      const archive = buildWeeklyArchive({ weekStart, dailyLogs: nextDailyLogs, data, existingArchive })
      return upsertWeeklyArchive(archives, archive)
    })
    setArchiveMessage('本周归档已生成/更新。')
  }

  function generateMonthlyArchive() {
    setMonthlyArchives((archives) => {
      const existingArchive = archives.find((archive) => archive.month === month)
      const archive = buildMonthlyArchive({ month, weeklyArchives, existingArchive })
      setSelectedMonth(month)
      return upsertMonthlyArchive(archives, archive)
    })
    setArchiveMessage('本月归档已生成/更新。')
  }

  async function generateWeeklyHtmlReport() {
    const endDate = today
    const startDate = addDays(endDate, -6)
    const range = { startDate, endDate }

    setWeeklyReportState({ loading: true, error: '', result: null })

    try {
      const payload = {
        range,
        data: {
          tasks: filterRecordsForRange(readStorageArray(storageKeys.tasks), range),
          focusSessions: filterRecordsForRange(readStorageArray(storageKeys.focusSessions), range),
          evidenceItems: filterRecordsForRange(readStorageArray(storageKeys.evidenceItems), range),
          knowledgeCards: filterRecordsForRange(readStorageArray(storageKeys.knowledgeCards), range),
          reviews: filterRecordsForRange(readStorageArray(storageKeys.reviews), range),
          dailyLogs: filterRecordsForRange(readStorageArray(storageKeys.dailyLogs), range),
          weeklyArchives: filterWeeklyArchivesForRange(readStorageArray(storageKeys.weeklyArchives), range),
        },
      }

      const response = await fetch('/api/reports/weekly-html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        setWeeklyReportState({
          loading: false,
          error: result.error || result.detail || '周报生成失败，请稍后重试。',
          result: null,
        })
        return
      }

      setWeeklyReportState({ loading: false, error: '', result })
    } catch {
      setWeeklyReportState({
        loading: false,
        error: '周报服务不可用，请确认 npm run server 已启动。',
        result: null,
      })
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-wheat/50 bg-white/55 p-5 shadow-soft">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-sm font-medium text-sage">Week Workspace</p>
            <h2 className="mt-1 text-xl font-semibold text-ink">{formatMonthLabel(month)} · {weekStart}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <IconButton label="上一周" icon={ChevronLeft} onClick={() => moveWeek(-1)} />
            <IconButton label="回到本周" icon={RotateCcw} onClick={returnToToday} />
            <IconButton label="下一周" icon={ChevronRight} onClick={() => moveWeek(1)} />
            <button type="button" onClick={updateTodayLog} className="rounded-lg border border-wheat/70 bg-paper px-4 py-2.5 text-sm font-medium text-ink/75">
              更新今日日志
            </button>
            <button type="button" onClick={generateWeeklyArchive} className="rounded-lg bg-sage px-4 py-2.5 text-sm font-medium text-paper">
              生成/更新本周归档
            </button>
            <button type="button" onClick={generateMonthlyArchive} className="rounded-lg bg-clay px-4 py-2.5 text-sm font-medium text-paper">
              生成/更新本月归档
            </button>
          </div>
        </div>
        {archiveMessage && <p className="mt-4 rounded-lg bg-linen/70 px-4 py-3 text-sm text-ink/70">{archiveMessage}</p>}
      </section>

      <section className="grid gap-3 md:grid-cols-7">
        {daySummaries.map((day, index) => (
          <button
            key={day.date}
            type="button"
            onClick={() => setSelectedDate(day.date)}
            className={`rounded-lg border p-4 text-left transition ${
              selectedDate === day.date ? 'border-sage bg-linen shadow-soft' : 'border-wheat/50 bg-white/55 hover:bg-linen/50'
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sage">{weekLabels[index]}</p>
            <p className="mt-2 font-semibold text-ink">{day.date.slice(5)}</p>
            <div className="mt-3 space-y-1 text-xs text-ink/65">
              <p>任务 {day.summary.totalTasks} / 完成 {day.summary.completedTasks}</p>
              <p>专注 {day.summary.totalFocusMinutes} 分钟</p>
              <p>成果 {day.summary.evidenceCount}</p>
              <p>{day.summary.reviewCount > 0 ? '已复盘' : '未复盘'}</p>
            </div>
          </button>
        ))}
      </section>

      <WeeklyHtmlReportPanel state={weeklyReportState} onGenerate={generateWeeklyHtmlReport} />

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <DayDetail day={selectedDay} />
        <ArchivePanel
          month={month}
          weekSummary={weekSummary}
          currentWeekArchive={currentWeekArchive}
          monthWeeklyArchives={monthWeeklyArchives}
          monthlyArchives={monthlyArchives}
          selectedMonth={selectedMonth}
          selectedMonthlyArchive={selectedMonthlyArchive}
          onSelectMonth={setSelectedMonth}
        />
      </section>
    </div>
  )
}

function DayDetail({ day }) {
  const focusSessions = Array.isArray(day.items.focusSessions) ? day.items.focusSessions : []

  return (
    <section className="rounded-lg border border-wheat/50 bg-white/55 p-5 shadow-soft">
      <div className="mb-5 flex items-center gap-3">
        <CalendarDays className="h-5 w-5 text-sage" />
        <h3 className="text-lg font-semibold text-ink">{day.date} 详情</h3>
      </div>
      <DetailGroup title="当天任务" items={day.items.tasks} render={(task) => `${task.title} · ${getTaskStatusLabel(task.status)}`} />
      <div className="mb-5">
        <FocusTimeDial sessions={focusSessions} date={day.date} />
      </div>
      <DetailGroup title="成果证据" items={day.items.evidenceItems} render={(item) => `${item.type || 'Evidence'} · ${item.content || item.title || ''}`} />
      <DetailGroup title="知识卡" items={day.items.knowledgeCards} render={(card) => `${card.title} · ${card.source || '未标来源'}`} />
      <DetailGroup title="复盘" items={day.items.reviews} render={(review) => review.mainlineAdvanced || review.firstStepTomorrow || '已复盘'} />
    </section>
  )
}

function FocusTimeDial({ sessions, date }) {
  const segments = buildFocusDialSegments(sessions, date)
  const drawableCount = segments.filter((segment) => segment.drawable).length
  const missingCount = segments.length - drawableCount
  const colors = ['#8ea58c', '#c48f6a', '#7e9bb6', '#b59c66', '#9b8fb7']

  return (
    <div className="rounded-lg bg-linen/55 p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-sage">专注时间盘</p>
        <p className="text-xs text-ink/55">0:00-24:00</p>
      </div>
      <svg viewBox="0 0 320 320" role="img" aria-label={`${date} 专注时间盘`} className="mx-auto mt-3 h-auto w-full max-w-md">
        <circle cx="160" cy="160" r="108" fill="none" stroke="#eadfca" strokeWidth="18" />
        {[0, 6, 12, 18, 24].map((hour) => {
          const tick = pointOnCircle(160, 160, 108, minuteToAngle(hour * 60))
          const label = pointOnCircle(160, 160, hour === 24 ? 136 : 132, minuteToAngle(hour * 60))
          return (
            <g key={hour}>
              <circle cx={tick.x} cy={tick.y} r="3" fill="#6f7f5f" />
              <text x={label.x} y={label.y + 4} textAnchor="middle" className="fill-ink text-[11px]">
                {hour === 24 ? '24:00' : `${hour}:00`}
              </text>
            </g>
          )
        })}
        {segments.filter((segment) => segment.drawable).map((segment, index) => (
          <path
            key={`${segment.id}-${index}`}
            d={arcPath(160, 160, 108, minuteToAngle(segment.startMinute), minuteToAngle(segment.endMinute))}
            fill="none"
            stroke={colors[index % colors.length]}
            strokeWidth={segment.estimated ? 10 : 14}
            strokeLinecap="round"
            strokeDasharray={segment.estimated ? '4 6' : undefined}
          >
            <title>{`${segment.taskName} ${segment.startTime}-${segment.endTime} ${formatFocusedMinutes(segment.minutes)}`}</title>
          </path>
        ))}
      </svg>
      {segments.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-wheat/60 px-3 py-2 text-center text-sm text-ink/55">当天还没有专注记录</p>
      ) : (
        <div className="mt-3 space-y-2">
          {segments.map((segment, index) => (
            <div key={`${segment.id}-legend-${index}`} className="flex flex-wrap items-center gap-2 text-xs text-ink/65">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.drawable ? colors[index % colors.length] : '#d8ccb7' }} />
              <span className="font-medium text-ink/75">{segment.taskName}</span>
              <span>{segment.startTime && segment.endTime ? `${segment.startTime}-${segment.endTime}` : '时间未知'}</span>
              <span>{formatFocusedMinutes(segment.minutes)}</span>
              {segment.estimated && <span className="text-clay">估算</span>}
            </div>
          ))}
          {missingCount > 0 && <p className="text-xs text-clay">有 {missingCount} 条记录缺少开始/结束时间，未绘制到时间盘。</p>}
        </div>
      )}
    </div>
  )
}

function ArchivePanel({
  month,
  weekSummary,
  currentWeekArchive,
  monthWeeklyArchives,
  monthlyArchives,
  selectedMonth,
  selectedMonthlyArchive,
  onSelectMonth,
}) {
  return (
    <section className="rounded-lg border border-wheat/50 bg-white/55 p-5 shadow-soft">
      <h3 className="text-lg font-semibold text-ink">周归档 / 月归档</h3>
      <SummaryGrid summary={weekSummary} />
      <div className="mt-5">
        <p className="text-sm font-semibold text-sage">{formatMonthLabel(month)} 周归档</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {monthWeeklyArchives.map((archive) => (
            <span key={archive.id} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${archive.weekStart === currentWeekArchive?.weekStart ? 'bg-sage text-paper' : 'bg-linen text-ink/70'}`}>
              {archive.label}
            </span>
          ))}
          {monthWeeklyArchives.length === 0 && <span className="text-sm text-ink/55">本月还没有周归档。</span>}
        </div>
      </div>
      <div className="mt-5">
        <p className="text-sm font-semibold text-sage">月份归档</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {monthlyArchives.map((archive) => (
            <button key={archive.id} type="button" onClick={() => onSelectMonth(archive.month)} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${archive.month === selectedMonth ? 'bg-clay text-paper' : 'bg-linen text-ink/70'}`}>
              {archive.label}
            </button>
          ))}
          {monthlyArchives.length === 0 && <span className="text-sm text-ink/55">还没有月归档。</span>}
        </div>
      </div>
      {selectedMonthlyArchive && (
        <div className="mt-5 rounded-lg bg-linen/60 p-4">
          <p className="text-sm font-semibold text-ink">{selectedMonthlyArchive.label}</p>
          <SummaryGrid summary={selectedMonthlyArchive.summary} compact />
          <p className="mt-3 text-xs text-ink/55">包含 {selectedMonthlyArchive.weekArchiveIds.length} 个周归档。</p>
        </div>
      )}
    </section>
  )
}

function SummaryGrid({ summary, compact = false }) {
  const items = [
    ['专注分钟', summary.totalFocusMinutes],
    ['完成任务', summary.completedTasks],
    ['任务总数', summary.totalTasks],
    ['成果证据', summary.evidenceCount],
    ['知识卡', summary.knowledgeCardsCreated ?? summary.knowledgeCardCount],
    ['复盘', summary.reviewCount],
  ]

  return (
    <div className={`mt-4 grid gap-3 ${compact ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3'}`}>
      {items.map(([label, value]) => (
        <div key={label} className="rounded-lg bg-linen/60 p-3">
          <p className="text-xs text-ink/55">{label}</p>
          <p className="mt-1 text-lg font-semibold text-ink">{value || 0}</p>
        </div>
      ))}
    </div>
  )
}

function DetailGroup({ title, items, render }) {
  return (
    <div className="mb-5">
      <p className="text-sm font-semibold text-sage">{title}</p>
      <div className="mt-2 space-y-2">
        {items.length > 0 ? (
          items.map((item) => (
            <div key={item.id} className="rounded-lg bg-linen/60 px-3 py-2 text-sm text-ink/75">
              {render(item)}
            </div>
          ))
        ) : (
          <p className="rounded-lg border border-dashed border-wheat/60 px-3 py-2 text-sm text-ink/50">当天没有记录。</p>
        )}
      </div>
    </div>
  )
}

function buildFocusDialSegments(sessions, date) {
  return (Array.isArray(sessions) ? sessions : []).flatMap((session) => {
    const timeRange = getFocusSessionTimeRange(session)
    const minutes = getFocusSessionMinutes(session)
    const base = {
      id: session.id || `${session.taskId || 'focus'}-${session.createdAt || Math.random()}`,
      taskName: session.taskTitle || session.label || '未命名任务',
      startTime: timeRange.startTimeLocal,
      endTime: timeRange.endTimeLocal,
      minutes,
      estimated: timeRange.estimated,
      drawable: timeRange.drawable,
    }

    if (!timeRange.drawable) return [base]

    const startMinute = minuteOfDay(timeRange.startedAt)
    const endMinute = minuteOfDay(timeRange.endedAt)
    const startDate = getFocusSessionLocalDate({ date: '', startedAt: timeRange.startedAt }, date)
    const endDate = getFocusSessionLocalDate({ date: '', startedAt: timeRange.endedAt }, date)

    if (startMinute === null || endMinute === null) return [{ ...base, drawable: false }]
    if (startDate < date || endDate > date || endMinute < startMinute) {
      return [
        { ...base, startMinute, endMinute: 1440, drawable: startDate === date },
        { ...base, startMinute: 0, endMinute, drawable: endDate === date },
      ].filter((segment) => segment.drawable)
    }

    return [{ ...base, startMinute, endMinute: Math.max(startMinute + 1, endMinute) }]
  })
}

function minuteOfDay(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.getHours() * 60 + date.getMinutes()
}

function minuteToAngle(minute) {
  return (Math.max(0, Math.min(1440, minute)) / 1440) * 360
}

function pointOnCircle(cx, cy, radius, angle) {
  const radians = ((angle - 90) * Math.PI) / 180
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  }
}

function arcPath(cx, cy, radius, startAngle, endAngle) {
  const safeEndAngle = endAngle >= 360 ? 359.99 : endAngle
  const start = pointOnCircle(cx, cy, radius, startAngle)
  const end = pointOnCircle(cx, cy, radius, safeEndAngle)
  const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`
}

function IconButton({ label, icon: Icon, onClick }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-2 rounded-lg border border-wheat/70 bg-paper px-4 py-2.5 text-sm font-medium text-ink/75">
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )
}

function WeeklyHtmlReportPanel({ state, onGenerate }) {
  const summary = state.result?.summary

  return (
    <section className="rounded-lg border border-wheat/50 bg-white/55 p-5 shadow-soft">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm font-medium text-sage">七日周报</p>
          <h3 className="mt-1 text-lg font-semibold text-ink">生成最近七日 HTML 周报</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/62">
            从浏览器 localStorage 读取最近七天的任务、专注、成果、知识卡和复盘记录，保存为本地 HTML 文件。
          </p>
        </div>
        <button
          type="button"
          disabled={state.loading}
          onClick={onGenerate}
          className="inline-flex w-fit items-center gap-2 rounded-lg bg-sage px-4 py-2.5 text-sm font-medium text-paper disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FileText className="h-4 w-4" />
          {state.loading ? '正在生成周报...' : '生成最近七日周报'}
        </button>
      </div>

      {state.error && (
        <p className="mt-4 rounded-lg border border-clay/35 bg-linen/70 px-4 py-3 text-sm text-clay">
          {state.error}
        </p>
      )}

      {state.result && (
        <div className="mt-4 rounded-lg border border-wheat/50 bg-linen/55 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-ink">{state.result.fileName}</p>
              <p className="mt-1 text-sm text-ink/62">
                {state.result.range?.startDate} 至 {state.result.range?.endDate}
              </p>
              <p className="mt-2 text-sm text-ink/70">文件已保存到项目 weekly-reports 文件夹。</p>
            </div>
            {state.result.url && (
              <a
                href={state.result.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-fit items-center rounded-lg border border-wheat/70 bg-paper px-4 py-2.5 text-sm font-medium text-ink/75"
              >
                打开周报
              </a>
            )}
          </div>
          {summary && (
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <ReportMetric label="总专注" value={`${summary.totalFocusMinutes || 0} 分钟`} />
              <ReportMetric label="完成任务" value={`${summary.completedTasks || 0} / ${summary.totalTasks || 0}`} />
              <ReportMetric label="成果证据" value={summary.evidenceCount || 0} />
              <ReportMetric label="复盘次数" value={summary.reviewCount || 0} />
            </div>
          )}
          {state.result.aiAdviceAvailable === false && (
            <p className="mt-3 text-sm text-ink/58">AI 建议生成失败，但本周统计已生成。</p>
          )}
        </div>
      )}
    </section>
  )
}

function ReportMetric({ label, value }) {
  return (
    <div className="rounded-lg bg-paper/80 p-3">
      <p className="text-xs text-ink/55">{label}</p>
      <p className="mt-1 text-lg font-semibold text-ink">{value}</p>
    </div>
  )
}

function readStorageArray(key) {
  try {
    const value = window.localStorage.getItem(key)
    const parsed = value ? JSON.parse(value) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function filterRecordsForRange(records, range) {
  return records.filter((record) => {
    const date = getStoredRecordDate(record)
    return date >= range.startDate && date <= range.endDate
  })
}

function filterWeeklyArchivesForRange(records, range) {
  return records.filter((record) => {
    const start = record.weekStart || getStoredRecordDate(record)
    const end = record.weekEnd || start
    return start <= range.endDate && end >= range.startDate
  })
}

function getStoredRecordDate(record) {
  const value = record?.date || record?.createdAt || record?.completedAt || record?.reviewDate || record?.startedAt
  return value ? String(value).slice(0, 10) : ''
}

function addDays(dateString, offset) {
  const [year, month, day] = String(dateString).split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + offset)
  const nextYear = date.getFullYear()
  const nextMonth = String(date.getMonth() + 1).padStart(2, '0')
  const nextDay = String(date.getDate()).padStart(2, '0')
  return `${nextYear}-${nextMonth}-${nextDay}`
}
