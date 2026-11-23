import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive,
  BookOpenCheck,
  Brain,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  Focus,
  Gauge,
  HelpCircle,
  Inbox,
  Layers3,
  Library,
  ListChecks,
  NotebookPen,
  Search,
  Settings,
  Sparkles,
  CalendarDays,
  Target,
} from 'lucide-react'
import { CrudPanel } from './components/CrudPanel'
import { EvidenceLibraryPage } from './components/EvidenceLibraryPage'
import { FocusRoomPage } from './components/FocusRoomPage'
import { HelpPage } from './components/HelpPage'
import { KnowledgeCardsPage } from './components/KnowledgeCardsPage'
import { getLatestReview, hasReviewToday, ReviewPage } from './components/ReviewPage'
import { TaskBreakdownPage } from './components/TaskBreakdownPage'
import { WeekWorkspacePage } from './components/WeekWorkspacePage'
import {
  defaultDailyLogs,
  defaultEvidenceItems,
  defaultFocusSessions,
  defaultKnowledgeCards,
  defaultMonthlyArchives,
  defaultParkingItems,
  defaultReviews,
  defaultSettings,
  defaultTasks,
  defaultWeeklyArchives,
  storageKeys,
} from './data/defaultData'
import { useLocalStorage } from './hooks/useLocalStorage'
import {
  createBackupPayloadFromLocalStorage,
  downloadJson,
  restoreBackupToLocalStorage,
  validateBackupPayload,
} from './utils/backup'
import {
  formatFocusedMinutes,
  getFocusSessionLocalDate,
  getFocusSessionMinutes,
} from './utils/focusStats'
import {
  diffDays,
  getDueReviewCards,
  getKnowledgeCardCreatedDate,
  markKnowledgeCardReviewedToday,
} from './utils/knowledgeReview'
import { createRecordId, deleteById, upsertById } from './utils/records'
import { searchDashboardRecords } from './utils/search'
import { localToday, upsertDailyLog } from './utils/dateRecords'
import { normalizeTaskStatus } from './utils/taskStatus'
import {
  getTaskEndDate,
  getTaskRangeStatus,
  isTaskActiveOnDate,
  normalizeLocalDate,
} from './utils/taskDateUtils'
import {
  getDailyExecutionStatus,
  getTodayTaskFocusSessions,
  getTodayFocusedMinutesForTask,
  isClosedOutSession,
  isTaskActiveToday,
  wasTaskCreatedToday,
} from './utils/taskExecutionStatus'

const priorityRank = { P1: 1, P2: 2, P3: 3, P4: 4, P5: 5 }

const navigation = [
  { id: 'dashboard', label: 'Dashboard', title: 'Dashboard 首页', icon: Gauge },
  { id: 'week-workspace', label: 'Week Workspace', title: '周工作台', icon: CalendarDays },
  { id: 'task-breakdown', label: 'Task Breakdown', title: '任务拆解器', icon: ListChecks },
  { id: 'focus-room', label: 'Focus Room', title: '专注室', icon: Focus },
  { id: 'parking-lot', label: 'Parking Lot', title: '优化停车场', icon: Inbox },
  { id: 'knowledge-cards', label: 'Knowledge Cards', title: '知识消化卡', icon: BookOpenCheck },
  { id: 'evidence-library', label: 'Evidence Library', title: '成果证据库', icon: Library },
  { id: 'review', label: 'Review', title: '每日复盘', icon: NotebookPen },
  { id: 'help', label: 'Help', title: '使用说明', icon: HelpCircle },
]

const parkingFields = [
  { name: 'title', label: '优化事项', required: true },
  { name: 'tag', label: '分类标签', required: true },
  { name: 'owner', label: '处理时机', required: true },
]

