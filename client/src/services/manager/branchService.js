import { supabase } from '../../lib/supabaseClient.js'
import { getRange, normalizeSearch } from '../query.js'

export async function listBranches({ page = 1, pageSize = 10, search, status } = {}) {
  if (!supabase) return { rows: [], count: 0 }

  const { from, to } = getRange(page, pageSize)
  let query = supabase
    .from('branches')
    .select('*', { count: 'exact' })
    .order('name', { ascending: true })
    .range(from, to)

  const term = normalizeSearch(search)
  if (term) {
    query = query.or(`name.ilike.%${term}%,code.ilike.%${term}%,address.ilike.%${term}%`)
  }

  if (status === 'active') query = query.eq('is_active', true)
  if (status === 'inactive') query = query.eq('is_active', false)

  const { data, error, count } = await query
  if (error) throw error

  return { rows: data ?? [], count: count ?? 0 }
}

export async function listAllBranches() {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('branches')
    .select('id, name, code, timezone, is_active')
    .order('name', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function saveBranch(values, branchId) {
  if (!supabase) return null

  const payload = {
    name: values.name.trim(),
    code: values.code.trim().toUpperCase(),
    address: values.address?.trim() || null,
    timezone: values.timezone?.trim() || 'Asia/Manila',
    geofence_radius: Number(values.geofence_radius ?? 0),
    latitude: values.latitude === '' || values.latitude == null ? null : Number(values.latitude),
    longitude: values.longitude === '' || values.longitude == null ? null : Number(values.longitude),
    is_active: values.is_active ?? true,
  }

  const query = branchId
    ? supabase.from('branches').update(payload).eq('id', branchId).select().single()
    : supabase.from('branches').insert(payload).select().single()

  const { data, error } = await query
  if (error) throw error
  return data
}
