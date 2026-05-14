'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { Loader2, Plus, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Connection {
  id: string
  google_email: string
  created_at: string
}

interface CalendarOption {
  connectionId: string
  googleEmail: string
  calendarId: string
  summary: string
  primary: boolean
}

interface CalendarGroup {
  connectionId: string
  googleEmail: string
  calendars: { id: string; summary: string; primary: boolean }[]
}

interface Settings {
  id: string
  calendar_1_connection_id: string
  calendar_1_id: string
  calendar_1_name: string | null
  calendar_2_connection_id: string
  calendar_2_id: string
  calendar_2_name: string | null
  recipient_email: string
  report_day: 'friday' | 'monday'
  timezone: string
  active: boolean
  last_test_sent_at: string | null
  last_report_sent_at: string | null
}

interface User {
  id: string
  email: string
  name: string | null
  avatar_url: string | null
}

interface Props {
  user: User
  connections: Connection[]
  initialSettings: Settings | null
}

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Australia/Sydney',
]

const REPORT_DAY_LABELS: Record<string, string> = {
  friday: 'Friday morning',
  monday: 'Monday morning',
}

function formatTs(ts: string | null) {
  if (!ts) return 'Never'
  return format(parseISO(ts), 'MMM d, yyyy · h:mm a')
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

async function loadCalendarGroups(signal?: AbortSignal): Promise<CalendarGroup[]> {
  const res = await fetch('/api/google/calendars', { signal })
  if (!res.ok) throw new Error('Failed to fetch calendars')
  return res.json()
}

function Avatar({ user }: { user: User }) {
  if (user.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt={user.name || user.email}
        className="w-9 h-9 rounded-full object-cover border border-gray-200"
      />
    )
  }
  return (
    <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-semibold">
      {(user.name || user.email)[0].toUpperCase()}
    </div>
  )
}

