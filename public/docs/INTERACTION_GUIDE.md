# 成长证据驾驶舱交互说明文档

## 1. 产品一句话说明

成长证据驾驶舱不是普通 Todo List。它更像一个本地学习管理系统：先把任务拆成能启动的下一步，再进入专注室执行，结束后强制收尾，沉淀知识卡和成果证据，最后用日复盘、周工作台、月归档和七日周报回看进展。

它适合研究生科研、数据分析学习、文献综述、AI 产品开发、课程作业、考试备考、作品集积累等需要长期推进的场景。

## 2. 推荐每日使用流程

1. 打开 Dashboard，先看今日任务、今日复习、今日成果、本周概览和最近一次 Review。
2. 到 Task Breakdown 添加或拆解任务。模糊任务先做 V0，写清下一步动作、完成标准、输出物和 fallbackAction。
3. 如果任务卡住，使用 AI 任务拆解教练，让它给出结构化建议，再选择“填入任务表单”或“直接创建任务”。
4. 进入 Focus Room，从已有任务开始专注，或快速创建一个任务并开始专注。
5. 专注结束后看休息提醒，填写收尾表单。达到完成标准就勾选 reachedStandard。
6. 如果出现想继续优化但现在不该展开的内容，放入 Parking Lot。
7. 学到可复用方法、概念或规则后，创建 Knowledge Card。
8. 完成报告、图表、录音、草稿、原型、截图等产出后，添加 Evidence。
9. 晚上进入 Review，回答每日四问。
10. 每周进入 Week Workspace 生成/更新周归档、月归档，也可以在 Week Workspace 生成最近七日 HTML 周报。

## 3. 页面说明

### Dashboard

页面作用：提供当天总览，帮助你决定今天先做什么。

适合什么时候使用：每天打开系统的第一站；专注前确认方向；晚上复盘前回看数据。

核心操作：
- 查看今日任务、今日复习、今日成果、本周概览。
- 查看任务按 DDL、优先级、完成状态排序后的执行队列。
- 查看任务累计专注时间。
- 修改学习者名称、本周焦点和复盘提示语。
- 导出或导入 JSON 数据备份。

注意事项：
- Dashboard 不等于“今天必须完成全部任务”。
- `reachedStandard` 勾选后，任务会被标记为 completed，并在列表中弱化显示。
- 当前代码中没有独立的 Life Reset Map 页面；不要把 Dashboard 当成完整人生规划工具。

### Task Breakdown

页面作用：把模糊任务拆成可以开始执行的任务卡。

适合什么时候使用：不知道怎么开始、任务太大、需要给专注室准备明确任务时。

核心操作：
- 新建、编辑、删除任务。
- 设置 V0/V1/V2、project、mainline、priority、deadline、status。
- 按今日、本周、未完成、Backlog、全部筛选。
- 在任务卡上点击“开始专注”，把任务送入 Focus Room。
- 使用 DeepSeek AI 任务拆解教练，生成结构化任务建议。
- 对 AI 推荐任务选择“填入任务表单”或“直接创建任务”。

注意事项：
- 下一步动作要小到能立刻开始。
- 完成标准要具体，避免“继续优化一下”这种无边界描述。
- Backlog 主要用于没有日期和 deadline 的任务。

### Focus Room

页面作用：执行一个明确任务，并在结束时留下收尾记录。

适合什么时候使用：已经选定一个任务，准备进入 15/45/90 分钟专注块时。

核心操作：
- 从 Task Breakdown 的任务卡开始专注。
- 或在 Focus Room 快速创建任务并开始专注。
- 选择 15、45、90 分钟模式，也可以一键按任务预计时长开始。
- 暂停、继续、手动进入收尾。
- 填写 completedWhat、missingWhat、nextStep、reachedStandard。
- 勾选 sendToParkingLot 或 createEvidence。

注意事项：
- 倒计时结束后会出现休息弹窗，当前界面使用动态猫咪作为休息提醒。
- 可开启浏览器通知；声音提醒会在浏览器允许的情况下播放。
- 单项任务累计专注超过 190 分钟时会出现防沉浸提醒，建议先切换任务或只继续一个短时段。
- 勾选 reachedStandard 后，任务状态会变为 completed。

### Parking Lot

页面作用：存放“值得继续处理，但现在不该打断主线”的内容。

适合什么时候使用：专注中冒出优化点、补充点、新想法、流程问题，但当前任务还没完成时。