function App() {
  const [activePage, setActivePage] = useState('dashboard')
  const backgroundInputRef = useRef(null)
  const importInputRef = useRef(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [backupMessage, setBackupMessage] = useState('')
  const [settings, setSettings] = useLocalStorage(storageKeys.settings, defaultSettings)
  const [tasks, setTasks] = useLocalStorage(storageKeys.tasks, defaultTasks)
  const [focusSessions, setFocusSessions] = useLocalStorage(storageKeys.focusSessions, defaultFocusSessions)
  const [parkingItems, setParkingItems] = useLocalStorage(storageKeys.parkingItems, defaultParkingItems)
  const [knowledgeCards, setKnowledgeCards] = useLocalStorage(storageKeys.knowledgeCards, defaultKnowledgeCards)
  const [evidenceItems, setEvidenceItems] = useLocalStorage(storageKeys.evidenceItems, defaultEvidenceItems)
  const [reviews, setReviews] = useLocalStorage(storageKeys.reviews, defaultReviews)
  const [dailyLogs, setDailyLogs] = useLocalStorage(storageKeys.dailyLogs, defaultDailyLogs)
  const [weeklyArchives, setWeeklyArchives] = useLocalStorage(storageKeys.weeklyArchives, defaultWeeklyArchives)
  const [monthlyArchives, setMonthlyArchives] = useLocalStorage(storageKeys.monthlyArchives, defaultMonthlyArchives)
  const [activeFocusSession, setActiveFocusSession] = useLocalStorage(storageKeys.activeFocusSession, null)
  const [feynmanRooms, setFeynmanRooms] = useLocalStorage(storageKeys.feynmanRooms, [])
  const [siteBackgroundImage, setSiteBackgroundImage] = useLocalStorage(storageKeys.siteBackgroundImage, '')
  const [trackedMainlineTasks, setTrackedMainlineTasks] = useLocalStorage(storageKeys.trackedMainlineTasks, [])
  const [mainlineContinuityRecords, setMainlineContinuityRecords] = useLocalStorage(storageKeys.mainlineContinuityRecords, {})
  const [taskCardOrder, setTaskCardOrder] = useLocalStorage(storageKeys.taskCardOrder, [])
  const [searchQuery, setSearchQuery] = useState('')

  const page = useMemo(
    () => navigation.find((item) => item.id === activePage) ?? navigation[0],
    [activePage],
  )

  const data = {
    settings,
    setSettings,
    tasks,
    setTasks,
    focusSessions,
    setFocusSessions,
    parkingItems,
    setParkingItems,
    knowledgeCards,
    setKnowledgeCards,
    evidenceItems,
    setEvidenceItems,
    reviews,
    setReviews,
    setActivePage,
    dailyLogs,
    setDailyLogs,
    weeklyArchives,
    setWeeklyArchives,
    monthlyArchives,
    setMonthlyArchives,
    activeFocusSession,
    setActiveFocusSession,
    feynmanRooms,
    setFeynmanRooms,
    trackedMainlineTasks,
    setTrackedMainlineTasks,
    mainlineContinuityRecords,
    setMainlineContinuityRecords,
    taskCardOrder,
    setTaskCardOrder,
  }

  useEffect(() => {
    const today = localToday()
    const dataForLog = { tasks, focusSessions, evidenceItems, knowledgeCards, reviews }
    setDailyLogs((logs) => upsertDailyLog(logs, today, dataForLog))
  }, [tasks, focusSessions, evidenceItems, knowledgeCards, reviews, setDailyLogs])

  const searchGroups = useMemo(
    () => searchDashboardRecords(data, searchQuery),
    [tasks, knowledgeCards, evidenceItems, reviews, searchQuery],
  )

  function handleSearchNavigate(pageId) {
    setActivePage(pageId)
    setSearchQuery('')
  }

  function handleBackgroundUpload(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) return

    const reader = new FileReader()
    reader.onload = () => {
      setSiteBackgroundImage(typeof reader.result === 'string' ? reader.result : '')
    }
    reader.readAsDataURL(file)
  }

  function handleExportData() {
    const today = localToday()
    const payload = createBackupPayloadFromLocalStorage(storageKeys)
    downloadJson(`growth-evidence-dashboard-backup-${today}.json`, payload)
    setBackupMessage('数据已导出为 JSON 文件。')
  }

  function handleImportClick() {
    importInputRef.current?.click()
  }

  async function handleImportData(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const confirmed = window.confirm('导入会覆盖当前本地数据。确认继续吗？')
    if (!confirmed) return

    try {
      const text = await file.text()
      const importedData = validateBackupPayload(JSON.parse(text))
      restoreBackupToLocalStorage(storageKeys, importedData)
      window.sessionStorage.setItem('growth-dashboard:backup-message', '数据导入成功，页面已刷新。')
      window.location.reload()
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : '导入失败，请检查 JSON 文件。')
    }
  }

  useEffect(() => {
    const message = window.sessionStorage.getItem('growth-dashboard:backup-message')
    if (message) {
      setBackupMessage(message)
      window.sessionStorage.removeItem('growth-dashboard:backup-message')
    }
  }, [])

  return (
    <div
      className="min-h-screen bg-paper text-ink"
      style={siteBackgroundImage ? {
        backgroundImage: `linear-gradient(rgba(251,250,245,.82), rgba(251,250,245,.82)), url(${siteBackgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      } : undefined}
    >
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-wheat/40 bg-linen/85 px-5 py-6 backdrop-blur lg:block">
          <Brand />
          <nav className="mt-8 space-y-1" aria-label="主导航">
            {navigation.map((item) => (
              <NavButton
                key={item.id}
                item={item}
                active={activePage === item.id}
                onClick={() => setActivePage(item.id)}
              />
            ))}
          </nav>
          <div className="mt-8 rounded-lg border border-wheat/50 bg-paper/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sage">Today Signal</p>
            <p className="mt-3 text-sm leading-6 text-ink/75">{settings.weeklyFocus}</p>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-wheat/40 bg-paper/90 px-4 py-4 backdrop-blur md:px-8 lg:px-10">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-medium text-sage">成长证据驾驶舱 · {settings.studentName}</p>
                <h1 className="mt-1 text-2xl font-semibold tracking-normal text-ink md:text-3xl">
                  {page.title}
                </h1>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-wheat/50 bg-linen/60 px-4 py-3 text-sm text-ink/75">
                <Clock3 className="h-4 w-4 text-clay" aria-hidden="true" />
                <span>localStorage 持久化 · 本地数据</span>
              </div>
            </div>
            <GlobalSearch
              query={searchQuery}
              onQueryChange={setSearchQuery}
              groups={searchGroups}
              onNavigate={handleSearchNavigate}
            />
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
              {navigation.map((item) => (
                <MobileNavButton
                  key={item.id}
                  item={item}
                  active={activePage === item.id}
                  onClick={() => setActivePage(item.id)}
                />
              ))}
            </div>
          </header>

          <section className="flex-1 px-4 py-6 md:px-8 lg:px-10">
            <PageContent activePage={activePage} data={data} />
          </section>
        </main>
      </div>
      <div className="fixed bottom-4 left-4 z-30">
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-wheat/60 bg-paper/90 px-4 py-3 text-sm font-medium text-ink/75 shadow-soft backdrop-blur"
        >
          <Settings className="h-4 w-4 text-sage" />
          设置
        </button>
        <input
          ref={backgroundInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          onChange={handleBackgroundUpload}
          className="hidden"
        />
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleImportData}
          className="hidden"
        />
      </div>
      {settingsOpen && (
        <SettingsDrawer
          settings={settings}
          onChange={setSettings}
          backupMessage={backupMessage}
          onClose={() => setSettingsOpen(false)}
          onExport={handleExportData}
          onImport={handleImportClick}
          onChooseBackground={() => backgroundInputRef.current?.click()}
          onClearBackground={() => setSiteBackgroundImage('')}
          hasBackground={Boolean(siteBackgroundImage)}
        />
      )}
    </div>
  )
}

function PageContent({ activePage, data }) {
  if (activePage === 'week-workspace') return <WeekWorkspacePage {...data} />
  if (activePage === 'task-breakdown') return <TaskBreakdownPage {...data} />
  if (activePage === 'focus-room') return <FocusRoom {...data} />
  if (activePage === 'parking-lot') return <ParkingLot {...data} />
  if (activePage === 'knowledge-cards') return <KnowledgeCardsPage {...data} />
  if (activePage === 'evidence-library') return <EvidenceLibraryPage {...data} />
  if (activePage === 'review') return <ReviewPage {...data} />
  if (activePage === 'help') return <HelpPage />
  return <Dashboard {...data} />
}

function Dashboard({
  tasks,
  focusSessions,
  knowledgeCards,
  setKnowledgeCards,
  evidenceItems,
  reviews,
  activeFocusSession,
  trackedMainlineTasks,
  setTrackedMainlineTasks,
  mainlineContinuityRecords,
  setMainlineContinuityRecords,
}) {
  const reviewedToday = hasReviewToday(reviews)
  const today = localToday()
  const yesterdayReview = getReviewForDate(reviews, addDays(today, -1))
  const dueReviewCards = useMemo(() => getDueReviewCards(knowledgeCards, today), [knowledgeCards, today])
  const sortedTasks = useMemo(() => getDashboardTasks(tasks, today), [tasks, today])
  const todayFocusSummary = useMemo(() => summarizeTodayFocus(focusSessions, today), [focusSessions, today])

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="今日任务" value={sortedTasks.length} hint={`${sortedTasks.length} 个今日执行项`} icon={ClipboardList} />
        <MetricCard
          label="今日专注时长"
          value={formatTodayFocusValue(todayFocusSummary.totalMinutes)}
          hint={
            todayFocusSummary.sessionCount > 0
              ? `今日专注轮次：${todayFocusSummary.sessionCount} 轮 · 今日最长单任务：${todayFocusSummary.longestTaskLabel}`
              : '今天还没有专注记录，先从 15 分钟启动。'
          }
          icon={Clock3}
        />
        <MetricCard label="证据沉淀" value={evidenceItems.length} hint="本地证据记录" icon={Archive} />
        <MetricCard label="今日复习" value={dueReviewCards.length} hint="到期知识卡" icon={Brain} />
      </div>

      <MainlineContinuityPanel
        tasks={tasks}
        focusSessions={focusSessions}
        trackedMainlineTasks={trackedMainlineTasks}
        setTrackedMainlineTasks={setTrackedMainlineTasks}
        mainlineContinuityRecords={mainlineContinuityRecords}
        setMainlineContinuityRecords={setMainlineContinuityRecords}
        today={today}
      />

      <LatestReviewBlock review={yesterdayReview} />

      {!reviewedToday && (
        <div className="rounded-lg border border-wheat/50 bg-linen/70 p-4 text-sm leading-6 text-ink/72">
          今天还没有主复盘。晚一点留三分钟，把推进了什么、留下了什么证据和明天第一步写下来就够了。
        </div>
      )}

      <Panel title="今日执行队列" icon={ListChecks}>
        <div className="space-y-3">
          {sortedTasks.map((task, index) => (
            <TaskRow
              key={task.id}
              task={task}
              focusedMinutes={getTodayFocusedMinutesForTask(task, today, focusSessions)}
              dailyStatus={getDailyExecutionStatus(task, today, focusSessions, activeFocusSession)}
              highlight={index < 4}
              today={today}
            />
          ))}
        </div>
      </Panel>

      <Panel title="今日复习" icon={Brain}>
        {dueReviewCards.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {dueReviewCards.map((card) => (
              <ReviewCard
                key={card.id}
                card={card}
                today={today}
                onMarkReviewed={() => markKnowledgeCardReviewedToday(card.id, today, setKnowledgeCards)}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm leading-6 text-ink/65">今天没有到期知识卡。</p>
        )}
      </Panel>
    </div>
  )
}

function SettingsForm({ settings, onChange }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <LabelInput label="学习者名称" value={settings.studentName} onChange={(value) => onChange({ ...settings, studentName: value })} />
      <LabelInput label="本周焦点" value={settings.weeklyFocus} onChange={(value) => onChange({ ...settings, weeklyFocus: value })} />
      <label className="block md:col-span-2">
        <span className="text-sm font-medium text-ink/75">复盘提示语</span>
        <textarea
          rows="3"
          value={settings.reviewPrompt}
          onChange={(event) => onChange({ ...settings, reviewPrompt: event.target.value })}
          className="mt-2 w-full resize-none rounded-lg border border-wheat/60 bg-paper px-4 py-3 text-sm leading-6 text-ink"
        />
      </label>
    </div>
  )
}

function FocusRoom({
  tasks,
  settings,
  setSettings,
  setTasks,
  setParkingItems,
  setEvidenceItems,
  focusSessions,
  setFocusSessions,
  activeFocusSession,
  setActiveFocusSession,
  setActivePage,
}) {
  const safeTasks = Array.isArray(tasks) ? tasks : []
  const safeFocusSessions = Array.isArray(focusSessions) ? focusSessions : []
  const currentTask = safeTasks.find((task) => task.id === settings?.currentFocusTaskId)

  return (
    <FocusRoomPage
      tasks={safeTasks}
      currentTask={currentTask}
      settings={settings}
      setSettings={setSettings}
      setTasks={setTasks}
      setParkingItems={setParkingItems}
      setEvidenceItems={setEvidenceItems}
      focusSessions={safeFocusSessions}
      setFocusSessions={setFocusSessions}
      activeFocusSession={activeFocusSession}
      setActiveFocusSession={setActiveFocusSession}
      setActivePage={setActivePage}
    />
  )
}

function ParkingLot({ parkingItems, setParkingItems, tasks, setTasks }) {
  const [convertMessage, setConvertMessage] = useState('')

  function handleConvertToTask(item) {
    if (item.status === 'converted' || tasks.some((task) => task.linkedParkingItemId === item.id)) return

    setTasks((items) => [
      {
        id: createRecordId('task'),
        title: item.title,
        project: item.project ?? '',
        mainline: item.tag ?? '',
        reason: item.reasonToOptimize ?? item.reason ?? '',
        versionGoal: 'V0',
        nextAction: '处理该优化点',
        estimatedMinutes: 45,
        completionStandard: '完成该优化点的 V0 版本',
        output: item.title,
        fallbackAction: '先写出最粗糙版本，不追求完美',
        deadline: item.reviewDate ?? '',
        priority: 'P3',
        status: 'not_started',
        linkedParkingItemId: item.id,
      },
      ...items,
    ])
    setParkingItems((items) =>
      items.map((currentItem) =>
        currentItem.id === item.id
          ? { ...currentItem, status: 'converted', convertedAt: new Date().toISOString() }
          : currentItem,
      ),
    )
    setConvertMessage(`已转为任务：${item.title}`)
  }

  return (
    <div className="space-y-4">
      {convertMessage && (
        <p className="rounded-lg border border-sage/30 bg-linen/70 px-4 py-3 text-sm text-ink/75">
          {convertMessage}
        </p>
      )}
      <CrudPanel
        title="优化停车场"
        description="把暂不处理但值得优化的问题先停放在这里。"
        prefix="parking"
        fields={parkingFields}
        items={parkingItems}
        onSave={(item) => setParkingItems((items) => upsertById(items, item))}
        onDelete={(id) => setParkingItems((items) => deleteById(items, id))}
        renderItem={(item) => {
          const converted = item.status === 'converted' || tasks.some((task) => task.linkedParkingItemId === item.id)

          return (
            <>
              <div className="flex flex-wrap gap-2">
                <StatusPill>{item.tag}</StatusPill>
                {converted && <span className="inline-flex rounded-lg bg-sage px-3 py-1 text-xs font-medium text-paper">已转为任务</span>}
              </div>
              <h3 className="mt-4 text-base font-semibold leading-6 text-ink">{item.title}</h3>
              <p className="mt-4 text-sm text-ink/62">{item.owner}</p>
              <button
                type="button"
                disabled={converted}
                onClick={() => handleConvertToTask(item)}
                className={`mt-4 rounded-lg px-3 py-2 text-xs font-medium ${
                  converted
                    ? 'cursor-not-allowed bg-linen text-ink/45'
                    : 'bg-sage text-paper'
                }`}
              >
                {converted ? '已转为任务' : '一键转为任务'}
              </button>
            </>
          )
        }}
      />
    </div>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-sage text-paper shadow-soft">
        <Layers3 className="h-5 w-5" aria-hidden="true" />
      </div>
      <div>
        <p className="text-base font-semibold text-ink">成长证据驾驶舱</p>
        <p className="text-xs text-ink/60">Executive Learning System</p>
      </div>
    </div>
  )
}

function GlobalSearch({ query, onQueryChange, groups, onNavigate }) {
  const [isFocused, setIsFocused] = useState(false)
  const hasQuery = query.trim().length > 0
  const totalResults = groups.reduce((count, group) => count + group.results.length, 0)
  const showPanel = isFocused || hasQuery || totalResults > 0

  return (
    <div className="relative mt-4">
      <label className="block">
        <span className="sr-only">全局搜索</span>
        <span className="flex items-center gap-3 rounded-lg border border-wheat/60 bg-white/75 px-4 py-3 shadow-soft">
          <Search className="h-4 w-4 shrink-0 text-sage" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onFocus={() => setIsFocused(true)}
            placeholder="搜索任务、知识卡、成果和复盘"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink/45"
          />
        </span>
      </label>

      {showPanel && (
        <div
          className="absolute left-0 right-0 z-20 mt-2 max-h-[26rem] overflow-y-auto rounded-lg border border-wheat/60 bg-paper p-4 shadow-soft"
          onMouseDown={(event) => event.preventDefault()}
        >
          {!hasQuery && (
            <p className="text-sm leading-6 text-ink/62">输入关键词搜索任务、知识卡、成果和复盘。</p>
          )}

          {hasQuery && totalResults === 0 && (
            <p className="text-sm leading-6 text-ink/62">没有找到相关内容。</p>
          )}

          {hasQuery && totalResults > 0 && (
            <div className="space-y-4">
              {groups.filter((group) => group.results.length > 0).map((group) => (
                <div key={group.key}>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sage">
                    {group.label} · {group.results.length}
                  </p>
                  <div className="mt-2 space-y-2">
                    {group.results.map((result) => (
                      <button
                        key={`${group.key}-${result.id}`}
                        type="button"
                        onClick={() => {
                          setIsFocused(false)
                          onNavigate(result.pageId)
                        }}
                        className="block w-full rounded-lg border border-wheat/45 bg-white/65 p-3 text-left transition hover:border-sage/50 hover:bg-linen/55"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-lg bg-sage px-2.5 py-1 text-xs font-medium text-paper">
                            {result.typeLabel}
                          </span>
                          {result.meta && <span className="text-xs text-ink/55">{result.meta}</span>}
                        </div>
                        <p className="mt-2 text-sm font-semibold text-ink">{result.title}</p>
                        <p className="mt-1 text-sm leading-6 text-ink/65">{result.snippet}</p>
                        <p className="mt-2 text-xs text-clay">点击跳转到 {group.label} 模块查看。</p>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function NavButton({ item, active, onClick }) {
  const Icon = item.icon

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm transition ${
        active ? 'bg-paper text-ink shadow-soft' : 'text-ink/68 hover:bg-paper/70 hover:text-ink'
      }`}
    >
      <span className="flex min-w-0 items-center gap-3">
        <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-clay' : 'text-sage'}`} />
        <span className="truncate">{item.label}</span>
      </span>
      {active && <ChevronRight className="h-4 w-4 shrink-0 text-clay" aria-hidden="true" />}
    </button>
  )
}

