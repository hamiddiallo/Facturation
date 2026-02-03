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

    // --- OPTIMISATION PROXY ---
    // On vérifie d'abord si des cookies de session Supabase existent.
    // Si aucun cookie n'est présent et que c'est une route publique, on évite l'appel getUser.
    const url = request.nextUrl.clone()
    const isPublicRoute =
        url.pathname === '/login' ||
        url.pathname === '/auth/callback' ||
        url.pathname === '/preview'

    const hasSessionCookie = request.cookies.getAll().some(c => c.name.startsWith('sb-'));

    // Si pas de cookie et route publique, on continue sans appeler Supabase
    if (!hasSessionCookie && isPublicRoute) {
        return response
    }

    // IMPORTANT: Avoid writing any logic between createServerClient and
    // supabase.auth.getUser().
    const {
        data: { user },
    } = await supabase.auth.getUser()

    // --- LOGIQUE DE REDIRECTION ---
    if (!user && !isPublicRoute) {
        const loginUrl = new URL('/login', request.url)
        return NextResponse.redirect(loginUrl)
    }

    if (user && url.pathname === '/login') {
        const homeUrl = new URL('/', request.url)
        return NextResponse.redirect(homeUrl)
    }

    return response
}
