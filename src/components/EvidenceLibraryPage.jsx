import { useMemo, useState } from 'react'
import { Check, Download, Eye, Pencil, Plus, Trash2, Upload, X } from 'lucide-react'
import { createRecordId, deleteById, upsertById } from '../utils/records'
import { getRecordDate, isDateInWeek, localToday } from '../utils/dateRecords'
import {
  deleteAttachment,
  downloadAttachment,
  formatAttachmentSize,
  getAttachmentBlob,
  getAttachmentPreviewUrl,
  isPreviewable,
  saveAttachment,
} from '../services/attachmentStorage'

const emptyEvidence = {
  date: '',
  createdAt: '',
  type: '',
  content: '',
  relatedProject: '',
  relatedTaskId: '',
  usableForPaper: false,
  usableForResume: false,
  usableForPortfolio: false,
  note: '',
  attachments: [],
}

export function EvidenceLibraryPage({ evidenceItems, setEvidenceItems, tasks }) {
  const today = localToday()
  const normalizedItems = useMemo(() => (Array.isArray(evidenceItems) ? evidenceItems : []).map((item) => normalizeEvidence(item, today)), [evidenceItems, today])
  const [draft, setDraft] = useState(() => ({ ...emptyEvidence, date: today, createdAt: today }))
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [dateFilter, setDateFilter] = useState('')
  const [rangeFilter, setRangeFilter] = useState('今日成果')
  const [typeFilter, setTypeFilter] = useState('全部类型')
  const [useFilter, setUseFilter] = useState('全部用途')
  const [previewState, setPreviewState] = useState(null)
  const [attachmentMessage, setAttachmentMessage] = useState('')

  const typeOptions = ['全部类型', ...Array.from(new Set(normalizedItems.map((item) => item.type).filter(Boolean)))]
  const filteredItems = normalizedItems.filter((item) => {
    const matchesDate = !dateFilter || item.date === dateFilter
    const itemDate = getRecordDate(item, today)
    const matchesRange =
      rangeFilter === '全部成果' ||
      (rangeFilter === '今日成果' && itemDate === today) ||
      (rangeFilter === '本周成果' && isDateInWeek(itemDate, today))
    const matchesType = typeFilter === '全部类型' || item.type === typeFilter
    const matchesUse =
      useFilter === '全部用途' ||
      (useFilter === '论文' && item.usableForPaper) ||
      (useFilter === '简历' && item.usableForResume) ||
      (useFilter === '作品集' && item.usableForPortfolio)
    return matchesDate && matchesType && matchesUse && matchesRange
  })

  function resetForm() {
    setDraft({ ...emptyEvidence, date: today, createdAt: today })
    setEditingId(null)
    setShowForm(false)
  }

  function handleSubmit(event) {
    event.preventDefault()
    const evidenceId = editingId ?? draft.id ?? createRecordId('evidence')
    const attachments = (Array.isArray(draft.attachments) ? draft.attachments : []).map((attachment) => ({
      ...attachment,
      evidenceId,
    }))
    setEvidenceItems((items) =>
      upsertById((Array.isArray(items) ? items : []).map((item) => normalizeEvidence(item, today)), {
        ...draft,
        id: evidenceId,
        date: draft.date || today,
        createdAt: draft.createdAt || draft.date || today,
        attachments,
      }),
    )
    resetForm()
  }

  function handleEdit(item) {
    setDraft(item)
    setEditingId(item.id)
    setShowForm(true)
  }

  async function handleDeleteEvidence(item) {
    await Promise.all((item.attachments || []).map((attachment) => deleteAttachment(attachment).catch(() => null)))
    setEvidenceItems((items) => deleteById(Array.isArray(items) ? items : [], item.id))
  }

  async function handlePreviewAttachment(attachment) {
    if (!isPreviewable(attachment)) {
      setPreviewState({ attachment, kind: 'unsupported' })
      return
    }

    const blob = await getAttachmentBlob(attachment)
    if (!blob) {
      setPreviewState({ attachment, missing: true })
      return
    }

    const url = await getAttachmentPreviewUrl(attachment)
    if (attachment.type?.startsWith('text/') || /\.(txt|md|csv)$/i.test(attachment.name || '')) {
      setPreviewState({ attachment, kind: 'text', text: await blob.text(), url })
      return
    }

    setPreviewState({ attachment, kind: attachment.type === 'application/pdf' ? 'pdf' : 'image', url })
  }

  async function handleDownloadAttachment(attachment) {
    const ok = await downloadAttachment(attachment)
    if (!ok) setAttachmentMessage('附件文件未找到，可能已被浏览器清理。')
  }

  async function handleDeleteAttachment(item, attachment) {
    await deleteAttachment(attachment).catch(() => null)
    setEvidenceItems((items) =>
      (Array.isArray(items) ? items : []).map((evidence) =>
        evidence.id === item.id
          ? { ...evidence, attachments: (evidence.attachments || []).filter((current) => current.id !== attachment.id) }
          : evidence,
      ),
    )
    setAttachmentMessage('附件已删除。')
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-wheat/50 bg-white/55 p-5 shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-sage">Evidence Library</p>
            <h2 className="mt-1 text-xl font-semibold text-ink">成果证据库</h2>
            <p className="mt-2 text-sm leading-6 text-ink/62">保存可被论文、简历或作品集复用的学习证据。</p>
          </div>
          <button type="button" onClick={() => setShowForm(true)} className="inline-flex w-fit items-center gap-2 rounded-lg bg-sage px-4 py-2.5 text-sm font-medium text-paper">
            <Plus className="h-4 w-4" />
            新增证据
          </button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <SelectFilter label="范围" value={rangeFilter} options={['今日成果', '本周成果', '全部成果']} onChange={setRangeFilter} />
          <DateFilter label="日期" value={dateFilter} onChange={setDateFilter} />
          <SelectFilter label="类型" value={typeFilter} options={typeOptions} onChange={setTypeFilter} />
          <SelectFilter label="用途" value={useFilter} options={['全部用途', '论文', '简历', '作品集']} onChange={setUseFilter} />
        </div>
      </section>

      {attachmentMessage && <p className="rounded-lg border border-wheat/60 bg-linen/70 px-4 py-3 text-sm text-ink/70">{attachmentMessage}</p>}

      {showForm && <EvidenceForm draft={draft} setDraft={setDraft} tasks={tasks} isEditing={editingId !== null} onSubmit={handleSubmit} onCancel={resetForm} />}

      <section className="grid gap-4 xl:grid-cols-2">
        {filteredItems.map((item) => (
          <article key={item.id} className="rounded-lg border border-wheat/50 bg-white/55 p-5 shadow-soft">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-sage">{item.date} · {item.type || '未分类'}</p>
                <h3 className="mt-2 text-lg font-semibold leading-7 text-ink">{item.content}</h3>
              </div>
              <div className="flex gap-2">
                <IconButton label="编辑" icon={Pencil} onClick={() => handleEdit(item)} />
                <IconButton label="删除" icon={Trash2} danger onClick={() => handleDeleteEvidence(item)} />
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Info label="relatedProject" value={item.relatedProject} />
              <Info label="relatedTaskId" value={item.relatedTaskId} />
              <Info label="note" value={item.note} />
              <div className="rounded-lg bg-linen/50 p-3">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-sage">usableFor</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {item.usableForPaper && <Badge>论文</Badge>}
                  {item.usableForResume && <Badge>简历</Badge>}
                  {item.usableForPortfolio && <Badge>作品集</Badge>}
                  {!item.usableForPaper && !item.usableForResume && !item.usableForPortfolio && <span className="text-sm text-ink/55">未标记</span>}
                </div>
              </div>
            </div>
            <AttachmentList
              attachments={item.attachments}
              onPreview={handlePreviewAttachment}
              onDownload={handleDownloadAttachment}
              onDelete={(attachment) => handleDeleteAttachment(item, attachment)}
            />
          </article>
        ))}
      </section>

      {previewState && (
        <AttachmentPreviewModal
          previewState={previewState}
          onClose={() => {
            if (previewState.url) URL.revokeObjectURL(previewState.url)
            setPreviewState(null)
          }}
        />
      )}
    </div>
  )
}

