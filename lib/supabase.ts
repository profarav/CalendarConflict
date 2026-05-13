import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _supabase: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _supabase
}

export const supabase = {
  from: (table: string) => getSupabase().from(table),
  auth: new Proxy({} as SupabaseClient['auth'], {
    get(_target, prop) {
      return (getSupabase().auth as any)[prop]
    },
  }),
} as unknown as SupabaseClient

export type Database = {
  users: {
    id: string
    email: string
    name: string | null
    avatar_url: string | null
    created_at: string
  }
  google_connections: {
    id: string
    user_id: string
    google_email: string
    access_token: string
    refresh_token: string
    token_expiry: string | null
    created_at: string
  }
  calendar_report_settings: {
    id: string
    user_id: string
    calendar_1_connection_id: string
    calendar_1_id: string
    calendar_1_name: string | null
    calendar_2_connection_id: string
    calendar_2_id: string
    calendar_2_name: string | null
    recipient_email: string
    report_day: 'friday' | 'monday'
    report_hour: number
    timezone: string
    active: boolean
    last_test_sent_at: string | null
    last_report_sent_at: string | null
    created_at: string
    updated_at: string
  }
}
