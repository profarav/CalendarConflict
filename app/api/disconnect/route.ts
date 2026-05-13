import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { supabase } from '@/lib/supabase'

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const connectionId = searchParams.get('connectionId')

  if (!connectionId) {
    return NextResponse.json({ error: 'Missing connectionId' }, { status: 400 })
  }

  // Verify connection belongs to user
  const { data: connection } = await supabase
    .from('google_connections')
    .select('id, user_id')
    .eq('id', connectionId)
    .eq('user_id', session.id)
    .single()

  if (!connection) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
  }

  // Check if it's the only connection (must keep at least one)
  const { count } = await supabase
    .from('google_connections')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', session.id)

  if ((count || 0) <= 1) {
    return NextResponse.json(
      { error: 'Cannot disconnect your only Google account' },
      { status: 400 }
    )
  }

  // Remove from settings if referenced
  await supabase
    .from('calendar_report_settings')
    .update({ active: false })
    .eq('user_id', session.id)
    .or(
      `calendar_1_connection_id.eq.${connectionId},calendar_2_connection_id.eq.${connectionId}`
    )

  // Delete the connection (tokens deleted with it)
  await supabase.from('google_connections').delete().eq('id', connectionId)

  return NextResponse.json({ success: true })
}
