import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isSupabaseConfigured } from '@/lib/supabase/env'

/**
 * Magic-link handoff must set session cookies on the same NextResponse as the redirect.
 * Using `cookies().set()` from `next/headers` in a Route Handler often fails silently
 * (see try/catch in `lib/supabase/server.ts`), so the session never reaches the browser.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const nextRaw = searchParams.get('next') ?? '/boss'
  const next = nextRaw.startsWith('/') ? nextRaw : `/${nextRaw}`

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(`${origin}/login?error=config`)
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth`)
  }

  const redirectUrl = `${origin}${next}`
  const response = NextResponse.redirect(redirectUrl)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    console.error('[auth/callback] exchangeCodeForSession:', error.message)
    return NextResponse.redirect(`${origin}/login?error=auth`)
  }

  return response
}
