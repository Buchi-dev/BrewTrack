import { useState } from 'react'
import { CalendarDays, Plus, Check, LoaderCircle, ArrowDownToLine } from 'lucide-react'
import { Modal } from './CameraCapture'
import { saveEntity, removeAssignment } from '../lib/api'
import { dateKey, dayLabel, downloadCsv } from '../lib/attendance'
import { WORK_ROLES, CORE_ROLES, assignmentLocked, validateAssignment } from '../lib/schedule'

export default function DailySchedule({ data, demo, onChange, notify, readOnly = false }) {
  const [date, setDate] = useState(dateKey)
  const [station, setStation] = useState('')
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const assignments = data.assignments || []
  const daily = assignments.filter(a => a.work_date === date)
  const visible = daily.filter(a => !station || a.station_id === station)
  const employeeName = a => a.employee_name || data.employees.find(e => e.id === a.employee_id)?.name || 'Employee'
  const stationName = a => a.station_name || data.stations.find(s => s.id === a.station_id)?.name || 'Station'
  const unassigned = data.employees.filter(e => e.active && !daily.some(a => a.employee_id === e.id))
  async function remove(a) {
    setBusy(true); setError('')
    try {
      if (assignmentLocked(a, data.records, dateKey())) throw new Error('This assignment is locked.')
      if (!demo) await removeAssignment(a.id)
      onChange(assignments.filter(item => item.id !== a.id)); notify('Assignment removed for this date.')
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  function exportSchedule() {
    downloadCsv([['Date', 'Employee', 'Station', 'Work role'], ...visible.map(a => [date, employeeName(a), stationName(a), a.work_role])], `brewtrack-schedule-${date}.csv`)
  }
  return <>
    <div className="schedule-controls"><label className="date-control"><CalendarDays size={16}/><input aria-label="Schedule date" type="date" value={date} onChange={e => { if (e.target.value) setDate(e.target.value) }}/></label><select aria-label="Schedule station" value={station} onChange={e => setStation(e.target.value)}><option value="">All stations</option>{data.stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select><button className="button" onClick={exportSchedule}><ArrowDownToLine size={16}/>Export schedule</button>{!readOnly && <button className="button primary" disabled={date < dateKey()} onClick={() => setEditing({ work_date: date, station_id: station })}><Plus size={16}/>Assign staff</button>}</div>
    <div className="notice">{readOnly ? 'Your manager assigns your station and role separately for each date.' : 'Plan each day: Cook, Barista, Cashier (OTD), plus a Trainee if needed. Usually 3–4 staff per station. Rotation follows your arrangements.'} {date < dateKey() && 'Past schedules are read-only.'}</div>
    {!readOnly && <div className="schedule-summary">{data.stations.filter(s => (!station || s.id === station) && (s.active || daily.some(a => a.station_id === s.id))).map(s => {
      const team = daily.filter(a => a.station_id === s.id)
      const missing = CORE_ROLES.filter(role => !team.some(a => a.work_role === role))
      return <section className="panel schedule-card" key={s.id}><h3>{s.name}</h3><strong>{team.length} staff</strong><p>{missing.length ? `Needs: ${missing.join(', ')}` : 'Core roles covered'}{team.length > 4 ? ' · Above usual staffing' : ''}</p></section>
    })}</div>}
    {error && <div className="error" role="alert">{error}</div>}
    <section className="panel"><div className="panel-heading"><div><h2>{dayLabel(date)} · Daily assignments</h2><p>{visible.length} assignments{!readOnly && ` · ${unassigned.length} active staff unassigned`}</p></div></div><div className="table-scroll"><table><thead><tr><th>Staff</th><th>Station</th><th>Work role</th><th>{readOnly ? 'Schedule' : 'Actions'}</th></tr></thead><tbody>{visible.map(a => <tr key={a.id}><td><strong>{employeeName(a)}</strong></td><td>{stationName(a)}</td><td>{a.work_role}</td><td>{readOnly ? 'Assigned by manager' : assignmentLocked(a, data.records, dateKey()) ? <span className="muted">Locked · history preserved</span> : <div className="schedule-actions"><button className="text-button" disabled={busy} onClick={() => setEditing(a)}>Edit assignment</button><button className="text-button" disabled={busy} onClick={() => remove(a)}>Remove</button></div>}</td></tr>)}</tbody></table>{!visible.length && <div className="empty"><CalendarDays size={27}/><h3>No assignments for this date</h3><p>{readOnly ? 'Contact your manager for your schedule.' : 'Choose Assign staff to plan this day.'}</p></div>}</div></section>
    {!readOnly && unassigned.length > 0 && <p className="schedule-unassigned">Unassigned: {unassigned.map(e => e.name).join(', ')}</p>}
    {editing && <AssignmentForm key={editing.id || 'new'} assignment={editing} data={data} demo={demo} onClose={() => setEditing(null)} onSave={saved => { onChange(assignments.some(a => a.id === saved.id) ? assignments.map(a => a.id === saved.id ? saved : a) : [...assignments, saved]); setEditing(null); notify('Daily assignment saved. Other dates are unchanged.') }}/>} 
  </>
}

function AssignmentForm({ assignment, data, demo, onClose, onSave }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('')
    const form = new FormData(event.currentTarget)
    const values = { employee_id: form.get('employee_id') || assignment.employee_id, station_id: form.get('station_id'), work_role: form.get('work_role'), work_date: assignment.work_date }
    try {
      validateAssignment(values, data.assignments, data.records, dateKey(), assignment.id)
      const employee = data.employees.find(e => e.id === values.employee_id && e.active)
      const station = data.stations.find(s => s.id === values.station_id && s.active)
      if (!employee || !station) throw new Error('Choose active staff and an active station.')
      const saved = demo ? { ...values, id: assignment.id || crypto.randomUUID(), employee_name: employee.name, station_name: station.name, shift_start: station.shift_start, shift_end: station.shift_end } : await saveEntity('daily_assignments', values, assignment.id)
      onSave(saved)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  const available = data.employees.filter(e => e.active && (e.id === assignment.employee_id || !data.assignments.some(a => a.employee_id === e.id && a.work_date === assignment.work_date)))
  return <Modal title={assignment.id ? 'Edit daily assignment' : 'Assign staff'} subtitle={`${dayLabel(assignment.work_date)} · Philippine time`} onClose={onClose}><form onSubmit={submit}><label className="field">Staff<select name="employee_id" required disabled={!!assignment.id} defaultValue={assignment.employee_id || ''}><option value="" disabled>Select staff</option>{available.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label><label className="field">Station<select name="station_id" required defaultValue={assignment.station_id || ''}><option value="" disabled>Select station</option>{data.stations.filter(s => s.active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label className="field">Work role<select name="work_role" required defaultValue={assignment.work_role || ''}><option value="" disabled>Select role</option>{WORK_ROLES.map(role => <option key={role}>{role}</option>)}</select></label><p className="form-footnote">This assignment applies only to the selected date. Past dates and assignments with attendance cannot be changed.</p>{error && <div className="error" role="alert">{error}</div>}<div className="modal-actions"><button type="button" className="button" onClick={onClose}>Cancel</button><button className="button primary" disabled={busy || !available.length}>{busy ? <LoaderCircle className="spin" size={16}/> : <Check size={16}/>}Save assignment</button></div></form></Modal>
}
