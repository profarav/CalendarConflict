'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}

function LoginContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  const errorMessages: Record<string, string> = {
    oauth_denied: 'Google sign-in was cancelled. Please try again.',
    no_tokens: 'Could not retrieve access tokens. Please try again.',
    no_email: 'Could not retrieve your email. Please try again.',
    auth_failed: 'Authentication failed. Please try again.',
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="w-full max-w-md space-y-6">
        {/* Logo / Branding */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-200">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Calendar Conflict Checker</h1>
            <p className="text-sm text-gray-500 mt-1">Internal tool</p>
          </div>
        </div>

        {/* Error alert */}
        {error && errorMessages[error] && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
            </svg>
            {errorMessages[error]}
          </div>
        )}

        {/* Main card */}
        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl">Sign in to get started</CardTitle>
            <CardDescription className="text-base leading-relaxed mt-2">
              Automatically detect scheduling conflicts across multiple Google calendars — set up once, get weekly reports forever.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <a href="/api/auth/google/start" className="block">
              <Button className="w-full h-12 text-base font-medium bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 shadow-sm" variant="outline">
                <GoogleIcon />
                <span className="ml-2">Continue with Google</span>
              </Button>
            </a>

            <div className="space-y-2">
              {[
                'Connect multiple Google accounts',
                'Select any two calendars to compare',
                'Receive automated weekly email reports',
              ].map((feature) => (
                <div key={feature} className="flex items-center gap-2 text-sm text-gray-600">
                  <svg className="w-4 h-4 text-green-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                  </svg>
                  {feature}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Footer badges */}
        <div className="flex justify-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-xs">Read-only calendar access</Badge>
          <Badge variant="secondary" className="text-xs">Tokens stored server-side</Badge>
          <Badge variant="secondary" className="text-xs">No write permissions</Badge>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
