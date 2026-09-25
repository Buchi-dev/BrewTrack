import { supabase } from '../lib/supabaseClient.js'

const ATTENDANCE_SELFIES_BUCKET = 'attendance-selfies'
const ATTENDANCE_PHOTO_EVENTS = {
  clockIn: 'clock-in',
  clockOut: 'clock-out',
}
const SIGNED_SELFIE_URL_TTL_SECONDS = 60 * 5

function isNetworkFailure(error) {
  return (
    error?.name === 'TypeError'
    || /failed to fetch|network|fetch/i.test(error?.message ?? '')
  )
}

export function getAttendanceErrorMessage(error, fallback = 'Unable to complete the attendance request.') {
  const message = error?.message ?? ''

  if (isNetworkFailure(error)) {
    return 'Network connection was interrupted. Please check your connection and try again.'
  }

  if (/duplicate key|already clocked in|attendance already exists/i.test(message)) {
    return 'You already have an attendance record for today. Refresh your status before trying again.'
  }

  if (/no active attendance|clock.?out.*clock.?in|clock in first/i.test(message)) {
    return 'No active clock-in record was found. Refresh your status before clocking out.'
  }

  if (/branch|assigned/i.test(message)) {
    return 'Your account does not have an active branch assignment. Please contact a manager.'
  }

  if (/permission|policy|row-level security|rls|forbidden|not authorized/i.test(message)) {
    return 'Your account does not have permission to perform this attendance action.'
  }

  if (/storage|bucket|object|upload/i.test(message)) {
    return 'The attendance time was processed, but the selfie could not be stored. Please keep this page open and try again.'
  }

  return message || fallback
}

function assertUuid(value, label) {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  if (!uuidPattern.test(value ?? '')) {
    throw new Error(`${label} is required to store attendance evidence.`)
  }
}

function getManilaDateParts(value = new Date()) {
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value instanceof Date ? value : new Date(value))

  const [year, month, day] = formatted.split('-')
  return { year, month, day }
}

function normalizeAttendancePhotoEvent(eventType) {
  const normalized = ATTENDANCE_PHOTO_EVENTS[eventType] ?? eventType

  if (!Object.values(ATTENDANCE_PHOTO_EVENTS).includes(normalized)) {
    throw new Error('Attendance evidence must be for clock-in or clock-out.')
  }

  return normalized
}

function normalizeAttendanceRpcEvent(eventType) {
  return normalizeAttendancePhotoEvent(eventType).replace('-', '_')
}

export function buildAttendanceSelfiePath({
  employeeId,
  attendanceId,
  attendanceDate = new Date(),
  eventType,
} = {}) {
  assertUuid(employeeId, 'Employee ID')
  assertUuid(attendanceId, 'Attendance ID')

  const { year, month, day } = getManilaDateParts(attendanceDate)
  const normalizedEventType = normalizeAttendancePhotoEvent(eventType)

  return `attendance/${employeeId}/${year}/${month}/${day}/${attendanceId}/${normalizedEventType}.jpg`
}

export async function uploadAttendanceSelfie({
  employeeId,
  attendanceId,
  attendanceDate = new Date(),
  eventType,
  photoBlob,
} = {}) {
  if (!supabase) return null

  if (!(photoBlob instanceof Blob)) {
    throw new Error('A captured selfie is required before uploading attendance evidence.')
  }

  const path = buildAttendanceSelfiePath({
    employeeId,
    attendanceId,
    attendanceDate,
    eventType,
  })

  const { data, error } = await supabase.storage
    .from(ATTENDANCE_SELFIES_BUCKET)
    .upload(path, photoBlob, {
      contentType: 'image/jpeg',
      upsert: false,
    })

  if (error) {
    const isAlreadyUploaded =
      error.statusCode === 409
      || error.status === 409
      || /already exists|duplicate/i.test(error.message ?? '')

    if (!isAlreadyUploaded) throw error
  }

  return data?.path ?? path
}

export async function attachAttendanceSelfiePath({ attendanceId, eventType, photoPath } = {}) {
  if (!supabase) return null

  assertUuid(attendanceId, 'Attendance ID')

  const { data, error } = await supabase.rpc('attach_attendance_selfie', {
    p_attendance_id: attendanceId,
    p_event_type: normalizeAttendanceRpcEvent(eventType),
    p_photo_path: photoPath,
  })

  if (error) throw error
  return data
}

export async function storeAttendanceSelfie({
  employeeId,
  attendanceId,
  attendanceDate = new Date(),
  eventType,
  photoBlob,
} = {}) {
  const photoPath = await uploadAttendanceSelfie({
    employeeId,
    attendanceId,
    attendanceDate,
    eventType,
    photoBlob,
  })

  const attendance = await attachAttendanceSelfiePath({
    attendanceId,
    eventType,
    photoPath,
  })

  return {
    attendance,
    photoPath,
  }
}

export async function getAttendanceSelfieSignedUrl(
  photoPath,
  expiresIn = SIGNED_SELFIE_URL_TTL_SECONDS,
) {
  if (!supabase || !photoPath) return null

  const { data, error } = await supabase.storage
    .from(ATTENDANCE_SELFIES_BUCKET)
    .createSignedUrl(photoPath, expiresIn)

  if (error) throw error
  return data?.signedUrl ?? null
}

export async function getAttendanceSelfieSignedUrls(
  photoPaths,
  expiresIn = SIGNED_SELFIE_URL_TTL_SECONDS,
) {
  if (!supabase || !Array.isArray(photoPaths) || photoPaths.length === 0) return []

  const cleanPaths = photoPaths.filter(Boolean)
  if (cleanPaths.length === 0) return []

  const { data, error } = await supabase.storage
    .from(ATTENDANCE_SELFIES_BUCKET)
    .createSignedUrls(cleanPaths, expiresIn)

  if (error) throw error
  return data ?? []
}

export async function getTodayAttendance() {
  if (!supabase) return null

  const { data, error } = await supabase.rpc('get_today_attendance')

  if (error) throw error
  return data
}

export async function getStaffAttendanceHistory({ page = 1, pageSize = 10 } = {}) {
  if (!supabase) return { records: [], total: 0 }

  const safePage = Math.max(Number(page) || 1, 1)
  const safePageSize = Math.min(Math.max(Number(pageSize) || 10, 1), 50)
  const from = (safePage - 1) * safePageSize
  const to = from + safePageSize - 1

  const { data, error, count } = await supabase
    .from('attendance_records')
    .select(
      `
        id,
        attendance_date,
        clock_in_at,
        clock_out_at,
        scheduled_start,
        scheduled_end,
        late_minutes,
        worked_minutes,
        status,
        branches (
          name,
          code
        )
      `,
      { count: 'exact' },
    )
    .order('attendance_date', { ascending: false })
    .order('clock_in_at', { ascending: false, nullsFirst: false })
    .range(from, to)

  if (error) throw error

  return {
    records: data ?? [],
    total: count ?? 0,
  }
}

export async function clockIn({ photoPath = null, latitude = null, longitude = null } = {}) {
  if (!supabase) return null

  const { data, error } = await supabase.rpc('clock_in', {
    p_clock_in_photo_path: photoPath,
    p_clock_in_latitude: latitude,
    p_clock_in_longitude: longitude,
  })

  if (error) throw error
  return data
}

export async function clockOut({ photoPath = null, latitude = null, longitude = null } = {}) {
  if (!supabase) return null

  const { data, error } = await supabase.rpc('clock_out', {
    p_clock_out_photo_path: photoPath,
    p_clock_out_latitude: latitude,
    p_clock_out_longitude: longitude,
  })

  if (error) throw error
  return data
}