function MobileNavButton({ item, active, onClick }) {
  const Icon = item.icon

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
        active ? 'border-sage bg-sage text-paper' : 'border-wheat/60 bg-linen/60 text-ink/75'
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span>{item.label}</span>
    </button>
  )
}

function MetricCard({ label, value, hint, icon: Icon }) {
  return (
    <div className="rounded-lg border border-wheat/50 bg-paper p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink/62">{label}</p>
        <Icon className="h-5 w-5 text-sage" aria-hidden="true" />
      </div>
      <p className="mt-4 text-3xl font-semibold text-ink">{value}</p>
      <p className="mt-2 text-sm text-ink/60">{hint}</p>
    </div>
  )
}

function SettingsDrawer({
  settings,
  onChange,
  backupMessage,
  onClose,
  onExport,
  onImport,
  onChooseBackground,
  onClearBackground,
  hasBackground,
}) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-ink/35 px-4 py-4" onMouseDown={onClose}>
      <aside
        className="flex h-full w-full max-w-xl flex-col overflow-y-auto rounded-lg border border-wheat/60 bg-paper p-5 shadow-soft"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-sage">Settings</p>
            <h2 className="mt-1 text-xl font-semibold text-ink">系统设置</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-wheat/70 px-3 py-2 text-sm text-ink/70">
            关闭
          </button>
        </div>

        <div className="mt-5">
          <SettingsForm settings={settings} onChange={onChange} />
        </div>

        <div className="mt-6 rounded-lg border border-wheat/50 bg-linen/50 p-4">
          <p className="text-sm font-semibold text-ink">背景设置</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={onChooseBackground} className="rounded-lg bg-sage px-4 py-2.5 text-sm font-medium text-paper">
              更新背景
            </button>
            {hasBackground && (
              <button type="button" onClick={onClearBackground} className="rounded-lg border border-wheat/70 bg-paper px-4 py-2.5 text-sm font-medium text-ink/75">
                清除背景
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-wheat/50 bg-linen/50 p-4">
          <p className="text-sm font-semibold text-ink">数据备份与恢复</p>
          <p className="mt-1 text-sm leading-6 text-ink/62">导出或导入当前浏览器中的本地数据。</p>
          <p className="mt-2 text-xs leading-5 text-ink/55">
            当前 JSON 备份包含附件元数据，但不包含附件文件本体。附件文件保存在当前浏览器的 IndexedDB 中。
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={onExport} className="rounded-lg bg-sage px-4 py-2.5 text-sm font-medium text-paper">
              导出数据
            </button>
            <button type="button" onClick={onImport} className="rounded-lg border border-wheat/70 bg-paper px-4 py-2.5 text-sm font-medium text-ink/75">
              导入数据
            </button>
          </div>
          {backupMessage && <p className="mt-3 rounded-lg bg-paper px-3 py-2 text-sm text-ink/70">{backupMessage}</p>}
        </div>
      </aside>
    </div>
  )
}

