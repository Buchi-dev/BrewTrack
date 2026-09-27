import {
  clockIn,
  clockOut,
  storeAttendanceSelfie,
} from './attendanceService.js'
import {
  OFFLINE_ATTENDANCE_STATUSES,
  getOfflineAttendanceRecords,
  removeOfflineAttendanceRecord,
  updateOfflineAttendanceRecord,
} from './offlineAttendanceService.js'

function getAttendanceId(result) {
  if (!result) return null
  if (typeof result === 'string') return result
  if (Array.isArray(result)) return getAttendanceId(result[0])
  return result.id ?? result.attendance_id ?? getAttendanceId(result.attendance)
}

function getAttendanceDate(result) {
  if (!result) return new Date()
  if (Array.isArray(result)) return getAttendanceDate(result[0])
  return result.attendance_date ?? result.clock_in_at ?? result.clock_out_at ?? getAttendanceDate(result.attendance)
}

async function createAttendance(record) {
  if (record.attendanceId) {
    return {
      attendanceId: record.attendanceId,
      attendanceDate: record.attendanceDate ?? record.capturedAt,
    }
  }

  const payload = {
    clientEventId: record.id,
    capturedAt: record.capturedAt,
    wasOffline: true,
  }

  const created = record.action === 'clockIn'
    ? await clockIn(payload)
    : await clockOut(payload)

  return {
    attendanceId: getAttendanceId(created),
    attendanceDate: getAttendanceDate(created),
  }
}

export async function syncOfflineAttendance({ userId = null } = {}) {
  if (!navigator.onLine) return { synced: 0, failed: 0, pending: 0 }

  const records = await getOfflineAttendanceRecords({ userId })
  let synced = 0
  let failed = 0

  for (const record of records) {
    if (record.status === OFFLINE_ATTENDANCE_STATUSES.uploading) continue

    await updateOfflineAttendanceRecord(record.id, {
      status: OFFLINE_ATTENDANCE_STATUSES.uploading,
      attempts: (record.attempts ?? 0) + 1,
      lastAttemptAt: new Date().toISOString(),
      lastError: null,
    })

    try {
      const { attendanceId, attendanceDate } = await createAttendance(record)

      if (!attendanceId) {
        throw new Error('Attendance was created, but the record ID was not returned.')
      }

      await updateOfflineAttendanceRecord(record.id, { attendanceId, attendanceDate })

      await storeAttendanceSelfie({
        employeeId: record.userId,
        attendanceId,
        attendanceDate,
        eventType: record.action,
        photoBlob: record.photoBlob,
      })

      await removeOfflineAttendanceRecord(record.id)
      synced += 1
    } catch (error) {
      await updateOfflineAttendanceRecord(record.id, {
        status: OFFLINE_ATTENDANCE_STATUSES.failed,
        lastError: error?.message ?? 'Unable to synchronize attendance.',
      })
      failed += 1
    }
  }

  const pending = await getOfflineAttendanceRecords({ userId })
  return { synced, failed, pending: pending.length }
}
