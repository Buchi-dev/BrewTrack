const DB_NAME = 'brewtrack-attendance'
const DB_VERSION = 1
const STORE_NAME = 'offlineAttendance'
const SYNC_EVENT_NAME = 'brewtrack:attendance-sync-updated'

export const OFFLINE_ATTENDANCE_STATUSES = {
  pending: 'pending',
  uploading: 'uploading',
  synced: 'synced',
  failed: 'failed',
}

function getIndexedDb() {
  return globalThis.indexedDB ?? null
}

function emitSyncUpdate() {
  globalThis.dispatchEvent?.(new CustomEvent(SYNC_EVENT_NAME))
}

function openDatabase() {
  const indexedDb = getIndexedDb()

  if (!indexedDb) {
    return Promise.reject(new Error('Offline attendance storage is not available in this browser.'))
  }

  return new Promise((resolve, reject) => {
    const request = indexedDb.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      const store = db.objectStoreNames.contains(STORE_NAME)
        ? request.transaction.objectStore(STORE_NAME)
        : db.createObjectStore(STORE_NAME, { keyPath: 'id' })

      if (!store.indexNames.contains('status')) store.createIndex('status', 'status')
      if (!store.indexNames.contains('createdAt')) store.createIndex('createdAt', 'createdAt')
      if (!store.indexNames.contains('userId')) store.createIndex('userId', 'userId')
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function withStore(mode, callback) {
  const db = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode)
    const store = transaction.objectStore(STORE_NAME)
    const result = callback(store)

    transaction.oncomplete = () => {
      db.close()
      resolve(result)
    }
    transaction.onerror = () => {
      db.close()
      reject(transaction.error)
    }
    transaction.onabort = () => {
      db.close()
      reject(transaction.error)
    }
  })
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export function subscribeToAttendanceSyncUpdates(callback) {
  globalThis.addEventListener?.(SYNC_EVENT_NAME, callback)
  return () => globalThis.removeEventListener?.(SYNC_EVENT_NAME, callback)
}

export async function queueOfflineAttendance({
  id = crypto.randomUUID(),
  userId,
  action,
  photoBlob,
  capturedAt = new Date().toISOString(),
  attendanceId = null,
  attendanceDate = null,
} = {}) {
  if (!userId) throw new Error('User is required before saving offline attendance.')
  if (!['clockIn', 'clockOut'].includes(action)) throw new Error('Attendance action is required.')
  if (!(photoBlob instanceof Blob)) throw new Error('A captured selfie is required before saving offline attendance.')

  const now = new Date().toISOString()
  const record = {
    id,
    userId,
    action,
    photoBlob,
    capturedAt,
    attendanceId,
    attendanceDate,
    status: OFFLINE_ATTENDANCE_STATUSES.pending,
    attempts: 0,
    lastAttemptAt: null,
    lastError: null,
    createdAt: now,
    updatedAt: now,
  }

  await withStore('readwrite', (store) => store.put(record))
  emitSyncUpdate()
  return record
}

export async function getOfflineAttendanceRecords({ includeSynced = false, userId = null } = {}) {
  try {
    const records = await withStore('readonly', (store) => requestToPromise(store.getAll()))
    return records
      .filter((record) => includeSynced || record.status !== OFFLINE_ATTENDANCE_STATUSES.synced)
      .filter((record) => !userId || record.userId === userId)
      .sort((first, second) => new Date(first.createdAt) - new Date(second.createdAt))
  } catch (error) {
    console.warn('Unable to read offline attendance queue.', error)
    return []
  }
}

export async function updateOfflineAttendanceRecord(id, changes) {
  const updated = await withStore('readwrite', async (store) => {
    const existing = await requestToPromise(store.get(id))
    if (!existing) return null

    const next = {
      ...existing,
      ...changes,
      updatedAt: new Date().toISOString(),
    }

    store.put(next)
    return next
  })

  emitSyncUpdate()
  return updated
}

export async function removeOfflineAttendanceRecord(id) {
  await withStore('readwrite', (store) => store.delete(id))
  emitSyncUpdate()
}
