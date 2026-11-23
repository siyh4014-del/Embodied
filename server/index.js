import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

const localEnvPath = path.join(rootDir, '.env.local')
dotenv.config({ path: fs.existsSync(localEnvPath) ? localEnvPath : path.join(rootDir, '.env') })

const app = express()
const port = process.env.PORT || 8787
const legacyFrontendPort = 5173
const distDir = path.join(rootDir, 'dist')

app.use(cors({ origin: true }))
app.use(express.json({ limit: '1mb' }))
app.use('/weekly-reports', express.static(path.join(rootDir, 'weekly-reports')))

app.get('/api/health', (_request, response) => {
  response.json({ ok: true })
})

app.post('/api/deepseek/task-breakdown', async (request, response) => {
  const apiKey = process.env.DEEPSEEK_API_KEY
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash'
  const baseUrl = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '')

  if (!apiKey) {
    response.status(500).json({
      error: '未配置 DEEPSEEK_API_KEY，请在 .env.local 中配置。',
    })
    return
  }

  try {
    const upstreamResponse = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: buildTaskBreakdownMessages(request.body),
        temperature: 0.2,
        max_tokens: 3000,
        response_format: { type: 'json_object' },
      }),
    })

    const text = await upstreamResponse.text()
    let payload
    try {
      payload = text ? JSON.parse(text) : {}
    } catch {
      payload = { raw: text }
    }

    if (!upstreamResponse.ok) {
      response.status(upstreamResponse.status).json({
        error: 'DeepSeek 请求失败。',
        detail: payload,
      })
      return
    }

    const messageContent = payload?.choices?.[0]?.message?.content ?? ''
    const jsonContent = extractJsonText(messageContent)
    try {
      response.json({
        ok: true,
        structured: true,
        data: JSON.parse(jsonContent),
        raw: messageContent,
      })
    } catch {
      response.json({
        ok: true,
        structured: false,
        data: null,
        raw: messageContent,
        warning: 'AI 返回内容不是标准 JSON',
      })
    }
  } catch (error) {
    response.status(502).json({
      error: 'DeepSeek 请求失败，服务未崩溃。',
      detail: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

app.post('/api/deepseek/feynman-chat', async (request, response) => {
  try {
    const result = await callDeepSeek(buildFeynmanChatMessages(request.body), {
      temperature: 0.35,
      max_tokens: 2200,
    })
    response.json({ ok: true, content: result.content, raw: result.content })
  } catch (error) {
    response.status(error.status || 502).json({
      error: 'AI 费曼助手暂时没有回应，请稍后重试。你的对话记录已保存在本地。',
      detail: error.message || 'Unknown error',
    })
  }
})

app.post('/api/deepseek/feynman-summary', async (request, response) => {
  try {
    const result = await callDeepSeek(buildFeynmanSummaryMessages(request.body), {
      temperature: 0.2,
      max_tokens: 3500,
      response_format: { type: 'json_object' },
    })
    try {
      response.json({ ok: true, structured: true, data: JSON.parse(extractJsonText(result.content)), raw: result.content })
    } catch {
      response.json({ ok: true, structured: false, data: null, raw: result.content })
    }
  } catch (error) {
    response.status(error.status || 502).json({
      error: 'AI 暂时没有回应。你的 Feynman 对话已保存在本地。',
      detail: error.message || 'Unknown error',
    })
  }
})

app.post('/api/deepseek/feynman-daily-review', async (request, response) => {
  try {
    const result = await callDeepSeek(buildFeynmanDailyReviewMessages(request.body), {
      temperature: 0.2,
      max_tokens: 2200,
      response_format: { type: 'json_object' },
    })
    response.json({ ok: true, data: JSON.parse(extractJsonText(result.content)), raw: result.content })
  } catch (error) {
    response.status(error.status || 502).json({
      error: 'AI 暂时没有回应。',
      detail: error.message || 'Unknown error',
    })
  }
})

app.post('/api/search/feynman', async (request, response) => {
  const tavilyKey = process.env.TAVILY_API_KEY
  const braveKey = process.env.BRAVE_SEARCH_API_KEY
  const serpApiKey = process.env.SERPAPI_API_KEY

  if (!tavilyKey && !braveKey && !serpApiKey) {
    response.status(501).json({ error: '联网搜索未配置，请在 .env.local 中配置搜索 API Key。' })
    return
  }

  try {
    const query = buildFeynmanSearchQuery(request.body)
    const sources = tavilyKey
      ? await searchTavily(query, tavilyKey)
      : braveKey
        ? await searchBrave(query, braveKey)
        : await searchSerpApi(query, serpApiKey)
    const supplement = await buildGroundedFeynmanSupplement(request.body, sources)

    response.json({
      query,
      searchedAt: new Date().toISOString(),
      sources,
      groundedSupplement: supplement.groundedSupplement,
      teachBackPrompt: supplement.teachBackPrompt,
      updatedKnowledgePoints: supplement.updatedKnowledgePoints,
    })
  } catch (error) {
    response.status(502).json({
      error: '联网搜索失败，但你仍然可以继续本地费曼讲解。',
      detail: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

app.post('/api/reports/weekly-html', async (request, response) => {
  try {
    const range = normalizeReportRange(request.body?.range)
    const data = request.body?.data && typeof request.body.data === 'object' ? request.body.data : {}
    const summary = buildWeeklyReportSummary(range, data)
    const aiAdvice = await generateWeeklyAdvice(summary, data)
    const reportsDir = path.join(rootDir, 'weekly-reports')
    const fileName = `weekly-report-${range.startDate}-to-${range.endDate}.html`
    const filePath = path.join(reportsDir, fileName)
    const html = buildWeeklyReportHtml({ range, summary, aiAdvice })

    await fs.promises.mkdir(reportsDir, { recursive: true })
    await fs.promises.writeFile(filePath, html, 'utf8')

    response.json({
      ok: true,
      fileName,
      filePath,
      url: `/weekly-reports/${encodeURIComponent(fileName)}`,
      range,
      summary: {
        totalTasks: summary.totalTasks,
        completedTasks: summary.completedTasks,
        unfinishedTasks: summary.unfinishedTasks,
        totalFocusMinutes: summary.totalFocusMinutes,
        averageDailyFocusMinutes: summary.averageDailyFocusMinutes,
        evidenceCount: summary.evidenceCount,
        knowledgeCardCount: summary.knowledgeCardCount,
        reviewCount: summary.reviewCount,
      },
      aiAdviceAvailable: aiAdvice.available,
      aiAdviceError: aiAdvice.error || '',
    })
  } catch (error) {
    response.status(500).json({
      error: '周报生成失败，后端服务未崩溃。',
      detail: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get(/.*/, (request, response, next) => {
    if (request.path.startsWith('/api/')) {
      next()
      return
    }

    response.sendFile(path.join(distDir, 'index.html'))
  })
}

app.listen(port, () => {
  console.log(`Growth Evidence Dashboard listening on http://127.0.0.1:${port}`)
})

if (fs.existsSync(distDir) && !process.env.PORT) {
  app.listen(legacyFrontendPort, () => {
    console.log(`Growth Evidence Dashboard frontend listening on http://127.0.0.1:${legacyFrontendPort}`)
  })
}

function buildTaskBreakdownMessages(input) {
  const safeInput = input && typeof input === 'object' ? input : {}
  const schema = {
    diagnosis: '',
    suggestedMindset: '',
    v0Goal: '',
    v1Goal: '',
    v2Goal: '',
    startAction15min: '',
    standardAction45min: '',
    deepWorkAction90min: '',
    completionStandard: '',
    output: '',
    fallbackAction: '',
    antiHyperfocusStopPoint: '',
    suggestedTasks: [
      {
        title: '',
        project: '',
        mainline: '',
        reason: '',
        versionGoal: 'V0',
        nextAction: '',
        estimatedMinutes: 45,
        completionStandard: '',
        output: '',
        fallbackAction: '',
        priority: 'P2',
        status: 'not_started',
      },
    ],
  }

  return [
    {
      role: 'system',
      content: [
        '你是一个学习任务拆解助手。请根据用户提供的信息，把任务拆成可执行步骤、完成标准、输出物和兜底动作。',
        '你必须只输出合法 JSON，不要输出 Markdown，不要输出解释性文字，不要使用 ```json 代码块。',
        '所有字段必须存在；如果没有内容就用空字符串或空数组。',
        'suggestedTasks 至少 1 条，最多 3 条；每条任务都必须可以直接执行。',
        'title 要短；nextAction 必须是下一步动作，不要写抽象建议；completionStandard 必须具体；fallbackAction 必须非常低门槛。',
        'antiHyperfocusStopPoint 必须告诉用户做到什么程度就该停。',
        '根据用户选择的 availableMinutes，把推荐任务 estimatedMinutes 设为 15、45、90 或用户输入值。',
        `严格使用这个 JSON 结构：${JSON.stringify(schema)}`,
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        '请基于以下用户输入返回严格 JSON。',
        '再次强调：只输出合法 JSON，不要 Markdown，不要解释，不要代码块。',
        JSON.stringify(safeInput, null, 2),
      ].join('\n'),
    },
  ]
}

async function callDeepSeek(messages, options = {}) {
  const apiKey = process.env.DEEPSEEK_API_KEY
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash'
  const baseUrl = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '')

  if (!apiKey) {
    const error = new Error('未配置 DEEPSEEK_API_KEY，请在 .env.local 中配置。')
    error.status = 500
    throw error
  }

  const upstreamResponse = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.25,
      max_tokens: options.max_tokens ?? 2400,
      ...(options.response_format ? { response_format: options.response_format } : {}),
    }),
  })

  const text = await upstreamResponse.text()
  let payload
  try {
    payload = text ? JSON.parse(text) : {}
  } catch {
    payload = { raw: text }
  }

  if (!upstreamResponse.ok) {
    const error = new Error(`DeepSeek 请求失败：${upstreamResponse.status}`)
    error.status = upstreamResponse.status
    error.detail = payload
    throw error
  }

  return { content: payload?.choices?.[0]?.message?.content ?? '', payload }
}

function buildFeynmanChatMessages(input) {
  const safeInput = input && typeof input === 'object' ? input : {}
  const topic = safeInput.topic || {}
  const mode = safeInput.mode || 'free_explain'
  const area = topic.topicArea || '其他'
  return [
    {
      role: 'system',
      content: [
        '你是 Feynman Learning Room 的中文 AI 教练，面向研究生和职场小白。',
        '你的目标不是直接替用户总结，而是帮助用户把知识讲清楚，并判断是否真正理解。',
        '核心规则：先让用户讲；每次最多提出 3 个问题；用户抽象时要求举例；用户跳步时指出中间逻辑；概念混淆时温和指出；讲清楚后再提高难度。',
        '不要鸡汤，不批评用户，不输出长篇标准答案，除非 mode=demo 或用户明确要求示范。',
        '固定 6 句脚手架：一句话结论、解决的问题、核心概念、运行机制、例子/反例、迁移应用。',
        '如果用户不知道怎么讲，返回填空模板：这个知识点主要解决 ______ 问题。它的核心概念有 ______。它的运行逻辑是 ______。举个例子：______。它可以用到我的 ______ 任务里，因为 ______。',
        '示范一版时必须提供：小白版、研究生/职场版、输出版。示范后要求：现在请你不要复制我的版本，用你自己的话重新讲一遍。',
        `当前 mode：${mode}`,
        `当前 topicArea：${area}`,
        areaPrompt(area),
      ].join('\n'),
    },
    {
      role: 'user',
      content: JSON.stringify({
        topic,
        mode,
        messages: safeArray(safeInput.messages).slice(-16),
        memory: safeInput.memory || {},
        attachmentsSummary: safeInput.attachmentsSummary || '',
        todayContext: compactTodayContext(safeInput.todayContext),
      }, null, 2),
    },
  ]
}

function buildFeynmanSummaryMessages(input) {
  const schema = {
    understandingDiagnosis: { explainedWell: [], unclearPoints: [], misconceptions: [], nextPracticeFocus: [] },
    scores: { definition: 0, problemAwareness: 0, mechanism: 0, examples: 0, boundary: 0, transfer: 0 },
    suggestedKnowledgeCards: [
      { title: '', type: '概念卡', oneSentence: '', problemSolved: '', mechanism: '', example: '', boundary: '', application: '', reviewQuestion: '', relatedProject: '', tags: [] },
    ],
    visualCards: [{ headline: '', centerConcept: '', problem: '', method: '', example: '', application: '' }],
    mindmap: { title: '', nodes: [{ id: 'root', label: '', children: [] }], mermaid: '' },
    updatedMemory: {
      masteredConcepts: [],
      weakConcepts: [],
      commonConfusions: [],
      bestExplanations: [],
      examplesGenerated: [],
      transferApplications: [],
      preferredScaffolds: [],
      nextReviewQuestions: [],
      aiAdjustmentNotes: '',
    },
    tomorrowReviewQuestions: [],
    nextStep: '',
  }
  return [
    {
      role: 'system',
      content: [
        '你是 Feynman Learning Room 的知识整理员。只在结束阶段生成结构化总结。',
        '必须输出合法 JSON，不要 Markdown，不要代码块。',
        '不要把没有来源的时效性搜索结论写进 Knowledge Cards；有来源时在 oneSentence/application 中简洁体现。',
        '输出中文，具体指出用户讲清楚了什么、哪里薄弱、误区、明天复习问题。',
        `严格使用这个 JSON 结构：${JSON.stringify(schema)}`,
      ].join('\n'),
    },
    {
      role: 'user',
      content: JSON.stringify({
        room: input?.room || {},
        messages: safeArray(input?.messages),
        attachmentsSummary: input?.attachmentsSummary || '',
        webSearchResults: safeArray(input?.webSearchResults),
        todayContext: compactTodayContext(input?.todayContext),
      }, null, 2),
    },
  ]
}

function buildFeynmanDailyReviewMessages(input) {
  const schema = {
    overallPerformance: '',
    learningOutputSummary: '',
    knowledgeDiagnosis: '',
    strongPoints: [],
    weakPoints: [],
    focusPattern: '',
    nextReviewQuestions: [],
    tomorrowFirstStep: '',
    reviewText: '',
  }
  return [
    {
      role: 'system',
      content: [
        '你是每日费曼复盘助手。输出中文，不鸡汤，不批评。',
        '必须具体指出：今天讲清楚了什么、哪些知识薄弱、哪些内容明天复习、今日专注行为是否和学习产出匹配、明天第一步。',
        '必须输出合法 JSON，不要 Markdown，不要代码块。',
        `严格使用这个 JSON 结构：${JSON.stringify(schema)}`,
      ].join('\n'),
    },
    {
      role: 'user',
      content: JSON.stringify({
        date: input?.date || '',
        feynmanSummaries: safeArray(input?.feynmanSummaries),
        weekWorkspaceDayDetail: input?.weekWorkspaceDayDetail || {},
        todayTasks: safeArray(input?.todayTasks),
        todayFocusSessions: safeArray(input?.todayFocusSessions),
        todayEvidenceItems: safeArray(input?.todayEvidenceItems),
        todayKnowledgeCards: safeArray(input?.todayKnowledgeCards),
      }, null, 2),
    },
  ]
}

function areaPrompt(area) {
  const prompts = {
    科研: '科研追问重点：问题意识、作者为什么研究、方法或证据、结论、与既有文献差异、能支持论文哪句话、选题启发、局限。',
    数据分析: '数据分析追问重点：方法/指标含义、解决的分析问题、输入数据、变量样本单位、输出怎么看、图能说明什么和不能说明什么、误读风险、如何给老师/领导解释。',
    产品经理: '产品追问重点：用户是谁、场景、表面需求、真实需求、功能如何满足需求、不使用原因、迁移到时间管理网站/英语阅读工具/写作智能体。',
    金字塔原理: '金字塔原理追问重点：中心结论、三个理由、是否同层级、重复交叉遗漏、证据、一句话记忆点、结论-理由-证据结构。',
    其他: '追问重点：定义、问题、机制、边界、例子、反例、迁移应用。',
  }
  return prompts[area] || prompts.其他
}

function compactTodayContext(context) {
  const safe = context && typeof context === 'object' ? context : {}
  return {
    tasks: safeArray(safe.tasks).slice(0, 20).map(pickTask),
    focusSessions: safeArray(safe.focusSessions).slice(0, 30).map((session) => ({
      taskId: session.taskId || '',
      taskTitle: session.taskTitle || session.label || '',
      actualMinutes: session.actualMinutes || '',
      date: getRecordDate(session),
      closedOut: Boolean(session.closedOut || session.closeoutAt || session.closeoutDate),
    })),
    evidenceItems: safeArray(safe.evidenceItems).slice(0, 20),
    knowledgeCards: safeArray(safe.knowledgeCards).slice(0, 20),
    reviews: safeArray(safe.reviews).slice(0, 10),
    weekWorkspaceDayDetail: safe.weekWorkspaceDayDetail || {},
  }
}

function buildFeynmanSearchQuery(input) {
  const safeInput = input && typeof input === 'object' ? input : {}
  const modeMap = {
    latest_research: 'latest research paper',
    latest_case: 'latest case study',
    official_docs: 'official documentation',
    competitor: 'competitor analysis',
    general: 'latest reliable source',
  }
  return [
    safeInput.taskTitle || 'learning topic',
    safeInput.topicArea || '',
    modeMap[safeInput.searchMode] || modeMap.general,
    safeInput.userExplanation || '',
  ].filter(Boolean).join(' ')
}

async function searchTavily(query, apiKey) {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey, query, max_results: 5, search_depth: 'basic' }),
  })
  const payload = await response.json()
  if (!response.ok) throw new Error(payload?.error || 'Tavily search failed')
  return safeArray(payload.results).map((item) => ({
    title: item.title || item.url || '',
    url: item.url || '',
    source: sourceHost(item.url),
    publishedAt: item.published_date || '',
    snippet: item.content || item.snippet || '',
  }))
}

async function searchBrave(query, apiKey) {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`
  const response = await fetch(url, { headers: { 'X-Subscription-Token': apiKey, Accept: 'application/json' } })
  const payload = await response.json()
  if (!response.ok) throw new Error(payload?.message || 'Brave search failed')
  return safeArray(payload.web?.results).map((item) => ({
    title: item.title || item.url || '',
    url: item.url || '',
    source: sourceHost(item.url),
    publishedAt: item.age || '',
    snippet: item.description || '',
  }))
}

async function searchSerpApi(query, apiKey) {
  const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&api_key=${encodeURIComponent(apiKey)}&num=5`
  const response = await fetch(url)
  const payload = await response.json()
  if (!response.ok) throw new Error(payload?.error || 'SerpAPI search failed')
  return safeArray(payload.organic_results).map((item) => ({
    title: item.title || item.link || '',
    url: item.link || '',
    source: sourceHost(item.link),
    publishedAt: item.date || '',
    snippet: item.snippet || '',
  }))
}

async function buildGroundedFeynmanSupplement(input, sources) {
  if (!sources.length) {
    return {
      groundedSupplement: '没有找到可用来源。请继续用本地资料讲解。',
      teachBackPrompt: '请你先基于已有材料再讲一遍。',
      updatedKnowledgePoints: [],
    }
  }
  try {
    const result = await callDeepSeek([
      {
        role: 'system',
        content: '你是联网校准助手。基于有来源的搜索结果输出中文 JSON，不要 Markdown。结构：whatYouExplainedWell, whatNeedsUpdate, newExamplesOrEvidence, suggestedReExplanationStructure, teachBackPrompt, updatedKnowledgePoints, groundedSupplement。',
      },
      { role: 'user', content: JSON.stringify({ input, sources }, null, 2) },
    ], { temperature: 0.2, max_tokens: 1600, response_format: { type: 'json_object' } })
    const parsed = JSON.parse(extractJsonText(result.content))
    return {
      groundedSupplement: parsed.groundedSupplement || [
        '你刚才讲对的地方：',
        ...safeArray(parsed.whatYouExplainedWell).map((item) => `- ${item}`),
        '需要更新或补充：',
        ...safeArray(parsed.whatNeedsUpdate).map((item) => `- ${item}`),
        '适合加入的案例或证据：',
        ...safeArray(parsed.newExamplesOrEvidence).map((item) => `- ${item}`),
      ].join('\n'),
      teachBackPrompt: parsed.teachBackPrompt || '请你基于这些资料再讲一遍。',
      updatedKnowledgePoints: safeArray(parsed.updatedKnowledgePoints),
    }
  } catch {
    return {
      groundedSupplement: '联网搜索已返回来源。请只把有来源的内容作为校准材料，不要直接背资料。',
      teachBackPrompt: '请你基于这些来源，重新讲一遍这个知识点。',
      updatedKnowledgePoints: [],
    }
  }
}

function sourceHost(url) {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

function extractJsonText(text) {
  const trimmed = String(text || '').trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) return fenced[1].trim()

  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  return start >= 0 && end > start ? trimmed.slice(start, end + 1) : trimmed
}

function normalizeReportRange(range) {
  const endDate = isDateText(range?.endDate) ? range.endDate : toLocalDate(new Date())
  const startDate = isDateText(range?.startDate) ? range.startDate : addDays(endDate, -6)
  if (startDate > endDate) throw new Error('周报开始日期不能晚于结束日期。')
  return { startDate, endDate }
}

function buildWeeklyReportSummary(range, data) {
  const dates = getDateRange(range.startDate, range.endDate)
  const tasks = filterRecordsByRange(safeArray(data.tasks), range)
  const focusSessions = filterRecordsByRange(safeArray(data.focusSessions), range)
  const evidenceItems = filterRecordsByRange(safeArray(data.evidenceItems), range)
  const knowledgeCards = filterRecordsByRange(safeArray(data.knowledgeCards), range)
  const reviews = filterRecordsByRange(safeArray(data.reviews), range)
  const weeklyArchives = filterWeeklyArchives(safeArray(data.weeklyArchives), range)

  const completedTasks = tasks.filter((task) => isCompletedStatus(task.status))
  const unfinishedTasks = tasks.filter((task) => !isCompletedStatus(task.status))
  const totalFocusMinutes = focusSessions.reduce((sum, session) => sum + numberValue(session.actualMinutes), 0)
  const focusMinutesByTask = focusSessions.reduce((map, session) => {
    const key = session.taskId || session.taskTitle || session.label || session.detail || '未关联任务'
    const title = session.taskTitle || findTaskTitle(tasks, session.taskId) || session.label || session.detail || '未关联任务'
    const current = map.get(key) || { id: session.taskId || '', title, totalMinutes: 0, sessions: 0 }
    current.totalMinutes += numberValue(session.actualMinutes)
    current.sessions += 1
    map.set(key, current)
    return map
  }, new Map())

  const dailyOverview = dates.map((date) => {
    const dayTasks = tasks.filter((task) => getRecordDate(task) === date)
    const dayFocusSessions = focusSessions.filter((session) => getRecordDate(session) === date)
    const dayEvidenceItems = evidenceItems.filter((item) => getRecordDate(item) === date)
    const dayReviews = reviews.filter((review) => getRecordDate(review) === date)
    return {
      date,
      taskCount: dayTasks.length,
      completedTaskCount: dayTasks.filter((task) => isCompletedStatus(task.status)).length,
      focusMinutes: dayFocusSessions.reduce((sum, session) => sum + numberValue(session.actualMinutes), 0),
      evidenceCount: dayEvidenceItems.length,
      hasReview: dayReviews.length > 0,
    }
  })

  return {
    range,
    totalTasks: tasks.length,
    completedTasks: completedTasks.length,
    unfinishedTasks: unfinishedTasks.length,
    totalFocusMinutes,
    averageDailyFocusMinutes: Math.round(totalFocusMinutes / Math.max(dates.length, 1)),
    evidenceCount: evidenceItems.length,
    knowledgeCardCount: knowledgeCards.length,
    reviewCount: reviews.length,
    mainlineStats: groupCount(tasks, 'mainline'),
    projectStats: groupCount(tasks, 'project'),
    dailyFocusStats: dailyOverview.map((day) => ({ date: day.date, minutes: day.focusMinutes })),
    dailyCompletedTaskStats: dailyOverview.map((day) => ({ date: day.date, completedTasks: day.completedTaskCount })),
    dailyOverview,
    hyperfocusTasks: Array.from(focusMinutesByTask.values()).filter((task) => task.totalMinutes > 190).sort((a, b) => b.totalMinutes - a.totalMinutes),
    overdueTasks: tasks.filter((task) => !isCompletedStatus(task.status) && task.deadline && String(task.deadline).slice(0, 10) <= range.endDate),
    completedTaskList: completedTasks,
    unfinishedTaskList: unfinishedTasks,
    evidenceItems,
    reviews,
    weeklyArchives,
  }
}

async function generateWeeklyAdvice(summary, data) {
  const fallback = {
    available: false,
    error: '',
    data: {
      weeklySummary: 'AI 建议生成失败，但本周统计已生成。',
      mainProgress: [],
      mainProblems: [],
      procrastinationPattern: '',
      hyperfocusPattern: '',
      nextWeekPriorities: [],
      nextWeekScheduleSuggestion: '',
      oneSentenceAdvice: '',
    },
  }

  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) return { ...fallback, error: '未配置 DEEPSEEK_API_KEY' }

  const model = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash'
  const baseUrl = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '')

  try {
    const upstreamResponse = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: buildWeeklyAdviceMessages(summary, data),
        temperature: 0.2,
        max_tokens: 2200,
        response_format: { type: 'json_object' },
      }),
    })

    const text = await upstreamResponse.text()
    let payload
    try {
      payload = text ? JSON.parse(text) : {}
    } catch {
      payload = { raw: text }
    }

    if (!upstreamResponse.ok) {
      return { ...fallback, error: `DeepSeek 请求失败：${upstreamResponse.status}` }
    }

    const messageContent = payload?.choices?.[0]?.message?.content ?? ''
    const parsed = JSON.parse(extractJsonText(messageContent))
    return { available: true, error: '', data: normalizeWeeklyAdvice(parsed) }
  } catch (error) {
    return {
      ...fallback,
      error: error instanceof Error ? error.message : 'DeepSeek 请求失败',
    }
  }
}

