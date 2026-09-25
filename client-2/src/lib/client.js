import { createClient as supabaseClient } from '@supabase/supabase-js'

let instance
export const configured = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)

export function createClient() {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

  if (!url || !key) {
    throw new Error(
      'Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local, then restart Vite.'
    )
  }

  instance ??= supabaseClient(url, key)
  return instance
}
