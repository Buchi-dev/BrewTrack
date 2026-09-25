export const WORK_ROLES = ['Cook', 'Barista', 'Cashier (OTD)', 'Trainee']
export const CORE_ROLES = WORK_ROLES.slice(0, 3)
const ROLE_START_OFFSETS = { Cook: -60 }

export function roleShiftStart(role, shiftStart) {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(shiftStart || '')
  if (!match) return shiftStart
  const minutes = (Number(match[1]) * 60 + Number(match[2]) + (ROLE_START_OFFSETS[role] || 0) + 1440) % 1440
  const text = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
  return match[3] == null ? text : `${text}:${match[3]}`
}

export function monthDays(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return []
  const [year, number] = month.split('-').map(Number)
  const count = new Date(Date.UTC(year, number, 0)).getUTCDate()
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)
}

export function addDays(date, count) {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + count)
  return value.toISOString().slice(0, 10)
}

export function weekStart(date) {
  return addDays(date, -(new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7)
}

export function copyAssignments(assignments, stationId, source, targets, week = false) {
  const start = week ? weekStart(source) : source
  const dates = Array.from({ length: week ? 7 : 1 }, (_, i) => addDays(start, i))
  return [...new Set(targets)].flatMap(target => assignments
    .filter(a => a.station_id === stationId && dates.includes(a.work_date))
    .map(a => ({ employee_id: a.employee_id, station_id: stationId, work_role: a.work_role, work_date: addDays(target, dates.indexOf(a.work_date)) })))
}

export function validateBatch(values, data, today) {
  if (!values.length) throw new Error('Choose dates and at least one assignment to save.')
  const pending = [...(data.assignments || [])]
  for (const value of values) {
    const employee = data.employees.find(e => e.id === value.employee_id && e.active)
    const station = data.stations.find(s => s.id === value.station_id && s.active)
    if (!employee || !station) throw new Error('Choose active staff and an active station.')
    try { validateAssignment(value, pending, data.records, today) }
    catch (error) { throw new Error(`${employee.name} · ${value.work_date}: ${error.message}`, { cause: error }) }
    pending.push(value)
  }
}

export function assignmentFor(assignments, employeeId, date) {
  return assignments.find(a => a.employee_id === employeeId && a.work_date === date)
}

export function assignmentLocked(assignment, records, today) {
  return assignment.work_date < today || records.some(r => r.employee_id === assignment.employee_id && r.attendance_date === assignment.work_date)
}

export function validateAssignment(values, assignments, records, today, id) {
  if (!monthDays(values.work_date?.slice(0, 7) || '').includes(values.work_date) || !values.employee_id || !values.station_id || !WORK_ROLES.includes(values.work_role)) throw new Error('Choose a date, employee, station, and work role.')
  if (assignmentLocked(values, records, today)) throw new Error('Past schedules and assignments with attendance are locked.')
  if (assignments.some(a => (!id || a.id !== id) && a.employee_id === values.employee_id && a.work_date === values.work_date)) throw new Error('This employee already has an assignment for this date. Edit that assignment instead.')
}