function EvidenceForm({ draft, setDraft, tasks, isEditing, onSubmit, onCancel }) {
  const [uploadMessage, setUploadMessage] = useState('')
  const [formPreviewState, setFormPreviewState] = useState(null)

  async function handleUploadFiles(event) {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (files.length === 0) return

    const evidenceId = draft.id || createRecordId('evidence')
    try {
      const attachments = await Promise.all(files.map((file) => saveAttachment(file, evidenceId)))
      setDraft({
        ...draft,
        id: evidenceId,
        attachments: [...(Array.isArray(draft.attachments) ? draft.attachments : []), ...attachments],
      })
      setUploadMessage(`${attachments.length} 个附件已上传。`)
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : '附件上传失败。')
    }
  }

  async function handlePreviewAttachment(attachment) {
    if (!isPreviewable(attachment)) {
      setFormPreviewState({ attachment, kind: 'unsupported' })
      return
    }

    const blob = await getAttachmentBlob(attachment)
    if (!blob) {
      setFormPreviewState({ attachment, missing: true })
      return
    }

    const url = await getAttachmentPreviewUrl(attachment)
    if (attachment.type?.startsWith('text/') || /\.(txt|md|csv)$/i.test(attachment.name || '')) {
      setFormPreviewState({ attachment, kind: 'text', text: await blob.text(), url })
      return
    }

    setFormPreviewState({ attachment, kind: attachment.type === 'application/pdf' ? 'pdf' : 'image', url })
  }

  async function handleDeleteDraftAttachment(attachment) {
    await deleteAttachment(attachment).catch(() => null)
    setDraft({
      ...draft,
      attachments: (Array.isArray(draft.attachments) ? draft.attachments : []).filter((current) => current.id !== attachment.id),
    })
    setUploadMessage('附件已删除。')
  }

  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-wheat/50 bg-white/55 p-5 shadow-soft">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold text-ink">{isEditing ? '编辑证据' : '新增证据'}</h3>
        <button type="button" onClick={onCancel} className="inline-flex items-center gap-2 rounded-lg border border-wheat/60 px-3 py-2 text-sm text-ink/70">
          <X className="h-4 w-4" />
          取消
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <TextField label="date" type="date" value={draft.date} onChange={(value) => setDraft({ ...draft, date: value })} required />
        <TextField label="createdAt" type="date" value={draft.createdAt} onChange={(value) => setDraft({ ...draft, createdAt: value })} />
        <TextField label="type" value={draft.type} onChange={(value) => setDraft({ ...draft, type: value })} />
        <TextField label="relatedProject" value={draft.relatedProject} onChange={(value) => setDraft({ ...draft, relatedProject: value })} />
        <label className="block">
          <span className="text-sm font-medium text-ink/75">relatedTaskId</span>
          <select value={draft.relatedTaskId} onChange={(event) => setDraft({ ...draft, relatedTaskId: event.target.value })} className="mt-2 w-full rounded-lg border border-wheat/60 bg-paper px-4 py-3 text-sm text-ink">
            <option value="">未关联</option>
            {tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
          </select>
        </label>
        <TextareaField label="content" value={draft.content} onChange={(value) => setDraft({ ...draft, content: value })} />
        <TextareaField label="note" value={draft.note} onChange={(value) => setDraft({ ...draft, note: value })} />
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <Checkbox label="usableForPaper" checked={draft.usableForPaper} onChange={(checked) => setDraft({ ...draft, usableForPaper: checked })} />
        <Checkbox label="usableForResume" checked={draft.usableForResume} onChange={(checked) => setDraft({ ...draft, usableForResume: checked })} />
        <Checkbox label="usableForPortfolio" checked={draft.usableForPortfolio} onChange={(checked) => setDraft({ ...draft, usableForPortfolio: checked })} />
      </div>
      <div className="mt-5 rounded-lg border border-wheat/50 bg-linen/40 p-4">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-sage px-4 py-2.5 text-sm font-medium text-paper">
          <Upload className="h-4 w-4" />
          上传附件
          <input type="file" multiple onChange={handleUploadFiles} className="hidden" />
        </label>
        {uploadMessage && <p className="mt-3 text-sm text-ink/65">{uploadMessage}</p>}
        <AttachmentList
          attachments={draft.attachments || []}
          onPreview={handlePreviewAttachment}
          onDownload={downloadAttachment}
          onDelete={handleDeleteDraftAttachment}
        />
      </div>
      <button type="submit" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-sage px-4 py-2.5 text-sm font-medium text-paper">
        <Check className="h-4 w-4" />
        {isEditing ? '保存证据' : '创建证据'}
      </button>
      {formPreviewState && (
        <AttachmentPreviewModal
          previewState={formPreviewState}
          onClose={() => {
            if (formPreviewState.url) URL.revokeObjectURL(formPreviewState.url)
            setFormPreviewState(null)
          }}
        />
      )}
    </form>
  )
}

