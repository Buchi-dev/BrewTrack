import { useEffect, useState } from 'react'
import { Camera, ShieldCheck, Flag, LoaderCircle } from 'lucide-react'
import { Modal } from './CameraCapture'
import { photoUrl, reviewRecord } from '../lib/api'
import { timeLabel, dayLabel } from '../lib/attendance'

export default function PhotoReview({ record, demo, canReview, onClose, notify }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [verdict, setVerdict] = useState('')
  const [reviews, setReviews] = useState(record.reviews || [])
  useEffect(() => {
    let alive = true
    if (record.photo_path && !demo) photoUrl(record.photo_path).then(value => { if (alive) setUrl(value) }).catch(e => { if (alive) setError(e.message) })
    return () => { alive = false }
  }, [record, demo])
  async function review(value) {
    setBusy(true)
    try { const saved = !demo ? await reviewRecord(record, value, note) : { id: crypto.randomUUID(), verdict: value, note, created_at: new Date().toISOString() }; setReviews(old => [saved, ...old]); setVerdict(value); notify(`Attendance ${value}. Review saved${demo ? ' for this demo session' : ''}.`) }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return <Modal title="Attendance evidence" subtitle={`${record.employee_name} · ${dayLabel(record.attendance_date)}`} onClose={onClose}>
    {url ? <img className="review-photo" src={url} alt={`Attendance selfie of ${record.employee_name}`}/> : <div className="photo-placeholder">{record.photo_path && !error ? <LoaderCircle className="spin"/> : <Camera size={40}/>}<p>{demo ? 'Sample record · no real selfie stored' : error || 'No photo available'}</p></div>}
    <dl className="detail-list"><div><dt>Employee</dt><dd>{record.employee_name}</dd></div><div><dt>Station</dt><dd>{record.station_name}</dd></div><div><dt>Work role</dt><dd>{record.work_role || "Not recorded"}</dd></div><div><dt>Transaction</dt><dd>{record.transaction_type}</dd></div><div><dt>Official time</dt><dd>{timeLabel(record.official_timestamp)} · PHT</dd></div><div><dt>Record ID</dt><dd className="mono">{record.id}</dd></div></dl>
    {reviews.length > 0 && <div className="review-history"><h3>Review history</h3>{reviews.map(r => <div key={r.id}><strong>{r.verdict} · {timeLabel(r.created_at)}</strong><p>{r.note || 'No note added'}</p></div>)}</div>}
    {error && <div className="error">{error}</div>}
    {canReview && <><label className="field">Review note<textarea maxLength={2000} value={note} onChange={e => setNote(e.target.value)} placeholder="Add context for the audit trail…"/></label>{verdict ? <div className="notice">Review saved: {verdict}. The original record is preserved.</div> : <div className="modal-actions"><button className="button" disabled={busy || (!demo && !url)} onClick={() => review('flagged')}><Flag size={16}/>Flag for follow-up</button><button className="button primary" disabled={busy || (!demo && !url)} onClick={() => review('verified')}><ShieldCheck size={16}/>Verify selfie</button></div>}</>}
  </Modal>
}
