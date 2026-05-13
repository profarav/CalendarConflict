import { NextRequest, NextResponse } from 'next/server'
import { getTokensFromCode, getUserInfo } from '@/lib/google'
import { supabase } from '@/lib/supabase'
import { setSessionCookie } from '@/lib/session'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state') || ''
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(new URL('/login?error=oauth_denied', req.url))
  }

  try {
    const tokens = await getTokensFromCode(code)

    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.redirect(new URL('/login?error=no_tokens', req.url))
    }

    const googleUser = await getUserInfo(tokens.access_token)

    if (!googleUser.email) {
      return NextResponse.redirect(new URL('/login?error=no_email', req.url))
    }

    const tokenExpiry = tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : null

    // Adding another Google account to an existing session
    if (state.startsWith('add:')) {
      const userId = state.replace('add:', '')

      // Upsert connection (in case this Google account is already connected)
      const { error: connErr } = await supabase
        .from('google_connections')
        .upsert(
          {
            user_id: userId,
            google_email: googleUser.email,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            token_expiry: tokenExpiry,
          },
          { onConflict: 'user_id,google_email' }
        )

      if (connErr) throw connErr

      return NextResponse.redirect(new URL('/dashboard?connected=true', req.url))
    }

    // Initial login flow
    // Find or create user by Google email
    let { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('email', googleUser.email)
      .single()

    if (!user) {
      const { data: newUser, error: userErr } = await supabase
        .from('users')
        .insert({
          email: googleUser.email,
          name: googleUser.name || null,
          avatar_url: googleUser.picture || null,
        })
        .select()
        .single()

      if (userErr) throw userErr
      user = newUser
    } else {
      // Update name/avatar if changed
      await supabase
        .from('users')
        .update({
          name: googleUser.name || user.name,
          avatar_url: googleUser.picture || user.avatar_url,
        })
        .eq('id', user.id)
    }

    // Upsert Google connection
    await supabase
      .from('google_connections')
      .upsert(
        {
          user_id: user.id,
          google_email: googleUser.email,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expiry: tokenExpiry,
        },
        { onConflict: 'user_id,google_email' }
      )

    const response = NextResponse.redirect(new URL('/dashboard', req.url))
    await setSessionCookie(user.id)

    return response
  } catch (err) {
    console.error('OAuth callback error:', err)
    return NextResponse.redirect(new URL('/login?error=auth_failed', req.url))
  }
}