function normalizeEvidence(item, fallbackDate = localToday()) {
  const date = getRecordDate(item, fallbackDate)
  return {
    id: item.id,
    date,
    createdAt: item.createdAt ?? date,
    type: item.type ?? '',
    content: item.content ?? item.title ?? item.proof ?? '',
    relatedProject: item.relatedProject ?? '',
    relatedTaskId: item.relatedTaskId ?? '',
    usableForPaper: Boolean(item.usableForPaper),
    usableForResume: Boolean(item.usableForResume),
    usableForPortfolio: Boolean(item.usableForPortfolio),
    note: item.note ?? '',
    attachments: Array.isArray(item.attachments) ? item.attachments.map(normalizeAttachment) : [],
  }
}

function normalizeAttachment(attachment) {
  return {
    id: attachment.id,
    evidenceId: attachment.evidenceId ?? '',
    name: attachment.name ?? 'attachment',
    type: attachment.type ?? '',
    size: Number(attachment.size ?? 0),
    createdAt: attachment.createdAt ?? '',
    storageProvider: attachment.storageProvider ?? 'indexeddb',
    storageKey: attachment.storageKey ?? '',
    url: null,
  }
}

function AttachmentList({ attachments = [], onPreview, onDownload, onDelete, compact = false }) {
  const safeAttachments = Array.isArray(attachments) ? attachments : []
  if (safeAttachments.length === 0) {
    return <p className="mt-3 text-sm text-ink/55">暂无附件。</p>
  }

  return (
    <div className="mt-4 space-y-2">
      {safeAttachments.map((attachment) => (
        <div key={attachment.id} className="rounded-lg border border-wheat/50 bg-paper p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-ink">{attachment.name}</p>
              <p className="mt-1 text-xs text-ink/55">
                {attachment.type || 'unknown'} · {formatAttachmentSize(attachment.size)} · {formatAttachmentDate(attachment.createdAt)}
              </p>
            </div>
            {!compact && (
              <div className="flex flex-wrap gap-2">
                <IconButton label="预览" icon={Eye} onClick={() => onPreview?.(attachment)} />
                <IconButton label="下载" icon={Download} onClick={() => onDownload?.(attachment)} />
                <IconButton label="删除" icon={Trash2} danger onClick={() => onDelete?.(attachment)} />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function AttachmentPreviewModal({ previewState, onClose }) {
  const { attachment } = previewState

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 px-4 py-6">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg border border-wheat/60 bg-paper p-5 shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-ink">{attachment.name}</h3>
            <p className="mt-1 text-sm text-ink/55">{attachment.type || 'unknown'} · {formatAttachmentSize(attachment.size)}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-wheat/60 px-3 py-2 text-sm text-ink/70">
            关闭
          </button>
        </div>

        <div className="mt-5 rounded-lg bg-linen/50 p-4">
          {previewState.missing && <p className="text-sm text-clay">附件文件未找到，可能已被浏览器清理。</p>}
          {previewState.kind === 'unsupported' && <p className="text-sm text-ink/70">该文件类型暂不支持页面内预览，请使用下载按钮查看。</p>}
          {previewState.kind === 'image' && <img src={previewState.url} alt={attachment.name} className="max-h-[70vh] w-full object-contain" />}
          {previewState.kind === 'pdf' && <iframe src={previewState.url} title={attachment.name} className="h-[70vh] w-full rounded-lg border border-wheat/50" />}
          {previewState.kind === 'text' && <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap text-sm leading-6 text-ink/75">{previewState.text}</pre>}
        </div>
      </div>
    </div>
  )
}

function formatAttachmentDate(value) {
  if (!value) return '未知时间'
  return String(value).slice(0, 10)
}

function TextField({ label, value, onChange, type = 'text', required = false }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink/75">{label}</span>
      <input type={type} value={value} required={required} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-lg border border-wheat/60 bg-paper px-4 py-3 text-sm text-ink" />
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

function Checkbox({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-3 rounded-lg border border-wheat/50 bg-linen/50 px-4 py-3 text-sm font-medium text-ink/75">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-sage" />
      {label}
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

function Info({ label, value }) {
  return (
    <div className="rounded-lg bg-linen/50 p-3">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-sage">{label}</p>
      <p className="mt-2 text-sm leading-6 text-ink/72">{value || '未填写'}</p>
    </div>
  )
}

function Badge({ children }) {
  return <span className="rounded-lg bg-linen px-3 py-1 text-xs text-ink/70">{children}</span>
}

function IconButton({ label, icon: Icon, onClick, danger = false }) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex items-center gap-2 rounded-lg bg-linen px-3 py-2 text-xs font-medium ${danger ? 'text-clay' : 'text-ink/70'}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}