function buildWeeklyAdviceMessages(summary, data) {
  const schema = {
    weeklySummary: '',
    mainProgress: [],
    mainProblems: [],
    procrastinationPattern: '',
    hyperfocusPattern: '',
    nextWeekPriorities: [],
    nextWeekScheduleSuggestion: '',
    oneSentenceAdvice: '',
  }

  const compactInput = {
    range: summary.range,
    stats: {
      totalTasks: summary.totalTasks,
      completedTasks: summary.completedTasks,
      unfinishedTasks: summary.unfinishedTasks,
      totalFocusMinutes: summary.totalFocusMinutes,
      averageDailyFocusMinutes: summary.averageDailyFocusMinutes,
      evidenceCount: summary.evidenceCount,
      knowledgeCardCount: summary.knowledgeCardCount,
      reviewCount: summary.reviewCount,
      mainlineStats: summary.mainlineStats,
      projectStats: summary.projectStats,
      dailyFocusStats: summary.dailyFocusStats,
      dailyCompletedTaskStats: summary.dailyCompletedTaskStats,
      hyperfocusTasks: summary.hyperfocusTasks,
      overdueTasks: summary.overdueTasks.map((task) => pickTask(task)),
    },
    reviews: summary.reviews.map((review) => ({
      date: getRecordDate(review),
      mainlineAdvanced: review.mainlineAdvanced || '',
      evidenceLeft: review.evidenceLeft || '',
      procrastinationOrHyperfocus: review.procrastinationOrHyperfocus || '',
      firstStepTomorrow: review.firstStepTomorrow || '',
    })),
    weeklyArchives: summary.weeklyArchives,
    contextData: {
      tasks: safeArray(data.tasks).slice(0, 80).map((task) => pickTask(task)),
    },
  }

  return [
    {
      role: 'system',
      content: [
        '你是成长证据驾驶舱的周复盘建议助手。',
        '你必须只输出合法 JSON，不要 Markdown，不要代码块，不要解释性文字。',
        '输出中文。不要鸡汤，不要批评用户。',
        '基于数据指出本周真实完成情况，识别拖延和过度沉浸模式。',
        '下周优先级最多 3 个，建议必须具体、可执行。',
        '建议要适合研究生科研、数据分析学习、文献综述、AI 产品开发、考试备考场景。',
        `严格使用这个 JSON 结构：${JSON.stringify(schema)}`,
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        '请基于以下七日统计和复盘内容输出结构化周建议。',
        '再次强调：只输出合法 JSON。',
        JSON.stringify(compactInput, null, 2),
      ].join('\n'),
    },
  ]
}

