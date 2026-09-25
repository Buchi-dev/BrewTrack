import test from 'node:test'
import assert from 'node:assert/strict'
import { dailyRows } from '../src/lib/attendance.js'
import { assignmentLocked, validateAssignment, monthDays, addDays, weekStart, copyAssignments, validateBatch, roleShiftStart } from '../src/lib/schedule.js'

const employee = { id: 'e1', name: 'Staff member', station_id: 's1', active: true }
const assignments = [
  { id: 'a1', employee_id: 'e1', work_date: '2026-09-25', station_id: 's1', station_name: 'Station 1', work_role: 'Cook', employee_name: 'Staff member' },
  { id: 'a2', employee_id: 'e1', work_date: '2026-09-26', station_id: 's2', station_name: 'Station 2', work_role: 'Barista', employee_name: 'Staff member' },
]
test('daily attendance follows that date’s station and role', () => {
  const today = dailyRows([employee], [], '2026-09-25', [], assignments)[0]
  const tomorrow = dailyRows([employee], [], '2026-09-26', [], assignments)[0]
  assert.equal(today.station_id, 's1'); assert.equal(today.work_role, 'Cook')
  assert.equal(tomorrow.station_id, 's2'); assert.equal(tomorrow.work_role, 'Barista')
})
test('unscheduled staff are not marked absent', () => {
  assert.deepEqual(dailyRows([employee], [], '2026-09-27', [], assignments), [])
})
test('historical attendance uses recorded identity and station', () => {
  const records = [{ employee_id: 'e1', employee_name: 'Original name', station_id: 's1', station_name: 'Original station', work_role: 'Cook', attendance_date: '2026-09-25', transaction_type: 'clock-in' }]
  const row = dailyRows([{ ...employee, name: 'New name', station_id: 's2' }], records, '2026-09-25', [], assignments)[0]
  assert.equal(row.name, 'Original name'); assert.equal(row.station_name, 'Original station'); assert.equal(row.work_role, 'Cook')
})
test('inactive staff with historical schedules remain in reports', () => {
  assert.equal(dailyRows([{ ...employee, active: false }], [], '2026-09-25', [], assignments).length, 1)
})
test('past dates and assignments with attendance are locked', () => {
  assert.equal(assignmentLocked(assignments[0], [], '2026-09-26'), true)
  assert.equal(assignmentLocked(assignments[1], [], '2026-09-25'), false)
  assert.equal(assignmentLocked(assignments[0], [{ employee_id: 'e1', attendance_date: '2026-09-25' }], '2026-09-25'), true)
})
test('validation rejects duplicate dates and invalid work roles', () => {
  assert.throws(() => validateAssignment(assignments[0], assignments, [], '2026-09-25'), /already has/)
  assert.throws(() => validateAssignment({ ...assignments[0], work_role: 'Manager' }, [], [], '2026-09-25'), /Choose/)
  assert.doesNotThrow(() => validateAssignment({ ...assignments[1], work_role: 'Trainee' }, assignments, [], '2026-09-25', 'a2'))
})
test('cook assignments start one hour before station opening', () => {
  assert.equal(roleShiftStart('Cook', '09:00'), '08:00')
  assert.equal(roleShiftStart('Cook', '09:00:00'), '08:00:00')
  assert.equal(roleShiftStart('Barista', '09:00'), '09:00')
  assert.equal(roleShiftStart('Cashier (OTD)', '09:00'), '09:00')
})

test('calendar uses actual month lengths, including leap years', () => {
  assert.equal(monthDays('2026-02').length, 28)
  assert.equal(monthDays('2028-02').length, 29)
  assert.equal(monthDays('2026-09').length, 30)
  assert.equal(monthDays('2026-12').length, 31)
  assert.deepEqual(monthDays('2026-13'), [])
  assert.equal(addDays('2026-12-31', 1), '2027-01-01')
  assert.equal(weekStart('2026-09-27'), '2026-09-21')
})
const batchData = { employees: [employee], stations: [{ id: 's1', active: true }, { id: 's2', active: true }], assignments, records: [] }
test('day copy preserves staff and role without copying identity or historical snapshots', () => {
  const copied = copyAssignments(assignments, 's1', '2026-09-25', ['2026-09-28', '2026-09-29'])
  assert.deepEqual(copied.map(a => a.work_date), ['2026-09-28', '2026-09-29'])
  assert.equal(copied[0].id, undefined)
  assert.equal(copied[0].work_role, 'Cook')
  assert.doesNotThrow(() => validateBatch(copied, batchData, '2026-09-25'))
})
test('week copy maps Monday offsets across month and year boundaries', () => {
  const copied = copyAssignments(assignments, 's1', '2026-09-27', ['2026-12-28'], true)
  assert.equal(copied[0].work_date, '2027-01-01')
  assert.equal(assignments[0].work_date, '2026-09-25')
})
test('bulk assignments reject cross-station conflicts, attendance, past dates and overlapping copies', () => {
  const value = { employee_id: 'e1', station_id: 's1', work_role: 'Cook', work_date: '2026-09-26' }
  assert.throws(() => validateBatch([value], batchData, '2026-09-25'), /already has/)
  const future = { ...value, work_date: '2026-09-28' }
  assert.throws(() => validateBatch([future, future], batchData, '2026-09-25'), /already has/)
  assert.throws(() => validateBatch([future], { ...batchData, records: [{ employee_id: 'e1', attendance_date: '2026-09-28' }] }, '2026-09-25'), /locked/)
  assert.throws(() => validateBatch([future], batchData, '2026-09-29'), /locked/)
  assert.throws(() => validateBatch([{ ...future, work_date: '2026-02-30' }], batchData, '2026-01-01'), /Choose/)
  assert.throws(() => validateBatch([future], { ...batchData, employees: [{ ...employee, active: false }] }, '2026-09-25'), /active/)
  assert.throws(() => validateBatch([], batchData, '2026-09-25'), /Choose/)
})
