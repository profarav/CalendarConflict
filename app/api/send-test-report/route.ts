import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { supabase } from '@/lib/supabase'
import { fetchCalendarEvents } from '@/lib/google'
import { detectConflicts, getWeekWindow } from '@/lib/conflicts'
import { sendConflictReport } from '@/lib/email'

export async function POST() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: settings } = await supabase
    .from('calendar_report_settings')
    .select('*')
    .eq('user_id', session.id)
    .single()

  if (!settings) {
    return NextResponse.json({ error: 'No settings configured' }, { status: 400 })
  }

  try {
    const { timeMin, timeMax } = getWeekWindow(settings.report_day, settings.timezone)

    const [eventsA, eventsB] = await Promise.all([
      fetchCalendarEvents(
        settings.calendar_1_connection_id,
        settings.calendar_1_id,
        settings.calendar_1_name || 'Calendar 1',
        timeMin,
        timeMax
      ),
      fetchCalendarEvents(
        settings.calendar_2_connection_id,
        settings.calendar_2_id,
        settings.calendar_2_name || 'Calendar 2',
        timeMin,
        timeMax
      ),
    ])

    const conflicts = detectConflicts(eventsA, eventsB)

    await sendConflictReport({
      recipientEmail: settings.recipient_email,
      userName: session.name,
      conflicts,
      timeMin,
      timeMax,
    })

    await supabase
      .from('calendar_report_settings')
      .update({ last_test_sent_at: new Date().toISOString() })
      .eq('id', settings.id)

    return NextResponse.json({
      success: true,
      conflictCount: conflicts.length,
      sentTo: settings.recipient_email,
    })
  } catch (err) {
    console.error('Test report error:', err)
    const message = err instanceof Error ? err.message : 'Failed to send report'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
