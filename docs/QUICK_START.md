# Quick Start

This guide is for getting the Growth Evidence Dashboard running and using it for the first day.

## 1. Start The Project

Install dependencies:

```bash
npm install
```

Start the frontend:

```bash
npm run dev
```

Vite usually opens the app at:

```text
http://localhost:5173
```

Start the local backend proxy in another terminal:

```bash
npm run server
```

The backend runs at:

```text
http://localhost:8787
```

The backend is required for DeepSeek features and weekly HTML report generation.

## 2. Ten-Minute First Flow

1. Open Task Breakdown and create a long-term task.
   Fill in title, project, start date, DDL, next action, completion standard, output, and fallback action.

2. Open Dashboard.
   The today queue shows tasks whose date range includes today.

3. Start one task in Focus Room.
   Focus Room records when the session starts and how long you focus.

4. End the session and submit the wrap-up.
   This writes a closed-out focusSession and creates the daily execution loop.

5. Return to Dashboard and check Mainline In Progress.
   Use Manage Mainline to choose long-term tasks from Task Breakdown. A completed daily loop is shown as ✅; a missed loop is shown as ❌. Records are grouped into 21-day cycles.

6. Open Week Workspace.
   Daily detail uses a circular 24-hour time dial to show focus distribution.

7. Write a Review.
   Review is for the daily reflection. Dashboard shows the previous day's Review below Mainline In Progress.

8. Use Feynman Learning Room.
   First explain what you learned, then let AI restate, ask questions, give a speaking scaffold, and generate Knowledge Cards, visual cards, a mindmap, and today's Feynman review.

9. Review Knowledge Cards.
   Cards use spaced review timing and show what is due today.

10. Save evidence in Evidence Library.
    Upload screenshots, documents, reports, notes, and other reusable learning outputs.

## 3. Daily Routine

1. Morning: open Dashboard and check the today queue.
2. Choose one task and start it in Focus Room.
3. When stopping, write what was completed, what is missing, and the next step.
4. Save useful outputs as Evidence or Knowledge Cards.
5. Evening: write Review or do a Feynman explanation.
6. Check whether the mainline has a ✅ or ❌ for the day.

## 4. Data Storage

- Main app data is saved in browser `localStorage`.
- Attachment files are saved in browser `IndexedDB`.
- Attachment metadata is saved with Evidence records in `localStorage`.
- Do not clear browser site data unless you have exported a backup.
- Data export and import are in the bottom-left Settings panel.

## 5. Common Questions

### The page does not open

Run:

```bash
npm run dev
```

Then open the Vite URL shown in the terminal.

### AI does not respond

Make sure the backend is running:

```bash
npm run server
```

Also check `.env.local` for:

```env
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=
DEEPSEEK_BASE_URL=
```

### Online search in Feynman does not work

Search is optional. Configure one of these keys if you want online lookup:

```env
TAVILY_API_KEY=
BRAVE_SEARCH_API_KEY=
SERPAPI_API_KEY=
```

### Attachments disappeared

Attachments live in IndexedDB. Clearing browser site data, changing browsers, or using another computer can remove them. Export JSON for metadata, but remember JSON does not include the attachment file blobs.

### Mainline does not show ✅

✅ appears only when that task has a Focus Room session for that day with a submitted closeout. Starting a task without wrap-up counts as ❌.

### Why does the Task Breakdown weekly view show long-term tasks?

The weekly view shows tasks whose date range overlaps the current week. A task that started earlier and ends later still belongs in this week.
