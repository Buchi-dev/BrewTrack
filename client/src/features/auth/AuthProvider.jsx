import { useCallback, useEffect, useMemo, useState } from 'react'
import { isSupabaseConfigured } from '../../config/env.js'
import { supabase } from '../../lib/supabaseClient.js'
import { cacheOfflineProfile, getCachedOfflineProfile } from '../../services/offlineReadinessService.js'
import { getCurrentProfile } from '../../services/profileService.js'
import { AuthContext } from './authContext.js'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(null)

  const loadProfile = useCallback(async (user) => {
    if (!user) {
      setProfile(null)
      return
    }

    try {
      const currentProfile = await getCurrentProfile(user.id)
      if (currentProfile?.status === 'active') cacheOfflineProfile(currentProfile)
      setProfile(currentProfile)
      return
    } catch (error) {
      if (!navigator.onLine) {
        const cachedProfile = getCachedOfflineProfile(user.id)
        if (cachedProfile?.status === 'active') {
          setProfile(cachedProfile)
          return
        }
      }

      throw error
    }
  }, [])

  useEffect(() => {
    let ignore = false

    async function applySession(nextSession, error = null) {
      if (error) {
        if (ignore) return
        setSession(null)
        setProfile(null)
        setAuthError(error)
        setLoading(false)
        return
      }

      if (ignore) return

      setSession(nextSession)

      try {
        await loadProfile(nextSession?.user)
        if (ignore) return
        setAuthError(null)
      } catch (error) {
        if (ignore) return
        setProfile(null)
        setAuthError(error)
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    async function restoreSession() {
      if (!supabase) {
        setLoading(false)
        return
      }

      const { data, error } = await supabase.auth.getSession()
      await applySession(data?.session ?? null, error)
    }

    restoreSession()

    if (!supabase) return () => {}

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (ignore) return
      setLoading(true)
      await applySession(nextSession)
    })

    return () => {
      ignore = true
      subscription.unsubscribe()
    }
  }, [loadProfile])

  const value = useMemo(
    () => ({
      isConfigured: isSupabaseConfigured,
      isAuthenticated: Boolean(session?.user),
      authError,
      loading,
      profile,
      role: profile?.role,
      session,
      user: session?.user ?? null,
      refreshProfile: () => loadProfile(session?.user),
    }),
    [authError, loadProfile, loading, profile, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
