import { useEffect, useMemo, useState } from 'react'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { createRecordId } from '../utils/records'

export function CrudPanel({ title, description, prefix, fields, items, onSave, onDelete, renderItem }) {
  const emptyDraft = useMemo(
    () =>
      fields.reduce((draft, field) => {
        draft[field.name] = field.defaultValue ?? ''
        return draft
      }, {}),
    [fields],
  )
  const [draft, setDraft] = useState(emptyDraft)
  const [editingId, setEditingId] = useState(null)

  useEffect(() => {
    setDraft(emptyDraft)
  }, [emptyDraft])

  const isEditing = editingId !== null

  function resetForm() {
    setDraft(emptyDraft)
    setEditingId(null)
  }

  function handleEdit(item) {
    const nextDraft = fields.reduce((currentDraft, field) => {
      const value = item[field.name]
      currentDraft[field.name] = Array.isArray(value) ? value.join('，') : value ?? ''
      return currentDraft
    }, {})
    setDraft(nextDraft)
    setEditingId(item.id)
  }

  function normalizeDraft() {
    return fields.reduce((record, field) => {
      const rawValue = draft[field.name]
      if (field.type === 'array') {
        record[field.name] = String(rawValue)
          .split(/[，,]/)
          .map((value) => value.trim())
          .filter(Boolean)
      } else if (field.type === 'number') {
        record[field.name] = Number(rawValue)
      } else {
        record[field.name] = rawValue
      }
      return record
    }, {})
  }

  function handleSubmit(event) {
    event.preventDefault()
    onSave({
      id: editingId ?? createRecordId(prefix),
      ...normalizeDraft(),
    })
    resetForm()
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
      <section className="rounded-lg border border-wheat/50 bg-white/55 p-5 shadow-soft">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-ink">{isEditing ? `编辑${title}` : `新增${title}`}</h2>
          <p className="mt-2 text-sm leading-6 text-ink/62">{description}</p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {fields.map((field) => (
            <label key={field.name} className="block">
              <span className="text-sm font-medium text-ink/75">{field.label}</span>
              {field.kind === 'textarea' ? (
                <textarea
                  rows="4"
                  value={draft[field.name]}
                  onChange={(event) => setDraft({ ...draft, [field.name]: event.target.value })}
                  className="mt-2 w-full resize-none rounded-lg border border-wheat/60 bg-paper px-4 py-3 text-sm leading-6 text-ink"
                  required={field.required}
                />
              ) : (
                <input
                  type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                  min={field.min}
                  max={field.max}
                  value={draft[field.name]}
                  onChange={(event) => setDraft({ ...draft, [field.name]: event.target.value })}
                  className="mt-2 w-full rounded-lg border border-wheat/60 bg-paper px-4 py-3 text-sm text-ink"
                  required={field.required}
                />
              )}
            </label>
          ))}
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-sage px-4 py-2.5 text-sm font-medium text-paper"
            >
              {isEditing ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {isEditing ? '保存修改' : '新增记录'}
            </button>
            {isEditing && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-2 rounded-lg border border-wheat/60 px-4 py-2.5 text-sm font-medium text-ink/70"
              >
                <X className="h-4 w-4" />
                取消
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-wheat/50 bg-white/55 p-5 shadow-soft">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">{title}</h2>
            <p className="mt-1 text-sm text-ink/60">{items.length} 条记录，自动保存到 localStorage</p>
          </div>
        </div>
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border border-wheat/50 bg-paper p-4">
              {renderItem(item)}
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => handleEdit(item)}
                  className="inline-flex items-center gap-2 rounded-lg bg-linen px-3 py-2 text-xs font-medium text-ink/70"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  编辑
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(item.id)}
                  className="inline-flex items-center gap-2 rounded-lg bg-linen px-3 py-2 text-xs font-medium text-clay"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
