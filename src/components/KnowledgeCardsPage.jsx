import { useMemo, useState } from 'react'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import {
  getDueReviewCards,
  getKnowledgeCardCreatedDate,
  markKnowledgeCardReviewedToday,
} from '../utils/knowledgeReview'
import { createRecordId, deleteById, upsertById } from '../utils/records'
import { getRecordDate, isDateInWeek, localToday } from '../utils/dateRecords'

const emptyCard = {
  title: '',
  source: '',
  type: '',
  oneSentence: '',
  problemSolved: '',
  relatedProject: '',
  application: '',
  reviewDate: '',
  date: '',
  createdAt: '',
  tags: '',
}

export function KnowledgeCardsPage({ knowledgeCards, setKnowledgeCards }) {
  const today = localToday()
  const normalizedCards = useMemo(() => (Array.isArray(knowledgeCards) ? knowledgeCards : []).map((card) => normalizeCard(card, today)), [knowledgeCards, today])
  const [draft, setDraft] = useState(emptyCard)
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [tagFilter, setTagFilter] = useState('全部标签')
  const [reviewDateFilter, setReviewDateFilter] = useState('')
  const [rangeFilter, setRangeFilter] = useState('今日需复习')

  const tagOptions = useMemo(
    () => ['全部标签', ...Array.from(new Set(normalizedCards.flatMap((card) => card.tags)))],
    [normalizedCards],
  )

  const dueTodayCards = getDueReviewCards(normalizedCards, today)
  const filteredCards = normalizedCards.filter((card) => {
    const matchesTag = tagFilter === '全部标签' || card.tags.includes(tagFilter)
    const matchesDate = !reviewDateFilter || card.reviewDate === reviewDateFilter
    const cardDate = getRecordDate(card, today)
    const matchesRange =
      rangeFilter === '全部' ||
      (rangeFilter === '今日需复习' && dueTodayCards.some((dueCard) => dueCard.id === card.id)) ||
      (rangeFilter === '本周创建' && isDateInWeek(cardDate, today))
    return matchesTag && matchesDate && matchesRange
  })

  function resetForm() {
    setDraft(emptyCard)
    setEditingId(null)
    setShowForm(false)
  }

  function handleSubmit(event) {
    event.preventDefault()
    const card = {
      ...draft,
      id: editingId ?? createRecordId('card'),
      date: draft.date || draft.createdAt || today,
      createdAt: draft.createdAt || draft.date || today,
      reviewRecords: Array.isArray(draft.reviewRecords) ? draft.reviewRecords : [],
      tags: splitTags(draft.tags),
    }
    setKnowledgeCards((items) => upsertById(items.map(normalizeCard), card))
    resetForm()
  }

  function handleEdit(card) {
    setDraft({ ...card, tags: card.tags.join(', ') })
    setEditingId(card.id)
    setShowForm(true)
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-wheat/50 bg-white/55 p-5 shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-sage">Knowledge Cards</p>
            <h2 className="mt-1 text-xl font-semibold text-ink">知识消化卡</h2>
            <p className="mt-2 text-sm leading-6 text-ink/62">把学到的概念压缩成可复习、可迁移、可应用的卡片。</p>
          </div>
          <button type="button" onClick={() => setShowForm(true)} className="inline-flex w-fit items-center gap-2 rounded-lg bg-sage px-4 py-2.5 text-sm font-medium text-paper">
            <Plus className="h-4 w-4" />
            新增知识卡
          </button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <SelectFilter label="范围" value={rangeFilter} options={['今日需复习', '本周创建', '全部']} onChange={setRangeFilter} />
          <SelectFilter label="标签" value={tagFilter} options={tagOptions} onChange={setTagFilter} />
          <DateFilter label="复习日期" value={reviewDateFilter} onChange={setReviewDateFilter} />
          <div className="rounded-lg border border-wheat/50 bg-linen/60 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-sage">Today Review</p>
            <p className="mt-1 text-sm font-medium text-ink">{dueTodayCards.length} 张今天需要复习</p>
          </div>
        </div>
      </section>

      {dueTodayCards.length > 0 && (
        <section className="rounded-lg border border-clay/35 bg-white/65 p-5 shadow-soft">
          <h3 className="text-lg font-semibold text-ink">今天需要复习</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {dueTodayCards.map((card) => (
              <MiniCard
                key={card.id}
                card={card}
                today={today}
                onMarkReviewed={() => markKnowledgeCardReviewedToday(card.id, today, setKnowledgeCards)}
              />
            ))}
          </div>
        </section>
      )}

      {showForm && (
        <KnowledgeForm draft={draft} setDraft={setDraft} isEditing={editingId !== null} onSubmit={handleSubmit} onCancel={resetForm} />
      )}

      <section className="grid gap-4 xl:grid-cols-2">
        {filteredCards.map((card) => (
          <article key={card.id} className="rounded-lg border border-wheat/50 bg-white/55 p-5 shadow-soft">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-sage">{card.source} · {card.type || '未分类'}</p>
                <h3 className="mt-2 text-lg font-semibold text-ink">{card.title}</h3>
              </div>
              <div className="flex gap-2">
                <IconButton label="编辑" icon={Pencil} onClick={() => handleEdit(card)} />
                <IconButton label="删除" icon={Trash2} danger onClick={() => setKnowledgeCards((items) => deleteById(items, card.id))} />
              </div>
            </div>
            <p className="mt-4 rounded-lg bg-linen/60 p-4 text-sm font-medium leading-6 text-ink">{card.oneSentence}</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Info label="解决的问题" value={card.problemSolved} />
              <Info label="应用方式" value={card.application} />
              <Info label="关联项目" value={card.relatedProject} />
              <Info label="复习日期" value={card.reviewDate} />
              <Info label="创建日期" value={getKnowledgeCardCreatedDate(card)} />
            </div>
            {dueTodayCards.some((dueCard) => dueCard.id === card.id) && (
              <button
                type="button"
                onClick={() => markKnowledgeCardReviewedToday(card.id, today, setKnowledgeCards)}
                className="mt-4 rounded-lg bg-sage px-3 py-2 text-xs font-medium text-paper"
              >
                标记今日已复习
              </button>
            )}
            <TagList tags={card.tags} />
          </article>
        ))}
      </section>
    </div>
  )
}

