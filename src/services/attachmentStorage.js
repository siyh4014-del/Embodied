const dbName = 'growth-dashboard-attachments'
const dbVersion = 1
const storeName = 'attachmentBlobs'

// Attachment storage boundary.
// Future database/server migration should replace the internals of this file
// with backend API calls while keeping Evidence Library usage mostly unchanged.
export async function saveAttachment(file, evidenceId) {
  const id = `attachment-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const storageKey = `${evidenceId}:${id}`
  const db = await openAttachmentDb()
  await putBlob(db, storageKey, file)

  return {
    id,
    evidenceId,
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
    createdAt: new Date().toISOString(),
    storageProvider: 'indexeddb',
    storageKey,
    url: null,
  }
}

export async function getAttachmentBlob(attachment) {
  if (!attachment?.storageKey) return null
  const db = await openAttachmentDb()
  return getBlob(db, attachment.storageKey)
}

export async function getAttachmentPreviewUrl(attachment) {
  const blob = await getAttachmentBlob(attachment)
  if (!blob) return null
  return URL.createObjectURL(blob)
}

export async function deleteAttachment(attachment) {
  if (!attachment?.storageKey) return
  const db = await openAttachmentDb()
  await deleteBlob(db, attachment.storageKey)
}

export async function downloadAttachment(attachment) {
  const blob = await getAttachmentBlob(attachment)
  if (!blob) return false

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = attachment.name || 'attachment'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
  return true
}

export function isPreviewable(attachment) {
  const type = attachment?.type || ''
  const name = (attachment?.name || '').toLowerCase()
  return (
    type.startsWith('image/') ||
    type === 'application/pdf' ||
    type.startsWith('text/') ||
    name.endsWith('.md') ||
    name.endsWith('.csv') ||
    name.endsWith('.txt')
  )
}

export function formatAttachmentSize(size) {
  const bytes = Number(size || 0)
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function openAttachmentDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is not available in this browser.'))
      return
    }

    const request = window.indexedDB.open(dbName, dbVersion)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function putBlob(db, key, blob) {
  return runStoreRequest(db, 'readwrite', (store) => store.put(blob, key))
}

function getBlob(db, key) {
  return runStoreRequest(db, 'readonly', (store) => store.get(key))
}

function deleteBlob(db, key) {
  return runStoreRequest(db, 'readwrite', (store) => store.delete(key))
}

function runStoreRequest(db, mode, createRequest) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode)
    const store = transaction.objectStore(storeName)
    const request = createRequest(store)

    request.onsuccess = () => resolve(request.result ?? null)
    request.onerror = () => reject(request.error)
    transaction.oncomplete = () => db.close()
    transaction.onerror = () => {
      db.close()
      reject(transaction.error)
    }
  })
}
