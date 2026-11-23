import { getTaskStatusLabel } from './taskStatus'

const searchGroups = [
  {
    key: 'tasks',
    label: '任务',
    pageId: 'task-breakdown',
    fields: ['title', 'project', 'mainline', 'reason', 'nextAction', 'completionStandard', 'output', 'fallbackAction'],
    getTitle: (item) => item.title || '未命名任务',
    getMeta: (item) => [item.project, item.priority, getTaskStatusLabel(item.status)].filter(Boolean).join(' · '),
  },
  {
    key: 'knowledgeCards',
    label: '知识卡',
    pageId: 'knowledge-cards',
    fields: ['title', 'source', 'oneSentence', 'problemSolved', 'relatedProject', 'application', 'tags'],
    getTitle: (item) => item.title || item.concept || '未命名知识卡',
    getMeta: (item) => [item.source, item.relatedProject, formatTags(item.tags)].filter(Boolean).join(' · '),
  },
  {
    key: 'evidenceItems',
    label: '成果证据',
    pageId: 'evidence-library',
    fields: ['content', 'relatedProject', 'note', 'type'],
    getTitle: (item) => item.content || item.title || '未命名证据',
    getMeta: (item) => [item.date, item.relatedProject, item.type].filter(Boolean).join(' · '),
  },
  {
    key: 'reviews',
    label: '复盘',
    pageId: 'review',
    fields: ['mainlineAdvanced', 'evidenceLeft', 'procrastinationOrHyperfocus', 'firstStepTomorrow'],
    getTitle: (item) => item.date || '未命名复盘',
    getMeta: (item) => item.date || '',
  },
]

export function searchDashboardRecords(data, query) {
  const keyword = normalizeText(query)
  if (!keyword) return []

  return searchGroups.map((group) => {
    const records = Array.isArray(data[group.key]) ? data[group.key] : []
    const results = records
      .map((item) => createSearchResult(item, group, keyword))
      .filter(Boolean)

    return { ...group, results }
  })
}

function createSearchResult(item, group, keyword) {
  const match = group.fields
    .map((field) => ({ field, text: fieldText(item[field]) }))
    .find(({ text }) => normalizeText(text).includes(keyword))

  if (!match) return null

  return {
    id: item.id || `${group.key}-${group.getTitle(item)}`,
    typeLabel: group.label,
    pageId: group.pageId,
    title: group.getTitle(item),
    meta: group.getMeta(item),
    snippet: createSnippet(match.text, keyword),
  }
}

function createSnippet(text, keyword) {
  const source = fieldText(text)
  const normalizedSource = normalizeText(source)
  const index = normalizedSource.indexOf(keyword)
  if (index === -1) return source.slice(0, 80)

  const start = Math.max(0, index - 24)
  const end = Math.min(source.length, index + keyword.length + 56)
  const prefix = start > 0 ? '...' : ''
  const suffix = end < source.length ? '...' : ''
  return `${prefix}${source.slice(start, end)}${suffix}`
}

function fieldText(value) {
  if (Array.isArray(value)) return value.join(', ')
  return String(value ?? '')
}

function formatTags(tags) {
  return Array.isArray(tags) ? tags.join(', ') : tags
}

function normalizeText(value) {
  return String(value ?? '').trim().toLowerCase()
}
