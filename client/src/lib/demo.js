import { dateKey } from './attendance'
export function makeDemo() {
  const branches = [
    { id: 'b1', name: 'BGC · High Street', address: 'Bonifacio High Street, Taguig', shift_start: '09:00', shift_end: '18:00', active: true },
    { id: 'b2', name: 'Makati · Legazpi', address: 'Legazpi Village, Makati', shift_start: '09:00', shift_end: '18:00', active: true },
    { id: 'b3', name: 'Quezon City · Tomas Morato', address: 'Tomas Morato Avenue, Quezon City', shift_start: '09:00', shift_end: '18:00', active: true },
    { id: 'b4', name: 'Pasig · Kapitolyo', address: 'East Capitol Drive, Pasig', shift_start: '09:00', shift_end: '18:00', active: true },
  ]
  const names = ['Isabella Reyes', 'Gabriel Santos', 'Sofia Mendoza', 'Miguel Dela Cruz', 'Olivia Garcia', 'Ethan Villanueva', 'Amelia Torres', 'Lucas Ramos', 'Mia Bautista', 'Noah Fernandez', 'Chloe Navarro', 'Liam Castillo', 'Ava Lim', 'Elijah Tan', 'Emma Cruz', 'James Aquino', 'Charlotte Go', 'Benjamin Lopez', 'Harper Sy', 'Henry Flores', 'Evelyn Diaz', 'Daniel Ong', 'Abigail Chua', 'Matthew Lee']
  const employees = names.map((name, i) => ({ id: `e${i + 1}`, name, code: `BT-${String(i + 1).padStart(3, '0')}`, branch_id: branches[i % 4].id, position: i % 4 === 0 ? 'Shift supervisor' : i % 3 === 0 ? 'Store associate' : 'Barista', email: name.toLowerCase().split(' ')[0] + '@example.com', active: true, created_at: '2026-01-01' }))
  const records = []
  for (let offset = 6; offset >= 0; offset--) {
    const date = new Date(); date.setDate(date.getDate() - offset)
    const day = dateKey(date)
    employees.forEach((e, i) => {
      if (i >= (offset === 0 ? 21 : 23)) return
      const late = i % 7 === 3
      records.push({ id: `${offset}-${i}-in`, employee_id: e.id, employee_name: e.name, branch_id: e.branch_id, branch_name: branches[i % 4].name, transaction_type: 'clock-in', official_timestamp: `${day}T${late ? '09:12' : `08:${String(32 + i).padStart(2, '0')}`}:00+08:00`, attendance_date: day, status: late ? 'late' : 'on-time', photo_path: null, review_status: i % 5 === 0 ? 'pending' : 'verified' })
      if ((offset > 0 && i !== 8) || (offset === 0 && i < 5)) records.push({ id: `${offset}-${i}-out`, employee_id: e.id, employee_name: e.name, branch_id: e.branch_id, branch_name: branches[i % 4].name, transaction_type: 'clock-out', official_timestamp: `${day}T18:0${i % 9}:00+08:00`, attendance_date: day, status: 'completed', photo_path: null, review_status: 'verified' })
    })
  }
  return { branches, employees, records: records.reverse(), profile: { id: 'demo-admin', name: 'Alex Morgan', role: 'admin' } }
}
