import { google } from 'googleapis'
import { supabase } from './supabase'

export function createOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )
}

export function getAuthUrl(state?: string) {
  const client = createOAuthClient()
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar.readonly', 'openid', 'email', 'profile'],
    state: state || '',
  })
}

export async function getTokensFromCode(code: string) {
  const client = createOAuthClient()
  const { tokens } = await client.getToken(code)
  return tokens
}

export async function getUserInfo(accessToken: string) {
  const client = createOAuthClient()
  client.setCredentials({ access_token: accessToken })
  const oauth2 = google.oauth2({ version: 'v2', auth: client })
  const { data } = await oauth2.userinfo.get()
  return data
}

export async function getAuthenticatedClient(connectionId: string) {
  const { data: connection } = await supabase
    .from('google_connections')
    .select('*')
    .eq('id', connectionId)
    .single()

  if (!connection) throw new Error('Connection not found')

  const client = createOAuthClient()
  client.setCredentials({
    access_token: connection.access_token,
    refresh_token: connection.refresh_token,
    expiry_date: connection.token_expiry ? new Date(connection.token_expiry).getTime() : undefined,
  })

  // Auto-refresh if token expired
  const tokenExpiry = connection.token_expiry ? new Date(connection.token_expiry).getTime() : 0
  if (tokenExpiry < Date.now() + 60000) {
    const { credentials } = await client.refreshAccessToken()
    await supabase
      .from('google_connections')
      .update({
        access_token: credentials.access_token!,
        token_expiry: credentials.expiry_date
          ? new Date(credentials.expiry_date).toISOString()
          : null,
      })
      .eq('id', connectionId)
    client.setCredentials(credentials)
  }

  return client
}

export interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  location: string | null
  htmlLink: string
  calendarName: string
  calendarId: string
}

export async function fetchCalendarEvents(
  connectionId: string,
  calendarId: string,
  calendarName: string,
  timeMin: Date,
  timeMax: Date
): Promise<CalendarEvent[]> {
  const auth = await getAuthenticatedClient(connectionId)
  const calendar = google.calendar({ version: 'v3', auth })

  const response = await calendar.events.list({
    calendarId,
    singleEvents: true,
    orderBy: 'startTime',
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    maxResults: 2500,
  })

  const events = (response.data.items || []).filter(
    (e) =>
      e.status !== 'cancelled' &&
      e.start?.dateTime &&
      e.end?.dateTime
  )

  return events.map((e) => ({
    id: e.id!,
    title: e.summary || '(No title)',
    start: e.start!.dateTime!,
    end: e.end!.dateTime!,
    location: e.location || null,
    htmlLink: e.htmlLink || '',
    calendarName,
    calendarId,
  }))
}