function buildWeeklyReportHtml({ range, summary, aiAdvice }) {
  const maxFocus = Math.max(...summary.dailyFocusStats.map((day) => day.minutes), 1)
  const advice = aiAdvice.data

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>成长证据驾驶舱｜七日周报</title>
  <style>
    :root { color-scheme: light; --paper:#fbfaf5; --card:#ffffff; --ink:#26312c; --muted:#66756e; --line:#e8ddc8; --sage:#6f8f7a; --clay:#a66f52; --soft:#f2eee4; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--paper); color: var(--ink); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif; line-height: 1.65; }
    main { max-width: 1120px; margin: 0 auto; padding: 32px 20px 56px; }
    header { border-bottom: 1px solid var(--line); padding-bottom: 22px; margin-bottom: 24px; }
    h1 { margin: 0; font-size: 28px; letter-spacing: 0; }
    h2 { margin: 0 0 14px; font-size: 18px; }
    h3 { margin: 0 0 8px; font-size: 15px; }
    p { margin: 0; }
    .range { color: var(--muted); margin-top: 8px; }
    .grid { display: grid; gap: 14px; }
    .overview { grid-template-columns: repeat(5, minmax(0, 1fr)); }
    .two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .card { background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 18px; box-shadow: 0 10px 28px rgba(38,49,44,.06); }
    .metric-label { color: var(--muted); font-size: 13px; }
    .metric-value { margin-top: 8px; font-size: 26px; font-weight: 700; color: var(--sage); }
    section { margin-top: 18px; }
    table { width: 100%; border-collapse: collapse; overflow: hidden; border-radius: 8px; background: var(--card); }
    th, td { border-bottom: 1px solid var(--line); padding: 10px 12px; text-align: left; vertical-align: top; }
    th { background: var(--soft); color: var(--muted); font-size: 13px; font-weight: 700; }
    tr:last-child td { border-bottom: 0; }
    ul { margin: 0; padding-left: 20px; }
    li { margin: 4px 0; }
    .muted { color: var(--muted); }
    .bar-row { display: grid; grid-template-columns: 96px 1fr 64px; gap: 10px; align-items: center; margin: 8px 0; }
    .bar-track { height: 10px; background: var(--soft); border-radius: 999px; overflow: hidden; }
    .bar-fill { height: 100%; background: var(--sage); border-radius: 999px; }
    .tag { display: inline-block; border-radius: 8px; background: var(--soft); padding: 2px 8px; color: var(--muted); font-size: 12px; margin-right: 6px; }
    .warning { border-color: #e7c8a9; background: #fff8ef; }
    .advice { background: #f7f7f1; border-color: #d9e2d4; }
    @media (max-width: 820px) { .overview, .two { grid-template-columns: 1fr; } main { padding: 22px 14px 40px; } table { font-size: 14px; } }
    @media print { body { background: white; } main { max-width: none; padding: 0; } .card { box-shadow: none; break-inside: avoid; } section { break-inside: avoid; } }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>成长证据驾驶舱｜七日周报</h1>
      <p class="range">${escapeHtml(range.startDate)} 至 ${escapeHtml(range.endDate)}</p>
    </header>

    <section class="grid overview">
      ${metricCard('总专注时间', `${summary.totalFocusMinutes} 分钟`)}
      ${metricCard('完成任务数', `${summary.completedTasks} / ${summary.totalTasks}`)}
      ${metricCard('成果证据数', summary.evidenceCount)}
      ${metricCard('知识卡数', summary.knowledgeCardCount)}
      ${metricCard('复盘次数', summary.reviewCount)}
    </section>

    <section class="card">
      <h2>每日概览</h2>
      <table>
        <thead><tr><th>日期</th><th>任务数</th><th>完成任务数</th><th>专注分钟数</th><th>成果数量</th><th>是否复盘</th></tr></thead>
        <tbody>${summary.dailyOverview.map((day) => `<tr><td>${escapeHtml(day.date)}</td><td>${day.taskCount}</td><td>${day.completedTaskCount}</td><td>${day.focusMinutes}</td><td>${day.evidenceCount}</td><td>${day.hasReview ? '是' : '否'}</td></tr>`).join('')}</tbody>
      </table>
    </section>

    <section class="grid two">
      ${statsCard('项目统计', summary.projectStats)}
      ${statsCard('主线统计', summary.mainlineStats)}
    </section>

    <section class="card">
      <h2>每日专注趋势</h2>
      ${summary.dailyFocusStats.map((day) => `<div class="bar-row"><span>${escapeHtml(day.date.slice(5))}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.round((day.minutes / maxFocus) * 100)}%"></div></div><span>${day.minutes} 分</span></div>`).join('')}
    </section>

    <section class="grid two">
      ${listCard('本周完成任务', summary.completedTaskList, renderTask)}
      ${listCard('本周未完成任务', summary.unfinishedTaskList, renderTask)}
    </section>

    <section class="card">
      <h2>本周成果证据</h2>
      ${renderList(summary.evidenceItems, renderEvidence, '本周没有成果证据记录')}
    </section>

    <section class="card">
      <h2>本周复盘摘录</h2>
      ${renderList(summary.reviews, renderReview, '本周没有复盘记录')}
    </section>

    <section class="card warning">
      <h2>高沉浸提醒</h2>
      ${renderList(summary.hyperfocusTasks, (task) => `${escapeHtml(task.title)}：累计 ${task.totalMinutes} 分钟`, '本周没有明显过度沉浸任务')}
    </section>

    <section class="card warning">
      <h2>DDL 逾期或未完成任务</h2>
      ${renderList(summary.overdueTasks, renderTask, '本周没有 DDL 逾期或未完成提醒')}
    </section>

    <section class="card advice">
      <h2>AI 周复盘建议</h2>
      ${!aiAdvice.available ? `<p class="muted">AI 建议生成失败，但本周统计已生成。</p>` : ''}
      <h3>本周总结</h3><p>${escapeHtml(advice.weeklySummary || '未生成')}</p>
      <h3>主要进展</h3>${renderTextList(advice.mainProgress)}
      <h3>主要问题</h3>${renderTextList(advice.mainProblems)}
      <h3>拖延模式</h3><p>${escapeHtml(advice.procrastinationPattern || '未识别到明确模式')}</p>
      <h3>过度沉浸模式</h3><p>${escapeHtml(advice.hyperfocusPattern || '未识别到明确模式')}</p>
      <h3>下周优先级</h3>${renderTextList(advice.nextWeekPriorities)}
      <h3>下周安排建议</h3><p>${escapeHtml(advice.nextWeekScheduleSuggestion || '未生成')}</p>
      <h3>一句话建议</h3><p>${escapeHtml(advice.oneSentenceAdvice || '未生成')}</p>
    </section>
  </main>
</body>
</html>`
}

function metricCard(label, value) {
  return `<article class="card"><p class="metric-label">${escapeHtml(label)}</p><p class="metric-value">${escapeHtml(value)}</p></article>`
}

function statsCard(title, stats) {
  const entries = Object.entries(stats)
  return `<section class="card"><h2>${escapeHtml(title)}</h2>${entries.length ? `<ul>${entries.map(([key, count]) => `<li>${escapeHtml(key)}：${count}</li>`).join('')}</ul>` : '<p class="muted">暂无记录</p>'}</section>`
}

function listCard(title, items, render) {
  return `<section class="card"><h2>${escapeHtml(title)}</h2>${renderList(items, render, '暂无记录')}</section>`
}

function renderList(items, render, emptyText) {
  if (!items.length) return `<p class="muted">${escapeHtml(emptyText)}</p>`
  return `<ul>${items.map((item) => `<li>${render(item)}</li>`).join('')}</ul>`
}

function renderTextList(items) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : []
  if (!safeItems.length) return '<p class="muted">未生成</p>'
  return `<ul>${safeItems.slice(0, 6).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
}

function renderTask(task) {
  const parts = [
    `<strong>${escapeHtml(task.title || '未命名任务')}</strong>`,
    task.project ? `<span class="tag">${escapeHtml(task.project)}</span>` : '',
    task.mainline ? `<span class="tag">${escapeHtml(task.mainline)}</span>` : '',
    task.status ? `状态：${escapeHtml(task.status)}` : '',
    task.deadline ? `DDL：${escapeHtml(String(task.deadline).slice(0, 10))}` : '',
  ].filter(Boolean)
  return parts.join(' ')
}

function renderEvidence(item) {
  return [
    `<strong>${escapeHtml(item.title || item.type || 'Evidence')}</strong>`,
    escapeHtml(item.content || item.proof || item.note || ''),
    item.relatedProject ? `<span class="tag">${escapeHtml(item.relatedProject)}</span>` : '',
  ].filter(Boolean).join(' ')
}

function renderReview(review) {
  return [
    `<strong>${escapeHtml(getRecordDate(review))}</strong>`,
    escapeHtml(review.mainlineAdvanced || review.note || ''),
    review.evidenceLeft ? `证据：${escapeHtml(review.evidenceLeft)}` : '',
    review.procrastinationOrHyperfocus ? `拖延/沉浸：${escapeHtml(review.procrastinationOrHyperfocus)}` : '',
    review.firstStepTomorrow ? `明天第一步：${escapeHtml(review.firstStepTomorrow)}` : '',
  ].filter(Boolean).join('；')
}

function normalizeWeeklyAdvice(value) {
  return {
    weeklySummary: stringValue(value.weeklySummary),
    mainProgress: arrayValue(value.mainProgress).slice(0, 6),
    mainProblems: arrayValue(value.mainProblems).slice(0, 6),
    procrastinationPattern: stringValue(value.procrastinationPattern),
    hyperfocusPattern: stringValue(value.hyperfocusPattern),
    nextWeekPriorities: arrayValue(value.nextWeekPriorities).slice(0, 3),
    nextWeekScheduleSuggestion: stringValue(value.nextWeekScheduleSuggestion),
    oneSentenceAdvice: stringValue(value.oneSentenceAdvice),
  }
}

function filterRecordsByRange(records, range) {
  return records.filter((record) => {
    const date = getRecordDate(record)
    return date >= range.startDate && date <= range.endDate
  })
}

function filterWeeklyArchives(records, range) {
  return records.filter((archive) => {
    const start = archive.weekStart || getRecordDate(archive)
    const end = archive.weekEnd || start
    return start <= range.endDate && end >= range.startDate
  })
}

function getDateRange(startDate, endDate) {
  const dates = []
  let current = startDate
  while (current <= endDate && dates.length < 31) {
    dates.push(current)
    current = addDays(current, 1)
  }
  return dates
}

function addDays(dateString, offset) {
  const date = parseLocalDate(dateString)
  date.setDate(date.getDate() + offset)
  return toLocalDate(date)
}

function toLocalDate(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return toLocalDate(new Date())
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseLocalDate(dateString) {
  const [year, month, day] = String(dateString || '').split('-').map(Number)
  return new Date(year, month - 1, day)
}

function getRecordDate(record) {
  const value = record?.date || record?.createdAt || record?.completedAt || record?.reviewDate || record?.startedAt
  return value ? String(value).slice(0, 10) : ''
}

function groupCount(records, field) {
  return records.reduce((stats, record) => {
    const key = stringValue(record?.[field]) || '未设置'
    stats[key] = (stats[key] || 0) + 1
    return stats
  }, {})
}

function pickTask(task) {
  return {
    title: task.title || '',
    project: task.project || task.course || '',
    mainline: task.mainline || '',
    status: task.status || '',
    deadline: task.deadline || '',
    date: getRecordDate(task),
    nextAction: task.nextAction || '',
    output: task.output || '',
  }
}

function findTaskTitle(tasks, taskId) {
  if (!taskId) return ''
  return tasks.find((task) => task.id === taskId)?.title || ''
}

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

function numberValue(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function stringValue(value) {
  if (typeof value === 'string') return value
  if (value === null || value === undefined) return ''
  return String(value)
}

function arrayValue(value) {
  if (Array.isArray(value)) return value.map(stringValue).filter(Boolean)
  return value ? [stringValue(value)] : []
}

function isDateText(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))
}

function isCompletedStatus(status) {
  return status === 'completed' || status === '已完成'
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
