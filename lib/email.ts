import nodemailer from 'nodemailer'
import { Conflict } from './conflicts'
import { format, parseISO } from 'date-fns'

function getTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  })
}

function formatDateTime(iso: string) {
  return format(parseISO(iso), 'EEE, MMM d · h:mm a')
}

function formatDateRange(timeMin: Date, timeMax: Date) {
  const start = format(timeMin, 'MMMM d')
  const end = format(new Date(timeMax.getTime() - 1), 'MMMM d, yyyy')
  return `${start} – ${end}`
}

export async function sendConflictReport({
  recipientEmail,
  userName,
  conflicts,
  timeMin,
  timeMax,
}: {
  recipientEmail: string
  userName: string | null
  conflicts: Conflict[]
  timeMin: Date
  timeMax: Date
}) {
  const dateRange = formatDateRange(timeMin, timeMax)
  const weekLabel = format(timeMin, 'MMMM d')
  const firstName = userName?.split(' ')[0] || 'there'

  let bodyHtml: string

  if (conflicts.length === 0) {
    bodyHtml = `
      <p>No direct calendar overlaps found for this week. Enjoy a conflict-free schedule!</p>
    `
  } else {
    const conflictHtml = conflicts
      .map(
        ({ eventA, eventB }) => `
        <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
          <div style="margin-bottom: 12px;">
            <div style="font-weight: 600; font-size: 15px; color: #111827;">${eventA.title}</div>
            <div style="color: #6b7280; font-size: 13px; margin-top: 2px;">📅 ${formatDateTime(eventA.start)} → ${format(parseISO(eventA.end), 'h:mm a')}</div>
            <div style="color: #6b7280; font-size: 13px;">📁 ${eventA.calendarName}</div>
            ${eventA.location ? `<div style="color: #6b7280; font-size: 13px;">📍 ${eventA.location}</div>` : ''}
            <a href="${eventA.htmlLink}" style="color: #4f46e5; font-size: 13px; text-decoration: none;">Open in Google Calendar →</a>
          </div>
          <div style="text-align: center; color: #ef4444; font-weight: 600; margin: 8px 0;">⚡ Conflicts with</div>
          <div>
            <div style="font-weight: 600; font-size: 15px; color: #111827;">${eventB.title}</div>
            <div style="color: #6b7280; font-size: 13px; margin-top: 2px;">📅 ${formatDateTime(eventB.start)} → ${format(parseISO(eventB.end), 'h:mm a')}</div>
            <div style="color: #6b7280; font-size: 13px;">📁 ${eventB.calendarName}</div>
            ${eventB.location ? `<div style="color: #6b7280; font-size: 13px;">📍 ${eventB.location}</div>` : ''}
            <a href="${eventB.htmlLink}" style="color: #4f46e5; font-size: 13px; text-decoration: none;">Open in Google Calendar →</a>
          </div>
        </div>
      `
      )
      .join('')

    bodyHtml = `
      <p style="color: #ef4444; font-weight: 600;">${conflicts.length} direct overlap${conflicts.length !== 1 ? 's' : ''} found</p>
      ${conflictHtml}
    `
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #111827; background: #f9fafb;">
      <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="border-bottom: 1px solid #e5e7eb; padding-bottom: 20px; margin-bottom: 24px;">
          <div style="font-size: 22px; font-weight: 700; color: #111827;">📆 Calendar Conflict Report</div>
          <div style="color: #6b7280; margin-top: 4px;">Week of ${weekLabel}</div>
        </div>
        <p style="color: #374151;">Hi ${firstName},</p>
        <p style="color: #374151;">Here is your calendar conflict report for <strong>${dateRange}</strong>.</p>
        ${bodyHtml}
        <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px;">
          This report checks only direct overlapping meetings (events where one starts before another ends).
          <br><br>
          Manage your report settings at <a href="${process.env.APP_URL}/dashboard" style="color: #4f46e5;">${process.env.APP_URL}/dashboard</a>
        </div>
      </div>
    </body>
    </html>
  `

  await getTransporter().sendMail({
    from: `Calendar Conflict Checker <${process.env.GMAIL_USER}>`,
    to: recipientEmail,
    subject: `Calendar Conflict Report: Week of ${weekLabel}`,
    html,
  })
}