function KnowledgeForm({ draft, setDraft, isEditing, onSubmit, onCancel }) {
  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-wheat/50 bg-white/55 p-5 shadow-soft">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold text-ink">{isEditing ? '编辑知识卡' : '新增知识卡'}</h3>
        <button type="button" onClick={onCancel} className="inline-flex items-center gap-2 rounded-lg border border-wheat/60 px-3 py-2 text-sm text-ink/70">
          <X className="h-4 w-4" />
          取消
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <TextField label="title" value={draft.title} onChange={(value) => setDraft({ ...draft, title: value })} required />
        <TextField label="source" value={draft.source} onChange={(value) => setDraft({ ...draft, source: value })} />
        <TextField label="type" value={draft.type} onChange={(value) => setDraft({ ...draft, type: value })} />
        <TextField label="relatedProject" value={draft.relatedProject} onChange={(value) => setDraft({ ...draft, relatedProject: value })} />
        <TextField label="reviewDate" type="date" value={draft.reviewDate} onChange={(value) => setDraft({ ...draft, reviewDate: value })} />
        <TextField label="date" type="date" value={draft.date} onChange={(value) => setDraft({ ...draft, date: value })} />
        <TextField label="createdAt" type="date" value={draft.createdAt} onChange={(value) => setDraft({ ...draft, createdAt: value })} />
        <TextField label="tags" value={draft.tags} onChange={(value) => setDraft({ ...draft, tags: value })} placeholder="用逗号分隔" />
        <TextareaField label="oneSentence" value={draft.oneSentence} onChange={(value) => setDraft({ ...draft, oneSentence: value })} />
        <TextareaField label="problemSolved" value={draft.problemSolved} onChange={(value) => setDraft({ ...draft, problemSolved: value })} />
        <TextareaField label="application" value={draft.application} onChange={(value) => setDraft({ ...draft, application: value })} />
      </div>
      <button type="submit" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-sage px-4 py-2.5 text-sm font-medium text-paper">
        <Check className="h-4 w-4" />
        {isEditing ? '保存知识卡' : '创建知识卡'}
      </button>
    </form>
  )
}

