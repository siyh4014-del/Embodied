import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, FilePlus2, Pause, Play, RotateCcw, TimerReset } from 'lucide-react'
import { getFocusedMinutesByTask, getFocusSessionLocalDate, getFocusSessionMinutes } from '../utils/focusStats'
import { createRecordId } from '../utils/records'
import { localToday, nowIso } from '../utils/dateRecords'
import { getTaskRangeStatus } from '../utils/taskExecutionStatus'

const TASK_FOCUS_LIMIT_MINUTES = 180
const CONTINUE_LIMIT_MINUTES = 25

const focusModes = [
  { id: 'starter', label: '启动模式', minutes: 15 },
  { id: 'standard', label: '标准模式', minutes: 45 },
  { id: 'deep', label: '深度模式', minutes: 90 },
]

const emptyWrapUp = {
  completedWhat: '',
  missingWhat: '',
  nextStep: '',
  reachedStandard: false,
  sendToParkingLot: false,
  createEvidence: false,
}

const emptyQuickTask = {
  title: '',
  project: '',
  versionGoal: 'V0',
  nextAction: '',
  completionStandard: '',
  output: '',
  estimatedMinutes: 25,
  priority: 'P3',
}

export function FocusRoomPage({
  tasks,
  currentTask,
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
  const safeSettings = settings ?? {}
  const safeSetSettings = typeof setSettings === 'function' ? setSettings : () => {}
  const safeSetTasks = typeof setTasks === 'function' ? setTasks : () => {}
  const safeSetParkingItems = typeof setParkingItems === 'function' ? setParkingItems : () => {}
  const safeSetEvidenceItems = typeof setEvidenceItems === 'function' ? setEvidenceItems : () => {}
  const safeSetFocusSessions = typeof setFocusSessions === 'function' ? setFocusSessions : () => {}
  const safeSetActiveFocusSession = typeof setActiveFocusSession === 'function' ? setActiveFocusSession : () => {}
  const safeSetActivePage = typeof setActivePage === 'function' ? setActivePage : () => {}
  const [selectedModeId, setSelectedModeId] = useState('starter')
  const [customSessionMinutes, setCustomSessionMinutes] = useState(null)
  const selectedMode = focusModes.find((mode) => mode.id === selectedModeId) ?? focusModes[0]
  const sessionMinutes = customSessionMinutes ?? selectedMode.minutes
  const initialSeconds = sessionMinutes * 60
  const [remainingSeconds, setRemainingSeconds] = useState(initialSeconds)
  const [isRunning, setIsRunning] = useState(false)
  const [sessionState, setSessionState] = useState('idle')
  const [wrapUp, setWrapUp] = useState(emptyWrapUp)
  const [activeChainId, setActiveChainId] = useState(null)
  const [activeRound, setActiveRound] = useState(null)
  const [completedRounds, setCompletedRounds] = useState([])
  const [quickTask, setQuickTask] = useState(emptyQuickTask)
  const [quickStartTaskId, setQuickStartTaskId] = useState(null)
  const [notificationStatus, setNotificationStatus] = useState(() => getNotificationStatus())
  const [showRestModal, setShowRestModal] = useState(false)
  const [restDismissed, setRestDismissed] = useState(false)
  const [focusLimitPrompt, setFocusLimitPrompt] = useState(null)
  const [timerAnchor, setTimerAnchor] = useState(null)
  const todayFocusedMinutesByTask = useMemo(
    () => getFocusedMinutesByTask(
      safeFocusSessions.filter((session) => getFocusSessionLocalDate(session, localToday()) === localToday()),
    ),
    [safeFocusSessions],
  )
  const chainMinutes = useMemo(
    () => completedRounds.reduce((sum, round) => sum + Number(round.actualMinutes || 0), 0),
    [completedRounds],
  )

  useEffect(() => {
    if (sessionState === 'idle') {
      setRemainingSeconds(initialSeconds)
    }
  }, [initialSeconds, sessionState])

  useEffect(() => {
    if (!activeFocusSession?.taskId || !currentTask?.id) return
    if (activeFocusSession.taskId !== currentTask.id) return
    const plannedMinutes = Number(activeFocusSession.plannedMinutes || sessionMinutes || CONTINUE_LIMIT_MINUTES)
    const restoredRemaining = getRemainingSecondsFromStartedAt(activeFocusSession.startedAt, plannedMinutes)

    setSelectedModeId(activeFocusSession.mode || selectedModeId)
    setCustomSessionMinutes(plannedMinutes)
    setRemainingSeconds(restoredRemaining)
    setTimerAnchor(null)
    setIsRunning(restoredRemaining > 0)
    setSessionState(restoredRemaining > 0 ? 'running' : 'rest')
    setActiveChainId(activeFocusSession.chainId || null)
    setActiveRound({
      chainId: activeFocusSession.chainId || createRecordId('focus-chain'),
      startedAt: activeFocusSession.startedAt || nowIso(),
      label: activeFocusSession.modeLabel || activeFocusSession.label || selectedMode.label,
      plannedMinutes,
    })
  }, [activeFocusSession?.taskId, currentTask?.id])

  useEffect(() => {
    if (!quickStartTaskId) return
    if (currentTask?.id !== quickStartTaskId) return

    setQuickStartTaskId(null)
    startSession({ force: true, minutesOverride: Number(currentTask.estimatedMinutes || CONTINUE_LIMIT_MINUTES) })
  }, [currentTask, quickStartTaskId])

  useEffect(() => {
    if (!isRunning || sessionState !== 'running') return

    let intervalId = null
    const tick = () => {
      const seconds = activeFocusSession?.startedAt
        ? getRemainingSecondsFromStartedAt(activeFocusSession.startedAt, activeFocusSession.plannedMinutes || sessionMinutes)
        : getRemainingSecondsFromAnchor(timerAnchor, timerAnchor?.remainingSeconds ?? remainingSeconds)
      setRemainingSeconds(seconds)

      if (shouldPauseForFocusLimit(seconds)) {
        if (intervalId) window.clearInterval(intervalId)
        completeActiveRound(seconds)
        setIsRunning(false)
        setTimerAnchor(null)
        setFocusLimitPrompt({ reason: 'during-session' })
        return
      }

      if (seconds <= 0) {
        if (intervalId) window.clearInterval(intervalId)
        setIsRunning(false)
        setTimerAnchor(null)
        finishTimer()
      }
    }

    tick()

    intervalId = window.setInterval(() => {
      tick()
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [isRunning, sessionState, timerAnchor, currentTask, todayFocusedMinutesByTask, initialSeconds, activeRound, completedRounds, activeFocusSession])

  const progress = useMemo(() => {
    if (!initialSeconds) return 0
    return Math.round(((initialSeconds - remainingSeconds) / initialSeconds) * 100)
  }, [initialSeconds, remainingSeconds])

  function startSession(options = {}) {
    if (!currentTask) return
    const requestedMinutes = options.minutesOverride ?? sessionMinutes
    const totalFocusedMinutes = todayFocusedMinutesByTask.get(currentTask.id) ?? 0

    if (!options.force && totalFocusedMinutes >= TASK_FOCUS_LIMIT_MINUTES) {
      setFocusLimitPrompt({ reason: 'before-start', taskId: currentTask.id })
      return
    }

    const cappedMinutes = totalFocusedMinutes >= TASK_FOCUS_LIMIT_MINUTES
      ? Math.min(requestedMinutes, CONTINUE_LIMIT_MINUTES)
      : requestedMinutes

    setCustomSessionMinutes(cappedMinutes === selectedMode.minutes ? null : cappedMinutes)
    setRemainingSeconds(cappedMinutes * 60)
    const startedAt = nowIso()
    const chainId = options.preserveChain && activeChainId ? activeChainId : (activeChainId || createRecordId('focus-chain'))
    setActiveChainId(chainId)
    setActiveRound({
      chainId,
      startedAt,
      label: selectedMode.label,
      plannedMinutes: cappedMinutes,
    })
    safeSetActiveFocusSession({
      taskId: currentTask.id,
      taskTitle: currentTask.title,
      startedAt,
      plannedMinutes: cappedMinutes,
      mode: selectedModeId,
      modeLabel: selectedMode.label,
      chainId,
    })
    setTimerAnchor({ startedAt: Date.now(), remainingSeconds: cappedMinutes * 60 })
    setIsRunning(true)
    setSessionState('running')
    setRestDismissed(false)
    setShowRestModal(false)
    safeSetTasks((tasks) =>
      (Array.isArray(tasks) ? tasks : []).map((task) =>
        task.id === currentTask.id ? { ...task, lastWorkedAt: startedAt } : task,
      ),
    )
  }

  function handleOneClickStart() {
    const taskMinutes = Number(currentTask?.estimatedMinutes || selectedMode.minutes)
    startSession({ minutesOverride: taskMinutes })
  }

  function handleQuickTaskSubmit(event) {
    event.preventDefault()
    const taskId = createRecordId('task')
    const today = localToday()
    const timestamp = nowIso()
    const task = {
      id: taskId,
      title: quickTask.title,
      project: quickTask.project,
      mainline: '',
      reason: '',
      versionGoal: quickTask.versionGoal,
      nextAction: quickTask.nextAction,
      estimatedMinutes: Number(quickTask.estimatedMinutes || CONTINUE_LIMIT_MINUTES),
      completionStandard: quickTask.completionStandard,
      output: quickTask.output,
      fallbackAction: '先做 5 分钟，完成最小可见版本',
      startDate: today,
      endDate: today,
      deadline: today,
      date: today,
      createdAt: today,
      completedAt: '',
      lastWorkedAt: timestamp,
      priority: quickTask.priority,
      status: 'not_started',
    }

    safeSetTasks((tasks) => [task, ...(Array.isArray(tasks) ? tasks : [])])
    safeSetSettings({ ...safeSettings, currentFocusTaskId: taskId })
    setQuickTask(emptyQuickTask)
    setCustomSessionMinutes(task.estimatedMinutes)
    setRemainingSeconds(task.estimatedMinutes * 60)
    setQuickStartTaskId(taskId)
  }

  function pauseSession() {
    settleTimer()
    setIsRunning(false)
    safeSetActiveFocusSession(null)
  }

  function resumeSession() {
    if (sessionState === 'running') {
      if (currentTask) {
        const startedAt = nowIso()
        setActiveRound((round) => ({ ...(round || {}), startedAt }))
        safeSetActiveFocusSession({
          taskId: currentTask.id,
          taskTitle: currentTask.title,
          startedAt,
          plannedMinutes: Math.ceil(remainingSeconds / 60),
          mode: selectedModeId,
          modeLabel: selectedMode.label,
          chainId: activeChainId,
        })
      }
      setTimerAnchor({ startedAt: Date.now(), remainingSeconds })
      setIsRunning(true)
    }
  }

  function resetSession() {
    setIsRunning(false)
    setSessionState('idle')
    setRemainingSeconds(initialSeconds)
    setTimerAnchor(null)
    setWrapUp(emptyWrapUp)
    setActiveChainId(null)
    setActiveRound(null)
    setCompletedRounds([])
    setShowRestModal(false)
    setRestDismissed(false)
    setFocusLimitPrompt(null)
    safeSetActiveFocusSession(null)
  }

  function openWrapUpManually() {
    const settledRemainingSeconds = settleTimer()
    completeActiveRound(settledRemainingSeconds)
    setIsRunning(false)
    safeSetActiveFocusSession(null)
    setSessionState('wrap-up')
    setShowRestModal(false)
  }

  async function requestNotificationPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotificationStatus('unsupported')
      return
    }

    if (window.Notification.permission === 'default') {
      const permission = await window.Notification.requestPermission()
      setNotificationStatus(permission)
      return
    }

    setNotificationStatus(window.Notification.permission)
  }

  function finishTimer() {
    completeActiveRound(0)
    setSessionState('rest')
    safeSetActiveFocusSession(null)
    setShowRestModal(true)
    setRestDismissed(false)
    playFocusEndSound()
    sendFocusEndNotification()
  }

  function handleContinueRound() {
    setShowRestModal(false)
    setRestDismissed(true)
    startSession({ preserveChain: true })
  }

  function handleEndAndWrapUp() {
    setShowRestModal(false)
    setRestDismissed(false)
    setSessionState('wrap-up')
  }

  function handleFocusLimitSwitch() {
    saveFocusLimitSwitchSession()
    setFocusLimitPrompt(null)
    setIsRunning(false)
    setTimerAnchor(null)
    safeSetActiveFocusSession(null)
    setSessionState('idle')
    safeSetSettings({ ...safeSettings, currentFocusTaskId: null })
    safeSetActivePage('task-breakdown')
  }

  function handleFocusLimitContinue() {
    setFocusLimitPrompt(null)
    openWrapUpManually()
  }

  function settleTimer() {
    if (!isRunning || sessionState !== 'running' || !timerAnchor) {
      return remainingSeconds
    }

    const seconds = getRemainingSecondsFromAnchor(timerAnchor, remainingSeconds)
    setRemainingSeconds(seconds)
    setTimerAnchor(null)
    return seconds
  }

  function saveFocusLimitSwitchSession() {
    if (!currentTask) return
    const settledRemainingSeconds = settleTimer()
    const round = activeRound
      ? completeActiveRound(settledRemainingSeconds)
      : null
    const previousMinutes = todayFocusedMinutesByTask.get(currentTask.id) ?? 0
    const roundMinutes = round ? Number(round.actualMinutes || 0) : 0
    const savedMinutes = Math.max(1, Math.min(roundMinutes, TASK_FOCUS_LIMIT_MINUTES - previousMinutes))
    const timestamp = nowIso()
    const sessionRound = {
      ...(round || {
        chainId: activeChainId || createRecordId('focus-chain'),
        startedAt: activeFocusSession?.startedAt || timestamp,
        endedAt: timestamp,
        label: selectedMode.label,
        plannedMinutes: sessionMinutes,
      }),
      actualMinutes: savedMinutes,
      endedAt: timestamp,
    }

    safeSetFocusSessions((items) => [
      createFocusSessionRecord(sessionRound, currentTask, emptyWrapUp, { closedOut: false }),
      ...(Array.isArray(items) ? items : []),
    ])
    setActiveRound(null)
    setCompletedRounds([])
  }

  function shouldPauseForFocusLimit(seconds) {
    if (!currentTask) return false
    const previousMinutes = todayFocusedMinutesByTask.get(currentTask.id) ?? 0
    if (previousMinutes >= TASK_FOCUS_LIMIT_MINUTES) return false
    const elapsedMinutes = Math.floor((initialSeconds - seconds) / 60)
    return previousMinutes + chainMinutes + elapsedMinutes >= TASK_FOCUS_LIMIT_MINUTES
  }

  function completeActiveRound(remainingSecondsOverride = remainingSeconds) {
    if (!activeRound) return null
    const endedAt = nowIso()
    const plannedSeconds = Number(activeRound.plannedMinutes || sessionMinutes) * 60
    const actualSeconds = Math.max(0, plannedSeconds - Number(remainingSecondsOverride || 0))
    const round = {
      ...activeRound,
      endedAt,
      actualMinutes: Math.max(1, Math.round(actualSeconds / 60)),
    }
    setCompletedRounds((rounds) => {
      if (rounds.some((item) => item.startedAt === round.startedAt && item.chainId === round.chainId)) return rounds
      return [...rounds, round]
    })
    setActiveRound(null)
    return round
  }

  function submitWrapUp(event) {
    event.preventDefault()
    if (!currentTask) return

    const timestamp = nowIso()
    const nextStep = wrapUp.nextStep.trim()
    const roundsToSave = completedRounds.length > 0
      ? completedRounds
      : [{
          chainId: activeChainId || createRecordId('focus-chain'),
          startedAt: timestamp,
          endedAt: timestamp,
          label: selectedMode.label,
          plannedMinutes: sessionMinutes,
          actualMinutes: 1,
        }]

    safeSetFocusSessions((items) => [
      ...roundsToSave.map((round) => createFocusSessionRecord(round, currentTask, wrapUp, { closedOut: true })),
      ...(Array.isArray(items) ? items : []),
    ])

    if (wrapUp.sendToParkingLot) {
      safeSetParkingItems((items) => [
        {
          id: createRecordId('parking'),
          title: wrapUp.missingWhat || `继续优化：${currentTask.title}`,
          tag: '专注收尾',
          owner: wrapUp.nextStep || '下一轮开始前处理',
          date: localDateFromIso(timestamp),
          createdAt: timestamp,
        },
        ...(Array.isArray(items) ? items : []),
      ])
    }

    if (wrapUp.createEvidence) {
      safeSetEvidenceItems((items) => [
        {
          id: createRecordId('evidence'),
          title: currentTask.output || `${currentTask.title} 专注产出`,
          type: 'Focus Session',
          date: localDateFromIso(timestamp),
          createdAt: timestamp,
          proof: wrapUp.completedWhat || currentTask.completionStandard || '专注收尾记录',
        },
        ...(Array.isArray(items) ? items : []),
      ])
    }

    safeSetTasks((tasks) =>
      (Array.isArray(tasks) ? tasks : []).map((task) =>
        task.id === currentTask.id
          ? {
              ...task,
              nextAction: nextStep || task.nextAction,
              lastWorkedAt: timestamp,
              lastCloseoutAt: timestamp,
            }
          : task,
      ),
    )
    setSessionState('completed')
    setIsRunning(false)
    safeSetActiveFocusSession(null)
    setActiveChainId(null)
    setActiveRound(null)
    setCompletedRounds([])
    setShowRestModal(false)
    setWrapUp(emptyWrapUp)
  }

  if (!currentTask) {
    return (
      <div className="space-y-6">
        <QuickStartPanel draft={quickTask} setDraft={setQuickTask} onSubmit={handleQuickTaskSubmit} />
        <div className="rounded-lg border border-dashed border-wheat/70 bg-white/55 p-8 text-sm leading-6 text-ink/65 shadow-soft">
          尚未选择当前专注任务。可以直接使用上方“快速开始专注”创建任务并开始。
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <QuickStartPanel draft={quickTask} setDraft={setQuickTask} onSubmit={handleQuickTaskSubmit} />
      <section className="rounded-lg border border-wheat/50 bg-white/55 p-5 shadow-soft">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-sage">Focus Room</p>
            <h2 className="mt-2 text-2xl font-semibold leading-9 text-ink">{currentTask.title}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge>{currentTask.versionGoal}</Badge>
              <Badge>{currentTask.priority}</Badge>
              <Badge>{getTaskRangeStatus(currentTask, localToday())}</Badge>
              <Badge>今日已专注 {todayFocusedMinutesByTask.get(currentTask.id) ?? 0} 分钟</Badge>
            </div>
          </div>
          <div className="flex flex-col gap-3 rounded-lg border border-wheat/50 bg-linen/60 p-4 text-sm text-ink/70">
            <p>一轮结束后可以直接再来一轮；结束并收尾后会统一保存本次连续专注。</p>
            <button
              type="button"
              disabled={sessionState !== 'idle'}
              onClick={handleOneClickStart}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-sage px-4 py-2.5 text-sm font-medium text-paper disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Play className="h-4 w-4" />
              一键开始专注
            </button>
            <button
              type="button"
              onClick={requestNotificationPermission}
              className="rounded-lg border border-wheat/70 bg-paper px-4 py-2.5 text-sm font-medium text-ink/75"
            >
              开启浏览器通知
            </button>
            <p className="text-xs text-ink/55">通知状态：{notificationStatusLabel(notificationStatus)}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <TaskInfo label="Next Action" value={currentTask.nextAction} strong />
          <TaskInfo label="Completion Standard" value={currentTask.completionStandard} />
          <TaskInfo label="Output" value={currentTask.output} />
          <TaskInfo label="Version Goal" value={currentTask.versionGoal} />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-lg border border-wheat/50 bg-white/55 p-5 shadow-soft">
          <h2 className="text-lg font-semibold text-ink">专注模式</h2>
          <div className="mt-4 grid gap-3">
            {focusModes.map((mode) => (
              <button
                key={mode.id}
                type="button"
                disabled={sessionState === 'running' || sessionState === 'wrap-up'}
                onClick={() => setSelectedModeId(mode.id)}
                className={`rounded-lg border px-4 py-3 text-left transition ${
                  selectedModeId === mode.id
                    ? 'border-sage bg-sage text-paper'
                    : 'border-wheat/50 bg-paper text-ink/75 hover:bg-linen/70'
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <span className="block font-semibold">{mode.label}</span>
                <span className="mt-1 block text-sm opacity-80">{mode.minutes} 分钟</span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-wheat/50 bg-sage p-6 text-paper shadow-soft">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-paper/70">{selectedMode.label}</p>
              <p className="mt-4 text-6xl font-semibold tabular-nums">{formatTime(remainingSeconds)}</p>
            </div>
            <TimerReset className="h-8 w-8 text-paper/70" />
          </div>
          <div className="mt-6 h-2 overflow-hidden rounded-full bg-paper/20">
            <div className="h-full rounded-full bg-paper" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            {sessionState === 'idle' && (
              <ControlButton onClick={startSession} icon={Play} label="开始专注" primary />
            )}
            {sessionState === 'running' && isRunning && (
              <ControlButton onClick={pauseSession} icon={Pause} label="暂停" />
            )}
            {sessionState === 'running' && !isRunning && (
              <ControlButton onClick={resumeSession} icon={Play} label="继续" primary />
            )}
            {sessionState === 'running' && (
              <ControlButton onClick={openWrapUpManually} icon={CheckCircle2} label="结束并收尾" />
            )}
            {sessionState === 'completed' && (
              <ControlButton onClick={resetSession} icon={RotateCcw} label="再开一轮" primary />
            )}
            {sessionState === 'rest' && (
              <>
                <ControlButton onClick={handleContinueRound} icon={Play} label="再来一轮" primary />
                <ControlButton onClick={handleEndAndWrapUp} icon={CheckCircle2} label="结束并收尾" />
              </>
            )}
          </div>
        </div>
      </section>

      {sessionState === 'wrap-up' && (
        <WrapUpForm
          wrapUp={wrapUp}
          setWrapUp={setWrapUp}
          onSubmit={submitWrapUp}
          totalMinutes={chainMinutes}
          roundCount={completedRounds.length}
        />
      )}

      {sessionState === 'rest' && restDismissed && (
        <div className="rounded-lg border border-clay/35 bg-white/70 p-5 shadow-soft">
          <p className="text-sm leading-6 text-ink/70">本轮已记录。可以继续同一任务，或结束并填写一次统一收尾。</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleContinueRound}
              className="rounded-lg bg-sage px-4 py-2.5 text-sm font-medium text-paper"
            >
              再来一轮
            </button>
            <button
              type="button"
              onClick={handleEndAndWrapUp}
              className="rounded-lg border border-wheat/70 bg-white px-4 py-2.5 text-sm font-medium text-ink/75"
            >
              结束并收尾
            </button>
          </div>
        </div>
      )}

      {showRestModal && <RestModal onContinue={handleContinueRound} onWrapUp={handleEndAndWrapUp} />}
      {focusLimitPrompt && <FocusLimitModal onSwitch={handleFocusLimitSwitch} onContinue={handleFocusLimitContinue} />}
    </div>
  )
}

function WrapUpForm({ wrapUp, setWrapUp, onSubmit, totalMinutes, roundCount }) {
  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-clay/40 bg-white/70 p-5 shadow-soft">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-ink">收尾表单</h2>
        <p className="mt-2 text-sm leading-6 text-ink/62">
          本轮已经结束。请先记录完成情况，再决定是否生成停车场事项或成果证据。
        </p>
        <p className="mt-2 rounded-lg bg-linen/60 px-3 py-2 text-sm text-ink/70">
          本次连续专注 {roundCount || 1} 轮，共 {formatFocusedMinutesForWrapUp(totalMinutes || 0)}。
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <TextareaField label="completedWhat" value={wrapUp.completedWhat} onChange={(value) => setWrapUp({ ...wrapUp, completedWhat: value })} required />
        <TextareaField label="missingWhat" value={wrapUp.missingWhat} onChange={(value) => setWrapUp({ ...wrapUp, missingWhat: value })} />
        <TextareaField
          label="nextStep"
          value={wrapUp.nextStep}
          onChange={(value) => setWrapUp({ ...wrapUp, nextStep: value })}
          hint="如果这个任务已经完成，不用填写下一步；提交后任务会标记为已完成。如果还要继续，请填写下一步，任务会保留为进行中，并在之后继续显示。"
        />
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <CheckboxField label="reachedStandard" checked={wrapUp.reachedStandard} onChange={(checked) => setWrapUp({ ...wrapUp, reachedStandard: checked })} />
        <CheckboxField label="sendToParkingLot" checked={wrapUp.sendToParkingLot} onChange={(checked) => setWrapUp({ ...wrapUp, sendToParkingLot: checked })} />
        <CheckboxField label="createEvidence" checked={wrapUp.createEvidence} onChange={(checked) => setWrapUp({ ...wrapUp, createEvidence: checked })} />
      </div>
      <button type="submit" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-sage px-4 py-2.5 text-sm font-medium text-paper">
        <FilePlus2 className="h-4 w-4" />
        完成收尾
      </button>
    </form>
  )
}

function QuickStartPanel({ draft, setDraft, onSubmit }) {
  return (
    <section className="rounded-lg border border-wheat/50 bg-white/55 p-5 shadow-soft">
      <div className="mb-5">
        <p className="text-sm font-medium text-sage">快速开始专注</p>
        <h2 className="mt-1 text-lg font-semibold text-ink">直接创建一个任务并开始倒计时</h2>
      </div>
      <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <TextField label="任务名称" value={draft.title} onChange={(value) => setDraft({ ...draft, title: value })} required />
        <TextField label="所属项目" value={draft.project} onChange={(value) => setDraft({ ...draft, project: value })} />
        <SelectField label="本轮目标" value={draft.versionGoal} options={['V0', 'V1', 'V2']} onChange={(value) => setDraft({ ...draft, versionGoal: value })} />
        <SelectField label="优先级" value={draft.priority} options={['P1', 'P2', 'P3', 'P4', 'P5']} onChange={(value) => setDraft({ ...draft, priority: value })} />
        <TextField label="下一步动作" value={draft.nextAction} onChange={(value) => setDraft({ ...draft, nextAction: value })} required />
        <TextField label="完成标准" value={draft.completionStandard} onChange={(value) => setDraft({ ...draft, completionStandard: value })} />
        <TextField label="输出物" value={draft.output} onChange={(value) => setDraft({ ...draft, output: value })} />
        <TextField label="预计时长" type="number" min="1" value={draft.estimatedMinutes} onChange={(value) => setDraft({ ...draft, estimatedMinutes: value })} />
        <div className="md:col-span-2 xl:col-span-4">
          <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-sage px-4 py-2.5 text-sm font-medium text-paper">
            <Play className="h-4 w-4" />
            创建并开始专注
          </button>
        </div>
      </form>
    </section>
  )
}

function RestModal({ onContinue, onWrapUp }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 px-4 py-6">
      <div className="w-full max-w-3xl rounded-lg border border-wheat/60 bg-paper p-8 text-center shadow-soft">
        <div className="cat-breathe text-[8rem] leading-none md:text-[11rem]" aria-hidden="true">🐱</div>
        <h2 className="mt-4 text-2xl font-semibold text-ink">你已经专注一轮啦</h2>
        <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-ink/70">
          站起来活动一下，休息眼睛 5 分钟。
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <button type="button" onClick={onContinue} className="rounded-lg border border-wheat/70 bg-white px-5 py-3 text-sm font-medium text-ink/75">
            再来一轮
          </button>
          <button type="button" onClick={onWrapUp} className="rounded-lg bg-sage px-5 py-3 text-sm font-medium text-paper">
            结束并收尾
          </button>
        </div>
      </div>
    </div>
  )
}

function FocusLimitModal({ onSwitch, onContinue }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 px-4 py-6">
      <div className="w-full max-w-xl rounded-lg border border-clay/40 bg-paper p-6 shadow-soft">
        <h2 className="text-xl font-semibold text-ink">建议先收尾</h2>
        <p className="mt-3 text-sm leading-6 text-ink/70">
          这个任务今天已经专注 180 分钟了。建议先收尾，避免一天被单个任务吞掉。
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={onContinue} className="rounded-lg bg-sage px-4 py-2.5 text-sm font-medium text-paper">
            结束并收尾
          </button>
          <button type="button" onClick={onSwitch} className="rounded-lg border border-wheat/70 bg-white px-4 py-2.5 text-sm font-medium text-ink/75">
            去切换其他任务
          </button>
        </div>
      </div>
    </div>
  )
}

function TaskInfo({ label, value, strong = false }) {
  return (
    <div className="rounded-lg bg-linen/60 p-4">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-sage">{label}</p>
      <p className={`mt-2 text-sm leading-6 ${strong ? 'font-semibold text-ink' : 'text-ink/75'}`}>
        {value || '未填写'}
      </p>
    </div>
  )
}

function TextareaField({ label, value, onChange, required = false, hint = '' }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink/75">{label}</span>
      {hint && <span className="mt-1 block text-xs leading-5 text-ink/55">{hint}</span>}
      <textarea
        rows="4"
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full resize-none rounded-lg border border-wheat/60 bg-paper px-4 py-3 text-sm leading-6 text-ink"
      />
    </label>
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
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-lg border border-wheat/60 bg-paper px-4 py-3 text-sm text-ink"
      />
    </label>
  )
}

function SelectField({ label, value, options, onChange }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink/75">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-lg border border-wheat/60 bg-paper px-4 py-3 text-sm text-ink"
      >
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  )
}

function CheckboxField({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-3 rounded-lg border border-wheat/50 bg-linen/50 px-4 py-3 text-sm font-medium text-ink/75">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-sage"
      />
      {label}
    </label>
  )
}

function ControlButton({ label, icon: Icon, onClick, primary = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium ${
        primary ? 'bg-paper text-sage' : 'bg-paper/15 text-paper'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )
}

function Badge({ children }) {
  return <span className="rounded-lg bg-linen px-3 py-1 text-xs font-medium text-ink/70">{children || '未设置'}</span>
}

function getRemainingSecondsFromAnchor(anchor, fallbackSeconds) {
  if (!anchor) return fallbackSeconds
  const elapsedSeconds = Math.floor((Date.now() - anchor.startedAt) / 1000)
  return Math.max(0, anchor.remainingSeconds - elapsedSeconds)
}

function getRemainingSecondsFromStartedAt(startedAt, plannedMinutes) {
  const startTime = new Date(startedAt || Date.now()).getTime()
  if (Number.isNaN(startTime)) return Number(plannedMinutes || 0) * 60
  const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000)
  return Math.max(0, Number(plannedMinutes || 0) * 60 - elapsedSeconds)
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function createFocusSessionRecord(round, task, wrapUp, options = {}) {
  const startedAt = round.startedAt || nowIso()
  const endedAt = round.endedAt || nowIso()
  const closeoutAt = options.closedOut ? endedAt : ''
  return {
    id: createRecordId('focus-session'),
    taskId: task.id,
    taskTitle: task.title,
    label: round.label || 'Focus Session',
    time: `${round.plannedMinutes || round.actualMinutes || 0} min`,
    detail: wrapUp.completedWhat || task.nextAction || task.title,
    actualMinutes: Number(round.actualMinutes || 0),
    plannedMinutes: Number(round.plannedMinutes || round.actualMinutes || 0),
    date: localDateFromIso(startedAt),
    createdAt: startedAt,
    startedAt,
    endedAt,
    completedAt: endedAt,
    startTimeLocal: localTimeFromIso(startedAt),
    endTimeLocal: localTimeFromIso(endedAt),
    chainId: round.chainId,
    reachedStandard: wrapUp.reachedStandard,
    closedOut: Boolean(options.closedOut),
    closeoutSubmitted: Boolean(options.closedOut),
    closeoutAt,
    closeoutDate: closeoutAt ? localDateFromIso(closeoutAt) : '',
  }
}

function localDateFromIso(value) {
  return toLocalParts(value).date
}

function localTimeFromIso(value) {
  return toLocalParts(value).time
}

function toLocalParts(value) {
  const date = new Date(value || Date.now())
  if (Number.isNaN(date.getTime())) return { date: localToday(), time: '00:00' }
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return { date: `${year}-${month}-${day}`, time: `${hours}:${minutes}` }
}

function formatFocusedMinutesForWrapUp(totalMinutes) {
  const minutes = Number(totalMinutes || 0)
  if (minutes < 60) return `${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  const restMinutes = minutes % 60
  return restMinutes ? `${hours} 小时 ${restMinutes} 分钟` : `${hours} 小时`
}

function getNotificationStatus() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return window.Notification.permission
}

function notificationStatusLabel(status) {
  if (status === 'granted') return '已开启'
  if (status === 'denied') return '已拒绝'
  if (status === 'unsupported') return '当前浏览器不支持'
  return '未开启'
}

function playFocusEndSound() {
  try {
    if (typeof window === 'undefined') return
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return

    const audioContext = new AudioContext()
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(660, audioContext.currentTime)
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime + 0.25)
    gain.gain.setValueAtTime(0.001, audioContext.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.18, audioContext.currentTime + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 1.1)

    oscillator.connect(gain)
    gain.connect(audioContext.destination)
    oscillator.start()
    oscillator.stop(audioContext.currentTime + 1.2)
  } catch {
    // Browser autoplay policies can block audio; the in-page reminder still appears.
  }
}

function sendFocusEndNotification() {
  try {
    if (typeof window === 'undefined') return
    if (!('Notification' in window) || window.Notification.permission !== 'granted') return
    new window.Notification('该休息啦', {
      body: '你已经完成一轮专注，站起来活动一下，休息眼睛。',
    })
  } catch {
    // System notifications are optional; failing silently keeps the timer flow intact.
  }
}
