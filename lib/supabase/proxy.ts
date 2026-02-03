import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

export async function updateSession(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // IMPORTANT: Avoid writing any logic between createServerClient and
    // supabase.auth.getUser(). A simple mistake can make it very hard to debug
    // issues with users being randomly logged out.

    const {
        data: { user },
    } = await supabase.auth.getUser()

    // --- LOGIQUE DE REDIRECTION ---
    const url = request.nextUrl.clone()
    const isPublicRoute =
        url.pathname === '/login' ||
        url.pathname === '/auth/callback' ||
        url.pathname === '/preview'

    if (!user && !isPublicRoute) {
        // Rediriger vers login si non authentifié sur une route protégée
        const loginUrl = new URL('/login', request.url)
        return NextResponse.redirect(loginUrl)
    }

    if (user && url.pathname === '/login') {
        // Rediriger vers l'accueil si déjà authentifié sur la page login
        const homeUrl = new URL('/', request.url)
        return NextResponse.redirect(homeUrl)
    }

    return response
}
