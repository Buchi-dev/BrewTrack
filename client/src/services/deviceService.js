const DEVICE_ID_STORAGE_KEY = 'brewtrack.deviceId'

export function getDeviceId() {
  const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY)
  if (existing) return existing

  const id = `BT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
  localStorage.setItem(DEVICE_ID_STORAGE_KEY, id)
  return id
}
