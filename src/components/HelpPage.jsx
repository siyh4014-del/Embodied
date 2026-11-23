import { BookOpen, ExternalLink } from 'lucide-react'

const quickSteps = [
  {
    title: '1. 新建长期任务',
    body: '先到 Task Breakdown 新建任务，填写标题、项目、开始日期、DDL、下一步、完成标准等。Task Breakdown 负责计划层。',
  },
  {
    title: '2. 查看今日执行队列',
    body: '回到 Dashboard 查看今天处于任务周期内的任务。今日状态来自 Focus Room 当天启动和收尾记录。',
  },
  {
    title: '3. 进入 Focus Room 专注',
    body: '从任务卡开始专注。系统记录 startedAt；结束并收尾后，会写入 focusSessions，形成当天闭环。',
  },
  {
    title: '4. 查看主线进行时',
    body: '在 Dashboard 从 Task Breakdown 选择主线任务。✅ 表示当天形成收尾闭环，❌ 表示当天没有闭环；每 21 天为一个周期。',
  },
  {
    title: '5. 回看一周证据',
    body: '进入 Week Workspace，用七日视图和 24 小时圆形时间盘查看每天任务、专注、证据、知识卡和复盘。',
  },
  {
    title: '6. 做 Review / Feynman 输出',
    body: 'Review 用于每日复盘。Feynman Learning Room 先让你讲，再由 AI 追问、校准，并生成知识卡、视觉卡、思维导图和费曼复盘。',
  },
  {
    title: '7. 复习与沉淀证据',
    body: '在 Knowledge Cards 保存和复习关键知识；在 Evidence Library 上传或管理学习产出、截图、文档和材料。',
  },
  {
    title: '8. 设置与备份',
    body: '左下角 Settings 可管理学习者名称、本周焦点、复盘提示语、数据导入导出，以及背景设置。',
  },
]

const moduleNotes = [
  {
    title: 'Dashboard',
    body: '展示今日执行队列、今日专注时长、证据沉淀、今日复盘、主线进行时和最近一次复盘。今日任务状态来自 Focus Room，不等于 Task Breakdown 的长期周期状态。主线任务需手动选择；✅ / ❌ 来自当天是否完成 Focus Room 收尾。最近一次复盘读取 Review 中前一天的复盘内容。系统设置已移到左下角 Settings。',
  },
  {
    title: 'Task Breakdown',
    body: '计划层。支持新建、编辑、删除任务，AI 任务拆解教练，今日 / 本周 / 全部视图，按状态和项目筛选，拖拽排序，以及开始专注。状态按开始日期和 DDL 判断：待执行、执行中、已完成。本周视图显示任务区间与本周有交集的任务。',
  },
  {
    title: 'Focus Room',
    body: '执行层。负责记录当天是否启动、是否收尾、专注了多久。切换模块后 activeFocusSession 仍可恢复计时。收尾后写入 focusSessions，并驱动 Dashboard 今日状态和主线进行时。保留休息提醒、浏览器通知和超长专注提醒。',
  },
  {
    title: 'Week Workspace',
    body: '用于查看一周执行证据。七日视图汇总每天任务、专注、证据、知识卡和复盘；每日详情用 0:00-24:00 圆形时间盘显示专注分布，并在图下方显示简洁图例。仍支持周归档、月归档和七日 HTML 周报。',
  },
  {
    title: 'Review',
    body: '用于沉淀每日复盘记录。Dashboard 的最近一次复盘读取前一天 Review。Feynman Learning Room 嵌入 Review，用于讲解、追问、校准和生成输出。',
  },
  {
    title: 'Feynman Learning Room',
    body: '从今日已收尾任务中选择讲解对象，也支持自由讲解。每个任务保留长期对话窗口，可上传资料。AI 会复述、追问、给讲法模板、示范一版，也可联网查资料、案例、文献或官方文档。结束后可生成 Knowledge Cards、视觉短卡片、思维导图和今日费曼复盘。',
  },
  {
    title: 'Knowledge Cards',
    body: '创建和复习知识卡，也可接收 Feynman Learning Room 生成的知识卡。系统按间隔复习逻辑提示今日复习和下次复习。',
  },
  {
    title: 'Evidence Library',
    body: '保存学习证据和附件。附件文件保存在浏览器 IndexedDB，附件元数据保存在 localStorage。图片、PDF、文本等可预览，Office 文件可作为附件保存或下载查看。',
  },
  {
    title: 'Settings',
    body: '左下角设置入口包含学习者名称、本周焦点、复盘提示语、数据导出、数据导入、背景设置和更新背景。',
  },
  {
    title: '全局搜索与周报',
    body: '顶部全局搜索可搜索任务、证据、知识卡和复盘。Week Workspace 可生成最近 7 天 HTML 周报，需要本地后端 server 正常运行。',
  },
]

const docLinks = [
  {
    title: 'docs/QUICK_START.md',
    body: '适合第一次运行和快速上手，包含启动命令、每日流程、数据保存和常见问题。',
  },
  {
    title: 'docs/INTERACTION_GUIDE.md',
    body: '适合查看完整功能说明、模块逻辑、数据关系和交互规则。',
  },
  {
    title: 'README.md',
    body: '适合了解项目总览、技术栈、启动方式、环境变量和功能边界。',
  },
]

export function HelpPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-wheat/50 bg-white/55 p-6 shadow-soft">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-sage text-paper">
            <BookOpen className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-sage">Help</p>
            <h2 className="mt-1 text-2xl font-semibold text-ink">新手快速上手</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/68">
              按“计划任务 - 专注执行 - 收尾复盘 - 沉淀证据”的顺序使用。先跑通一条主线，再逐步使用更多模块。
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {quickSteps.map((step) => (
          <article key={step.title} className="rounded-lg border border-wheat/50 bg-white/55 p-5 shadow-soft">
            <h3 className="text-base font-semibold text-ink">{step.title}</h3>
            <p className="mt-3 text-sm leading-6 text-ink/72">{step.body}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {moduleNotes.map((note) => (
          <article key={note.title} className="rounded-lg border border-wheat/50 bg-white/55 p-5 shadow-soft">
            <h3 className="text-base font-semibold text-ink">{note.title}</h3>
            <p className="mt-3 text-sm leading-6 text-ink/72">{note.body}</p>
          </article>
        ))}
      </section>

      <section className="rounded-lg border border-wheat/50 bg-linen/70 p-5">
        <p className="text-base font-semibold text-ink">核心原则：每天留下一个可复用证据，并让任务形成可复盘闭环。</p>
      </section>

      <section className="rounded-lg border border-wheat/50 bg-white/55 p-5 shadow-soft">
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-lg font-semibold text-ink">查看完整文档</h3>
            <p className="mt-2 text-sm leading-6 text-ink/62">
              如果页面不能直接打开本地 Markdown，请在项目目录中查看以下文件。
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {docLinks.map((doc) => (
              <div key={doc.title} className="rounded-lg bg-linen/60 p-4">
                <p className="text-sm font-semibold text-ink">{doc.title}</p>
                <p className="mt-2 text-sm leading-6 text-ink/65">{doc.body}</p>
              </div>
            ))}
          </div>
          <a
            href="/docs/INTERACTION_GUIDE.html"
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-fit items-center gap-2 rounded-lg bg-sage px-4 py-2.5 text-sm font-medium text-paper"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            查看完整文档
          </a>
        </div>
      </section>
    </div>
  )
}
