import { useEffect, useMemo, useState } from 'react'
import { Check, Filter, Pencil, Play, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { formatFocusedMinutes, getFocusedMinutesByTask } from '../utils/focusStats'
import { createRecordId, deleteById, upsertById } from '../utils/records'
import { endOfWeek, getRecordDate, localToday, startOfWeek } from '../utils/dateRecords'
import { isCompletedTaskStatus, normalizeTaskStatus } from '../utils/taskStatus'
import { doesTaskOverlapRange, getTaskRangeStatus, getTaskRangeStatusLabel } from '../utils/taskDateUtils'

const versionGoals = ['V0', 'V1', 'V2']
const priorities = ['P1', 'P2', 'P3', 'P4', 'P5']
const statusOptions = ['全部状态', '待执行', '执行中', '已完成']

const emptyTask = {
  title: '',
  project: '',
  mainline: '',
  reason: '',
  versionGoal: 'V0',
  nextAction: '',
  estimatedMinutes: 25,
  completionStandard: '',
  output: '',
  fallbackAction: '',
  deadline: '',
  date: '',
  createdAt: '',
  completedAt: '',
  archivedAt: '',
  priority: 'P3',
  status: 'not_started',
}

const emptyAiCoachInput = {
  mood: '正常',
  taskDescription: '',
  currentProgress: '',
  availableMinutes: 45,
  blockers: '',
  relatedProject: '',
  targetVersion: 'V0',
  recentReview: '',
}

export function TaskBreakdownPage({ tasks, setTasks, settings, setSettings, focusSessions, taskCardOrder, setTaskCardOrder }) {
  const today = localToday()
  const normalizedTasks = useMemo(() => (Array.isArray(tasks) ? tasks : []).map((task) => normalizeTask(task, today)), [tasks, today])
  const focusedMinutesByTask = useMemo(() => getFocusedMinutesByTask(focusSessions), [focusSessions])
  const [draft, setDraft] = useState(() => ({ ...emptyTask, date: today, createdAt: today }))
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [statusFilter, setStatusFilter] = useState('全部状态')
  const [projectFilter, setProjectFilter] = useState('全部项目')
  const [viewFilter, setViewFilter] = useState('本周')
  const [aiCoachOpen, setAiCoachOpen] = useState(false)
  const [aiInput, setAiInput] = useState(() => ({ ...emptyAiCoachInput }))
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [aiResult, setAiResult] = useState(null)
  const [aiCreateMessage, setAiCreateMessage] = useState('')
  const [draggedTaskId, setDraggedTaskId] = useState(null)
  const [dragOverTaskId, setDragOverTaskId] = useState(null)

  useEffect(() => {
    if (JSON.stringify(tasks) !== JSON.stringify(normalizedTasks)) {
      setTasks(normalizedTasks)
    }
  }, [normalizedTasks, setTasks, tasks])

  const projectOptions = useMemo(
    () => ['全部项目', ...Array.from(new Set(normalizedTasks.map((task) => task.project).filter(Boolean)))],
    [normalizedTasks],
  )

  const weekStart = startOfWeek(today)
  const weekEnd = endOfWeek(today)

  const orderIds = Array.isArray(taskCardOrder) ? taskCardOrder : []
  const orderedTasks = sortTasksByCustomOrder(normalizedTasks, orderIds)
  const filteredTasks = orderedTasks.filter((task) => {
    const rangeStatus = getTaskRangeStatus(task, today)
    const rangeStatusLabel = getTaskRangeStatusLabel(rangeStatus)
    const matchesStatus = statusFilter === '全部状态' || rangeStatusLabel === statusFilter
    const matchesProject = projectFilter === '全部项目' || task.project === projectFilter
    const matchesView =
      viewFilter === '全部' ||
      (viewFilter === '今日' && rangeStatus === 'active') ||
      (viewFilter === '本周' && doesTaskOverlapRange(task, weekStart, weekEnd))
    return matchesStatus && matchesProject && matchesView
  })

  const currentFocusTask = normalizedTasks.find((task) => task.id === settings.currentFocusTaskId)

  function resetForm() {
    setDraft({ ...emptyTask, date: today, createdAt: today })
    setEditingId(null)
    setShowForm(false)
  }

  function handleSubmit(event) {
    event.preventDefault()
    const existingTask = editingId ? normalizedTasks.find((item) => item.id === editingId) : null
    const status = editingId ? normalizeTaskStatus(existingTask?.status ?? draft.status) : 'not_started'
    const task = {
      ...draft,
      id: editingId ?? createRecordId('task'),
      date: draft.date || today,
      createdAt: draft.createdAt || today,
      completedAt: isCompletedTaskStatus(status) ? (draft.completedAt || today) : draft.completedAt,
      estimatedMinutes: Number(draft.estimatedMinutes || 0),
      status,
    }
    setTasks((items) => upsertById((Array.isArray(items) ? items : []).map((item) => normalizeTask(item, today)), task))
    resetForm()
  }

  function handleEdit(task) {
    setDraft(normalizeTask(task))
    setEditingId(task.id)
    setShowForm(true)
  }

  function handleDelete(id) {
    setTasks((items) => deleteById(items, id))
    if (settings.currentFocusTaskId === id) {
      setSettings({ ...settings, currentFocusTaskId: null })
    }
  }

  function handleStartFocus(task) {
    setTasks((items) =>
      items.map((item) =>
        item.id === task.id ? { ...normalizeTask(item), lastWorkedAt: new Date().toISOString() } : normalizeTask(item),
      ),
    )
    setSettings({ ...settings, currentFocusTaskId: task.id })
  }

  function handleDragStart(taskId) {
    setDraggedTaskId(taskId)
  }

  function handleDragOver(event, taskId) {
    event.preventDefault()
    if (taskId !== dragOverTaskId) setDragOverTaskId(taskId)
  }

  function handleDrop(event, targetTaskId) {
    event.preventDefault()
    if (!draggedTaskId || draggedTaskId === targetTaskId) {
      setDraggedTaskId(null)
      setDragOverTaskId(null)
      return
    }

    const currentOrder = mergeTaskOrder(orderIds, normalizedTasks)
    const nextOrder = moveIdBeforeTarget(currentOrder, draggedTaskId, targetTaskId)
    setTaskCardOrder(nextOrder)
    setDraggedTaskId(null)
    setDragOverTaskId(null)
  }

  function handleDragEnd() {
    setDraggedTaskId(null)
    setDragOverTaskId(null)
  }

  async function handleAiCoachSubmit(event) {
    event.preventDefault()
    await requestAiBreakdown()
  }

  async function requestAiBreakdown() {
    setAiLoading(true)
    setAiError('')
    setAiCreateMessage('')
    setAiResult(null)

    try {
      const response = await fetch('/api/deepseek/task-breakdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aiInput),
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        setAiError(payload.error || 'AI 服务暂时不可用，请确认 npm run server 已启动。')
        return
      }

      const parsed = parseAiPayload(payload)
      setAiResult(parsed)
    } catch {
      setAiError('AI 服务暂时不可用，请确认 npm run server 已启动。')
    } finally {
      setAiLoading(false)
    }
  }

  function handleFillSuggestedTask(task) {
    setDraft(normalizeSuggestedTask(task, aiInput, today, { includeId: false }))
    setEditingId(null)
    setShowForm(true)
    setAiCreateMessage('已填入任务表单，你可以修改后保存。')
    window.setTimeout(() => {
      document.getElementById('task-form-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
  }

  function handleCreateSuggestedTask(task) {
    const createdTask = normalizeSuggestedTask(task, aiInput, today)
    setTasks((items) => [createdTask, ...(Array.isArray(items) ? items : []).map((item) => normalizeTask(item, today))])
    setAiCreateMessage('已创建任务。')
    setViewFilter('本周')
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-wheat/50 bg-white/55 p-5 shadow-soft">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-sm font-medium text-sage">Task Breakdown</p>
            <h2 className="mt-1 text-xl font-semibold text-ink">任务拆解器</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/62">
              把任务拆成可启动、可完成、可留下证据的下一步。筛选、编辑和专注状态都会保存到 localStorage。
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setDraft({ ...emptyTask, date: today, createdAt: today })
              setEditingId(null)
              setShowForm(true)
            }}
            className="inline-flex w-fit items-center gap-2 rounded-lg bg-sage px-4 py-2.5 text-sm font-medium text-paper"
          >
            <Plus className="h-4 w-4" />
            新增任务
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <SelectField
            icon={Filter}
            label="视图"
            value={viewFilter}
            options={['今日', '本周', '全部']}
            onChange={setViewFilter}
          />
          <SelectField
            icon={Filter}
            label="按状态筛选"
            value={statusFilter}
            options={statusOptions}
            onChange={setStatusFilter}
            formatOption={(option) => option}
          />
          <SelectField
            icon={Filter}
            label="按项目筛选"
            value={projectFilter}
            options={projectOptions}
            onChange={setProjectFilter}
          />
          <div className="rounded-lg border border-wheat/50 bg-linen/60 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-sage">Current Focus</p>
            <p className="mt-1 max-w-xs truncate text-sm font-medium text-ink">
              {currentFocusTask ? currentFocusTask.title : '尚未选择'}
            </p>
          </div>
        </div>
      </section>

      <AiCoachPanel
        open={aiCoachOpen}
        setOpen={setAiCoachOpen}
        input={aiInput}
        setInput={setAiInput}
        loading={aiLoading}
        error={aiError}
        result={aiResult}
        createMessage={aiCreateMessage}
        onSubmit={handleAiCoachSubmit}
        onRegenerate={requestAiBreakdown}
        onFillSuggestedTask={handleFillSuggestedTask}
        onCreateSuggestedTask={handleCreateSuggestedTask}
      />

      {showForm && (
        <TaskForm
          draft={draft}
          setDraft={setDraft}
          isEditing={editingId !== null}
          onCancel={resetForm}
          onSubmit={handleSubmit}
        />
      )}

      <section className="grid gap-4 xl:grid-cols-2">
        {filteredTasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            isCurrentFocus={settings.currentFocusTaskId === task.id}
            onEdit={() => handleEdit(task)}
            onDelete={() => handleDelete(task.id)}
            onStartFocus={() => handleStartFocus(task)}
            focusedMinutes={focusedMinutesByTask.get(task.id) ?? 0}
            today={today}
            dragging={draggedTaskId === task.id}
            dragOver={dragOverTaskId === task.id && draggedTaskId !== task.id}
            onDragStart={() => handleDragStart(task.id)}
            onDragOver={(event) => handleDragOver(event, task.id)}
            onDrop={(event) => handleDrop(event, task.id)}
            onDragEnd={handleDragEnd}
          />
        ))}
      </section>

      {filteredTasks.length === 0 && (
        <div className="rounded-lg border border-dashed border-wheat/70 bg-white/45 p-8 text-center text-sm text-ink/60">
          当前筛选条件下没有任务。
        </div>
      )}
    </div>
  )
}

