import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { fetchCalendarEvents } from '@/lib/google'
import { detectConflicts, getWeekWindow } from '@/lib/conflicts'
import { sendConflictReport } from '@/lib/email'

export async function GET(req: NextRequest) {
  // Protect with CRON_SECRET
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()

  // Fetch all active settings
  const { data: allSettings } = await supabase
    .from('calendar_report_settings')
    .select('*, users(name, email)')
    .eq('active', true)

  if (!allSettings || allSettings.length === 0) {
    return NextResponse.json({ processed: 0 })
  }

  let processed = 0
  let errors = 0

  for (const settings of allSettings) {
    // Check if today is the report day for this user
    if (settings.report_day !== weekday) continue

    // Check we haven't already sent this week
    if (settings.last_report_sent_at) {
      const lastSent = new Date(settings.last_report_sent_at)
      const daysSinceLastSent = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60 * 24)
      if (daysSinceLastSent < 6) continue
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

      const user = (settings as any).users
      await sendConflictReport({
        recipientEmail: settings.recipient_email,
        userName: user?.name || null,
        conflicts,
        timeMin,
        timeMax,
      })

      await supabase
        .from('calendar_report_settings')
        .update({ last_report_sent_at: new Date().toISOString() })
        .eq('id', settings.id)

      processed++
    } catch (err) {
      console.error(`Failed to process settings ${settings.id}:`, err)
      errors++
    }
  }

  return NextResponse.json({ processed, errors, weekday })
}
