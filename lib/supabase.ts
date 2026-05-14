import { createClient, SupabaseClient } from '@supabase/supabase-js'

export function getSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL!.replace(/\/$/, '')
  return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabase()
    const value = Reflect.get(client, prop, client)
    return typeof value === 'function' ? value.bind(client) : value
  },
})

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
