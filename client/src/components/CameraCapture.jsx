import { useEffect, useRef, useState } from 'react'
import { X, Camera, RotateCcw, Check, ShieldCheck, LoaderCircle } from 'lucide-react'
import { startCapture, submitCapture } from '../lib/api'
import { dateKey, timeLabel, ZONE } from '../lib/attendance'

export function Modal({ title, subtitle, children, onClose, wide = false }) {
  const dialog = useRef(null)
  useEffect(() => { const el = dialog.current; el.showModal(); return () => el.close() }, [])
  return <dialog ref={dialog} className={`modal ${wide ? 'wide' : ''}`} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose() }}><div className="modal-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20}/></button></div>{children}</dialog>
}

export default function CameraCapture({ employee, branch, type, demo, onClose, onComplete }) {
  const video = useRef(null)
  const stream = useRef(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [captured, setCaptured] = useState(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  useEffect(() => {
    let alive = true
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 960 } }, audio: false }).then(media => {
      if (!alive) { media.getTracks().forEach(t => t.stop()); return }
      stream.current = media; video.current.srcObject = media
    }).catch(() => setError('Camera access is unavailable. Allow camera permission and use HTTPS or localhost.'))
    if (!navigator.mediaDevices) queueMicrotask(() => setError('Camera requires HTTPS or localhost on this device.'))
    return () => { alive = false; stream.current?.getTracks().forEach(t => t.stop()) }
  }, [])
  useEffect(() => () => { if (captured) URL.revokeObjectURL(captured.url) }, [captured])
  async function capture() {
    setBusy(true); setError('')
    try {
      const challenge = demo ? { id: crypto.randomUUID(), employee_id: employee.id, employee_name: employee.name, branch_id: branch.id, branch_name: branch.name, transaction_type: type, issued_at: new Date().toISOString() } : await startCapture(type)
      const v = video.current
      if (!v.videoWidth || !stream.current?.getVideoTracks()[0]?.enabled) throw new Error('Camera is not ready. Please try again.')
      const canvas = document.createElement('canvas'); canvas.width = v.videoWidth; canvas.height = v.videoHeight
      const ctx = canvas.getContext('2d'); ctx.drawImage(v, 0, 0)
      const size = Math.max(16, Math.round(canvas.width / 30))
      const height = size * 5.8
      ctx.fillStyle = 'rgba(9,35,32,.82)'; ctx.fillRect(0, canvas.height - height, canvas.width, height)
      ctx.fillStyle = 'white'; ctx.font = `600 ${size}px sans-serif`
      const lines = [challenge.employee_name, challenge.branch_name, `${type.toUpperCase()} · ${new Date(challenge.issued_at).toLocaleString('en-PH', { timeZone: ZONE })}`, demo ? 'BREWTRACK · DEMO' : 'BREWTRACK · SERVER SESSION TIME']
      lines.forEach((line, i) => ctx.fillText(line, size, canvas.height - height + size * (1.3 + i * 1.2), canvas.width - size * 2))
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .88))
      if (!blob) throw new Error('Could not capture the photo. Please try again.')
      setCaptured({ blob, challenge, url: URL.createObjectURL(blob) })
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  async function submit() {
    setBusy(true); setError('')
    try {
      const { challenge, blob } = captured
      const record = demo ? { ...challenge, id: crypto.randomUUID(), official_timestamp: challenge.issued_at, attendance_date: dateKey(new Date(challenge.issued_at)), status: type === 'clock-out' ? 'completed' : 'on-time', photo_path: null, review_status: 'pending' } : await submitCapture(challenge, blob)
      setResult(record); stream.current?.getTracks().forEach(t => t.stop()); onComplete(record)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return <Modal title={result ? 'You’re all set!' : `${type === 'clock-in' ? 'Clock in' : 'Clock out'} with a selfie`} subtitle={result ? 'Your attendance has been recorded.' : 'A fresh photo helps keep attendance accurate.'} onClose={onClose}>
    {result ? <div className="confirmation"><div className="success-icon"><Check size={36}/></div><h2>{type === 'clock-in' ? 'Have a great shift.' : 'Thanks for your work today.'}</h2><p>{employee.name} · {branch.name}</p><strong>{timeLabel(result.official_timestamp)}</strong><p>{dateKey(new Date(result.official_timestamp))} · Philippine time</p><button className="button primary" onClick={onClose}>Done</button></div> : <>
      <div className="camera-view"><video ref={video} autoPlay playsInline muted onLoadedData={() => setReady(true)} style={{ display: captured ? 'none' : 'block' }}/>{captured && <img src={captured.url} alt="Your captured attendance selfie"/>}{!captured && <div className="camera-guide"/>}</div>
      <div className="camera-caption"><ShieldCheck size={17}/><span>{branch.name} · {demo ? 'Demo session' : 'Secure camera session · submit within 2 minutes'}</span></div>
      {error && <div className="error" role="alert">{error}</div>}
      <div className="modal-actions">{captured ? <><button className="button" disabled={busy} onClick={() => { setCaptured(null); setError('') }}><RotateCcw size={16}/>Retake</button><button className="button primary" disabled={busy} onClick={submit}>{busy ? <LoaderCircle className="spin" size={17}/> : <Check size={17}/>}Confirm {type}</button></> : <button className="button primary full" onClick={capture} disabled={!ready || busy}>{busy ? <LoaderCircle className="spin" size={17}/> : <Camera size={17}/>}Capture selfie</button>}</div>
    </>}
  </Modal>
}


