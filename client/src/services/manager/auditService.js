import { supabase } from '../../lib/supabaseClient.js'
import { getRange, normalizeSearch } from '../shared/query.js'

export async function listAuditLogs({
  page = 1,
  pageSize = 10,
  search,
  action,
  resourceType,
  startDate,
  endDate,
} = {}) {
  if (!supabase) return { rows: [], count: 0 }

  const { from, to } = getRange(page, pageSize)
  let query = supabase
    .from('audit_logs')
    .select(
      `
        id,
        actor_user_id,
        action,
        resource_type,
        resource_id,
        old_values,
        new_values,
        metadata,
        created_at,
        profiles (
          id,
          first_name,
          middle_name,
          last_name,
          employee_number
        )
      `,
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(from, to)

  const term = normalizeSearch(search)
  if (term) {
    query = query.or(`action.ilike.%${term}%,resource_type.ilike.%${term}%`)
  }

  if (action) query = query.eq('action', action)
  if (resourceType) query = query.eq('resource_type', resourceType)
  if (startDate) query = query.gte('created_at', `${startDate}T00:00:00+08:00`)
  if (endDate) query = query.lte('created_at', `${endDate}T23:59:59+08:00`)

  const { data, error, count } = await query
  if (error) throw error

  return { rows: data ?? [], count: count ?? 0 }
}

export async function logManagerAction({
  action,
  resourceType,
  resourceId = null,
  oldValues = null,
  newValues = null,
  metadata = {},
} = {}) {
  if (!supabase) return null

  const { data, error } = await supabase.rpc('log_manager_action', {
    p_action: action,
    p_resource_type: resourceType,
    p_resource_id: resourceId,
    p_old_values: oldValues,
    p_new_values: newValues,
    p_metadata: metadata,
  })

  if (error) throw error
  return data
}
