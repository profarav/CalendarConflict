import { NextRequest, NextResponse } from 'next/server'
import { getAuthUrl } from '@/lib/google'
import { getSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const addAccount = searchParams.get('add') === 'true'

  const session = await getSession()

  // If user isn't logged in and trying to add account, redirect to login first
  if (addAccount && !session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  const state = addAccount && session ? `add:${session.id}` : 'login'
  const url = getAuthUrl(state)

  return NextResponse.redirect(url)
}
