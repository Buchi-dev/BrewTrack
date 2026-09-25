import { supabase } from '../lib/supabaseClient.js'

const MANAGER_TODAY_LIMIT = 8
const ATTENDANCE_SELFIES_BUCKET = 'attendance-selfies'
const ATTENDANCE_PHOTO_EVENTS = {
  clockIn: 'clock-in',
  clockOut: 'clock-out',
}
const SIGNED_SELFIE_URL_TTL_SECONDS = 60 * 5

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

  if (error) throw error
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

export async function getManagerTodayAttendance(limit = MANAGER_TODAY_LIMIT) {
  if (!supabase) return []

  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())

  const { data, error } = await supabase
    .from('attendance_records')
    .select(
      `
        id,
        attendance_date,
        clock_in_at,
        clock_out_at,
        status,
        late_minutes,
        profiles (
          first_name,
          middle_name,
          last_name,
          employee_number
        ),
        branches (
          name,
          code
        )
      `,
    )
    .eq('attendance_date', today)
    .order('clock_in_at', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) throw error
  return data ?? []
}

export async function getManagerDashboardSummary() {
  if (!supabase) return null

  const { data, error } = await supabase.rpc('get_manager_dashboard_summary')

  if (error) throw error
  return data
}
