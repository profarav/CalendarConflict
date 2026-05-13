import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { supabase } from '@/lib/supabase'
import { getAuthenticatedClient } from '@/lib/google'
import { google } from 'googleapis'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: connections } = await supabase
    .from('google_connections')
    .select('*')
    .eq('user_id', session.id)
    .order('created_at', { ascending: true })

  if (!connections || connections.length === 0) {
    return NextResponse.json([])
  }

  const results = await Promise.all(
    connections.map(async (conn) => {
      try {
        const auth = await getAuthenticatedClient(conn.id)
        const cal = google.calendar({ version: 'v3', auth })
        const { data } = await cal.calendarList.list({ maxResults: 250 })

        const calendars = (data.items || []).map((c) => ({
          id: c.id!,
          summary: c.summary || c.id!,
          primary: c.primary || false,
          accessRole: c.accessRole || 'reader',
        }))

        return {
          connectionId: conn.id,
          googleEmail: conn.google_email,
          calendars,
        }
      } catch (err) {
        console.error(`Failed to fetch calendars for ${conn.google_email}:`, err)
        return {
          connectionId: conn.id,
          googleEmail: conn.google_email,
          calendars: [],
          error: 'Failed to load calendars',
        }
      }
    })
  )

  return NextResponse.json(results)
}
