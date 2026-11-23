# Growth Evidence Dashboard

A local-first learning management dashboard for long-term task planning, focused execution, evidence capture, knowledge review, daily reflection, Feynman explanation, and weekly reporting.

The app is designed around three separate layers:

- Task Breakdown: planning layer for long-term tasks and date ranges.
- Focus Room: execution layer for starting, timing, and closing out daily work.
- Dashboard: display layer for today queue, mainline continuity, review signals, and summaries.

## Core Features

### Dashboard

- Today execution queue
- Today's focused time
- Evidence count
- Today review signal
- Mainline In Progress with ✅ / ❌ continuity records
- 21-day mainline cycles with collapsible history
- Previous day's Review summary
- Bottom-left Settings entry
- Global search across tasks, evidence, knowledge cards, and reviews

### Task Breakdown

- Create, edit, and delete long-term tasks
- Start date / DDL based task lifecycle status
- Today / This Week / All views
- Status and project filters
- Drag-and-drop task card ordering
- Start Focus Room from a task card
- DeepSeek-powered AI Task Breakdown Coach

### Focus Room

- Current task focus timer
- 15 / 45 / 90 minute focus modes
- Rest reminder and manual wrap-up
- Browser notification and sound reminder
- Active timer recovery through `activeFocusSession`
- Closed-out focus records saved to `focusSessions`
- Long-focus / anti-immersion reminder

### Week Workspace

- Seven-day execution view
- Daily detail view
- Circular 24-hour focus time dial
- Daily tasks, evidence, knowledge cards, and Review overview
- Weekly archive and monthly archive
- Seven-day HTML weekly report generation

### Review

- Daily Review records
- Previous-day Review shown on Dashboard
- Embedded Feynman Learning Room

### Feynman Learning Room

- Choose today's closed-out tasks or create free explanation topics
- One long-running conversation room per task
- Upload learning materials
- AI restatement, follow-up questions, speaking scaffold, and demonstration answer
- Optional online search for materials, cases, papers, and official docs
- Generate Knowledge Cards, visual short cards, mindmap, and today's Feynman review

### Knowledge Cards

- Create reusable knowledge cards
- Receive generated cards from Feynman Learning Room
- Spaced review timing
- Today review list

### Evidence Library

- Save learning outputs as evidence
- Upload attachments
- Store attachment files in IndexedDB
- Store attachment metadata in localStorage
- Preview supported images, PDFs, text, Markdown, and CSV files
- Keep Office files as downloadable attachments

### Settings

- Learner name
- Weekly focus
- Review prompt
- Data export
- Data import
- Background upload / clear

## Tech Stack

- Vite
- React
- Node.js
- Express
- DeepSeek API backend proxy
- localStorage for primary app data
- IndexedDB for attachment file blobs

## Start The App

Install dependencies:

```bash
npm install
```

Start the frontend:

```bash
npm run dev
```

Start the backend proxy:

```bash
npm run server
```

Build for production:

```bash
npm run build
```

Preview a production build:

```bash
npm run preview
```

Frontend usually runs at:

```text
http://localhost:5173
```

Backend runs at:

```text
http://localhost:8787
```

## Environment Variables

Create `.env.local` in the project root for AI features:

```env
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=
DEEPSEEK_BASE_URL=
```

Optional online search keys:

```env
TAVILY_API_KEY=
BRAVE_SEARCH_API_KEY=
SERPAPI_API_KEY=
```

The frontend does not need direct access to the DeepSeek key. AI calls go through the local backend.

## Data Safety

- Primary data is stored in the current browser's localStorage.
- Attachment files are stored in IndexedDB.
- JSON export includes app data and attachment metadata, but not attachment file blobs.
- Clearing browser site data can delete tasks, reviews, evidence metadata, and attachment files.
- Use Settings -> Export Data before clearing browser data or moving browsers.
- Import Data overwrites current local browser data after confirmation.

## Documentation

- `docs/QUICK_START.md`: fast setup, first-day flow, daily routine, and common questions.
- `docs/INTERACTION_GUIDE.md`: complete module logic, interaction rules, and data relationships.
- `README.md`: project overview, features, setup, environment variables, and boundaries.

## Current Boundaries

- The app is local-first and browser-storage based.
- Attachments are not included as blobs in JSON backup.
- AI features require `npm run server` and valid API keys.
- Weekly HTML report generation requires the backend server.
- Online search in Feynman Learning Room requires at least one configured search provider key.
