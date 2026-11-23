import { useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { createRecordId } from '../utils/records'
import { getRecordDate, isDateInWeek, localToday } from '../utils/dateRecords'
import { FeynmanLearningRoom } from './FeynmanLearningRoom'

const emptyReview = {
  mainlineAdvanced: '',
  evidenceLeft: '',
  procrastinationOrHyperfocus: '',
  firstStepTomorrow: '',
}

export function ReviewPage({
  tasks,
  focusSessions,
  evidenceItems,
  knowledgeCards,
  setKnowledgeCards,
  reviews,
  setReviews,
  feynmanRooms,
  setFeynmanRooms,
  activeFocusSession,
}) {
  const today = localToday()
  const normalizedReviews = useMemo(() => (Array.isArray(reviews) ? reviews : []).map((review) => normalizeReview(review, today)), [reviews, today])
  const todayReview = normalizedReviews.find((review) => review.date === today)
  const [draft, setDraft] = useState(todayReview ?? emptyReview)
  const [rangeFilter, setRangeFilter] = useState('今日复盘')
  const filteredReviews = normalizedReviews.filter((review) => {
    if (rangeFilter === '历史复盘') return true
    if (rangeFilter === '今日复盘') return review.date === today
    return isDateInWeek(review.date, today)
  })

  function handleSubmit(event) {
    event.preventDefault()
    const review = {
      ...draft,
      id: todayReview?.id ?? createRecordId('review'),
      date: today,
      createdAt: todayReview?.createdAt ?? today,
    }
    setReviews((items) => {
      const normalized = items.map(normalizeReview)
      const exists = normalized.some((item) => item.date === today)
      if (exists) {
        return normalized.map((item) => (item.date === today ? review : item))
      }
      return [review, ...normalized]
    })
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-wheat/50 bg-white/55 p-5 shadow-soft">
        <p className="text-sm font-medium text-sage">Review</p>
        <h2 className="mt-1 text-xl font-semibold text-ink">每日主复盘</h2>
        <p className="mt-2 text-sm leading-6 text-ink/62">
          每天只保存一条主复盘。今天已有复盘时，表单会编辑今天这条记录。
        </p>
      </section>

      <FeynmanLearningRoom
        tasks={tasks}
        focusSessions={focusSessions}
        evidenceItems={evidenceItems}
        knowledgeCards={knowledgeCards}
        setKnowledgeCards={setKnowledgeCards}
        reviews={reviews}
        setReviews={setReviews}
        feynmanRooms={feynmanRooms}
        setFeynmanRooms={setFeynmanRooms}
        activeFocusSession={activeFocusSession}
      />

      <form onSubmit={handleSubmit} className="rounded-lg border border-wheat/50 bg-white/55 p-5 shadow-soft">
        <div className="grid gap-4 md:grid-cols-2">
          <Textarea label="mainlineAdvanced" value={draft.mainlineAdvanced} onChange={(value) => setDraft({ ...draft, mainlineAdvanced: value })} />
          <Textarea label="evidenceLeft" value={draft.evidenceLeft} onChange={(value) => setDraft({ ...draft, evidenceLeft: value })} />
          <Textarea label="procrastinationOrHyperfocus" value={draft.procrastinationOrHyperfocus} onChange={(value) => setDraft({ ...draft, procrastinationOrHyperfocus: value })} />
          <Textarea label="firstStepTomorrow" value={draft.firstStepTomorrow} onChange={(value) => setDraft({ ...draft, firstStepTomorrow: value })} />
        </div>
        <button type="submit" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-sage px-4 py-2.5 text-sm font-medium text-paper">
          <Check className="h-4 w-4" />
          {todayReview ? '更新今日复盘' : '创建今日复盘'}
        </button>
      </form>

      <section className="rounded-lg border border-wheat/50 bg-white/55 p-5 shadow-soft">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-lg font-semibold text-ink">复盘记录</h3>
          <select value={rangeFilter} onChange={(event) => setRangeFilter(event.target.value)} className="rounded-lg border border-wheat/60 bg-paper px-3 py-2 text-sm text-ink">
            {['今日复盘', '本周复盘', '历史复盘'].map((option) => <option key={option}>{option}</option>)}
          </select>
        </div>
        <div className="mt-4 space-y-3">
          {filteredReviews.map((review) => (
            <article key={review.id} className="rounded-lg bg-linen/60 p-4">
              <p className="text-sm font-semibold text-sage">{review.date}</p>
              <p className="mt-2 text-sm leading-6 text-ink/75">{review.mainlineAdvanced}</p>
              <p className="mt-1 text-sm leading-6 text-ink/65">明天第一步：{review.firstStepTomorrow || '未填写'}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

export function getLatestReview(reviews) {
  return (Array.isArray(reviews) ? reviews : [])
    .map((review) => normalizeReview(review, localToday()))
    .filter((review) => review.date)
    .sort((a, b) => b.date.localeCompare(a.date))[0]
}

export function hasReviewToday(reviews) {
  const today = localToday()
  return (Array.isArray(reviews) ? reviews : []).map((review) => normalizeReview(review, today)).some((review) => review.date === today)
}

function normalizeReview(review, fallbackDate = localToday()) {
  const date = getRecordDate(review, fallbackDate)
  return {
    id: review.id,
    date,
    createdAt: review.createdAt ?? date,
    mainlineAdvanced: review.mainlineAdvanced ?? review.note ?? '',
    evidenceLeft: review.evidenceLeft ?? '',
    procrastinationOrHyperfocus: review.procrastinationOrHyperfocus ?? '',
    firstStepTomorrow: review.firstStepTomorrow ?? '',
  }
}

function Textarea({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink/75">{label}</span>
      <textarea rows="4" value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full resize-none rounded-lg border border-wheat/60 bg-paper px-4 py-3 text-sm leading-6 text-ink" />
    </label>
  )
}
