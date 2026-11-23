export const TASK_STATUSES = ['not_started', 'in_progress', 'completed']

const taskStatusLabels = {
  not_started: '待执行',
  in_progress: '进行中',
  completed: '已完成',
}

const legacyTaskStatusMap = {
  paused: 'in_progress',
  backlog: 'not_started',
  converted: 'not_started',
  待执行: 'not_started',
  拆解中: 'not_started',
  专注中: 'in_progress',
  进行中: 'in_progress',
  暂停: 'in_progress',
  已完成: 'completed',
}

export function normalizeTaskStatus(status) {
  if (TASK_STATUSES.includes(status)) return status
  return legacyTaskStatusMap[status] ?? 'not_started'
}

export function getTaskStatusLabel(status) {
  return taskStatusLabels[normalizeTaskStatus(status)]
}

export function isCompletedTaskStatus(status) {
  return normalizeTaskStatus(status) === 'completed'
}

export function isInProgressTaskStatus(status) {
  return normalizeTaskStatus(status) === 'in_progress'
}
