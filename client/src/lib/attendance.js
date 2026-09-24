export const ZONE = 'Asia/Manila'
export const dateKey = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
export const timeLabel = (value) => value ? new Intl.DateTimeFormat('en-US', { timeZone: ZONE, hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—'
export const dayLabel = (value) => new Intl.DateTimeFormat('en-US', { timeZone: ZONE, month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T12:00:00+08:00`))
export const initials = (name = '') => name.split(' ').map(x => x[0]).slice(0, 2).join('')
export function dailyRows(employees, records, date, branches = []) {
  const roster = [...employees]
  for (const record of records.filter(r => r.attendance_date === date)) {
    if (!roster.some(e => e.id === record.employee_id)) roster.push({ id: record.employee_id, name: record.employee_name, branch_id: record.branch_id, code: 'Historical', position: 'Team member', active: false })
  }
  return roster.filter(e => (e.active && (!e.created_at || dateKey(new Date(e.created_at)) <= date)) || records.some(r => r.employee_id === e.id && r.attendance_date === date)).map(employee => {
    const entries = records.filter(r => r.employee_id === employee.id && r.attendance_date === date)
    const clockIn = entries.find(r => r.transaction_type === 'clock-in')
    const clockOut = entries.find(r => r.transaction_type === 'clock-out')
    const shiftEnd = branches.find(b => b.id === (clockIn?.branch_id || employee.branch_id))?.shift_end || '23:59:59'
    const currentTime = new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date())
    const ended = date < dateKey() || (date === dateKey() && currentTime > shiftEnd)
    const status = clockOut ? 'Completed' : clockIn ? (ended ? 'Missing clock-out' : clockIn.status === 'late' ? 'Late' : 'On time') : (ended ? 'Missing clock-in' : 'Not clocked in')
    return { ...employee, name: clockIn?.employee_name || employee.name, branch_id: clockIn?.branch_id || employee.branch_id, clockIn, clockOut, status, entries }
  })
}
export function csvText(rows) {
  const cell = value => {
    let text = String(value ?? '')
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`
    return `"${text.replaceAll('"', '""')}"`
  }
  return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n')
}
export function downloadCsv(rows, filename) {
  const url = URL.createObjectURL(new Blob([csvText(rows)], { type: 'text/csv;charset=utf-8;' }))
  const link = document.createElement('a')
  link.href = url; link.download = filename; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function filterRecords(records, { search = '', branch = '', start = '', end = '', status = '', type = '' }) {
  return records.filter(r => (!search || r.employee_name.toLowerCase().includes(search.toLowerCase())) && (!branch || r.branch_id === branch) && (!start || r.attendance_date >= start) && (!end || r.attendance_date <= end) && (!status || r.status === status) && (!type || r.transaction_type === type))
}
