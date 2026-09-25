import { dateKey } from './attendance'
import { WORK_ROLES, roleShiftStart } from './schedule'
export function makeDemo() {
  const stations = [
    { id: 'b1', name: 'Station 1 · High Street', address: 'Bonifacio High Street, Taguig', shift_start: '09:00', shift_end: '18:00', active: true },
    { id: 'b2', name: 'Station 2 · Legazpi', address: 'Legazpi Village, Makati', shift_start: '09:00', shift_end: '18:00', active: true },
    { id: 'b3', name: 'Station 3 · Tomas Morato', address: 'Tomas Morato Avenue, Quezon City', shift_start: '09:00', shift_end: '18:00', active: true },
    { id: 'b4', name: 'Station 4 · Kapitolyo', address: 'East Capitol Drive, Pasig', shift_start: '09:00', shift_end: '18:00', active: true },
  ]
  const names = ['Isabella Reyes', 'Gabriel Santos', 'Sofia Mendoza', 'Miguel Dela Cruz', 'Olivia Garcia', 'Ethan Villanueva', 'Amelia Torres', 'Lucas Ramos', 'Mia Bautista', 'Noah Fernandez', 'Chloe Navarro', 'Liam Castillo', 'Ava Lim', 'Elijah Tan', 'Emma Cruz', 'James Aquino', 'Charlotte Go', 'Benjamin Lopez', 'Harper Sy', 'Henry Flores', 'Evelyn Diaz', 'Daniel Ong', 'Abigail Chua', 'Matthew Lee']
  const employees = names.slice(0, 16).map((name, i) => ({ id: `e${i + 1}`, name, code: `BT-${String(i + 1).padStart(3, '0')}`, station_id: stations[i % 4].id, position: 'Team member', email: name.toLowerCase().split(' ')[0] + '@example.com', active: true, created_at: '2026-01-01' }))
  const assignments = []
  for (let offset = -6; offset <= 1; offset++) {
    const date = new Date(); date.setDate(date.getDate() + offset)
    const day = dateKey(date)
    employees.forEach((employee, i) => {
      const station = stations[((i % 4) + offset + 8) % 4]
      const workRole = WORK_ROLES[(Math.floor(i / 4) + offset + 8) % 4]
      assignments.push({ id: day + '-' + employee.id, employee_id: employee.id, employee_name: employee.name, station_id: station.id, station_name: station.name, work_date: day, work_role: workRole, shift_start: roleShiftStart(workRole, station.shift_start), shift_end: station.shift_end })
    })
  }
  const records = []
  for (let offset = 6; offset >= 0; offset--) {
    const date = new Date(); date.setDate(date.getDate() - offset)
    const day = dateKey(date)
    employees.forEach((e, i) => {
      if (i >= (offset === 0 ? 21 : 23)) return
      const assignment = assignments.find(a => a.employee_id === e.id && a.work_date === day)
      const late = i % 7 === 3 || assignment.work_role === 'Cook'
      records.push({ id: `${offset}-${i}-in`, employee_id: e.id, employee_name: e.name, station_id: assignment.station_id, station_name: assignment.station_name, work_role: assignment.work_role, transaction_type: 'clock-in', official_timestamp: `${day}T${late ? '09:12' : `08:${String(32 + i).padStart(2, '0')}`}:00+08:00`, attendance_date: day, status: late ? 'late' : 'on-time', photo_path: null, review_status: i % 5 === 0 ? 'pending' : 'verified' })
      if ((offset > 0 && i !== 8) || (offset === 0 && i < 5)) records.push({ id: `${offset}-${i}-out`, employee_id: e.id, employee_name: e.name, station_id: assignment.station_id, station_name: assignment.station_name, work_role: assignment.work_role, transaction_type: 'clock-out', official_timestamp: `${day}T18:0${i % 9}:00+08:00`, attendance_date: day, status: 'completed', photo_path: null, review_status: 'verified' })
    })
  }
  return { stations, employees, assignments, records: records.reverse(), profile: { id: 'demo-admin', name: 'Alex Morgan', role: 'admin' } }
}
