import { useCallback, useEffect, useMemo, useState } from 'react'
import { isSupabaseConfigured } from '../../config/env.js'
import { supabase } from '../../lib/supabaseClient.js'
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

    const currentProfile = await getCurrentProfile(user.id)
    setProfile(currentProfile)
  }, [])

  useEffect(() => {
    let ignore = false

    async function restoreSession() {
      if (!supabase) {
        setLoading(false)
        return
      }

      const { data, error } = await supabase.auth.getSession()

      if (ignore) return

      if (error) {
        setSession(null)
        setProfile(null)
        setAuthError(error)
        setLoading(false)
        return
      }

      setSession(data.session)

      try {
        await loadProfile(data.session?.user)
        setAuthError(null)
      } catch (error) {
        setProfile(null)
        setAuthError(error)
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    restoreSession()

    if (!supabase) return () => {}

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession)

      try {
        await loadProfile(nextSession?.user)
        setAuthError(null)
      } catch (error) {
        setProfile(null)
        setAuthError(error)
      } finally {
        setLoading(false)
      }
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
