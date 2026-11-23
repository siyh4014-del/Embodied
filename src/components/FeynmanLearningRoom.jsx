import { useMemo, useRef, useState } from 'react'
import {
  Brain,
  ChevronDown,
  ChevronRight,
  Link,
  MessageCircle,
  Search,
  Send,
  Sparkles,
  Upload,
} from 'lucide-react'
import { saveAttachment, formatAttachmentSize } from '../services/attachmentStorage'
import { createRecordId, upsertById } from '../utils/records'
import { localToday, nowIso, summarizeDate } from '../utils/dateRecords'
import {
  getDailyExecutionStatus,
  getTodayFocusedMinutesForTask,
  isTaskActiveToday,
  wasTaskCreatedToday,
} from '../utils/taskExecutionStatus'

const topicAreas = ['科研', '数据分析', '产品经理', '金字塔原理', '其他']

const stages = [
  { id: 'explain', label: '先讲一遍' },
  { id: 'listen', label: 'AI 复述' },
  { id: 'diagnose', label: '追问漏洞' },
  { id: 'scaffold', label: '讲法脚手架' },
  { id: 'retry', label: '重新讲' },
  { id: 'summary', label: '生成卡片' },
]

const recommendedActions = [
  ['我先讲一遍', 'free_explain', '我先用自己的话讲一遍，请先听我讲。', 'explain'],
  ['我不知道怎么讲', 'scaffold', '我不知道怎么讲，请给我填空式讲法模板。', 'scaffold'],
  ['请复述你听懂了什么', 'student_listen', '请像小白学生一样复述你听懂了什么，并指出没听懂的地方。', 'listen'],
  ['请给我讲法模板', 'scaffold', '请给我一个适合这个主题的讲法脚手架。', 'scaffold'],
]

const trainingActions = [
  ['请指出我没讲清楚的地方', 'diagnose', '请指出我刚才没讲清楚、跳步或混淆的地方。', 'diagnose'],
  ['请示范一版', 'demo', '请给我小白版、研究生/职场版、输出版三档讲法。', 'scaffold'],
  ['请追问我', 'question', '请最多追问我 3 个问题。', 'diagnose'],
  ['请让我举例', 'example', '请要求我举一个例子和一个反例。', 'retry'],
  ['请让我迁移到真实任务', 'transfer', '请让我把它迁移到科研、数据分析、产品或表达任务里。', 'retry'],
]

const searchActions = [
  ['联网查最新资料', 'general'],
  ['联网查最新案例', 'latest_case'],
  ['联网查相关文献', 'latest_research'],
  ['联网查官方文档', 'official_docs'],
]

const emptyMemory = {
  masteredConcepts: [],
  weakConcepts: [],
  commonConfusions: [],
  bestExplanations: [],
  examplesGenerated: [],
  transferApplications: [],
  preferredScaffolds: [],
  nextReviewQuestions: [],
  aiAdjustmentNotes: '',
}

