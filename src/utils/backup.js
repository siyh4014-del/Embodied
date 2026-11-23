export const backupAppName = 'growth-evidence-dashboard'
export const backupVersion = '0.1.0'

const arrayModules = [
  'tasks',
  'focusSessions',
  'parkingItems',
  'knowledgeCards',
  'evidenceItems',
  'reviews',
  'dailyLogs',
  'weeklyArchives',
  'monthlyArchives',
]

export function createBackupPayloadFromLocalStorage(storageKeys) {
  const data = {
    settings: readJsonModule(storageKeys.settings, {}),
    tasks: readJsonModule(storageKeys.tasks, []),
    focusSessions: readJsonModule(storageKeys.focusSessions, []),
    parkingItems: readJsonModule(storageKeys.parkingItems, []),
    knowledgeCards: readJsonModule(storageKeys.knowledgeCards, []),
    evidenceItems: readJsonModule(storageKeys.evidenceItems, []),
    reviews: readJsonModule(storageKeys.reviews, []),
    dailyLogs: readJsonModule(storageKeys.dailyLogs, []),
    weeklyArchives: readJsonModule(storageKeys.weeklyArchives, []),
    monthlyArchives: readJsonModule(storageKeys.monthlyArchives, []),
  }

  validateBackupData(data)

  return {
    exportedAt: new Date().toISOString(),
    appName: backupAppName,
    version: backupVersion,
    data,
  }
}

export function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function validateBackupPayload(payload) {
  if (!payload || typeof payload !== 'object' || !payload.data || typeof payload.data !== 'object') {
    throw new Error('备份文件缺少 data 字段，已取消导入。')
  }

  validateBackupData(payload.data)
  return payload.data
}

export function restoreBackupToLocalStorage(storageKeys, data) {
  validateBackupData(data)

  window.localStorage.setItem(storageKeys.settings, JSON.stringify(data.settings))
  window.localStorage.setItem(storageKeys.tasks, JSON.stringify(data.tasks))
  window.localStorage.setItem(storageKeys.focusSessions, JSON.stringify(data.focusSessions))
  window.localStorage.setItem(storageKeys.parkingItems, JSON.stringify(data.parkingItems))
  window.localStorage.setItem(storageKeys.knowledgeCards, JSON.stringify(data.knowledgeCards))
  window.localStorage.setItem(storageKeys.evidenceItems, JSON.stringify(data.evidenceItems))
  window.localStorage.setItem(storageKeys.reviews, JSON.stringify(data.reviews))
  window.localStorage.setItem(storageKeys.dailyLogs, JSON.stringify(data.dailyLogs ?? []))
  window.localStorage.setItem(storageKeys.weeklyArchives, JSON.stringify(data.weeklyArchives ?? []))
  window.localStorage.setItem(storageKeys.monthlyArchives, JSON.stringify(data.monthlyArchives ?? []))
}

function readJsonModule(key, fallbackValue) {
  const rawValue = window.localStorage.getItem(key)
  if (!rawValue) return fallbackValue

  try {
    return JSON.parse(rawValue)
  } catch {
    return fallbackValue
  }
}

function validateBackupData(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('备份文件 data 格式不正确。')
  }

  if (!data.settings || typeof data.settings !== 'object' || Array.isArray(data.settings)) {
    throw new Error('settings 必须是对象。')
  }

  for (const key of arrayModules) {
    if (data[key] === undefined && ['dailyLogs', 'weeklyArchives', 'monthlyArchives'].includes(key)) {
      data[key] = []
    }

    if (!Array.isArray(data[key])) {
      throw new Error(`${key} 必须是数组。`)
    }
  }
}
