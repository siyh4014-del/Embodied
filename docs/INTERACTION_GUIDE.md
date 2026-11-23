# Interaction Guide

Growth Evidence Dashboard is a local-first learning management system. It separates planning, execution, review, and evidence so long-term work can be tracked without mixing task lifecycle status with today's execution status.

## 1. Dashboard

Dashboard is the display layer.

It shows:

- Today queue
- Today's focused time
- Evidence count
- Today's review signal
- Mainline In Progress
- Previous day's Review
- Bottom-left Settings entry

### Today Queue

The today queue shows tasks whose task date range includes today. It keeps the queue focused on what can be executed today.

Task row status comes from Focus Room daily execution records:

- Not started today
- In progress today
- Closed out today

This is separate from Task Breakdown's long-term task status.

### Mainline In Progress

Mainline tracking is selected manually from existing Task Breakdown tasks.

Daily cells mean:

- ✅ The task has at least one Focus Room session that was closed out that day.
- ❌ The task did not form a closed-out loop that day.

Records are grouped into 21-day cycles. The newest cycle is expanded. Historical cycles can be collapsed and show interruption counts plus the task's latest next step.

DDL labels use `endDate` or `deadline` when available.

### Previous Day Review

Dashboard shows the previous day's Review below Mainline In Progress. If no Review exists for the previous day, it shows an empty state.

### Settings

Settings moved to the bottom-left fixed entry. It includes learner name, weekly focus, review prompt, data export, data import, and background settings.

## 2. Task Breakdown

Task Breakdown is the planning layer.

It supports:

- Create, edit, and delete tasks
- AI Task Breakdown Coach
- Today / This Week / All views
- Status filter
- Project filter
- Drag-and-drop card ordering
- Start focus

### Date Range Logic

Task dates use local `YYYY-MM-DD`.

Start date priority:

1. `startDate`
2. `date`
3. local date from `createdAt`
4. today fallback

End date priority:

1. `endDate`
2. `deadline`
3. start date fallback

### Views

- Today: tasks active today.
- This Week: tasks whose date range overlaps the current week.
- All: all tasks.

### Status

Task Breakdown status is based only on task date range:

- Pending: today is before the task start date.
- Active: today is between start date and DDL, inclusive.
- Finished: DDL or end date is before today.

Focus Room closeout does not change this planning-layer status.

### Drag Sorting

Task cards can be dragged to reorder. The order is saved in `taskCardOrder`, a separate localStorage key, so the original `tasks` data structure is not polluted.

## 3. Focus Room

Focus Room is the execution layer.

It records:

- Which task started
- `startedAt`
- planned and actual minutes
- whether the session was closed out
- closeout date and time

`activeFocusSession` keeps an active timer restorable when switching modules.

Completed wrap-up writes records into `focusSessions`. Dashboard today status and Mainline In Progress read from these Focus Room records.

Focus Room keeps:

- Current focus timer
- 15 / 45 / 90 minute modes
- Manual wrap-up
- Rest reminder
- Browser notification
- Sound reminder
- Long-focus / anti-immersion reminder

The old focus module/template UI has been removed.

## 4. Week Workspace

Week Workspace is for reviewing weekly execution evidence.

It includes:

- Seven-day view
- Daily detail
- Circular 24-hour focus time dial
- Legend with task name, start time, end time, and duration
- Daily tasks, evidence, knowledge cards, and Review overview
- Weekly archive
- Monthly archive
- Seven-day HTML weekly report

The daily focus dial shows focus distribution from 0:00 to 24:00. It no longer shows a separate duplicate focus record list.

Weekly HTML report generation requires the backend server.

## 5. Review

Review stores daily reflection records.

It is used for:

- Daily mainline reflection
- Evidence left today
- Procrastination or over-immersion notes
- First step tomorrow
- Feynman Learning Room

Dashboard reads the previous day's Review from this module.

## 6. Feynman Learning Room

Feynman Learning Room is embedded in Review.

It supports:

- Choosing today's closed-out tasks
- Free explanation topics
- One long-running conversation room per task
- Uploading learning materials
- AI restatement
- AI follow-up questions
- Speaking scaffold
- AI demonstration answer
- Optional online search for materials, cases, papers, or official docs
- Generating Knowledge Cards
- Generating visual short cards
- Generating a mindmap
- Generating today's Feynman review

The core rule is: the learner speaks first. AI helps identify unclear parts and provides scaffolding after the learner attempts an explanation.

## 7. Knowledge Cards

Knowledge Cards store reusable concepts, methods, rules, and summaries.

They can be:

- Created manually
- Generated from Feynman Learning Room
- Reviewed by spaced intervals
- Marked as reviewed today

Dashboard shows cards due for review.

## 8. Evidence Library

Evidence Library stores reusable learning outputs.

It supports:

- Evidence records
- Attachment upload
- Image, PDF, text, Markdown, and CSV preview where supported
- Office files as downloadable attachments

Attachment files are stored in IndexedDB. Attachment metadata is stored in localStorage with evidence records.

## 9. Settings

Settings lives in the bottom-left fixed entry.

It includes:

- Learner name
- Weekly focus
- Review prompt
- Data export
- Data import
- Background upload
- Background clear

Importing data overwrites current local browser data after confirmation.

## 10. Global Search

The header search can search across:

- Tasks
- Knowledge cards
- Evidence
- Reviews

Search results navigate to the relevant module.

## 11. Data Structures And Compatibility

Primary localStorage keys include:

- `tasks`: Task Breakdown tasks.
- `focusSessions`: Focus Room session records.
- `activeFocusSession`: restorable active focus timer.
- `trackedMainlineTasks`: manually selected mainline tasks.
- `mainlineContinuityRecords`: daily ✅ / ❌ records.
- `taskCardOrder`: custom Task Breakdown card order.
- `feynmanRooms`: Feynman conversation rooms and generated outputs.
- `knowledgeCards`: knowledge cards and review data.
- `evidenceItems`: evidence records and attachment metadata.
- `reviews`: daily Review records.
- `settings`: learner name, weekly focus, and review prompt.

Attachment blobs are stored in browser IndexedDB, not in JSON backups.

The app is designed to tolerate missing fields in older data. Missing task dates fall back through the local date rules. Missing focus session fields are ignored where possible.

## 12. AI And Backend

The backend server powers:

- DeepSeek AI Task Breakdown Coach
- Feynman AI interactions
- Optional search proxy
- Seven-day HTML weekly report

Required for DeepSeek:

```env
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=
DEEPSEEK_BASE_URL=
```

Optional for online search:

```env
TAVILY_API_KEY=
BRAVE_SEARCH_API_KEY=
SERPAPI_API_KEY=
```