export default function DashboardClient({ user, connections: initialConnections, initialSettings }: Props) {
  const [connections, setConnections] = useState<Connection[]>(initialConnections)
  const [calendarGroups, setCalendarGroups] = useState<CalendarGroup[]>([])
  const [calendarsLoading, setCalendarsLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)

  const [cal1Key, setCal1Key] = useState(
    initialSettings
      ? `${initialSettings.calendar_1_connection_id}::${initialSettings.calendar_1_id}`
      : ''
  )
  const [cal2Key, setCal2Key] = useState(
    initialSettings
      ? `${initialSettings.calendar_2_connection_id}::${initialSettings.calendar_2_id}`
      : ''
  )
  const [reportDay, setReportDay] = useState<string>(initialSettings?.report_day || '')
  const [timezone, setTimezone] = useState(initialSettings?.timezone || 'America/Chicago')
  const [recipientEmail, setRecipientEmail] = useState(initialSettings?.recipient_email || user.email)
  const [saving, setSaving] = useState(false)
  const [sendingTest, setSendingTest] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [settings, setSettings] = useState<Settings | null>(initialSettings)

  const calendarOptions: CalendarOption[] = calendarGroups.flatMap((g) =>
    g.calendars.map((c) => ({
      connectionId: g.connectionId,
      googleEmail: g.googleEmail,
      calendarId: c.id,
      summary: c.summary,
      primary: c.primary,
    }))
  )

  const getCalLabel = (key: string) => {
    if (!key) return 'Select a calendar…'
    const [connId, calId] = key.split('::')
    const opt = calendarOptions.find((o) => o.connectionId === connId && o.calendarId === calId)
    if (!opt) return calId || 'Calendar unavailable'
    return `${opt.summary} (${opt.googleEmail})`
  }

  const getReportDayLabel = (value: string | null) =>
    value ? REPORT_DAY_LABELS[value] || value : 'When to send…'

  async function fetchCalendars() {
    try {
      const data = await loadCalendarGroups()
      setCalendarGroups(data)
    } catch {
      toast.error('Failed to load calendars')
    } finally {
      setCalendarsLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    loadCalendarGroups(controller.signal)
      .then((data) => {
        if (active) setCalendarGroups(data)
      })
      .catch((err) => {
        if (!active || (err instanceof DOMException && err.name === 'AbortError')) return
        toast.error('Failed to load calendars')
      })
      .finally(() => {
        if (active) setCalendarsLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [])

  async function handleDisconnect(connectionId: string, email: string) {
    if (!confirm(`Disconnect ${email}? Any active report using this account will be paused.`)) return
    setDisconnecting(connectionId)
    try {
      const res = await fetch(`/api/disconnect?connectionId=${connectionId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to disconnect')
      setConnections((prev) => prev.filter((c) => c.id !== connectionId))
      toast.success(`Disconnected ${email}`)
      setCalendarsLoading(true)
      await fetchCalendars()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to disconnect'))
    } finally {
      setDisconnecting(null)
    }
  }

  async function handleSave() {
    if (!cal1Key || !cal2Key || !reportDay || !recipientEmail) {
      toast.error('Please fill in all fields')
      return
    }
    if (cal1Key === cal2Key) {
      toast.error('Please select two different calendars')
      return
    }

    const [c1connId, c1calId] = cal1Key.split('::')
    const [c2connId, c2calId] = cal2Key.split('::')
    const c1name = calendarOptions.find((o) => o.connectionId === c1connId && o.calendarId === c1calId)?.summary
    const c2name = calendarOptions.find((o) => o.connectionId === c2connId && o.calendarId === c2calId)?.summary

    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendar_1_connection_id: c1connId,
          calendar_1_id: c1calId,
          calendar_1_name: c1name || null,
          calendar_2_connection_id: c2connId,
          calendar_2_id: c2calId,
          calendar_2_name: c2name || null,
          recipient_email: recipientEmail,
          report_day: reportDay,
          timezone,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      setSettings(data)
      toast.success('Setup saved! Your weekly conflict report is now active.')
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save'))
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle() {
    setToggling(true)
    try {
      const res = await fetch('/api/settings/toggle', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSettings(data)
      toast.success(data.active ? 'Reports resumed.' : 'Reports paused.')
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update reports'))
    } finally {
      setToggling(false)
    }
  }

  async function handleTestReport() {
    setSendingTest(true)
    try {
      const res = await fetch('/api/send-test-report', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send test report')
      setSettings((prev) => prev ? { ...prev, last_test_sent_at: new Date().toISOString() } : prev)
      toast.success(`Test report sent! Found ${data.conflictCount} conflict${data.conflictCount !== 1 ? 's' : ''}.`)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to send test report'))
    } finally {
      setSendingTest(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
              </svg>
            </div>
            <span className="font-semibold text-gray-900">Calendar Conflict Checker</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <Avatar user={user} />
              <span className="text-sm text-gray-600">{user.name || user.email}</span>
            </div>
            <form action="/api/auth/logout" method="POST">
              <Button variant="ghost" size="sm" type="submit" className="text-gray-500 hover:text-gray-700">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Section 1: Connected Accounts */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <CardTitle className="text-base">Connected Google Accounts</CardTitle>
                <CardDescription className="mt-1">
                  Calendars from all connected accounts are available to compare.
                </CardDescription>
              </div>
              <a href="/api/auth/google/start?add=true">
                <Button size="lg" variant="outline" className="h-10 shrink-0 px-4 text-sm font-semibold sm:h-11 sm:px-5">
                  <Plus className="size-4" />
                  Connect account
                </Button>
              </a>
            </div>
          </CardHeader>
          <CardContent>
            {connections.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No accounts connected.</p>
            ) : (
              <div className="space-y-2">
                {connections.map((conn) => (
                  <div
                    key={conn.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="w-8 h-8 shrink-0 rounded-full bg-indigo-100 flex items-center justify-center">
                        <svg className="w-4 h-4 text-indigo-600" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900">{conn.google_email}</p>
                        <p className="text-xs text-gray-400">Connected {format(parseISO(conn.created_at), 'MMM d, yyyy')}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      disabled={disconnecting === conn.id || connections.length === 1}
                      onClick={() => handleDisconnect(conn.id, conn.google_email)}
                    >
                      {disconnecting === conn.id ? (
                        <span className="flex items-center gap-1">
                          <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Disconnecting…
                        </span>
                      ) : 'Disconnect'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 2: Report Setup */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Weekly Conflict Report Setup</CardTitle>
            <CardDescription>
              Select two calendars to compare and when you want your weekly report delivered.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {calendarsLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
                <svg className="animate-spin w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading calendars…
              </div>
            ) : (
              <>
                <div className="grid gap-5 sm:grid-cols-2">
                  {/* Calendar 1 */}
                  <div className="min-w-0 space-y-1.5">
                    <Label className="text-sm font-medium">Calendar 1</Label>
                    <Select value={cal1Key} onValueChange={(v) => setCal1Key(v ?? '')}>
                      <SelectTrigger className="h-10">
                        <SelectValue className="truncate" placeholder="Select a calendar…">
                          {(value) => getCalLabel(value)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {calendarGroups.map((group) => (
                          <SelectGroup key={group.connectionId}>
                            <SelectLabel className="text-xs text-gray-400 font-normal">{group.googleEmail}</SelectLabel>
                            {group.calendars.map((cal) => {
                              const key = `${group.connectionId}::${cal.id}`
                              const isDisabled = key === cal2Key
                              return (
                                <SelectItem key={key} value={key} disabled={isDisabled} label={`${cal.summary} (${group.googleEmail})`}>
                                  <span className="flex min-w-0 items-center gap-1.5">
                                    {cal.primary && (
                                      <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                                    )}
                                    <span className="min-w-0 truncate">{cal.summary}</span>
                                    <span className="shrink-0 text-xs text-gray-400">({group.googleEmail})</span>
                                  </span>
                                </SelectItem>
                              )
                            })}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Calendar 2 */}
                  <div className="min-w-0 space-y-1.5">
                    <Label className="text-sm font-medium">Calendar 2</Label>
                    <Select value={cal2Key} onValueChange={(v) => setCal2Key(v ?? '')}>
                      <SelectTrigger className="h-10">
                        <SelectValue className="truncate" placeholder="Select a calendar…">
                          {(value) => getCalLabel(value)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {calendarGroups.map((group) => (
                          <SelectGroup key={group.connectionId}>
                            <SelectLabel className="text-xs text-gray-400 font-normal">{group.googleEmail}</SelectLabel>
                            {group.calendars.map((cal) => {
                              const key = `${group.connectionId}::${cal.id}`
                              const isDisabled = key === cal1Key
                              return (
                                <SelectItem key={key} value={key} disabled={isDisabled} label={`${cal.summary} (${group.googleEmail})`}>
                                  <span className="flex min-w-0 items-center gap-1.5">
                                    {cal.primary && (
                                      <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                                    )}
                                    <span className="min-w-0 truncate">{cal.summary}</span>
                                    <span className="shrink-0 text-xs text-gray-400">({group.googleEmail})</span>
                                  </span>
                                </SelectItem>
                              )
                            })}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  {/* Report timing */}
                  <div className="min-w-0 space-y-1.5">
                    <Label className="text-sm font-medium">Report timing</Label>
                    <Select value={reportDay} onValueChange={(v) => setReportDay(v ?? '')}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="When to send…">
                          {(value) => getReportDayLabel(value)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="friday">
                          <span className="flex flex-col">
                            <span>Friday morning</span>
                            <span className="text-xs text-gray-400">Report for the upcoming week</span>
                          </span>
                        </SelectItem>
                        <SelectItem value="monday">
                          <span className="flex flex-col">
                            <span>Monday morning</span>
                            <span className="text-xs text-gray-400">Report for the current week</span>
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Timezone */}
                  <div className="min-w-0 space-y-1.5">
                    <Label className="text-sm font-medium">Timezone</Label>
                    <Select value={timezone} onValueChange={(v) => setTimezone(v ?? 'America/Chicago')}>
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMEZONES.map((tz) => (
                          <SelectItem key={tz} value={tz}>{tz.replace('_', ' ')}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Recipient email */}
                <div className="space-y-1.5">
                  <Label htmlFor="recipient" className="text-sm font-medium">Send report to</Label>
                  <Input
                    id="recipient"
                    type="email"
                    placeholder="you@example.com"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                  />
                </div>

                <Separator />

                <div className="flex gap-3 flex-wrap">
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    {saving ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" />
                        Saving…
                      </span>
                    ) : 'Save Setup'}
                  </Button>

                  {settings && (
                    <Button
                      variant="outline"
                      onClick={handleTestReport}
                      disabled={sendingTest}
                    >
                      {sendingTest ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Sending…
                        </span>
                      ) : (
                        <>
                          <Send className="size-4" />
                          Send Test Report
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Section 3: Current Setup Status */}
        {settings && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Current Setup</CardTitle>
                <Badge
                  variant={settings.active ? 'default' : 'secondary'}
                  className={settings.active ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''}
                >
                  {settings.active ? '● Active' : '○ Paused'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Calendar 1</dt>
                  <dd className="text-sm text-gray-900">
                    {settings.calendar_1_name || settings.calendar_1_id}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Calendar 2</dt>
                  <dd className="text-sm text-gray-900">
                    {settings.calendar_2_name || settings.calendar_2_id}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Report timing</dt>
                  <dd className="text-sm text-gray-900 capitalize">
                    {settings.report_day === 'friday' ? 'Friday morning (next week)' : 'Monday morning (current week)'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Timezone</dt>
                  <dd className="text-sm text-gray-900">{settings.timezone}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Recipient</dt>
                  <dd className="text-sm text-gray-900">{settings.recipient_email}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Last test sent</dt>
                  <dd className="text-sm text-gray-900">{formatTs(settings.last_test_sent_at)}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Last automated report</dt>
                  <dd className="text-sm text-gray-900">{formatTs(settings.last_report_sent_at)}</dd>
                </div>
              </dl>

              <div className={`mt-4 p-3 rounded-lg border flex items-center justify-between gap-4 ${settings.active ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-200'}`}>
                <p className={`text-sm flex items-center gap-2 ${settings.active ? 'text-green-700' : 'text-gray-500'}`}>
                  <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                  </svg>
                  {settings.active
                    ? `Reports send automatically every ${settings.report_day === 'friday' ? 'Friday' : 'Monday'} morning.`
                    : 'Reports are paused. Resume to restart automatic sending.'}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggle}
                  disabled={toggling}
                  className="shrink-0"
                >
                  {toggling ? '…' : settings.active ? 'Pause' : 'Resume'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
