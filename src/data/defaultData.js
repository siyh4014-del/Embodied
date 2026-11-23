export const storageKeys = {
  settings: 'growth-dashboard:settings',
  tasks: 'growth-dashboard:tasks',
  focusSessions: 'growth-dashboard:focusSessions',
  parkingItems: 'growth-dashboard:parkingItems',
  knowledgeCards: 'growth-dashboard:knowledgeCards',
  evidenceItems: 'growth-dashboard:evidenceItems',
  reviews: 'growth-dashboard:reviews',
  dailyLogs: 'growth-dashboard:dailyLogs',
  weeklyArchives: 'growth-dashboard:weeklyArchives',
  monthlyArchives: 'growth-dashboard:monthlyArchives',
  activeFocusSession: 'growth-dashboard:activeFocusSession',
  feynmanRooms: 'growth-dashboard:feynmanRooms',
  siteBackgroundImage: 'growth-dashboard:siteBackgroundImage',
  trackedMainlineTasks: 'trackedMainlineTasks',
  mainlineContinuityRecords: 'mainlineContinuityRecords',
  taskCardOrder: 'taskCardOrder',
}

export const defaultSettings = {
  studentName: '学习者',
  weeklyFocus: '把学习动作转化为可复盘证据',
  reviewPrompt: '今天哪个动作最有效？明天如何降低启动阻力？',
  currentFocusTaskId: null,
}

export const defaultTasks = [
  {
    id: 'task-math-review',
    title: '完成数学错题复盘',
    project: 'Mathematics',
    mainline: '错题复盘',
    reason: '把重复错误转化为稳定规则',
    versionGoal: 'V1',
    nextAction: '定位最近三道错题的共同错因',
    estimatedMinutes: 25,
    completionStandard: '写出一张规则卡，并完成一道同类题',
    output: '错题规则卡',
    fallbackAction: '只标出一道题的错因',
    date: '2026-05-31',
    createdAt: '2026-05-31',
    deadline: '2026-05-31',
    priority: 'P1',
    status: 'not_started',
  },
  {
    id: 'task-english-evidence',
    title: '整理英语阅读证据',
    project: 'English',
    mainline: '阅读输出',
    reason: '把阅读理解从做题结果转为可复述证据',
    versionGoal: 'V0',
    nextAction: '摘录文章中的三个论点句',
    estimatedMinutes: 18,
    completionStandard: '完成一次 2 分钟口头复述',
    output: '复述录音和句子摘录',
    fallbackAction: '只摘录一个段落的主旨句',
    date: '2026-06-01',
    createdAt: '2026-06-01',
    deadline: '2026-06-01',
    priority: 'P2',
    status: 'not_started',
  },
  {
    id: 'task-science-report',
    title: '科学实验报告初稿',
    project: 'Science',
    mainline: '实验报告',
    reason: '先完成可提交版本，再迭代表达质量',
    versionGoal: 'V1',
    nextAction: '补充变量说明和数据表',
    estimatedMinutes: 35,
    completionStandard: '形成完整初稿，包含变量、数据和结论',
    output: '实验报告 v1',
    fallbackAction: '只完成变量说明',
    date: '2026-06-02',
    createdAt: '2026-06-02',
    deadline: '2026-06-02',
    priority: 'P1',
    status: 'in_progress',
  },
]

export const defaultFocusSessions = [
  { id: 'focus-deep-work', label: 'Deep Work', time: '25 min', detail: '科学实验报告变量说明', date: '2026-05-28', createdAt: '2026-05-28' },
  { id: 'focus-review-sprint', label: 'Review Sprint', time: '12 min', detail: '错题规则卡二次确认', date: '2026-05-29', createdAt: '2026-05-29' },
  { id: 'focus-reading-block', label: 'Reading Block', time: '18 min', detail: '英语阅读论点句摘录', date: '2026-05-30', createdAt: '2026-05-30' },
]

export const defaultParkingItems = [
  { id: 'parking-writing', title: '作文开头容易铺垫过长', tag: '表达优化', owner: '本周五处理', status: 'open' },
  { id: 'parking-evidence-link', title: '复盘记录缺少证据链接', tag: '流程优化', owner: '下次提交前检查', status: 'open' },
  { id: 'parking-switching', title: '番茄钟结束后切换任务慢', tag: '专注优化', owner: '明天试行', status: 'open' },
]

export const defaultKnowledgeCards = [
  {
    id: 'card-variables',
    title: '变量控制',
    source: 'Science Lab 03',
    type: '概念',
    oneSentence: '只改变一个变量，才能判断结果变化来自哪里。',
    problemSolved: '实验结论缺少因果依据',
    relatedProject: 'Science',
    application: '写实验报告时先列变量表',
    createdAt: '2026-05-30',
    date: '2026-05-30',
    reviewDate: '2026-05-30',
    reviewRecords: [],
    tags: ['science', 'method'],
  },
  {
    id: 'card-main-idea',
    title: '主旨句定位',
    source: 'English Reading',
    type: '方法',
    oneSentence: '先找段落功能，再判断主旨句。',
    problemSolved: '阅读时被细节句带偏',
    relatedProject: 'English',
    application: '阅读题先标段落功能',
    createdAt: '2026-05-30',
    date: '2026-05-30',
    reviewDate: '2026-06-01',
    reviewRecords: [],
    tags: ['english', 'reading'],
  },
]

export const defaultEvidenceItems = [
  {
    id: 'evidence-report',
    date: '2026-05-28',
    createdAt: '2026-05-28',
    type: 'Draft',
    content: '实验报告 v1，包含变量表、数据和初步结论。',
    relatedProject: 'Science',
    relatedTaskId: 'task-science-report',
    usableForPaper: true,
    usableForResume: false,
    usableForPortfolio: true,
    note: '可继续补充教师批注截图。',
  },
  {
    id: 'evidence-audio',
    date: '2026-05-29',
    createdAt: '2026-05-29',
    type: 'Audio',
    content: '英语阅读 2 分 40 秒口头复述录音。',
    relatedProject: 'English',
    relatedTaskId: 'task-english-evidence',
    usableForPaper: false,
    usableForResume: false,
    usableForPortfolio: true,
    note: '适合作为口语输出进步证据。',
  },
]

export const defaultReviews = [
  {
    id: 'review-2026-05-29',
    date: '2026-05-29',
    createdAt: '2026-05-29',
    mainlineAdvanced: '科学报告完成了变量说明。',
    evidenceLeft: '留下实验报告 v1 草稿。',
    procrastinationOrHyperfocus: '开始前整理材料花了太久。',
    firstStepTomorrow: '直接打开实验报告，先写结论第一段。',
  },
]

export const defaultDailyLogs = []
export const defaultWeeklyArchives = []
export const defaultMonthlyArchives = []