核心操作：
- 新建、编辑、删除停车场事项。
- 从 Focus Room 收尾表单勾选 sendToParkingLot 自动生成事项。
- 在 Parking Lot 中一键转为任务。
- 已转任务的事项显示 converted 状态。

注意事项：
- Parking Lot 不是任务列表，它是防止过度优化和临时分心的缓冲区。
- 真正要执行时，再把事项转成 Task。

### Knowledge Cards

页面作用：把学到的概念、方法、规则压缩成可复习、可迁移的卡片。

适合什么时候使用：读完文献、学完方法、复盘错题、总结数据分析规则后。

核心操作：
- 新增、编辑、删除知识卡。
- 填写 source、type、oneSentence、problemSolved、application、reviewDate、tags。
- 按今日需复习、本周创建、全部筛选。
- 按标签和复习日期过滤。
- 标记今日已复习。

注意事项：
- 当前复习规则基于创建日期的 1、3、7、14 天间隔，并结合 reviewRecords 判断今天是否已复习。
- Knowledge Card 关注“我理解了什么、下次怎么用”。

### Evidence Library

页面作用：保存学习过程中留下的可展示、可复用成果证据。

适合什么时候使用：完成草稿、图表、录音、截图、报告、数据表、原型、结构化笔记后。

核心操作：
- 新增、编辑、删除成果证据。
- 标记是否可用于论文、简历、作品集。
- 关联项目和任务。
- 上传附件。
- 图片、PDF、txt、md、csv 可在页面内预览。
- Word、Excel、PPT 等不支持页面内预览的文件，可下载查看。
- 按今日、本周、全部、类型、用途、日期过滤。

注意事项：
- 附件 Blob 保存在浏览器 IndexedDB。
- localStorage 只保存附件元数据。
- JSON 备份不包含附件文件本体。
- 如果清理浏览器站点数据、换电脑、换浏览器，附件可能丢失。

### Review

页面作用：每天写一条主复盘，帮助第二天接上行动。

适合什么时候使用：晚上学习结束后，或最后一个专注块结束后。

核心操作：
- 回答四个问题：今天推进了哪条主线、留下什么证据、哪里拖延或过度沉浸、明天第一步是什么。
- 查看今日复盘、本周复盘、历史复盘。

注意事项：
- 每天只保留一条主复盘。当天再次提交会更新今日复盘。
- 当前七日周报入口在 Week Workspace 页面，不在 Review 页面。

### Week Workspace / Calendar

页面作用：按周查看每天的任务、专注、成果、知识卡和复盘，并生成归档。

适合什么时候使用：周中回看节奏、周末做周复盘、月底做月回顾时。

核心操作：
- 查看当前周七日日历。
- 点击某一天查看当天详情。
- 切换上一周、下一周、回到今天。
- 更新今日日志。
- 生成/更新本周归档。
- 生成/更新本月归档。
- 生成最近七日 HTML 周报。

注意事项：
- dailyLogs 是轻量日志，用来记录某天关联了哪些任务、专注、成果、知识卡和复盘。
- weeklyArchives 是周归档，monthlyArchives 是月归档。
- 归档用于减少所有历史任务都堆在 Task Breakdown 里的压力。

### Global Search

页面作用：跨模块搜索已有记录。

适合什么时候使用：忘记任务、知识卡、成果证据或复盘记录在哪个页面时。

核心操作：
- 在顶部搜索框输入关键词。
- 搜索任务、知识卡、成果证据和复盘。
- 结果按类型分组展示。
- 点击结果会跳转到对应页面。

注意事项：
- 当前搜索是轻量本地搜索，不是全文数据库检索。
- 跳转到页面后，仍可能需要用该页面的筛选器定位具体记录。

### Help

页面作用：给第一次打开系统的用户提供极简上手路径。

适合什么时候使用：忘记基本流程、给他人介绍系统、快速回顾功能时。

核心操作：
- 查看 8 步快速流程。
- 了解 AI 教练、专注室、附件、周工作台和七日周报。
- 查看完整说明文档位置：`docs/INTERACTION_GUIDE.md`。

注意事项：
- Help 页面保持简短，不替代完整说明文档。

## 4. 核心概念解释

