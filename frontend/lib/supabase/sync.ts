import type { SupabaseClient } from '@supabase/supabase-js'
import type { AppState } from '@/lib/types'

export async function fetchBossAppStateJson(
  supabase: SupabaseClient,
  userId: string
): Promise<unknown | null> {
  const { data, error } = await supabase
    .from('boss_app_state')
    .select('state')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[Supabase] fetch boss_app_state:', error.message)
    return null
  }
  if (!data) return null
  return (data as { state: unknown }).state
}

export async function upsertBossAppState(
  supabase: SupabaseClient,
  userId: string,
  state: AppState
): Promise<void> {
  const { error } = await supabase.from('boss_app_state').upsert(
    {
      user_id: userId,
      state: state as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )

  if (error) {
    console.error('[Supabase] upsert boss_app_state:', error.message)
  }
}
