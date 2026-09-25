import { DEFAULT_TIMEZONE } from '../constants/settings.js'

export function formatDateTime(value, options = {}) {
  if (!value) return '--'

  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: DEFAULT_TIMEZONE,
    ...options,
  }).format(new Date(value))
}

export function formatDate(value, options = {}) {
  if (!value) return '--'

  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeZone: DEFAULT_TIMEZONE,
    ...options,
  }).format(new Date(value))
}