function LatestReviewBlock({ review }) {
  return (
    <section className="rounded-lg border border-wheat/50 bg-white/55 p-5 shadow-soft">
      <div className="mb-3 flex items-center gap-3">
        <Sparkles className="h-4 w-4 text-sage" />
        <h2 className="text-lg font-semibold text-ink">最近一次复盘</h2>
      </div>
      {review ? (
        <div className="space-y-2 text-sm leading-6 text-ink/75">
          <p className="font-semibold text-sage">{review.date}</p>
          <p>{formatReviewSummary(review)}</p>
        </div>
      ) : (
        <p className="text-sm leading-6 text-ink/65">前一天还没有复盘记录。</p>
      )}
    </section>
  )
}

function MainlineContinuityPanel({
  tasks,
  focusSessions,
  trackedMainlineTasks,
  setTrackedMainlineTasks,
  mainlineContinuityRecords,
  setMainlineContinuityRecords,
  today,
}) {
  const [manageOpen, setManageOpen] = useState(false)
  const [expandedCycles, setExpandedCycles] = useState({})
  const safeTasks = Array.isArray(tasks) ? tasks : []
  const safeTracked = normalizeTrackedMainlines(trackedMainlineTasks, today)
  const trackedRows = safeTracked
    .map((tracked) => {
      const task = safeTasks.find((item) => item?.id === tracked.taskId)
      if (!task) return null
      return buildMainlineRow(task, tracked, mainlineContinuityRecords, focusSessions, today)
    })
    .filter(Boolean)

  useEffect(() => {
    const nextRecords = buildBackfilledMainlineRecords({
      tasks: safeTasks,
      focusSessions,
      trackedMainlineTasks: safeTracked,
      records: mainlineContinuityRecords,
      today,
    })
    if (JSON.stringify(nextRecords) !== JSON.stringify(mainlineContinuityRecords || {})) {
      setMainlineContinuityRecords(nextRecords)
    }
  }, [tasks, focusSessions, trackedMainlineTasks, mainlineContinuityRecords, setMainlineContinuityRecords, today])

  useEffect(() => {
    const delay = getNextMidnightDelay()
    const timer = window.setTimeout(() => {
      setMainlineContinuityRecords((records) =>
        buildBackfilledMainlineRecords({
          tasks: safeTasks,
          focusSessions,
          trackedMainlineTasks: safeTracked,
          records,
          today: localToday(),
          includeToday: true,
        }),
      )
    }, delay)
    return () => window.clearTimeout(timer)
  }, [tasks, focusSessions, trackedMainlineTasks, setMainlineContinuityRecords])

  function handleToggleTask(task) {
    if (!task?.id) return
    setTrackedMainlineTasks((items) => {
      const current = normalizeTrackedMainlines(items, today)
      if (current.some((item) => item.taskId === task.id)) {
        return current.filter((item) => item.taskId !== task.id)
      }
      return [
        ...current,
        {
          taskId: task.id,
          trackedAt: new Date().toISOString(),
          trackingStartDate: today,
        },
      ]
    })
  }

  function toggleCycle(rowId, cycleIndex) {
    const key = `${rowId}:${cycleIndex}`
    setExpandedCycles((current) => ({ ...current, [key]: !current[key] }))
  }

  return (
    <Panel title="主线进行时" icon={Target}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="max-w-2xl text-sm leading-6 text-ink/62">
          从 Task Breakdown 选择主线任务，系统每天记录是否中断。
        </p>
        <button
          type="button"
          onClick={() => setManageOpen((open) => !open)}
          className="inline-flex w-fit items-center justify-center rounded-lg bg-sage px-4 py-2.5 text-sm font-medium text-paper"
        >
          管理主线
        </button>
      </div>

      {manageOpen && (
        <div className="mb-4 rounded-lg border border-wheat/50 bg-linen/50 p-4">
          {safeTasks.length === 0 ? (
            <p className="text-sm leading-6 text-ink/62">当前还没有任务。请先到 Task Breakdown 新建一个长期任务。</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {safeTasks.map((task) => {
                const checked = safeTracked.some((item) => item.taskId === task.id)
                return (
                  <label key={task.id} className="flex items-start gap-3 rounded-lg bg-paper/70 p-3 text-sm text-ink/75">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggleTask(task)}
                      className="mt-1 h-4 w-4 accent-sage"
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink">{task.title || '未命名任务'}</span>
                      <span className="mt-1 block text-xs text-ink/55">{task.project || '未设置项目'} · {formatDeadlineLabel(task, today)}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          )}
        </div>
      )}

      {trackedRows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-wheat/70 bg-paper/55 p-5 text-sm leading-6 text-ink/62">
          {safeTasks.length === 0
            ? '当前还没有任务。请先到 Task Breakdown 新建一个长期任务。'
            : '还没有追踪主线。请选择 Task Breakdown 中的长期任务，系统会帮你记录每天是否形成收尾闭环。'}
        </div>
      ) : (
        <div className="space-y-3">
          {trackedRows.map((row) => (
            <MainlineRow
              key={row.task.id}
              row={row}
              expandedCycles={expandedCycles}
              onToggleCycle={toggleCycle}
            />
          ))}
        </div>
      )}
    </Panel>
  )
}

function MainlineRow({ row, expandedCycles, onToggleCycle }) {
  return (
    <article className="rounded-lg border border-wheat/50 bg-paper p-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-ink">{row.task.title || '未命名任务'}</h3>
          <p className="mt-1 text-xs text-ink/55">{row.task.nextAction || row.task.mainline || '未填写下一步'}</p>
        </div>
        <span className={row.deadlineTone}>
          {row.deadlineLabel}
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {row.cycles.map((cycle) => {
          const cycleKey = `${row.task.id}:${cycle.index}`
          const isLatest = cycle.index === row.cycles.length - 1
          const expanded = isLatest || Boolean(expandedCycles[cycleKey])
          return (
            <div key={cycleKey} className="rounded-lg bg-linen/50 px-3 py-2">
              {!isLatest && (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs leading-5 text-ink/62">
                    过去 21 天，你中断了 {cycle.missedCount} 次，下一步：{row.nextStep}
                  </p>
                  <button
                    type="button"
                    onClick={() => onToggleCycle(row.task.id, cycle.index)}
                    className="w-fit rounded-lg border border-wheat/70 bg-paper px-2.5 py-1 text-xs text-ink/70"
                  >
                    {expanded ? '收起' : '展开'}
                  </button>
                </div>
              )}
              {expanded && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {cycle.days.map((day) => (
                    <span
                      key={day.date}
                      title={`${day.date} ${day.status === 'completed' ? '已收尾' : '未闭环'}`}
                      className={`flex h-7 w-7 items-center justify-center rounded-md text-sm ${
                        day.status === 'completed'
                          ? 'bg-sage/15 text-sage ring-1 ring-sage/25'
                          : 'bg-clay/10 text-clay ring-1 ring-clay/20'
                      }`}
                    >
                      {day.status === 'completed' ? '✅' : '❌'}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </article>
  )
}

function Panel({ title, icon: Icon, children }) {
  return (
    <section className="rounded-lg border border-wheat/50 bg-white/55 p-5 shadow-soft">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-linen text-sage">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function TaskRow({ task, focusedMinutes, dailyStatus, highlight, today }) {
  const urgency = getDeadlineUrgency(task.deadline, today)
  const rowClasses = [
    'rounded-lg border bg-paper p-4',
    highlight ? 'border-sage/45 shadow-soft ring-1 ring-sage/15' : 'border-wheat/50',
    urgency === 'overdue' ? 'border-red-300 bg-red-50/70' : '',
    urgency === 'soon' ? 'border-orange-300 bg-orange-50/70' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={rowClasses}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-ink">{task.title}</p>
          <p className="mt-1 text-sm text-ink/60">{task.project ?? task.course}</p>
        </div>
        <StatusPill>{dailyStatus.dot} {dailyStatus.label}</StatusPill>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-lg bg-linen px-3 py-1.5 text-xs text-ink/70">{task.priority ?? 'P3'}</span>
        {task.deadline && (
          <span className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
            urgency === 'overdue'
              ? 'bg-red-100 text-red-700'
              : urgency === 'soon'
                ? 'bg-orange-100 text-orange-700'
                : 'bg-linen text-ink/70'
          }`}>
            deadline: {task.deadline}
          </span>
        )}
        <span className="rounded-lg bg-linen px-3 py-1.5 text-xs text-ink/70">
          今日已专注：{formatFocusedMinutes(focusedMinutes)}
        </span>
        <span className="rounded-lg bg-linen px-3 py-1.5 text-xs text-ink/70">{task.versionGoal ?? 'V0'}</span>
        <span className="rounded-lg bg-linen px-3 py-1.5 text-xs text-ink/70">
          {task.nextAction ?? task.steps?.[0] ?? '未设置下一步'}
        </span>
      </div>
    </div>
  )
}

function ReviewCard({ card, today, onMarkReviewed }) {
  const createdDate = getKnowledgeCardCreatedDate(card)
  const daysSinceCreated = createdDate ? diffDays(createdDate, today) : null

  return (
    <div className="rounded-lg border border-red-200 bg-red-50/80 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-red-600">
            到期复习{daysSinceCreated ? ` · 第 ${daysSinceCreated} 天` : ''}
          </p>
          <h3 className="mt-2 font-semibold text-ink">{card.title}</h3>
        </div>
        <button
          type="button"
          onClick={onMarkReviewed}
          className="rounded-lg bg-sage px-3 py-2 text-xs font-medium text-paper"
        >
          标记今日已复习
        </button>
      </div>
      <p className="mt-3 text-sm leading-6 text-ink/72">{card.oneSentence}</p>
    </div>
  )
}

function LabelInput({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink/75">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-lg border border-wheat/60 bg-paper px-4 py-3 text-sm text-ink"
      />
    </label>
  )
}

function StatusPill({ children }) {
  return (
    <span className="inline-flex w-fit items-center rounded-lg bg-linen px-3 py-1 text-xs font-medium text-clay">
      {children}
    </span>
  )
}

export default App

function getDashboardTasks(tasks, today) {
  return (Array.isArray(tasks) ? tasks : [])
    .map((task) => ({ ...task, status: normalizeTaskStatus(task.status) }))
    .filter((task) => shouldShowOnDashboard(task, today))
    .sort((a, b) => {
    const aCompleted = getTaskRangeStatus(a, today) === 'finished'
    const bCompleted = getTaskRangeStatus(b, today) === 'finished'
    if (aCompleted !== bCompleted) return aCompleted ? 1 : -1

    const aUrgent = isDeadlineWithinDays(a.deadline, today, 3) || isDeadlineOverdue(a.deadline, today)
    const bUrgent = isDeadlineWithinDays(b.deadline, today, 3) || isDeadlineOverdue(b.deadline, today)
    if (aUrgent !== bUrgent) return aUrgent ? -1 : 1

    const priorityDiff = (priorityRank[a.priority] ?? 3) - (priorityRank[b.priority] ?? 3)
    if (priorityDiff !== 0) return priorityDiff

    const aDeadline = deadlineTime(a.deadline)
    const bDeadline = deadlineTime(b.deadline)
    return aDeadline - bDeadline
  })
}

function shouldShowOnDashboard(task, today) {
  return isTaskActiveToday(task, today) || wasTaskCreatedToday(task, today)
}

function isDeadlineWithinDays(deadline, today, days) {
  if (!deadline) return false
  const difference = diffDays(today, deadline)
  return difference >= 0 && difference <= days
}

function isDeadlineOverdue(deadline, today) {
  if (!deadline) return false
  return diffDays(today, deadline) < 0
}

function getDeadlineUrgency(deadline, today) {
  if (!deadline) return 'none'
  const difference = diffDays(today, deadline)
  if (difference < 0) return 'overdue'
  if (difference <= 3) return 'soon'
  return 'none'
}

function deadlineTime(deadline) {
  return deadline ? new Date(`${deadline}T00:00:00`).getTime() : Number.POSITIVE_INFINITY
}

function summarizeTodayFocus(focusSessions, today) {
  const todaySessions = (Array.isArray(focusSessions) ? focusSessions : []).filter(
    (session) => getFocusSessionLocalDate(session, today) === today,
  )
  const taskMinutes = todaySessions.reduce((minutesByTask, session) => {
    const taskName = session.taskTitle || session.label || '未命名任务'
    const minutes = getFocusSessionMinutes(session)
    minutesByTask.set(taskName, (minutesByTask.get(taskName) ?? 0) + minutes)
    return minutesByTask
  }, new Map())
  const totalMinutes = todaySessions.reduce((sum, session) => sum + getFocusSessionMinutes(session), 0)
  const longestTask = Array.from(taskMinutes.entries()).sort((a, b) => b[1] - a[1])[0]

  return {
    totalMinutes,
    sessionCount: todaySessions.length,
    longestTaskLabel: longestTask ? `${longestTask[0]} ${formatFocusedMinutes(longestTask[1])}` : '暂无',
  }
}

function formatTodayFocusValue(totalMinutes) {
  const minutes = Number(totalMinutes || 0)
  if (minutes < 60) return `${minutes} 分钟`
  return `${(minutes / 60).toFixed(1)} 小时`
}

function getReviewForDate(reviews, date) {
  return (Array.isArray(reviews) ? reviews : []).find((review) => review?.date === date) || null
}

function formatReviewSummary(review) {
  return [
    review.mainlineAdvanced && `主线推进：${review.mainlineAdvanced}`,
    review.evidenceLeft && `留下证据：${review.evidenceLeft}`,
    review.procrastinationOrHyperfocus && `卡点：${review.procrastinationOrHyperfocus}`,
    review.firstStepTomorrow && `下一步：${review.firstStepTomorrow}`,
  ].filter(Boolean).join('；') || '这条复盘还没有填写内容。'
}

function normalizeTrackedMainlines(value, today = localToday()) {
  return (Array.isArray(value) ? value : [])
    .filter((item) => item?.taskId)
    .reduce((items, item) => {
      if (items.some((current) => current.taskId === item.taskId)) return items
      items.push({
        taskId: item.taskId,
        trackedAt: item.trackedAt || new Date().toISOString(),
        trackingStartDate: normalizeLocalDate(item.trackingStartDate) || today,
      })
      return items
    }, [])
}

function buildBackfilledMainlineRecords({
  tasks,
  focusSessions,
  trackedMainlineTasks,
  records,
  today,
  includeToday = false,
}) {
  const safeTasks = Array.isArray(tasks) ? tasks : []
  const safeRecords = normalizeMainlineRecords(records)
  const targetEndDate = includeToday ? today : addDays(today, -1)
  if (targetEndDate < '0001-01-01') return safeRecords

  const nextRecords = { ...safeRecords }
  normalizeTrackedMainlines(trackedMainlineTasks, today).forEach((tracked) => {
    const task = safeTasks.find((item) => item?.id === tracked.taskId)
    if (!task) return
    const existingTaskRecords = nextRecords[tracked.taskId] || {}
    const lastDate = getLastRecordDate(existingTaskRecords)
    const firstDate = lastDate ? addDays(lastDate, 1) : tracked.trackingStartDate
    if (!firstDate || firstDate > targetEndDate) {
      nextRecords[tracked.taskId] = existingTaskRecords
      return
    }

    const taskRecords = { ...existingTaskRecords }
    enumerateDates(firstDate, targetEndDate).forEach((date) => {
      if (taskRecords[date]) return
      if (date < tracked.trackingStartDate) return
      if (!isTaskActiveOnDate(task, date)) return
      taskRecords[date] = getMainlineDayStatus(task, date, focusSessions)
    })
    nextRecords[tracked.taskId] = taskRecords
  })
  return nextRecords
}

function buildMainlineRow(task, tracked, records, focusSessions, today) {
  const days = buildMainlineDisplayDays(task, tracked, records, focusSessions, today)
  return {
    task,
    days,
    cycles: chunkMainlineDays(days),
    nextStep: task.nextAction || task.fallbackAction || task.mainline || '未填写下一步',
    deadlineLabel: formatDeadlineLabel(task, today),
    deadlineTone: getDeadlineTone(task, today),
  }
}

function buildMainlineDisplayDays(task, tracked, records, focusSessions, today) {
  const taskRecords = normalizeMainlineRecords(records)[task.id] || {}
  const startDate = tracked.trackingStartDate
  return enumerateDates(startDate, today)
    .filter((date) => date >= startDate && isTaskActiveOnDate(task, date))
    .map((date) => ({
      date,
      status: date === today ? getMainlineDayStatus(task, date, focusSessions) : taskRecords[date] || getMainlineDayStatus(task, date, focusSessions),
    }))
}

function chunkMainlineDays(days) {
  const chunks = []
  for (let index = 0; index < days.length; index += 21) {
    const chunk = days.slice(index, index + 21)
    chunks.push({
      index: chunks.length,
      days: chunk,
      missedCount: chunk.filter((day) => day.status === 'missed').length,
    })
  }
  return chunks
}

function getMainlineDayStatus(task, date, focusSessions) {
  return getTodayTaskFocusSessions(task, date, focusSessions).some(isClosedOutSession) ? 'completed' : 'missed'
}

function normalizeMainlineRecords(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.entries(value).reduce((records, [taskId, taskRecords]) => {
    if (!taskRecords || typeof taskRecords !== 'object' || Array.isArray(taskRecords)) return records
    records[taskId] = Object.entries(taskRecords).reduce((days, [date, status]) => {
      const safeDate = normalizeLocalDate(date)
      if (safeDate && (status === 'completed' || status === 'missed')) days[safeDate] = status
      return days
    }, {})
    return records
  }, {})
}

function getLastRecordDate(records) {
  return Object.keys(records || {}).sort().at(-1) || ''
}

function enumerateDates(startDate, endDate) {
  const start = normalizeLocalDate(startDate)
  const end = normalizeLocalDate(endDate)
  if (!start || !end || start > end) return []
  const dates = []
  for (let current = start; current <= end; current = addDays(current, 1)) {
    dates.push(current)
  }
  return dates
}

function addDays(dateString, amount) {
  const [year, month, day] = String(dateString).split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + amount)
  const localYear = date.getFullYear()
  const localMonth = String(date.getMonth() + 1).padStart(2, '0')
  const localDay = String(date.getDate()).padStart(2, '0')
  return `${localYear}-${localMonth}-${localDay}`
}

function getNextMidnightDelay() {
  const now = new Date()
  const midnight = new Date(now)
  midnight.setHours(24, 0, 0, 0)
  return Math.max(1000, midnight.getTime() - now.getTime())
}

function formatDeadlineLabel(task, today) {
  const deadline = getTaskEndDate(task, today)
  if (!deadline) return '无 DDL'
  const difference = diffDays(today, deadline)
  if (difference > 0) return `距 DDL ${difference} 天`
  if (difference === 0) return '今日到期'
  return `已过期 ${Math.abs(difference)} 天`
}

function getDeadlineTone(task, today) {
  const deadline = getTaskEndDate(task, today)
  if (!deadline) return 'rounded-lg bg-linen px-3 py-1.5 text-xs font-medium text-ink/65'
  const difference = diffDays(today, deadline)
  if (difference < 0) return 'rounded-lg bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700'
  if (difference <= 3) return 'rounded-lg bg-orange-100 px-3 py-1.5 text-xs font-medium text-orange-700'
  return 'rounded-lg bg-sage/12 px-3 py-1.5 text-xs font-medium text-sage'
}