function MiniCard({ card, today, onMarkReviewed }) {
  const createdDate = getKnowledgeCardCreatedDate(card)

  return (
    <div className="rounded-lg border border-red-200 bg-red-50/80 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-red-600">
            到期复习{createdDate ? ` · 创建于 ${createdDate}` : ''}
          </p>
          <p className="mt-2 font-semibold text-ink">{card.title}</p>
        </div>
        <button
          type="button"
          onClick={onMarkReviewed}
          className="rounded-lg bg-sage px-3 py-2 text-xs font-medium text-paper"
        >
          标记今日已复习
        </button>
      </div>
      <p className="mt-2 text-sm leading-6 text-ink/70">{card.oneSentence}</p>
    </div>
  )
}

function normalizeCard(card, fallbackDate = localToday()) {
  const date = getRecordDate(card, fallbackDate)
  return {
    id: card.id,
    title: card.title ?? card.concept ?? '',
    source: card.source ?? '',
    type: card.type ?? '',
    oneSentence: card.oneSentence ?? '',
    problemSolved: card.problemSolved ?? '',
    relatedProject: card.relatedProject ?? '',
    application: card.application ?? '',
    reviewDate: card.reviewDate ?? '',
    date,
    createdAt: (card.createdAt || card.createdDate || card.date || date).slice(0, 10),
    reviewRecords: Array.isArray(card.reviewRecords) ? card.reviewRecords : [],
    tags: Array.isArray(card.tags) ? card.tags : splitTags(card.tags ?? ''),
  }
}

function splitTags(value) {
  return String(value)
    .split(/[，,]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function TextField({ label, value, onChange, type = 'text', required = false, placeholder }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink/75">{label}</span>
      <input type={type} value={value} placeholder={placeholder} required={required} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-lg border border-wheat/60 bg-paper px-4 py-3 text-sm text-ink" />
    </label>
  )
}

function TextareaField({ label, value, onChange }) {
  return (
    <label className="block md:col-span-2">
      <span className="text-sm font-medium text-ink/75">{label}</span>
      <textarea rows="3" value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full resize-none rounded-lg border border-wheat/60 bg-paper px-4 py-3 text-sm leading-6 text-ink" />
    </label>
  )
}

function SelectFilter({ label, value, options, onChange }) {
  return (
    <label className="rounded-lg border border-wheat/50 bg-linen/60 px-4 py-3">
      <span className="text-xs font-medium uppercase tracking-[0.14em] text-sage">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full bg-transparent text-sm font-medium text-ink">
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  )
}

function DateFilter({ label, value, onChange }) {
  return (
    <label className="rounded-lg border border-wheat/50 bg-linen/60 px-4 py-3">
      <span className="text-xs font-medium uppercase tracking-[0.14em] text-sage">{label}</span>
      <input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full bg-transparent text-sm font-medium text-ink" />
    </label>
  )
}

function Info({ label, value }) {
  return (
    <div className="rounded-lg bg-linen/50 p-3">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-sage">{label}</p>
      <p className="mt-2 text-sm leading-6 text-ink/72">{value || '未填写'}</p>
    </div>
  )
}

function TagList({ tags }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {tags.map((tag) => <span key={tag} className="rounded-lg bg-linen px-3 py-1 text-xs text-ink/70">{tag}</span>)}
    </div>
  )
}

function IconButton({ label, icon: Icon, onClick, danger = false }) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex items-center gap-2 rounded-lg bg-linen px-3 py-2 text-xs font-medium ${danger ? 'text-clay' : 'text-ink/70'}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}
