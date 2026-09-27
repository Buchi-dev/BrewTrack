const PROFILE_CACHE_KEY = 'brewtrack.offline.profile'
const TODAY_SCHEDULE_CACHE_KEY = 'brewtrack.offline.todaySchedule'

export function getManilaDateKey(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value instanceof Date ? value : new Date(value))
}

export function cacheOfflineProfile(profile) {
  if (!profile?.id) return

  localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({
    profile,
    cachedAt: new Date().toISOString(),
  }))
}

export function getCachedOfflineProfile(userId) {
  try {
    const cached = JSON.parse(localStorage.getItem(PROFILE_CACHE_KEY) || 'null')
    if (cached?.profile?.id !== userId) return null
    return cached.profile
  } catch {
    return null
  }
}

export function cacheTodaySchedule({ profileId, schedule }) {
  if (!profileId || !schedule) return

  localStorage.setItem(TODAY_SCHEDULE_CACHE_KEY, JSON.stringify({
    profileId,
    schedule,
    date: getManilaDateKey(),
    cachedAt: new Date().toISOString(),
  }))
}

export function getCachedTodaySchedule(profileId) {
  try {
    const cached = JSON.parse(localStorage.getItem(TODAY_SCHEDULE_CACHE_KEY) || 'null')
    if (cached?.profileId !== profileId) return null
    if (cached?.date !== getManilaDateKey()) return null
    return cached.schedule ?? null
  } catch {
    return null
  }
}
