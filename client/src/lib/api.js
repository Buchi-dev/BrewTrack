import { createClient } from './client'
const unwrap = ({ data, error }) => { if (error) throw error; return data }
async function allRows(table, order) {
  const result = []
  for (let offset = 0; ; offset += 1000) {
    const page = unwrap(await createClient().from(table).select('*').order(order).order('id').range(offset, offset + 999))
    result.push(...page)
    if (page.length < 1000) return result
  }
}
export async function loadWorkspace(user) {
  const db = createClient()
  const profile = unwrap(await db.from('profiles').select('*').eq('id', user.id).single())
  const [employees, stations, records, reviews, assignments] = await Promise.all([allRows('employees', 'name'), allRows('stations', 'name'), allRows('attendance_records', 'official_timestamp'), allRows('attendance_reviews', 'created_at'), allRows('daily_assignments', 'work_date')])
  return { profile, employees, stations, assignments, records: records.reverse().map(r => ({ ...r, reviews: reviews.filter(review => review.attendance_id === r.id).reverse() })) }
}
export async function removeAssignment(id) {
  return unwrap(await createClient().from('daily_assignments').delete().eq('id', id).select().single())
}
export async function saveAssignments(values) {
  return unwrap(await createClient().from('daily_assignments').insert(values).select())
}
export async function saveEntity(table, values, id) {
  const db = createClient()
  return unwrap(await (id ? db.from(table).update(values).eq('id', id) : db.from(table).insert(values)).select().single())
}
export async function startCapture(type) {
  return unwrap(await createClient().rpc('begin_attendance', { transaction: type }))
}
export async function submitCapture(challenge, blob) {
  const db = createClient()
  const path = `${challenge.employee_id}/${challenge.id}.jpg`
  const uploaded = await db.storage.from('attendance-selfies').upload(path, blob, { contentType: 'image/jpeg', upsert: false })
  if (uploaded.error && String(uploaded.error.statusCode) !== '409') throw uploaded.error
  const existing = unwrap(await db.from('attendance_records').select('*').eq('challenge_id', challenge.id).maybeSingle())
  if (existing) return existing
  return unwrap(await db.from('attendance_records').insert({ employee_id: challenge.employee_id, challenge_id: challenge.id, photo_path: path }).select().single())
}
export async function photoUrl(path) {
  return unwrap(await createClient().storage.from('attendance-selfies').createSignedUrl(path, 120)).signedUrl
}
export async function reviewRecord(record, verdict, note) {
  return unwrap(await createClient().from('attendance_reviews').insert({ attendance_id: record.id, verdict, note }).select().single())
}
