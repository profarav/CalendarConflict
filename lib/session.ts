import { cookies } from 'next/headers'
import { supabase } from './supabase'

export async function getSession() {
  const cookieStore = await cookies()
  const userId = cookieStore.get('user_id')?.value
  if (!userId) return null

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

  return user
}

export async function setSessionCookie(userId: string) {
  const cookieStore = await cookies()
  cookieStore.set('user_id', userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
    sameSite: 'lax',
  })
}

export async function clearSession() {
  const cookieStore = await cookies()
  cookieStore.delete('user_id')
}
