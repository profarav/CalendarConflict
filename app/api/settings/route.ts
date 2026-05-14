import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: settings } = await supabase
    .from('calendar_report_settings')
    .select('*')
    .eq('user_id', session.id)
    .single()

  return NextResponse.json(settings || null)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const {
    calendar_1_connection_id,
    calendar_1_id,
    calendar_1_name,
    calendar_2_connection_id,
    calendar_2_id,
    calendar_2_name,
    recipient_email,
    report_day,
    timezone,
  } = body

  // Validate required fields
  if (
    !calendar_1_connection_id ||
    !calendar_1_id ||
    !calendar_2_connection_id ||
    !calendar_2_id ||
    !recipient_email ||
    !report_day
  ) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (!['friday', 'monday'].includes(report_day)) {
    return NextResponse.json({ error: 'Invalid report_day' }, { status: 400 })
  }

  // Check both connections belong to this user
  const { data: connections } = await supabase
    .from('google_connections')
    .select('id')
    .eq('user_id', session.id)
    .in('id', [calendar_1_connection_id, calendar_2_connection_id])

  if (!connections || connections.length < 1) {
    return NextResponse.json({ error: 'Invalid connections' }, { status: 403 })
  }

  // Upsert settings
  const { data: existing } = await supabase
    .from('calendar_report_settings')
    .select('id')
    .eq('user_id', session.id)
    .single()

  const payload = {
    user_id: session.id,
    calendar_1_connection_id,
    calendar_1_id,
    calendar_1_name: calendar_1_name || null,
    calendar_2_connection_id,
    calendar_2_id,
    calendar_2_name: calendar_2_name || null,
    recipient_email,
    report_day,
    timezone: timezone || 'America/Chicago',
    active: true,
    updated_at: new Date().toISOString(),
  }

  let result
  if (existing) {
    result = await supabase
      .from('calendar_report_settings')
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single()
  } else {
    result = await supabase
      .from('calendar_report_settings')
      .insert(payload)
      .select()
      .single()
  }

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 })
  }

  return NextResponse.json(result.data)
}
