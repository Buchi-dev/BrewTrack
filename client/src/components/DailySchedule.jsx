import { useState } from 'react'
import { CalendarDays, Plus, Check, LoaderCircle, ArrowDownToLine, ChevronLeft, ChevronRight, Copy, Search, LockKeyhole } from 'lucide-react'
import { Modal } from './CameraCapture'
import { saveEntity, saveAssignments, removeAssignment } from '../lib/api'
import { dateKey, dayLabel, downloadCsv } from '../lib/attendance'
import { WORK_ROLES, CORE_ROLES, assignmentLocked, validateAssignment, validateBatch, monthDays, addDays, weekStart, copyAssignments } from '../lib/schedule'
import './MonthlySchedule.css'

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const monthLabel = month => new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T12:00:00Z`))
const roleClass = role => `role-${WORK_ROLES.indexOf(role)}`
const employeeName = (data, a) => a.employee_name || data.employees.find(e => e.id === a.employee_id)?.name || 'Employee'
function Role({ role }) { return <span className={`schedule-role ${roleClass(role)}`}>{role}</span> }
function MonthControl({ month, onChange }) {
  const move = direction => onChange(addDays(direction < 0 ? `${month}-01` : monthDays(month).at(-1), direction).slice(0, 7))
  return <div className="month-control"><button type="button" className="icon-button" aria-label="Previous month" onClick={() => move(-1)}><ChevronLeft size={18}/></button><label><span className="sr-only">Schedule month</span><input type="month" required value={month} onChange={e => { if (monthDays(e.target.value).length) onChange(e.target.value) }}/></label><button type="button" className="icon-button" aria-label="Next month" onClick={() => move(1)}><ChevronRight size={18}/></button></div>
}
function DatePicker({ dates, onChange, initialMonth }) {
  const [month, setMonth] = useState(initialMonth)
  const days = monthDays(month)
  const offset = (new Date(`${days[0]}T12:00:00Z`).getUTCDay() + 6) % 7
  return <fieldset className="schedule-date-picker"><legend>Select dates</legend><MonthControl month={month} onChange={setMonth}/><div className="date-picker-grid">{weekdays.map(day => <span key={day}>{day}</span>)}{Array.from({ length: offset }, (_, i) => <span key={`blank-${i}`}/>)}{days.map(day => <button type="button" key={day} disabled={day < dateKey()} aria-label={dayLabel(day)} aria-pressed={dates.includes(day)} onClick={() => onChange(dates.includes(day) ? dates.filter(d => d !== day) : [...dates, day].sort())}>{Number(day.slice(-2))}</button>)}</div><p>{dates.length} date{dates.length !== 1 ? 's' : ''} selected</p><div className="selected-date-list">{dates.map(day => <button type="button" key={day} onClick={() => onChange(dates.filter(d => d !== day))} aria-label={`Remove ${day}`}>{day} ×</button>)}</div></fieldset>
}

export default function DailySchedule({ data, demo, onChange, notify, readOnly = false }) {
  const [date, setDate] = useState(dateKey)
  const [month, setMonth] = useState(() => dateKey().slice(0, 7))
  const [station, setStation] = useState(() => data.stations.find(s => s.active)?.id || data.stations[0]?.id || '')
  const [search, setSearch] = useState('')
  const [onlyAvailable, setOnlyAvailable] = useState(false)
  const [editing, setEditing] = useState(null)
  const [copyMode, setCopyMode] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const assignments = data.assignments || []
  const today = dateKey()
  const days = monthDays(month)
  const offset = (new Date(`${days[0]}T12:00:00Z`).getUTCDay() + 6) % 7
  const stationInfo = data.stations.find(s => s.id === station)
  const monthly = assignments.filter(a => a.station_id === station && a.work_date.startsWith(month))
  const daily = assignments.filter(a => a.work_date === date)
  const visible = daily.filter(a => a.station_id === station)
  const available = e => !daily.some(a => a.employee_id === e.id) && !data.records.some(r => r.employee_id === e.id && r.attendance_date === date)
  const staff = data.employees.filter(e => e.active && e.name.toLowerCase().includes(search.toLowerCase()) && (!onlyAvailable || available(e))).sort((a, b) => Number(available(b)) - Number(available(a)) || a.name.localeCompare(b.name))
  function changeMonth(value) { setMonth(value); setDate(value === today.slice(0, 7) ? today : `${value}-01`); setError('') }
  function assign(employeeId, day = date) {
    setError('')
    if (readOnly || busy) return
    if (day < dateKey() || !stationInfo?.active) { setError('Choose a current or future date and an active station.'); return }
    if (employeeId && (assignments.some(a => a.employee_id === employeeId && a.work_date === day) || data.records.some(r => r.employee_id === employeeId && r.attendance_date === day))) { setError('This employee already has an assignment or attendance on that date. Select their existing assignment to view it.'); return }
    setDate(day); setEditing({ employee_id: employeeId, work_date: day, station_id: station })
  }
  async function remove(a) {
    setBusy(true); setError('')
    try {
      if (assignmentLocked(a, data.records, dateKey())) throw new Error('This assignment is locked.')
      if (!demo) await removeAssignment(a.id)
      onChange(assignments.filter(item => item.id !== a.id)); notify('Assignment removed.')
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  function saved(rows) {
    const ids = new Set(rows.map(a => a.id))
    onChange([...assignments.filter(a => !ids.has(a.id)), ...rows]); setEditing(null); setCopyMode(null)
    notify(`${rows.length} assignment${rows.length === 1 ? '' : 's'} saved.`)
  }
  function exportSchedule() {
    downloadCsv([['Date', 'Employee', 'Station', 'Work role'], ...monthly.map(a => [a.work_date, employeeName(data, a), a.station_name || stationInfo?.name, a.work_role])], `brewtrack-schedule-${month}.csv`)
  }
  return <>
    <div className="schedule-controls"><MonthControl month={month} onChange={changeMonth}/><select aria-label="Schedule station" value={station} onChange={e => setStation(e.target.value)}>{!data.stations.length && <option value="">No stations</option>}{data.stations.map(s => <option key={s.id} value={s.id}>{s.name}{!s.active ? ' (inactive)' : ''}</option>)}</select><button className="button" onClick={() => changeMonth(today.slice(0, 7))}>Today</button><button className="button" onClick={exportSchedule}><ArrowDownToLine size={16}/>Export month</button></div>
    <div className="schedule-legend">{WORK_ROLES.map(role => <Role key={role} role={role}/>)}<span><LockKeyhole size={13}/> Past dates and attendance are locked</span></div>
    {error && <div className="error" role="alert">{error}</div>}
    <div className={`schedule-layout ${readOnly ? 'schedule-read-only' : ''}`}>
      <section className="panel month-panel" aria-label={monthLabel(month)}><div className="panel-heading"><div><h2>{monthLabel(month)}</h2><p>{stationInfo?.name || 'Select a station'} · {readOnly ? 'Your assignments' : 'Aim for 3–4 staff per day'}</p></div><CalendarDays size={22}/></div>
        <div className="calendar-scroll"><div className="month-grid">{weekdays.map(day => <div className="weekday" key={day}>{day}</div>)}{Array.from({ length: offset }, (_, i) => <div className="calendar-blank" key={`blank-${i}`} aria-hidden="true"/>)}{days.map(day => {
          const team = monthly.filter(a => a.work_date === day)
          const missing = CORE_ROLES.filter(role => !team.some(a => a.work_role === role))
          return <div className={`calendar-day ${day === date ? 'selected' : ''} ${day < today ? 'past' : ''}`} key={day} onDragOver={e => { if (!readOnly && !busy && day >= today && stationInfo?.active) e.preventDefault() }} onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData('application/x-brewtrack-staff'); if (data.employees.some(staff => staff.id === id && staff.active)) assign(id, day) }}>
            <button className={`calendar-date ${day === today ? 'is-today' : ''}`} aria-label={`Select ${dayLabel(day)}`} aria-pressed={day === date} onClick={() => { setDate(day); setError('') }}><span>{Number(day.slice(-2))}</span>{day < today && <LockKeyhole size={11}/>}</button>
            <div className="calendar-team">{team.map(a => <button key={a.id} className="calendar-assignment" onClick={() => { setDate(day); if (!readOnly && !busy && !assignmentLocked(a, data.records, today)) setEditing(a) }} aria-label={`${employeeName(data, a)}, ${a.work_role}${assignmentLocked(a, data.records, today) ? ', locked' : ', edit assignment'}`}><span>{employeeName(data, a)} {assignmentLocked(a, data.records, today) && <LockKeyhole size={10}/>}</span><Role role={a.work_role}/></button>)}</div>
            {!readOnly && <div className={`coverage ${!missing.length && team.length >= 3 && team.length <= 4 ? 'covered' : ''}`}><strong>{team.length} / 3–4 staff</strong><span>{missing.length ? `Needs ${missing.join(', ')}` : 'Core roles covered'}{team.length > 4 ? ' · Above usual coverage' : ''}</span></div>}
          </div>
        })}</div></div>
      </section>
      {!readOnly && <aside className="panel staff-panel"><div className="panel-heading"><div><h2>Staff list</h2><p>For {dayLabel(date)}</p></div></div><div className="staff-panel-body"><p className="muted">Drag staff onto a day, or select a day and click a name.</p><label className="search-box"><Search size={16}/><input aria-label="Search staff" placeholder="Search staff…" value={search} onChange={e => setSearch(e.target.value)}/></label><label className="available-filter"><input type="checkbox" checked={onlyAvailable} onChange={e => setOnlyAvailable(e.target.checked)}/>Unassigned only</label><div className="staff-list">{staff.map(e => {
        const assigned = daily.find(a => a.employee_id === e.id)
        const unassigned = available(e)
        return <button key={e.id} className={`staff-person ${unassigned ? 'unassigned' : ''}`} draggable={!busy && stationInfo?.active} onDragStart={event => { event.dataTransfer.setData('application/x-brewtrack-staff', e.id); event.dataTransfer.effectAllowed = 'copy' }} aria-disabled={busy || !unassigned || date < today || !stationInfo?.active} onClick={() => assign(e.id)}><strong>{e.name}</strong><span>{unassigned ? 'Unassigned' : assigned ? `${assigned.work_role} · ${assigned.station_name || data.stations.find(s => s.id === assigned.station_id)?.name || 'Station'}` : 'Attendance recorded'}</span></button>
      })}{!staff.length && <p className="muted">No staff match your search.</p>}</div></div></aside>}
    </div>
    <section className="panel selected-day"><div className="panel-heading"><div><h2>{dayLabel(date)} · {stationInfo?.name || 'Station'}</h2><p>{visible.length} staff assigned{date < today ? ' · Past schedule locked' : ''}</p></div>{!readOnly && <div className="schedule-day-actions"><button className="button" disabled={busy || !stationInfo?.active || !visible.length} onClick={() => setCopyMode('day')}><Copy size={14}/>Copy day</button><button className="button" disabled={busy || !stationInfo?.active} onClick={() => setCopyMode('week')}><Copy size={14}/>Copy week</button><button className="button primary" disabled={busy || date < today || !stationInfo?.active} onClick={() => assign()}><Plus size={15}/>Assign staff</button></div>}</div>
      <div className="selected-team">{visible.map(a => <div className="selected-person" key={a.id}><strong>{employeeName(data, a)}</strong><Role role={a.work_role}/>{assignmentLocked(a, data.records, today) ? <span className="muted"><LockKeyhole size={12}/> Locked</span> : !readOnly && <div className="schedule-actions"><button className="text-button" disabled={busy} onClick={() => setEditing(a)}>Edit</button><button className="text-button" disabled={busy} onClick={() => remove(a)}>Remove</button></div>}</div>)}{!visible.length && <p className="muted">{readOnly ? 'No assignments. Contact your manager for your schedule.' : 'No assignments yet. Choose staff from the list to plan this day.'}</p>}</div>
    </section>
    {editing && <AssignmentForm assignment={editing} data={data} demo={demo} onClose={() => setEditing(null)} onSave={saved}/>}
    {copyMode && <CopyForm mode={copyMode} source={date} station={station} data={data} demo={demo} onClose={() => setCopyMode(null)} onSave={saved}/>}
  </>
}

async function saveBatch(values, data, demo) {
  validateBatch(values, data, dateKey())
  if (!demo) return saveAssignments(values)
  return values.map(value => {
    const employee = data.employees.find(e => e.id === value.employee_id)
    const station = data.stations.find(s => s.id === value.station_id)
    return { ...value, id: crypto.randomUUID(), employee_name: employee.name, station_name: station.name, shift_start: station.shift_start, shift_end: station.shift_end }
  })
}
function AssignmentForm({ assignment, data, demo, onClose, onSave }) {
  const [dates, setDates] = useState([assignment.work_date])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('')
    const form = new FormData(event.currentTarget)
    const values = { employee_id: assignment.id ? assignment.employee_id : form.get('employee_id'), station_id: form.get('station_id'), work_role: form.get('work_role'), work_date: assignment.work_date }
    try {
      if (assignment.id) {
        if (assignmentLocked(assignment, data.records, dateKey())) throw new Error('This assignment is locked.')
        validateAssignment(values, data.assignments, data.records, dateKey(), assignment.id)
        const employee = data.employees.find(e => e.id === values.employee_id && e.active)
        const station = data.stations.find(s => s.id === values.station_id && s.active)
        if (!employee || !station) throw new Error('Choose active staff and an active station.')
        onSave([demo ? { ...assignment, ...values, employee_name: employee.name, station_name: station.name, shift_start: station.shift_start, shift_end: station.shift_end } : await saveEntity('daily_assignments', values, assignment.id)])
      } else onSave(await saveBatch(dates.map(work_date => ({ ...values, work_date })), data, demo))
    } catch (e) { setError(e.code === '23505' ? 'A staff member is already assigned on one of these dates. Refresh the schedule and adjust your dates.' : e.message) } finally { setBusy(false) }
  }
  return <Modal title={assignment.id ? 'Edit assignment' : 'Assign staff'} subtitle={`${dayLabel(assignment.work_date)} · Philippine time`} onClose={() => { if (!busy) onClose() }}><form onSubmit={submit}><fieldset className="schedule-form-fields" disabled={busy}><label className="field">Staff<select name="employee_id" required disabled={!!assignment.id} defaultValue={assignment.employee_id || ''}><option value="" disabled>Select staff</option>{data.employees.filter(e => e.active || e.id === assignment.employee_id).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label><label className="field">Station<select name="station_id" required defaultValue={assignment.station_id || ''}><option value="" disabled>Select station</option>{data.stations.filter(s => s.active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label className="field">Work role<select name="work_role" required defaultValue={assignment.work_role || ''}><option value="" disabled>Select role</option>{WORK_ROLES.map(role => <option key={role}>{role}</option>)}</select></label>{!assignment.id && <DatePicker dates={dates} onChange={setDates} initialMonth={assignment.work_date.slice(0, 7)}/>}<p className="form-footnote">Past dates and attendance are locked. Each employee can have only one assignment per day across all stations.</p></fieldset>{error && <div className="error" role="alert">{error}</div>}<div className="modal-actions"><button type="button" className="button" disabled={busy} onClick={onClose}>Cancel</button><button className="button primary" disabled={busy || !dates.length}>{busy ? <LoaderCircle className="spin" size={16}/> : <Check size={16}/>}Save {assignment.id ? 'assignment' : `${dates.length} assignment${dates.length === 1 ? '' : 's'}`}</button></div></form></Modal>
}
function CopyForm({ mode, source, station, data, demo, onClose, onSave }) {
  const [dates, setDates] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const start = mode === 'week' ? weekStart(source) : source
  const values = copyAssignments(data.assignments, station, source, dates, mode === 'week')
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('')
    try { onSave(await saveBatch(values, data, demo)) }
    catch (e) { setError(e.code === '23505' ? 'A staff member is already assigned on a target date. Refresh the schedule and choose different dates.' : e.message) }
    finally { setBusy(false) }
  }
  return <Modal title={`Copy ${mode}`} subtitle={`${data.stations.find(s => s.id === station)?.name} · ${start}${mode === 'week' ? ` to ${addDays(start, 6)}` : ''}`} onClose={() => { if (!busy) onClose() }}><form onSubmit={submit}><fieldset disabled={busy} className="schedule-form-fields"><p className="form-footnote">{mode === 'week' ? 'Select the first date of each destination week. Seven days are copied in order, starting with the source Monday.' : 'Select the dates that should receive this day’s staff and roles.'} Existing assignments stay in place. Any conflict blocks the entire copy.</p><DatePicker dates={dates} onChange={setDates} initialMonth={source.slice(0, 7)}/><p className="form-footnote">{values.length} assignments to add. After saving, click an assignment to adjust its role or station.</p>{values.length > 0 && <div className="copy-preview" aria-label="Copy preview">{values.map((a, i) => <div key={i}>{a.work_date} · {employeeName(data, a)} · {a.work_role}</div>)}</div>}</fieldset>{error && <div className="error" role="alert">{error}</div>}<div className="modal-actions"><button type="button" className="button" disabled={busy} onClick={onClose}>Cancel</button><button className="button primary" disabled={busy || !values.length}>{busy ? <LoaderCircle size={16} className="spin"/> : <Copy size={16}/>}Save copy</button></div></form></Modal>
}
