import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: settings } = await supabase
    .from('calendar_report_settings')
    .select('id, active')
    .eq('user_id', session.id)
    .single()

  if (!settings) return NextResponse.json({ error: 'No settings found' }, { status: 404 })

  const { data } = await supabase
    .from('calendar_report_settings')
    .update({ active: !settings.active, updated_at: new Date().toISOString() })
    .eq('id', settings.id)
    .select()
    .single()

  return NextResponse.json(data)
}