export function FeynmanLearningRoom({
  tasks,
  focusSessions,
  evidenceItems,
  knowledgeCards,
  setKnowledgeCards,
  reviews,
  setReviews,
  feynmanRooms,
  setFeynmanRooms,
  activeFocusSession,
}) {
  const today = localToday()
  const safeRooms = useMemo(
    () => (Array.isArray(feynmanRooms) ? feynmanRooms : []).map((room) => normalizeRoom(room, today)),
    [feynmanRooms, today],
  )
  const closedOutTasks = useMemo(
    () => getTodayClosedOutTasks(tasks, today, focusSessions, activeFocusSession),
    [tasks, today, focusSessions, activeFocusSession],
  )
  const todaySummaryCount = countTodaySummaries(safeRooms, today)
  const explainedTaskIds = new Set(
    safeRooms
      .filter((room) => room.taskId && room.summaries.some((summary) => isTodayRecord(summary, today)))
      .map((room) => room.taskId),
  )

  const [roomOpen, setRoomOpen] = useState(false)
  const [activeRoomId, setActiveRoomId] = useState(safeRooms[0]?.id || '')
  const [freeTopic, setFreeTopic] = useState('')
  const [freeTopicArea, setFreeTopicArea] = useState(topicAreas[0])
  const [messageDraft, setMessageDraft] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [stageId, setStageId] = useState('explain')
  const [freeOpen, setFreeOpen] = useState(false)
  const [recentOpen, setRecentOpen] = useState(false)
  const [memoryOpen, setMemoryOpen] = useState(false)
  const [attachmentsOpen, setAttachmentsOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [aiState, setAiState] = useState({ loading: false, error: '' })
  const [summaryState, setSummaryState] = useState({ loading: false, error: '', raw: '' })
  const [dailyReviewState, setDailyReviewState] = useState({ loading: false, error: '', result: null })
  const fileInputRef = useRef(null)

  const activeRoom = safeRooms.find((room) => room.id === activeRoomId) || safeRooms[0] || null
  const recentRooms = [...safeRooms].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, 5)
  const todayContext = useMemo(
    () => ({
      tasks: Array.isArray(tasks) ? tasks : [],
      focusSessions: Array.isArray(focusSessions) ? focusSessions : [],
      evidenceItems: Array.isArray(evidenceItems) ? evidenceItems : [],
      knowledgeCards: Array.isArray(knowledgeCards) ? knowledgeCards : [],
      reviews: Array.isArray(reviews) ? reviews : [],
      weekWorkspaceDayDetail: summarizeDate(today, { tasks, focusSessions, evidenceItems, knowledgeCards, reviews }),
    }),
    [tasks, focusSessions, evidenceItems, knowledgeCards, reviews, today],
  )

  const pendingCount = Math.max(0, closedOutTasks.length - explainedTaskIds.size)

  function persistRoom(room) {
    const normalized = normalizeRoom({ ...room, updatedAt: nowIso() }, today)
    setFeynmanRooms((rooms) => upsertById((Array.isArray(rooms) ? rooms : []).map((item) => normalizeRoom(item, today)), normalized))
    setActiveRoomId(normalized.id)
    return normalized
  }

  function openTaskRoom(task) {
    const existing = safeRooms.find((room) => room.taskId === task.id)
    if (existing) {
      setActiveRoomId(existing.id)
    } else {
      persistRoom(createRoom({ taskId: task.id, taskTitle: task.title, topicTitle: task.title, topicArea: inferTopicArea(task), today }))
    }
    setRoomOpen(true)
    setStageId('explain')
  }

  function createFreeRoom() {
    const title = freeTopic.trim()
    if (!title) {
      setStatusMessage('请先填写自由讲解主题。')
      return
    }
    persistRoom(createRoom({ topicTitle: title, topicArea: freeTopicArea, today }))
    setFreeTopic('')
    setFreeOpen(false)
    setRoomOpen(true)
    setStageId('explain')
  }

  function clearActiveRoomMessages() {
    if (!activeRoom) return
    const confirmed = window.confirm('确定清空当前 Feynman Room 的对话消息吗？长期记忆、总结、资料和知识卡不会删除。')
    if (!confirmed) return
    persistRoom({ ...activeRoom, messages: [] })
    setMessageDraft('')
    setStageId('explain')
    setStatusMessage('已清空当前窗口对话。长期记忆、总结和附件已保留。')
  }

  async function sendMessage(mode = 'free_explain', presetText = '', nextStage = stageId) {
    if (!activeRoom) return
    setStageId(nextStage)
    const text = (presetText || messageDraft).trim()
    const userMessage = text ? createMessage('user', text, mode) : null
    const nextRoom = userMessage
      ? persistRoom({ ...activeRoom, messages: [...activeRoom.messages, userMessage] })
      : activeRoom

    setMessageDraft('')
    setAiState({ loading: true, error: '' })

    try {
      const response = await fetch('/api/deepseek/feynman-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room: nextRoom,
          messages: nextRoom.messages,
          mode,
          topic: buildTopic(nextRoom),
          todayContext,
          attachmentsSummary: buildAttachmentsSummary(nextRoom),
          memory: nextRoom.memory,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setAiState({ loading: false, error: payload.error || 'AI 费曼助手暂时没有回应，请稍后重试。你的对话记录已保存在本地。' })
        return
      }
      const assistantText = payload.content || payload.raw || '我先听你讲。请用 6 句模板讲一遍这个主题。'
      persistRoom({ ...nextRoom, messages: [...nextRoom.messages, createMessage('assistant', assistantText, mode)] })
      setAiState({ loading: false, error: '' })
    } catch {
      setAiState({ loading: false, error: 'Feynman AI 服务不可用，请确认 npm run server 已启动。' })
    }
  }

  async function handleUpload(event) {
    if (!activeRoom) return
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length) return

    const attachments = []
    for (const file of files) {
      try {
        const meta = await saveAttachment(file, activeRoom.id)
        const textSummary = await readTextAttachment(file)
        attachments.push({
          ...meta,
          roomId: activeRoom.id,
          parsed: Boolean(textSummary),
          textSummary,
          parseMessage: textSummary ? '' : '该文件已保存，但当前版本暂不支持全文解析，可在对话中手动概述内容。',
        })
      } catch {
        attachments.push({
          id: createRecordId('attachment'),
          roomId: activeRoom.id,
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size,
          createdAt: nowIso(),
          storageProvider: 'indexeddb',
          storageKey: '',
          parsed: false,
          textSummary: '',
          parseMessage: '该附件已保存失败或无法自动解析，请在对话中手动概述资料内容。',
        })
      }
    }
    persistRoom({ ...activeRoom, attachments: [...activeRoom.attachments, ...attachments] })
    setStatusMessage(`${attachments.length} 个资料已加入当前 Feynman Room。`)
  }

  async function runSearch(searchMode) {
    if (!activeRoom) return
    setStageId('retry')
    setAiState({ loading: true, error: '' })
    try {
      const response = await fetch('/api/search/feynman', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskTitle: activeRoom.taskTitle || activeRoom.topicTitle,
          topicArea: activeRoom.topicArea,
          userExplanation: latestUserMessage(activeRoom),
          searchMode,
          date: today,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setAiState({ loading: false, error: payload.error || '联网搜索失败，但你仍然可以继续本地费曼讲解。' })
        return
      }
      const searchMessage = createMessage('assistant', formatSearchResult(payload), 'web_calibrate')
      persistRoom({
        ...activeRoom,
        messages: [...activeRoom.messages, searchMessage],
        webSearchResults: [...(activeRoom.webSearchResults || []), payload],
      })
      setAiState({ loading: false, error: '' })
    } catch {
      setAiState({ loading: false, error: '联网搜索失败，但你仍然可以继续本地费曼讲解。' })
    }
  }

  async function generateSummary() {
    if (!activeRoom) return
    setStageId('summary')
    setSummaryState({ loading: true, error: '', raw: '' })
    try {
      const response = await fetch('/api/deepseek/feynman-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room: activeRoom,
          messages: activeRoom.messages,
          attachmentsSummary: buildAttachmentsSummary(activeRoom),
          webSearchResults: activeRoom.webSearchResults || [],
          todayContext,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setSummaryState({ loading: false, error: payload.error || 'AI 暂时没有回应。你的 Feynman 对话已保存在本地。', raw: payload.raw || '' })
        return
      }
      const summary = payload.structured === false ? { rawText: payload.raw || '' } : payload.data
      persistRoom({
        ...activeRoom,
        memory: normalizeMemory(summary?.updatedMemory || activeRoom.memory),
        summaries: [...activeRoom.summaries, { id: createRecordId('feynman-summary'), date: today, createdAt: nowIso(), savedToKnowledgeCards: false, ...summary }],
      })
      setSummaryState({
        loading: false,
        error: payload.structured === false ? '结构化总结解析失败，但原始总结已保留。' : '',
        raw: payload.raw || '',
      })
    } catch {
      setSummaryState({ loading: false, error: 'AI 暂时没有回应。你的 Feynman 对话已保存在本地。', raw: '' })
    }
  }

  function saveKnowledgeCards(summaryId) {
    if (!activeRoom) return
    const summary = activeRoom.summaries.find((item) => item.id === summaryId)
    const cards = Array.isArray(summary?.suggestedKnowledgeCards) ? summary.suggestedKnowledgeCards : []
    if (!cards.length || summary.savedToKnowledgeCards) return

    const createdAt = nowIso()
    const nextCards = cards.map((card) => ({
      id: createRecordId('card'),
      title: card.title || 'Feynman Knowledge Card',
      source: `Feynman Learning Room · ${activeRoom.taskTitle || activeRoom.topicTitle}`,
      type: card.type || '概念卡',
      oneSentence: card.oneSentence || '',
      problemSolved: card.problemSolved || '',
      relatedProject: card.relatedProject || activeRoom.topicArea || '',
      application: card.application || card.reviewQuestion || '',
      reviewDate: today,
      date: today,
      createdAt,
      reviewRecords: [],
      tags: Array.isArray(card.tags) ? card.tags : ['feynman'],
      mechanism: card.mechanism || '',
      example: card.example || '',
      boundary: card.boundary || '',
      reviewQuestion: card.reviewQuestion || '',
    }))
    setKnowledgeCards((items) => [...nextCards, ...(Array.isArray(items) ? items : [])])
    persistRoom({
      ...activeRoom,
      summaries: activeRoom.summaries.map((item) => item.id === summaryId ? { ...item, savedToKnowledgeCards: true } : item),
    })
    setStatusMessage('已保存到 Knowledge Cards。')
  }

  async function generateDailyReview() {
    if (todaySummaryCount === 0) return
    const todaySummaries = safeRooms.flatMap((room) =>
      room.summaries.filter((summary) => isTodayRecord(summary, today))
        .map((summary) => ({ roomTitle: room.taskTitle || room.topicTitle, summary })),
    )
    setDailyReviewState({ loading: true, error: '', result: null })
    try {
      const response = await fetch('/api/deepseek/feynman-daily-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: today,
          feynmanSummaries: todaySummaries,
          weekWorkspaceDayDetail: todayContext.weekWorkspaceDayDetail,
          todayTasks: todayContext.weekWorkspaceDayDetail.items.tasks,
          todayFocusSessions: todayContext.weekWorkspaceDayDetail.items.focusSessions,
          todayEvidenceItems: todayContext.weekWorkspaceDayDetail.items.evidenceItems,
          todayKnowledgeCards: todayContext.weekWorkspaceDayDetail.items.knowledgeCards,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setDailyReviewState({ loading: false, error: payload.error || 'AI 暂时没有回应。', result: null })
        return
      }
      setDailyReviewState({ loading: false, error: '', result: payload.data || payload })
    } catch {
      setDailyReviewState({ loading: false, error: 'Feynman AI 服务不可用，请确认 npm run server 已启动。', result: null })
    }
  }

  function writeDailyReview() {
    const reviewText = dailyReviewState.result?.reviewText || ''
    if (!reviewText) return
    const timestamp = nowIso()
    setReviews((items) => {
      const safeItems = Array.isArray(items) ? items : []
      const todayReview = safeItems.find((review) => review.date === today)
      if (todayReview) {
        return safeItems.map((review) => review.id === todayReview.id
          ? {
              ...review,
              mainlineAdvanced: [review.mainlineAdvanced, reviewText].filter(Boolean).join('\n\n'),
              firstStepTomorrow: dailyReviewState.result?.tomorrowFirstStep || review.firstStepTomorrow || '',
              updatedAt: timestamp,
            }
          : review)
      }
      return [{
        id: createRecordId('review'),
        date: today,
        createdAt: timestamp,
        mainlineAdvanced: reviewText,
        evidenceLeft: dailyReviewState.result?.learningOutputSummary || '',
        procrastinationOrHyperfocus: dailyReviewState.result?.focusPattern || '',
        firstStepTomorrow: dailyReviewState.result?.tomorrowFirstStep || '',
      }, ...safeItems]
    })
    setStatusMessage('今日费曼复盘已写入 Review。')
  }

  return (
    <section className="rounded-lg border border-wheat/50 bg-white/55 p-5 shadow-soft">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-sage">Feynman Learning Room</p>
          <h2 className="mt-1 text-xl font-semibold text-ink">费曼学习室｜把今天学会的内容讲出来</h2>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center sm:w-[25rem]">
          <Metric label="可讲解" value={closedOutTasks.length} />
          <Metric label="已完成" value={todaySummaryCount} />
          <Metric label="待讲解" value={pendingCount} />
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-ink/65">
          先选一个今日已收尾任务，用自己的话讲给 AI。资料上传和联网搜索只是后续校准。
        </p>
        <button type="button" onClick={() => setRoomOpen((value) => !value)} className="inline-flex w-fit items-center gap-2 rounded-lg bg-sage px-4 py-2.5 text-sm font-medium text-paper">
          {roomOpen ? '收起费曼学习室' : '进入费曼学习室'}
        </button>
      </div>

      {statusMessage && <p className="mt-4 rounded-lg bg-linen/70 px-4 py-3 text-sm text-ink/70">{statusMessage}</p>}

      {roomOpen && (
        <div className="mt-6 space-y-6">
          <TaskChooser
            tasks={closedOutTasks}
            rooms={safeRooms}
            today={today}
            focusSessions={focusSessions}
            onOpenTask={openTaskRoom}
          />

          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
            <Disclosure open={freeOpen} onToggle={() => setFreeOpen((value) => !value)} title="没有对应任务？新建自由讲解主题">
              <div className="grid gap-3 md:grid-cols-[1fr_12rem_auto]">
                <input value={freeTopic} onChange={(event) => setFreeTopic(event.target.value)} placeholder="输入一个自由讲解主题" className="rounded-lg border border-wheat/60 bg-white px-3 py-2 text-sm text-ink" />
                <select value={freeTopicArea} onChange={(event) => setFreeTopicArea(event.target.value)} className="rounded-lg border border-wheat/60 bg-white px-3 py-2 text-sm text-ink">
                  {topicAreas.map((area) => <option key={area}>{area}</option>)}
                </select>
                <button type="button" onClick={createFreeRoom} className="rounded-lg bg-sage px-3 py-2 text-xs font-medium text-paper">开始自由讲解</button>
              </div>
            </Disclosure>

            <Disclosure open={recentOpen} onToggle={() => setRecentOpen((value) => !value)} title="最近讲解记录" compact>
              <div className="space-y-2">
                {recentRooms.map((room) => (
                  <button key={room.id} type="button" onClick={() => setActiveRoomId(room.id)} className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${activeRoom?.id === room.id ? 'bg-sage text-paper' : 'bg-linen text-ink/75'}`}>
                    {room.taskTitle || room.topicTitle}
                  </button>
                ))}
                {recentRooms.length === 0 && <p className="text-sm text-ink/55">还没有 Feynman Room。</p>}
              </div>
            </Disclosure>
          </div>

          {activeRoom ? (
            <RoomWorkspace
              room={activeRoom}
              stageId={stageId}
              messageDraft={messageDraft}
              setMessageDraft={setMessageDraft}
              onSend={() => sendMessage('free_explain', '', 'explain')}
              onQuickAction={(mode, text, nextStage) => sendMessage(mode, text, nextStage)}
              onSearch={runSearch}
              onUploadClick={() => fileInputRef.current?.click()}
              onClearMessages={clearActiveRoomMessages}
              onGenerateSummary={generateSummary}
              onSaveKnowledgeCards={saveKnowledgeCards}
              aiState={aiState}
              summaryState={summaryState}
              moreOpen={moreOpen}
              setMoreOpen={setMoreOpen}
              searchOpen={searchOpen}
              setSearchOpen={setSearchOpen}
              memoryOpen={memoryOpen}
              setMemoryOpen={setMemoryOpen}
              attachmentsOpen={attachmentsOpen}
              setAttachmentsOpen={setAttachmentsOpen}
            />
          ) : (
            <div className="rounded-lg border border-dashed border-wheat/70 bg-paper/60 p-8 text-center text-sm text-ink/60">
              选择一个今日已收尾任务，或创建自由讲解主题后开始。
            </div>
          )}

          <input ref={fileInputRef} type="file" multiple className="hidden" accept=".txt,.md,.csv,.pdf,.docx,.pptx,.xlsx,.png,.jpg,.jpeg" onChange={handleUpload} />

          <DailyReviewPanel
            summaryCount={todaySummaryCount}
            state={dailyReviewState}
            onGenerate={generateDailyReview}
            onWrite={writeDailyReview}
          />
        </div>
      )}
    </section>
  )
}

function TaskChooser({ tasks, rooms, today, focusSessions, onOpenTask }) {
  return (
    <div className="rounded-lg bg-linen/35 p-4">
      <PanelTitle icon={Brain} title="今日已收尾任务" />
      {tasks.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-wheat/70 bg-paper/70 p-4 text-sm text-ink/60">
          今天还没有已收尾任务。你也可以先完成一个 Focus Room 收尾，或直接开始自由讲解。
        </p>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {tasks.map((task) => {
            const room = rooms.find((item) => item.taskId === task.id)
            const area = room?.topicArea || inferTopicArea(task)
            return (
              <article key={task.id} className="rounded-lg bg-paper p-4 shadow-soft">
                <p className="font-semibold leading-6 text-ink">{task.title}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-ink/65">
                  <span className="rounded-lg bg-linen px-2.5 py-1">{area}</span>
                  <span className="rounded-lg bg-linen px-2.5 py-1">今日已专注 {getTodayFocusedMinutesForTask(task, today, focusSessions)} 分钟</span>
                  <span className="rounded-lg bg-linen px-2.5 py-1">🟢 今日已收尾</span>
                </div>
                <button type="button" onClick={() => onOpenTask(task)} className="mt-4 rounded-lg bg-sage px-3 py-2 text-xs font-medium text-paper">
                  {room ? '继续讲解' : '开始讲解'}
                </button>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

function RoomWorkspace({
  room,
  stageId,
  messageDraft,
  setMessageDraft,
  onSend,
  onQuickAction,
  onSearch,
  onUploadClick,
  onClearMessages,
  onGenerateSummary,
  onSaveKnowledgeCards,
  aiState,
  summaryState,
  moreOpen,
  setMoreOpen,
  searchOpen,
  setSearchOpen,
  memoryOpen,
  setMemoryOpen,
  attachmentsOpen,
  setAttachmentsOpen,
}) {
  const latestSummary = room.summaries[room.summaries.length - 1]

  return (
    <div className="space-y-5">
      <div className="rounded-lg bg-paper p-5 shadow-soft">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-sm font-medium text-sage">当前讲解</p>
            <h3 className="mt-1 text-2xl font-semibold leading-9 text-ink">{room.taskTitle || room.topicTitle}</h3>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-ink/65">
              <span className="rounded-lg bg-linen px-3 py-1.5">领域：{room.topicArea}</span>
              {room.taskId && <span className="rounded-lg bg-linen px-3 py-1.5">关联任务</span>}
              <span className="rounded-lg bg-linen px-3 py-1.5">资料：{room.attachments.length} 个</span>
              <span className="rounded-lg bg-linen px-3 py-1.5">最近更新：{formatDateTime(room.updatedAt)}</span>
              <span className="rounded-lg bg-sage px-3 py-1.5 text-paper">当前阶段：{stageLabel(stageId)}</span>
            </div>
            <button
              type="button"
              onClick={onClearMessages}
              disabled={room.messages.length === 0}
              className="mt-4 rounded-lg border border-wheat/70 bg-white px-3 py-2 text-xs font-medium text-ink/70 disabled:cursor-not-allowed disabled:opacity-50"
            >
              清空当前窗口对话
            </button>
          </div>
          <div className="w-full rounded-lg bg-linen/45 p-4 text-sm text-ink/68 xl:w-72">
            <button type="button" onClick={onUploadClick} className="inline-flex items-center gap-2 rounded-lg border border-wheat/70 bg-paper px-3 py-2 text-xs font-medium text-ink/75">
              <Upload className="h-3.5 w-3.5" />
              上传资料
            </button>
            <p className="mt-3 leading-6">上传资料用于后续校准，不会代替你的第一次讲解。</p>
            <button type="button" onClick={() => setAttachmentsOpen((value) => !value)} className="mt-2 text-xs font-medium text-sage">
              已上传资料：{room.attachments.length} 个
            </button>
            {attachmentsOpen && <AttachmentList attachments={room.attachments} />}
          </div>
        </div>
        <StageBar current={stageId} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-4">
          <div className="rounded-lg bg-paper p-5 shadow-soft">
            <MessageList messages={room.messages} />
            <div className="mt-5">
              <textarea
                value={messageDraft}
                onChange={(event) => setMessageDraft(event.target.value)}
                rows="4"
                placeholder="先用自己的话讲一遍..."
                className="w-full resize-none rounded-lg border border-wheat/60 bg-white px-4 py-3 text-sm leading-6 text-ink"
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-ink/50">建议先讲，再让 AI 复述和追问。</p>
                <button type="button" onClick={onSend} disabled={aiState.loading} className="inline-flex items-center gap-2 rounded-lg bg-sage px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-60">
                  <Send className="h-4 w-4" />
                  {aiState.loading ? '等待 AI...' : '发送'}
                </button>
              </div>
            </div>
            {aiState.error && <p className="mt-3 rounded-lg border border-clay/35 bg-linen/70 px-3 py-2 text-sm text-clay">{aiState.error}</p>}
          </div>

          <ActionGroups
            moreOpen={moreOpen}
            setMoreOpen={setMoreOpen}
            searchOpen={searchOpen}
            setSearchOpen={setSearchOpen}
            onQuickAction={onQuickAction}
            onSearch={onSearch}
            onGenerateSummary={onGenerateSummary}
            summaryLoading={summaryState.loading}
          />

          {summaryState.error && <p className="rounded-lg border border-clay/35 bg-linen/70 px-3 py-2 text-sm text-clay">{summaryState.error}</p>}
          {latestSummary && <SummaryView summary={latestSummary} onSaveKnowledgeCards={() => onSaveKnowledgeCards(latestSummary.id)} />}
        </div>

        <aside className="space-y-4">
          <MemoryPanel memory={room.memory} open={memoryOpen} onToggle={() => setMemoryOpen((value) => !value)} />
        </aside>
      </div>
    </div>
  )
}

function StageBar({ current }) {
  const currentIndex = Math.max(0, stages.findIndex((stage) => stage.id === current))
  return (
    <div className="mt-5 grid gap-2 md:grid-cols-6">
      {stages.map((stage, index) => (
        <div key={stage.id} className={`rounded-lg px-3 py-2 text-center text-xs font-medium ${index === currentIndex ? 'bg-sage text-paper' : index < currentIndex ? 'bg-linen text-sage' : 'bg-linen/65 text-ink/55'}`}>
          {index + 1}. {stage.label}
        </div>
      ))}
    </div>
  )
}

function MessageList({ messages }) {
  if (!messages.length) {
    return (
      <div className="rounded-lg border border-dashed border-wheat/70 bg-linen/35 p-8 text-center">
        <p className="text-base font-semibold text-ink">先讲一遍</p>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-ink/62">
          用自己的话讲，不必完整。AI 会先复述听懂了什么，再追问漏洞、给脚手架或示范讲法。
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {messages.map((message) => <MessageBubble key={message.id} message={message} />)}
    </div>
  )
}

function MessageBubble({ message }) {
  const [expanded, setExpanded] = useState(false)
  const isUser = message.role === 'user'
  const isLong = !isUser && message.content.length > 900
  const content = isLong && !expanded ? `${message.content.slice(0, 900)}...` : message.content

  return (
    <article className={`rounded-lg p-4 ${isUser ? 'ml-auto max-w-[85%] bg-sage text-paper' : 'max-w-[92%] bg-linen/70 text-ink'}`}>
      <p className={`text-xs font-medium ${isUser ? 'text-paper/75' : 'text-sage'}`}>{isUser ? '我' : 'Feynman AI'} · {message.mode}</p>
      <div className="mt-2 text-sm leading-7">
        {isUser ? <p className="whitespace-pre-wrap">{content}</p> : <MarkdownContent text={content} />}
      </div>
      {isLong && (
        <button type="button" onClick={() => setExpanded((value) => !value)} className={`mt-3 text-xs font-medium ${isUser ? 'text-paper' : 'text-sage'}`}>
          {expanded ? '收起回复' : '展开完整回复'}
        </button>
      )}
    </article>
  )
}

function MarkdownContent({ text }) {
  const lines = String(text || '').split('\n')
  const blocks = []
  let list = null

  function flushList() {
    if (!list) return
    const Tag = list.ordered ? 'ol' : 'ul'
    blocks.push(
      <Tag key={`list-${blocks.length}`} className={`my-2 space-y-1 ${list.ordered ? 'list-decimal' : 'list-disc'} pl-5`}>
        {list.items.map((item, index) => <li key={index}>{renderInlineMarkdown(item)}</li>)}
      </Tag>,
    )
    list = null
  }

  lines.forEach((line, index) => {
    const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/)
    const unordered = line.match(/^\s*[-*]\s+(.*)$/)
    if (ordered || unordered) {
      const orderedList = Boolean(ordered)
      if (!list || list.ordered !== orderedList) {
        flushList()
        list = { ordered: orderedList, items: [] }
      }
      list.items.push((ordered?.[1] || unordered?.[1] || '').trim())
      return
    }

    flushList()
    if (!line.trim()) {
      blocks.push(<div key={`space-${index}`} className="h-2" />)
      return
    }
    blocks.push(<p key={`p-${index}`} className="my-1">{renderInlineMarkdown(line)}</p>)
  })
  flushList()
  return <>{blocks}</>
}

function renderInlineMarkdown(text) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>
    }
    return <span key={index}>{part}</span>
  })
}

function ActionGroups({ moreOpen, setMoreOpen, searchOpen, setSearchOpen, onQuickAction, onSearch, onGenerateSummary, summaryLoading }) {
  return (
    <div className="rounded-lg bg-paper p-5 shadow-soft">
      <div>
        <p className="text-sm font-semibold text-ink">当前推荐操作</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {recommendedActions.map(([label, mode, text, nextStage]) => (
            <ActionButton key={label} label={label} onClick={() => onQuickAction(mode, text, nextStage)} />
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Disclosure open={moreOpen} onToggle={() => setMoreOpen((value) => !value)} title="更多训练" compact>
          <div className="flex flex-wrap gap-2">
            {trainingActions.map(([label, mode, text, nextStage]) => (
              <ActionButton key={label} label={label} onClick={() => onQuickAction(mode, text, nextStage)} />
            ))}
          </div>
        </Disclosure>

        <Disclosure open={searchOpen} onToggle={() => setSearchOpen((value) => !value)} title="联网校准" compact>
          <div className="flex flex-wrap gap-2">
            {searchActions.map(([label, mode]) => (
              <button key={label} type="button" onClick={() => onSearch(mode)} className="inline-flex items-center gap-1 rounded-lg border border-wheat/70 px-3 py-2 text-xs font-medium text-ink/70">
                <Search className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </Disclosure>
      </div>

      <div className="mt-5 flex justify-end border-t border-wheat/50 pt-4">
        <button type="button" onClick={onGenerateSummary} disabled={summaryLoading} className="rounded-lg bg-clay px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-60">
          {summaryLoading ? '正在生成产出...' : '结束对话并生成卡片'}
        </button>
      </div>
    </div>
  )
}

function MemoryPanel({ memory, open, onToggle }) {
  const hasMemory = [
    memory.masteredConcepts,
    memory.weakConcepts,
    memory.commonConfusions,
    memory.nextReviewQuestions,
  ].some((items) => Array.isArray(items) && items.length > 0)

  return (
    <div className="rounded-lg bg-paper p-4 shadow-soft">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-3 text-left">
        <span className="text-sm font-semibold text-ink">长期学习画像</span>
        {open ? <ChevronDown className="h-4 w-4 text-sage" /> : <ChevronRight className="h-4 w-4 text-sage" />}
      </button>
      {open && (
        hasMemory ? (
          <div className="mt-3 space-y-3">
            <InfoBlock label="已掌握概念" value={arrayText(memory.masteredConcepts)} />
            <InfoBlock label="薄弱概念" value={arrayText(memory.weakConcepts)} />
            <InfoBlock label="常见混淆" value={arrayText(memory.commonConfusions)} />
            <InfoBlock label="下次重点追问" value={arrayText(memory.nextReviewQuestions)} />
          </div>
        ) : (
          <p className="mt-3 text-sm leading-6 text-ink/62">
            这个 Room 还没有形成学习画像。完成一次讲解后，系统会记录你的薄弱点、常见混淆和下次追问重点。
          </p>
        )
      )}
    </div>
  )
}

function AttachmentList({ attachments }) {
  if (!attachments.length) return <p className="mt-3 text-xs text-ink/55">还没有上传资料。</p>
  return (
    <div className="mt-3 space-y-2">
      {attachments.map((attachment) => (
        <div key={attachment.id} className="rounded-lg bg-paper/70 px-3 py-2 text-sm text-ink/70">
          <p className="font-medium text-ink">{attachment.name} · {formatAttachmentSize(attachment.size)}</p>
          {attachment.parseMessage && <p className="mt-1 text-xs text-clay">{attachment.parseMessage}</p>}
        </div>
      ))}
    </div>
  )
}

function SummaryView({ summary, onSaveKnowledgeCards }) {
  if (summary.rawText) {
    return (
      <div className="rounded-lg bg-paper p-5 shadow-soft">
        <p className="text-sm font-semibold text-ink">本次讲解产出</p>
        <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-linen/60 p-4 text-sm text-ink/75">{summary.rawText}</pre>
      </div>
    )
  }

  return (
    <div className="rounded-lg bg-paper p-5 shadow-soft">
      <p className="text-lg font-semibold text-ink">本次讲解产出</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <InfoBlock label="理解诊断｜讲清楚了" value={arrayText(summary.understandingDiagnosis?.explainedWell)} />
        <InfoBlock label="理解诊断｜仍不清楚" value={arrayText(summary.understandingDiagnosis?.unclearPoints)} />
        <InfoBlock label="误区" value={arrayText(summary.understandingDiagnosis?.misconceptions)} />
        <InfoBlock label="明日复习问题" value={arrayText(summary.tomorrowReviewQuestions)} />
      </div>

      <SectionBlock title="Knowledge Cards 建议">
        <div className="grid gap-3 md:grid-cols-2">
          {(summary.suggestedKnowledgeCards || []).map((card, index) => (
            <div key={`${card.title}-${index}`} className="rounded-lg bg-linen/60 p-3 text-sm">
              <p className="font-semibold text-ink">{card.title}</p>
              <p className="mt-1 leading-6 text-ink/70">{card.oneSentence}</p>
            </div>
          ))}
        </div>
        <button type="button" disabled={summary.savedToKnowledgeCards} onClick={onSaveKnowledgeCards} className="mt-3 rounded-lg bg-sage px-3 py-2 text-xs font-medium text-paper disabled:opacity-50">
          {summary.savedToKnowledgeCards ? '已保存到 Knowledge Cards' : '保存到 Knowledge Cards'}
        </button>
      </SectionBlock>

      {(summary.visualCards || []).length > 0 && (
        <SectionBlock title="视觉短卡片">
          <div className="grid gap-3 md:grid-cols-2">
            {summary.visualCards.map((card, index) => (
              <div key={`${card.headline}-${index}`} className="rounded-lg border border-wheat/50 bg-white p-4">
                <p className="font-semibold text-ink">{card.headline}</p>
                <p className="mt-2 text-sm text-ink/70">中心概念：{card.centerConcept}</p>
                <p className="mt-1 text-sm text-ink/70">问题：{card.problem}</p>
                <p className="mt-1 text-sm text-ink/70">方法：{card.method}</p>
                <p className="mt-1 text-sm text-ink/70">例子：{card.example}</p>
                <p className="mt-1 text-sm text-ink/70">应用：{card.application}</p>
                <button type="button" onClick={() => navigator.clipboard?.writeText(JSON.stringify(card, null, 2))} className="mt-3 rounded-lg bg-linen px-3 py-2 text-xs text-ink/70">复制文本</button>
              </div>
            ))}
          </div>
        </SectionBlock>
      )}

      {summary.mindmap && <MindmapView mindmap={summary.mindmap} />}
    </div>
  )
}

function DailyReviewPanel({ summaryCount, state, onGenerate, onWrite }) {
  return (
    <div className="rounded-lg bg-linen/45 p-5">
      <p className="text-sm font-semibold text-ink">今日输出汇总</p>
      {summaryCount === 0 ? (
        <p className="mt-2 text-sm text-ink/62">完成至少一个讲解后，可生成今日费曼复盘。</p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-sm text-ink/62">今天已有 {summaryCount} 个讲解产出。</p>
          <button type="button" onClick={onGenerate} disabled={state.loading} className="inline-flex items-center gap-2 rounded-lg bg-clay px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-60">
            <Sparkles className="h-4 w-4" />
            {state.loading ? '正在生成...' : '生成今日费曼复盘'}
          </button>
        </div>
      )}
      {state.error && <p className="mt-3 rounded-lg border border-clay/35 bg-paper px-4 py-3 text-sm text-clay">{state.error}</p>}
      {state.result && (
        <div className="mt-4 rounded-lg bg-paper p-4">
          <p className="text-sm font-semibold text-ink">今日费曼总复盘</p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink/75">{state.result.reviewText}</p>
          <button type="button" onClick={onWrite} className="mt-4 rounded-lg bg-sage px-3 py-2 text-xs font-medium text-paper">写入 Review</button>
        </div>
      )}
    </div>
  )
}

function MindmapView({ mindmap }) {
  return (
    <SectionBlock title="思维导图">
      {mindmap.mermaid && <pre className="overflow-auto rounded-lg bg-linen/60 p-3 text-xs text-ink/70">{mindmap.mermaid}</pre>}
      <div className="mt-3">
        {(mindmap.nodes || []).map((node) => <MindmapNode key={node.id || node.label} node={node} />)}
      </div>
    </SectionBlock>
  )
}

function MindmapNode({ node }) {
  return (
    <div className="ml-3 border-l border-wheat/70 pl-3">
      <p className="text-sm font-medium text-ink">{node.label}</p>
      {(node.children || []).map((child) => <MindmapNode key={child.id || child.label} node={child} />)}
    </div>
  )
}

function Disclosure({ open, onToggle, title, children, compact = false }) {
  return (
    <div className={`rounded-lg bg-paper ${compact ? 'p-3' : 'p-4'} shadow-soft`}>
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-3 text-left">
        <span className="text-sm font-semibold text-ink">{title}</span>
        {open ? <ChevronDown className="h-4 w-4 text-sage" /> : <ChevronRight className="h-4 w-4 text-sage" />}
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  )
}

function InfoBlock({ label, value }) {
  return (
    <div className="rounded-lg bg-linen/55 p-3">
      <p className="text-xs font-medium text-sage">{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink/72">{value || '暂无'}</p>
    </div>
  )
}

function SectionBlock({ title, children }) {
  return (
    <div className="mt-5">
      <p className="text-sm font-semibold text-sage">{title}</p>
      <div className="mt-3">{children}</div>
    </div>
  )
}

function PanelTitle({ icon: Icon, title }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-sage" />
      <p className="text-sm font-semibold text-ink">{title}</p>
    </div>
  )
}

function ActionButton({ label, onClick }) {
  return (
    <button type="button" onClick={onClick} className="rounded-lg bg-linen px-3 py-2 text-xs font-medium text-ink/70">
      {label}
    </button>
  )
}

function Metric({ label, value }) {
  return (
    <div className="rounded-lg bg-linen/70 px-3 py-2">
      <p className="text-xs text-ink/55">{label}</p>
      <p className="mt-1 text-lg font-semibold text-ink">{value}</p>
    </div>
  )
}

function getTodayClosedOutTasks(tasks, today, focusSessions, activeFocusSession) {
  return (Array.isArray(tasks) ? tasks : [])
    .filter((task) => isTaskActiveToday(task, today) || wasTaskCreatedToday(task, today))
    .filter((task) => getDailyExecutionStatus(task, today, focusSessions, activeFocusSession).id === 'closed_out')
}

function createRoom({ taskId = '', taskTitle = '', topicTitle = '', topicArea = '其他', today }) {
  const timestamp = nowIso()
  return {
    id: createRecordId('feynman-room'),
    taskId,
    taskTitle,
    topicTitle: topicTitle || taskTitle || '自由讲解',
    topicArea,
    dateCreated: today,
    createdAt: timestamp,
    updatedAt: timestamp,
    messages: [],
    attachments: [],
    dailySessions: [],
    memory: emptyMemory,
    summaries: [],
    webSearchResults: [],
  }
}

function normalizeRoom(room, today) {
  return {
    id: room?.id || createRecordId('feynman-room'),
    taskId: room?.taskId || '',
    taskTitle: room?.taskTitle || '',
    topicTitle: room?.topicTitle || room?.taskTitle || '自由讲解',
    topicArea: topicAreas.includes(room?.topicArea) ? room.topicArea : '其他',
    dateCreated: room?.dateCreated || String(room?.createdAt || today).slice(0, 10),
    createdAt: room?.createdAt || nowIso(),
    updatedAt: room?.updatedAt || room?.createdAt || nowIso(),
    messages: Array.isArray(room?.messages) ? room.messages : [],
    attachments: Array.isArray(room?.attachments) ? room.attachments : [],
    dailySessions: Array.isArray(room?.dailySessions) ? room.dailySessions : [],
    memory: normalizeMemory(room?.memory),
    summaries: Array.isArray(room?.summaries) ? room.summaries : [],
    webSearchResults: Array.isArray(room?.webSearchResults) ? room.webSearchResults : [],
  }
}

function normalizeMemory(memory) {
  return {
    ...emptyMemory,
    ...(memory && typeof memory === 'object' ? memory : {}),
    masteredConcepts: safeArray(memory?.masteredConcepts),
    weakConcepts: safeArray(memory?.weakConcepts),
    commonConfusions: safeArray(memory?.commonConfusions),
    bestExplanations: safeArray(memory?.bestExplanations),
    examplesGenerated: safeArray(memory?.examplesGenerated),
    transferApplications: safeArray(memory?.transferApplications),
    preferredScaffolds: safeArray(memory?.preferredScaffolds),
    nextReviewQuestions: safeArray(memory?.nextReviewQuestions),
    aiAdjustmentNotes: memory?.aiAdjustmentNotes || '',
  }
}

function createMessage(role, content, mode) {
  return { id: createRecordId('feynman-message'), role, content, mode, createdAt: nowIso(), date: localToday() }
}

function buildTopic(room) {
  return {
    taskId: room.taskId,
    taskTitle: room.taskTitle,
    topicTitle: room.topicTitle,
    topicArea: room.topicArea,
    goal: '用费曼学习法确认用户是否真正理解，并帮助用户改进讲法。',
  }
}

function buildAttachmentsSummary(room) {
  return room.attachments
    .map((attachment) => [attachment.name, attachment.textSummary || attachment.parseMessage || '未解析'].join('：'))
    .join('\n')
}

function latestUserMessage(room) {
  return [...room.messages].reverse().find((message) => message.role === 'user')?.content || ''
}

function formatSearchResult(payload) {
  const sources = Array.isArray(payload.sources) ? payload.sources : []
  return [
    payload.groundedSupplement || '联网搜索完成。',
    '',
    '来源：',
    ...sources.map((source, index) => `${index + 1}. ${source.title} · ${source.source || source.url}\n${source.url}\n${source.snippet || ''}`),
    '',
    payload.teachBackPrompt || '请你基于这些资料再讲一遍。',
  ].join('\n')
}

async function readTextAttachment(file) {
  const name = file.name.toLowerCase()
  if (file.type.startsWith('text/') || /\.(txt|md|csv)$/i.test(name)) {
    return (await file.text()).slice(0, 6000)
  }
  return ''
}

function inferTopicArea(task) {
  const text = `${task.project || ''} ${task.mainline || ''} ${task.title || ''}`.toLowerCase()
  if (/research|paper|论文|文献|科研/.test(text)) return '科研'
  if (/data|analysis|数据|统计|图表/.test(text)) return '数据分析'
  if (/product|产品|用户|需求/.test(text)) return '产品经理'
  if (/pyramid|金字塔|表达|结构/.test(text)) return '金字塔原理'
  return '其他'
}

function countTodaySummaries(rooms, today) {
  return rooms.reduce((count, room) => count + room.summaries.filter((summary) => isTodayRecord(summary, today)).length, 0)
}

function isTodayRecord(record, today) {
  return String(record?.date || record?.createdAt || '').slice(0, 10) === today
}

function arrayText(value) {
  const items = safeArray(value)
  return items.length ? items.join('、') : '暂无'
}

function stageLabel(stageId) {
  const index = stages.findIndex((stage) => stage.id === stageId)
  const stage = stages[index] || stages[0]
  return `第 ${Math.max(1, index + 1)} 步｜${stage.label}`
}

function formatDateTime(value) {
  if (!value) return '未记录'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${month}-${day} ${hour}:${minute}`
}

function safeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}