- V0：最低可启动版本。目标是先留下粗糙但真实的产出。
- V1：可提交、可复盘版本。目标是结构完整、别人能看懂。
- V2：优化版本。目标是进一步提升表达、证据、形式或质量。
- 下一步动作：打开任务后立刻能做的第一件小事。
- 完成标准：判断这一轮是否结束的具体标准。
- 输出物：本轮结束后留下的文档、表格、录音、截图、代码、草稿等。
- fallbackAction：状态差、卡住或时间不足时也能做的最低动作。
- Parking Lot：暂存优化点和分心想法的停车场。
- Evidence：证明你做过、理解过、产出过的成果证据。
- Knowledge Card：可复习、可迁移的知识压缩卡。
- dailyLogs：每天的轻量记录。
- weeklyArchives：一周数据的归档记录。
- monthlyArchives：一个月数据的归档记录。
- 190 分钟防沉浸机制：同一任务累计专注超过 190 分钟时提醒你暂停或切换，避免无限优化。

## 5. AI 任务拆解教练说明

AI 任务拆解教练在 Task Breakdown 页面。

你需要填写：
- 当前情绪。
- 当前任务描述。
- 当前完成状态。
- 今日可用时间。
- 卡点。
- 关联项目。
- 期望目标 V0/V1/V2。
- 最近复盘。

AI 会返回结构化结果，包括当前卡住原因、建议心态、V0/V1/V2 目标、15/45/90 分钟动作、完成标准、输出物、兜底动作、防沉浸停止点和推荐任务。

使用方式：
- “填入任务表单”：把 AI 推荐任务放进表单，你可以修改后保存。
- “直接创建任务”：把 AI 推荐任务直接加入任务列表。

后端关系：
- 前端不会读取 DeepSeek API Key。
- API Key 写在项目根目录 `.env.local`。
- 后端通过 `npm run server` 启动后，前端请求 `http://localhost:8787/api/deepseek/task-breakdown`。

AI 不可用时：
- 检查是否启动了 `npm run server`。
- 检查 `.env.local` 是否配置 `DEEPSEEK_API_KEY`。
- 也可以不用 AI，手动填写任务字段。

## 6. Focus Room 使用说明

从已有任务开始：
1. 进入 Task Breakdown。
2. 找到任务卡。
3. 点击“开始专注”。
4. 进入 Focus Room 执行当前任务。

快速创建任务并开始：
1. 进入 Focus Room。
2. 在快速开始区域填写任务名称、项目、目标、下一步动作、完成标准、输出物和预计时长。
3. 提交后系统会创建任务并开始专注。

模式选择：
- 15 分钟：低能量、启动困难、任务很模糊时。
- 45 分钟：大多数学习和写作任务。
- 90 分钟：文献综述、数据分析、结构搭建等深度任务。

猫咪弹窗：表示一轮专注已结束，建议先休息，再填写收尾记录。

声音提醒和浏览器通知：
- 声音提醒会在浏览器允许播放时响起。
- 浏览器通知需要你点击开启并授权。

190 分钟提醒出现时：
- 优先切换任务或休息。
- 如果必须继续，只继续短时段，并明确停止点。
- 把“还想优化”的内容放入 Parking Lot。

收尾表单：
- completedWhat：本轮实际完成了什么。
- missingWhat：还缺什么。
- nextStep：下一轮第一步。
- reachedStandard：是否达到完成标准。
- sendToParkingLot：是否把问题放入停车场。
- createEvidence：是否生成成果证据。

勾选 reachedStandard 后，当前任务会被标记为 completed，并记录 completedAt。

## 7. Evidence 附件说明

可以上传常见附件：图片、PDF、txt、md、csv、Word、Excel、PPT 等。

页面内可预览：
- 图片。
- PDF。
- txt/md/csv 等文本文件。

只能下载查看：
- Word。
- Excel。
- PowerPoint。
- 其他浏览器不支持预览的文件。

存储说明：
- 附件文件 Blob 保存在浏览器 IndexedDB。
- Evidence 记录和附件元数据保存在 localStorage。
- JSON 备份只包含附件元数据，不包含附件文件本体。
- 清理浏览器站点数据、换电脑、换浏览器可能导致附件文件丢失。
- 附件丢失时，页面会提示文件未找到。

## 8. 周工作台与归档说明

七日日历用于查看一周内每天发生了什么。点击某一天，可以看到当天任务、专注记录、成果证据、知识卡和复盘。

dailyLogs 是轻量日志，它不是完整备份，而是把每天的关键记录索引和摘要保存下来。

weeklyArchives 是周归档，包含周起止日期、每日日志日期和汇总数据。

monthlyArchives 是月归档，基于当月周归档汇总。

