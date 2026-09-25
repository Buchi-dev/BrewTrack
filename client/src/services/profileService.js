import { supabase } from '../lib/supabaseClient.js'

export async function getCurrentProfile(userId) {
  if (!supabase || !userId) return null

  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }

  return data
}