function TaskForm({ draft, setDraft, isEditing, onCancel, onSubmit }) {
  return (
    <form id="task-form-panel" onSubmit={onSubmit} className="rounded-lg border border-wheat/50 bg-white/55 p-5 shadow-soft">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink">{isEditing ? '编辑任务' : '新增任务'}</h2>
          <p className="mt-1 text-sm text-ink/60">字段较多，按“定义任务、执行约束、交付证据”分区填写。</p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex w-fit items-center gap-2 rounded-lg border border-wheat/60 px-3 py-2 text-sm text-ink/70"
        >
          <X className="h-4 w-4" />
          收起
        </button>
      </div>

      <div className="space-y-6">
        <FieldGroup title="定义任务">
          <TextField label="Title" value={draft.title} onChange={(value) => setDraft({ ...draft, title: value })} required />
          <TextField label="Project" value={draft.project} onChange={(value) => setDraft({ ...draft, project: value })} required />
          <TextField label="Mainline" value={draft.mainline} onChange={(value) => setDraft({ ...draft, mainline: value })} />
          <SelectInput label="Version Goal" value={draft.versionGoal} options={versionGoals} onChange={(value) => setDraft({ ...draft, versionGoal: value })} />
          <TextareaField label="Reason" value={draft.reason} onChange={(value) => setDraft({ ...draft, reason: value })} />
        </FieldGroup>

        <FieldGroup title="执行约束">
          <TextareaField label="Next Action" value={draft.nextAction} onChange={(value) => setDraft({ ...draft, nextAction: value })} required />
          <TextField
            label="Estimated Minutes"
            type="number"
            min="1"
            value={draft.estimatedMinutes}
            onChange={(value) => setDraft({ ...draft, estimatedMinutes: value })}
          />
          <TextareaField label="Fallback Action" value={draft.fallbackAction} onChange={(value) => setDraft({ ...draft, fallbackAction: value })} />
          <TextField label="Date" type="date" value={draft.date} onChange={(value) => setDraft({ ...draft, date: value })} />
          <TextField label="Deadline" type="date" value={draft.deadline} onChange={(value) => setDraft({ ...draft, deadline: value })} />
          <SelectInput label="Priority" value={draft.priority} options={priorities} onChange={(value) => setDraft({ ...draft, priority: value })} />
        </FieldGroup>

        <FieldGroup title="交付证据">
          <TextareaField label="Completion Standard" value={draft.completionStandard} onChange={(value) => setDraft({ ...draft, completionStandard: value })} />
          <TextareaField label="Output" value={draft.output} onChange={(value) => setDraft({ ...draft, output: value })} />
        </FieldGroup>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-sage px-4 py-2.5 text-sm font-medium text-paper">
          <Check className="h-4 w-4" />
          {isEditing ? '保存任务' : '创建任务'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-wheat/60 px-4 py-2.5 text-sm font-medium text-ink/70">
          取消
        </button>
      </div>
    </form>
  )
}

function AiCoachPanel({
  open,
  setOpen,
  input,
  setInput,
  loading,
  error,
  result,
  createMessage,
  onSubmit,
  onRegenerate,
  onFillSuggestedTask,
  onCreateSuggestedTask,
}) {
  const suggestedTasks = result?.suggestedTasks || []

  return (
    <section className="rounded-lg border border-wheat/50 bg-white/55 p-5 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-sage">AI 任务拆解教练</p>
          <h2 className="mt-1 text-lg font-semibold text-ink">把卡住的任务拆成下一步</h2>
        </div>
        <button type="button" onClick={() => setOpen(!open)} className="rounded-lg border border-wheat/70 px-3 py-2 text-sm text-ink/70">
          {open ? '收起' : '展开'}
        </button>
      </div>

      {open && (
        <div className="mt-5 space-y-5">
          <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
            <SelectInput label="当前情绪" value={input.mood} options={['焦虑', '拖延', '疲惫', '混乱', '正常', '有动力']} onChange={(value) => setInput({ ...input, mood: value })} />
            <TextField label="关联项目" value={input.relatedProject} onChange={(value) => setInput({ ...input, relatedProject: value })} />
            <SelectInput label="今日可用时间" value={String(input.availableMinutes)} options={['15', '45', '90', '120']} onChange={(value) => setInput({ ...input, availableMinutes: Number(value) })} />
            <SelectInput label="期望目标" value={input.targetVersion} options={versionGoals} onChange={(value) => setInput({ ...input, targetVersion: value })} />
            <TextareaField label="当前任务描述" value={input.taskDescription} onChange={(value) => setInput({ ...input, taskDescription: value })} required />
            <TextareaField label="当前完成状态" value={input.currentProgress} onChange={(value) => setInput({ ...input, currentProgress: value })} />
            <TextareaField label="卡点" value={input.blockers} onChange={(value) => setInput({ ...input, blockers: value })} />
            <TextareaField label="最近复盘" value={input.recentReview} onChange={(value) => setInput({ ...input, recentReview: value })} />
            <div className="md:col-span-2">
              <button type="submit" disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-sage px-4 py-2.5 text-sm font-medium text-paper disabled:cursor-not-allowed disabled:opacity-60">
                <Sparkles className="h-4 w-4" />
                {loading ? 'AI 正在拆解...' : '让 AI 帮我拆解任务'}
              </button>
            </div>
          </form>

          {error && <p className="rounded-lg border border-clay/35 bg-linen/70 px-4 py-3 text-sm text-clay">{error}</p>}
          {result && <AiResultView result={result} loading={loading} onRegenerate={onRegenerate} />}

          {suggestedTasks.length > 0 && (
            <div className="rounded-lg border border-wheat/50 bg-linen/50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-ink">推荐任务列表</p>
                <p className="text-sm text-ink/60">可以逐条填入表单或直接创建。</p>
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-3">
                {suggestedTasks.map((task, index) => (
                  <SuggestedTaskCard
                    key={getSuggestedTaskId(task, index)}
                    task={task}
                    index={index}
                    onFill={() => onFillSuggestedTask(task)}
                    onCreate={() => onCreateSuggestedTask(task)}
                  />
                ))}
              </div>
              {createMessage && <p className="mt-3 text-sm text-sage">{createMessage}</p>}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function AiResultView({ result, loading, onRegenerate }) {
  if (result.rawText) {
    return (
      <div className="rounded-lg border border-wheat/50 bg-linen/50 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-clay">AI 这次没有返回标准结构，你可以参考原文，但不能一键创建任务。</p>
          <button type="button" disabled={loading} onClick={onRegenerate} className="rounded-lg border border-wheat/70 px-3 py-2 text-sm font-medium text-ink/70 disabled:cursor-not-allowed disabled:opacity-60">
            {loading ? '重新生成中...' : '重新生成结构化结果'}
          </button>
        </div>
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-medium text-sage">查看 AI 原文</summary>
          <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-paper p-3 text-sm leading-6 text-ink/75">{result.rawText}</pre>
        </details>
      </div>
    )
  }

  const fields = [
    ['diagnosis', '当前卡住原因'],
    ['suggestedMindset', '建议心态'],
    ['v0Goal', 'V0 粗糙版目标'],
    ['v1Goal', 'V1 可交付版目标'],
    ['v2Goal', 'V2 优化版目标'],
    ['startAction15min', '15分钟启动动作'],
    ['standardAction45min', '45分钟标准动作'],
    ['deepWorkAction90min', '90分钟深度动作'],
    ['completionStandard', '本轮完成标准'],
    ['output', '本轮输出物'],
    ['fallbackAction', '卡住时最低动作'],
    ['antiHyperfocusStopPoint', '防沉浸停止点'],
  ]

  return (
    <div className="rounded-lg border border-wheat/50 bg-linen/50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-ink">AI 拆解结果</p>
        <button type="button" disabled={loading} onClick={onRegenerate} className="rounded-lg border border-wheat/70 px-3 py-2 text-sm font-medium text-ink/70 disabled:cursor-not-allowed disabled:opacity-60">
          {loading ? '重新生成中...' : '重新生成'}
        </button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {fields.map(([key, label]) => (
          <InfoBlock key={key} label={label} value={formatAiValue(result[key])} strong={['v0Goal', 'startAction15min', 'completionStandard'].includes(key)} />
        ))}
      </div>
    </div>
  )
}

function SuggestedTaskCard({ task, index, onFill, onCreate }) {
  return (
    <article className="rounded-lg border border-wheat/45 bg-paper p-4 text-sm text-ink/75">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="sage">{task.priority || 'P3'}</Badge>
        <Badge>{task.versionGoal || 'V0'}</Badge>
        <Badge>{Number(task.estimatedMinutes || 45)} min</Badge>
      </div>
      <h3 className="mt-3 font-semibold leading-6 text-ink">{task.title || task.name || `推荐任务 ${index + 1}`}</h3>
      <p className="mt-2 leading-6">{task.nextAction || task.description || '未提供下一步动作'}</p>
      <div className="mt-3 space-y-2">
        <InfoBlock label="完成标准" value={task.completionStandard || '未提供'} />
        <InfoBlock label="兜底动作" value={task.fallbackAction || '先完成最粗糙版本，不追求完美'} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={onFill} className="rounded-lg border border-wheat/70 px-3 py-2 text-sm font-medium text-ink/70">
          填入任务表单
        </button>
        <button type="button" onClick={onCreate} className="rounded-lg bg-sage px-3 py-2 text-sm font-medium text-paper">
          直接创建任务
        </button>
      </div>
    </article>
  )
}

function TaskCard({
  task,
  isCurrentFocus,
  onEdit,
  onDelete,
  onStartFocus,
  focusedMinutes,
  today,
  dragging,
  dragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}) {
  const rangeStatus = getTaskRangeStatus(task, today)
  const rangeStatusLabel = getTaskRangeStatusLabel(rangeStatus)
  const cardClasses = [
    'rounded-lg border bg-white/55 p-5 shadow-soft transition',
    dragOver ? 'border-sage ring-2 ring-sage/25' : 'border-wheat/50',
    dragging ? 'opacity-55' : '',
  ].filter(Boolean).join(' ')

  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cardClasses}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="sage">{task.priority}</Badge>
            <Badge>{task.versionGoal}</Badge>
            <Badge>{rangeStatusLabel}</Badge>
            {isCurrentFocus && <Badge tone="clay">当前专注</Badge>}
            <Badge>已专注：{formatFocusedMinutes(focusedMinutes)}</Badge>
            <Badge>拖拽排序</Badge>
          </div>
          <h3 className="mt-3 text-lg font-semibold leading-7 text-ink">{task.title}</h3>
          <p className="mt-1 text-sm text-ink/60">{task.project} · {task.mainline || '未设置主线'}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <IconButton label="开始专注" icon={Play} onClick={onStartFocus} primary />
          <IconButton label="编辑" icon={Pencil} onClick={onEdit} />
          <IconButton label="删除" icon={Trash2} onClick={onDelete} danger />
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <InfoBlock label="Reason" value={task.reason} />
        <InfoBlock label="Next Action" value={task.nextAction} strong />
        <InfoBlock label="Completion Standard" value={task.completionStandard} />
        <InfoBlock label="Output" value={task.output} />
        <InfoBlock label="Fallback Action" value={task.fallbackAction} />
        <div className="rounded-lg bg-linen/60 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-sage">Time / Deadline</p>
          <p className="mt-2 text-sm leading-6 text-ink/75">
            {task.estimatedMinutes || 0} min · {task.date || 'No date'} · {task.deadline || 'No deadline'}
          </p>
        </div>
      </div>
    </article>
  )
}

function FieldGroup({ title, children }) {
  return (
    <fieldset className="rounded-lg border border-wheat/40 bg-paper/45 p-4">
      <legend className="px-2 text-sm font-semibold text-sage">{title}</legend>
      <div className="mt-2 grid gap-4 md:grid-cols-2">{children}</div>
    </fieldset>
  )
}

function TextField({ label, value, onChange, type = 'text', required = false, min }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink/75">{label}</span>
      <input
        type={type}
        min={min}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className="mt-2 w-full rounded-lg border border-wheat/60 bg-white/80 px-4 py-3 text-sm text-ink"
      />
    </label>
  )
}

function TextareaField({ label, value, onChange, required = false }) {
  return (
    <label className="block md:col-span-2">
      <span className="text-sm font-medium text-ink/75">{label}</span>
      <textarea
        rows="3"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className="mt-2 w-full resize-none rounded-lg border border-wheat/60 bg-white/80 px-4 py-3 text-sm leading-6 text-ink"
      />
    </label>
  )
}

function SelectInput({ label, value, options, onChange }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink/75">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-lg border border-wheat/60 bg-white/80 px-4 py-3 text-sm text-ink"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

function SelectField({ icon: Icon, label, value, options, onChange, formatOption = (option) => option }) {
  return (
    <label className="block rounded-lg border border-wheat/50 bg-linen/60 px-4 py-3">
      <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-sage">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full bg-transparent text-sm font-medium text-ink"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {formatOption(option)}
          </option>
        ))}
      </select>
    </label>
  )
}

function InfoBlock({ label, value, strong = false }) {
  return (
    <div className="rounded-lg bg-linen/60 p-4">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-sage">{label}</p>
      <p className={`mt-2 text-sm leading-6 ${strong ? 'font-semibold text-ink' : 'text-ink/75'}`}>
        {value || '未填写'}
      </p>
    </div>
  )
}

function Badge({ children, tone = 'default' }) {
  const classes =
    tone === 'sage'
      ? 'bg-sage text-paper'
      : tone === 'clay'
        ? 'bg-clay text-paper'
        : 'bg-linen text-ink/70'

  return <span className={`inline-flex rounded-lg px-3 py-1 text-xs font-medium ${classes}`}>{children}</span>
}

function IconButton({ label, icon: Icon, onClick, primary = false, danger = false }) {
  const classes = primary
    ? 'bg-sage text-paper'
    : danger
      ? 'bg-linen text-clay'
      : 'bg-linen text-ink/70'

  return (
    <button type="button" onClick={onClick} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${classes}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}

function normalizeTask(task, fallbackDate = localToday()) {
  const date = getRecordDate(task, fallbackDate)
  return {
    ...emptyTask,
    id: task.id,
    title: task.title ?? '',
    project: task.project ?? task.course ?? '',
    mainline: task.mainline ?? '',
    reason: task.reason ?? '',
    versionGoal: versionGoals.includes(task.versionGoal) ? task.versionGoal : 'V0',
    nextAction: task.nextAction ?? (Array.isArray(task.steps) ? task.steps[0] : ''),
    estimatedMinutes: Number(task.estimatedMinutes ?? 25),
    completionStandard: task.completionStandard ?? (Array.isArray(task.steps) ? task.steps.join('；') : ''),
    output: task.output ?? '',
    fallbackAction: task.fallbackAction ?? '',
    deadline: task.deadline ?? '',
    date,
    createdAt: task.createdAt ?? date,
    completedAt: task.completedAt ?? '',
    archivedAt: task.archivedAt ?? '',
    priority: priorities.includes(task.priority) ? task.priority : 'P3',
    status: normalizeTaskStatus(task.status),
  }
}

function sortTasksByCustomOrder(tasks, orderIds) {
  const safeTasks = Array.isArray(tasks) ? tasks : []
  const rank = new Map((Array.isArray(orderIds) ? orderIds : []).map((id, index) => [id, index]))
  return [...safeTasks].sort((a, b) => {
    const aRank = rank.has(a.id) ? rank.get(a.id) : Number.POSITIVE_INFINITY
    const bRank = rank.has(b.id) ? rank.get(b.id) : Number.POSITIVE_INFINITY
    if (aRank !== bRank) return aRank - bRank
    return 0
  })
}

function mergeTaskOrder(orderIds, tasks) {
  const taskIds = (Array.isArray(tasks) ? tasks : []).map((task) => task.id).filter(Boolean)
  const existing = (Array.isArray(orderIds) ? orderIds : []).filter((id) => taskIds.includes(id))
  const missing = taskIds.filter((id) => !existing.includes(id))
  return [...existing, ...missing]
}

function moveIdBeforeTarget(orderIds, movedId, targetId) {
  const withoutMoved = orderIds.filter((id) => id !== movedId)
  const targetIndex = withoutMoved.indexOf(targetId)
  if (targetIndex < 0) return [...withoutMoved, movedId]
  return [...withoutMoved.slice(0, targetIndex), movedId, ...withoutMoved.slice(targetIndex)]
}

function parseAiPayload(payload) {
  if (payload?.structured === true) return normalizeAiResult(payload.data || {})
  if (payload?.structured === false) {
    return {
      structured: false,
      rawText: payload.raw || '',
      warning: payload.warning || 'AI 返回内容不是标准 JSON',
      suggestedTasks: [],
    }
  }

  const content = payload?.choices?.[0]?.message?.content ?? payload?.content ?? payload?.text ?? payload
  if (content && typeof content === 'object') return normalizeAiResult(content)

  const text = String(content ?? '')
  const jsonText = extractJsonText(text)
  if (!jsonText) return { rawText: text }

  try {
    return normalizeAiResult(JSON.parse(jsonText))
  } catch {
    return { rawText: text }
  }
}

function normalizeAiResult(result) {
  return {
    structured: true,
    diagnosis: result.diagnosis ?? '',
    suggestedMindset: result.suggestedMindset ?? '',
    v0Goal: result.v0Goal ?? '',
    v1Goal: result.v1Goal ?? '',
    v2Goal: result.v2Goal ?? '',
    startAction15min: result.startAction15min ?? '',
    standardAction45min: result.standardAction45min ?? '',
    deepWorkAction90min: result.deepWorkAction90min ?? '',
    completionStandard: result.completionStandard ?? '',
    output: result.output ?? '',
    fallbackAction: result.fallbackAction ?? '',
    antiHyperfocusStopPoint: result.antiHyperfocusStopPoint ?? '',
    suggestedTasks: Array.isArray(result.suggestedTasks) ? result.suggestedTasks : [],
  }
}

function extractJsonText(text) {
  const trimmed = text.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) return fenced[1].trim()
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  return start >= 0 && end > start ? trimmed.slice(start, end + 1) : ''
}

function formatAiValue(value) {
  if (Array.isArray(value)) return value.join('\n')
  if (value && typeof value === 'object') return JSON.stringify(value, null, 2)
  return value || '未提供'
}

function getSuggestedTaskId(task, index) {
  return `${index}-${task.id || task.title || task.name || 'task'}`
}

function normalizeSuggestedTask(task, aiInput, today, options = {}) {
  const title = task.title || task.name || aiInput.taskDescription || 'AI 推荐任务'
  const normalizedTask = {
    ...emptyTask,
    title,
    project: task.project || aiInput.relatedProject || '',
    mainline: task.mainline || '',
    reason: task.reason || aiInput.blockers || '',
    versionGoal: versionGoals.includes(task.versionGoal) ? task.versionGoal : aiInput.targetVersion,
    nextAction: task.nextAction || task.startAction || task.description || aiInput.taskDescription,
    estimatedMinutes: Number(task.estimatedMinutes || aiInput.availableMinutes || 45),
    completionStandard: task.completionStandard || '',
    output: task.output || title,
    fallbackAction: task.fallbackAction || '先完成最粗糙版本，不追求完美',
    deadline: task.deadline || '',
    date: today,
    createdAt: new Date().toISOString(),
    priority: task.priority || 'P3',
    status: 'not_started',
  }
  return options.includeId === false ? normalizedTask : { ...normalizedTask, id: createRecordId('task') }
}