为什么不把所有历史任务都堆在 Task Breakdown：
- Task Breakdown 主要服务当前执行。
- 历史回看更适合放在 Week Workspace、weeklyArchives、monthlyArchives 和周报里。
- 这样当前任务列表不会被历史记录淹没。

## 9. 七日周报说明

入口在 Week Workspace 页面，“七日周报”区域。

使用前需要启动后端：

```bash
npm run server
```

然后启动前端：

```bash
npm run dev
```

点击“生成最近七日周报”后：
- 前端从 localStorage 读取最近 7 天任务、专注、成果、知识卡、复盘、dailyLogs、weeklyArchives。
- 后端生成统计。
- 如果 DeepSeek 可用，后端生成 AI 周复盘建议。
- 后端在项目根目录 `weekly-reports/` 保存 HTML 文件。
- 前端显示文件名、时间范围、统计摘要和“打开周报”链接。

DeepSeek 不可用时：
- HTML 周报仍会生成。
- AI 建议区域显示“AI 建议生成失败，但本周统计已生成。”

## 10. 字段填写示例

### 写作智能体文献综述任务

- title：整理写作智能体研究方向表
- project：研究生科研
- mainline：文献综述
- versionGoal：V1
- nextAction：打开文献表，按写作反馈、自动评分、协作写作三类标注 10 篇文献
- estimatedMinutes：45
- completionStandard：每类至少 2 篇代表文献，并写出一个共同研究问题
- output：三类文献方向表
- fallbackAction：只标注 3 篇最熟悉的文献
- priority：P1

### 金字塔原理学习任务

- title：用金字塔原理重写小组汇报大纲
- project：表达训练
- mainline：结构化表达
- versionGoal：V0
- nextAction：把当前大纲改成结论先行加三个理由
- estimatedMinutes：25
- completionStandard：形成一个可讲 3 分钟的新大纲
- output：金字塔结构汇报大纲
- fallbackAction：只写最上层结论和三个一级理由
- priority：P2

### 六级听力任务

- title：复盘一套六级听力错题
- project：六级备考
- mainline：听力训练
- versionGoal：V1
- nextAction：重听错题音频，标出没听出的关键词
- estimatedMinutes：45
- completionStandard：整理 5 个听力误判点，并写出下次识别规则
- output：六级听力错题规则卡
- fallbackAction：只复盘 1 道错题
- priority：P1

### 老年大学数据分析任务

- title：整理老年大学问卷描述统计
- project：数据分析
- mainline：问卷数据分析
- versionGoal：V1
- nextAction：检查变量名和缺失值，生成年龄、性别、参与频率描述表
- estimatedMinutes：60
- completionStandard：得到一张可放入报告的描述统计表
- output：描述统计表和简短发现
- fallbackAction：只完成变量名检查
- priority：P1

### 小组作业任务

- title：完成小组作业个人负责部分初稿
- project：小组作业
- mainline：课程汇报
- versionGoal：V0
- nextAction：根据分工写出自己负责部分的 5 个要点
- estimatedMinutes：45
- completionStandard：形成可发给组员讨论的初稿
- output：个人部分初稿
- fallbackAction：只列出 5 个要点，不写完整句子
- priority：P2

### 数据分析作品集任务

- title：整理一个可展示的数据分析案例
- project：作品集
- mainline：数据分析作品集
- versionGoal：V1
- nextAction：选择一个已完成分析，补充问题、数据、方法、结果四段说明
- estimatedMinutes：90
- completionStandard：形成一页作品集案例草稿，包含图表和结论
- output：数据分析案例页面草稿
- fallbackAction：只写问题和结果两段
- priority：P2

## 11. 标准日、低能量日、冲刺日使用模板

### 标准日

1. Dashboard 看今日任务和今日复习。
2. Task Breakdown 选 1 个 P1 任务和 1 个 P2 任务。
3. Focus Room 做 1 到 2 个 45 分钟专注块。
4. 学到方法就建 Knowledge Card，有产出就建 Evidence。
5. 晚上写 Review。

### 低能量日

1. 只选一个 V0 任务。
2. 使用 15 分钟模式。
3. fallbackAction 写得足够低门槛。
4. 结束后只要求留下一个小证据。
5. Review 只写明天第一步。

### 组会/DDL 冲刺日

