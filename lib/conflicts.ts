import { CalendarEvent } from './google'

export interface Conflict {
  eventA: CalendarEvent
  eventB: CalendarEvent
}

export function detectConflicts(
  eventsA: CalendarEvent[],
  eventsB: CalendarEvent[]
): Conflict[] {
  const conflicts: Conflict[] = []

  for (const a of eventsA) {
    for (const b of eventsB) {
      if (a.id === b.id) continue

      const aStart = new Date(a.start)
      const aEnd = new Date(a.end)
      const bStart = new Date(b.start)
      const bEnd = new Date(b.end)

      if (aStart < bEnd && bStart < aEnd) {
        conflicts.push({ eventA: a, eventB: b })
      }
    }
  }

  return conflicts
}

export function getWeekWindow(reportDay: 'friday' | 'monday', timezone: string) {
  const now = new Date()

  // Get current date in user's timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long',
  })
  const parts = formatter.formatToParts(now)
  const weekday = parts.find((p) => p.type === 'weekday')?.value || ''

  const dayMap: Record<string, number> = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  }
  const currentDay = dayMap[weekday] ?? 0

  let monday: Date
  if (reportDay === 'friday') {
    // Next Monday through the Monday after (next week)
    const daysUntilNextMonday = (8 - currentDay) % 7 || 7
    monday = new Date(now)
    monday.setDate(now.getDate() + daysUntilNextMonday)
  } else {
    // Current Monday through next Monday
    const daysSinceMonday = (currentDay + 6) % 7
    monday = new Date(now)
    monday.setDate(now.getDate() - daysSinceMonday)
  }

  // Set to midnight in user timezone
  const timeMin = new Date(
    new Date(monday.toLocaleDateString('en-US', { timeZone: timezone })).setHours(0, 0, 0, 0)
  )
  const timeMax = new Date(timeMin)
  timeMax.setDate(timeMin.getDate() + 7)

  return { timeMin, timeMax }
}
