import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { supabase } from '@/lib/supabase'
import DashboardClient from './dashboard-client'

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const [{ data: connections }, { data: settings }] = await Promise.all([
    supabase
      .from('google_connections')
      .select('id, google_email, created_at')
      .eq('user_id', session.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('calendar_report_settings')
      .select('*')
      .eq('user_id', session.id)
      .single(),
  ])

  return (
    <DashboardClient
      user={session}
      connections={connections || []}
      initialSettings={settings || null}
    />
  )
}