1. Dashboard 先看 DDL 和 P1 任务。
2. Task Breakdown 把大任务拆成可交付的 V0/V1。
3. Focus Room 使用 45 或 90 分钟模式。
4. 暂时不处理的优化点全部放入 Parking Lot。
5. 结束后添加 Evidence，保留可提交版本。

### 考试前一天

1. 只看今日复习和最关键错题。
2. 不新开大任务。
3. 用 15/45 分钟块复盘高频错点。
4. 每个错点写成 Knowledge Card。
5. Review 写明天进考场前第一步。

## 12. 数据保存说明

localStorage 保存：
- settings。
- tasks。
- focusSessions。
- parkingItems。
- knowledgeCards。
- evidenceItems。
- reviews。
- dailyLogs。
- weeklyArchives。
- monthlyArchives。

IndexedDB 保存：
- Evidence 附件文件 Blob。

`.env.local` 保存：
- `DEEPSEEK_API_KEY`。
- 可选的 `DEEPSEEK_MODEL`。
- 可选的 `DEEPSEEK_BASE_URL`。

`weekly-reports/` 保存：
- 后端生成的七日 HTML 周报。

影响说明：
- 换端口通常不影响 localStorage，但换域名、换浏览器、无痕模式会影响。
- 清理浏览器站点数据可能清空 localStorage 和 IndexedDB。
- JSON 备份不包含附件文件本体。
- 当前版本不是云同步，也没有账号系统。

建议：
- 定期在 Dashboard 导出 JSON。
- 重要阶段生成七日周报。
- 清理浏览器数据或换电脑前，先导出数据并单独保存附件。

## 13. 常见问题 FAQ

### 1. 每天必须把所有模块都用一遍吗？

不需要。最低限度是：拆一个任务，做一轮专注，留下一个证据或一条 Review。

### 2. 任务太多怎么办？

先按未完成、今日、本周、项目和优先级筛选，只选一个 P1 或 P2 任务进入 Focus Room。

### 3. 任务没做完怎么办？

收尾时不要勾选 reachedStandard，写清 nextStep，下次继续。

### 4. 时间到了但我还想继续改怎么办？

先把想改的点写到 missingWhat 或 Parking Lot。若确实必须继续，只开一个短时段并明确停止点。

### 5. Knowledge Card 和 Evidence 有什么区别？

Knowledge Card 是“我理解了什么、下次怎么用”。Evidence 是“我产出了什么、它能证明什么”。

### 6. Parking Lot 和 Task 有什么区别？

Parking Lot 是暂存点，不要求马上执行。Task 是已经准备进入执行流程的任务。

### 7. AI 教练不能用怎么办？

确认 `npm run server` 已启动，`.env.local` 有 `DEEPSEEK_API_KEY`。仍不可用时，手动填写任务字段即可。

### 8. 附件会不会丢？

有可能。附件保存在当前浏览器 IndexedDB 中，清理站点数据、换浏览器、换电脑都可能丢失附件文件。

### 9. 为什么 Task Breakdown 不默认显示全部任务？

默认聚焦当前更需要处理的任务，避免历史任务淹没今天要做的事。需要时可以切换到“全部”。

### 10. 周报文件在哪里？

项目根目录的 `weekly-reports/` 文件夹中。生成成功后前端也会提供打开链接。

### 11. 为什么要开 npm run server 和 npm run dev？

`npm run dev` 启动前端页面。`npm run server` 启动本地后端代理，用于 DeepSeek 和周报 HTML 文件生成。

### 12. 这个系统和普通 Todo List 有什么区别？

普通 Todo List 关注是否完成。成长证据驾驶舱关注任务是否拆清楚、是否执行、是否防沉浸、是否留下证据、是否形成复盘和下周行动。

## 14. 当前版本限制

- 当前版本没有账号系统、数据库、云同步。
- 数据主要保存在当前浏览器本地。
- 附件不会进入 JSON 备份。
- 周报生成依赖本地后端服务。
- DeepSeek 不可用时，AI 建议不会生成，但统计周报仍可生成。
- 全局搜索是轻量本地搜索，不是复杂检索系统。
- 周归档和月归档需要手动生成/更新。
- 部分界面文案和历史数据可能存在编码显示问题，后续可统一清理。

## 15. 后续可优化方向

1. 数据库和云同步。
2. 账号系统和多设备同步。
3. 附件云存储。
4. 自动周报和定时提醒。
5. 更完整的日历视图。
6. 移动端适配。
7. 更强的全文搜索和标签体系。
8. 数据导入前预览和差异合并。
