import test from 'node:test'
import assert from 'node:assert/strict'
import { dailyRows } from '../src/lib/attendance.js'
import { assignmentLocked, validateAssignment } from '../src/lib/schedule.js'

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
