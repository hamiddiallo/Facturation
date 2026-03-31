import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

function redirectOnRequestOrigin(request: NextRequest, pathname: string, search: string = ''): NextResponse {
    const target = request.nextUrl.clone()
    target.pathname = pathname
    target.search = search
    target.hash = ''
    return NextResponse.redirect(target)
}

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
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
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
        url.pathname === '/auth/logout' ||
        url.pathname === '/preview' ||
        url.pathname === '/manifest.json' ||
        url.pathname === '/robots.txt' ||
        url.pathname === '/sitemap.xml' ||
        url.pathname === '/apple-touch-icon.png' ||
        url.pathname === '/sw.js'

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

    if (user && url.pathname !== '/auth/logout') {
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('status, role')
            .eq('id', user.id)
            .maybeSingle()

        if (profileError || !profile || profile.status !== 'active') {
            console.warn(
                `[ProxyAuth] Inactive or missing profile detected. path=${url.pathname}, user=${user.id}, status=${profile?.status ?? 'unknown'}`
            )
            return redirectOnRequestOrigin(request, '/auth/logout', '?reason=inactive_profile')
        }
    }

    // --- LOGIQUE DE REDIRECTION ---
    if (!user && !isPublicRoute) {
        return redirectOnRequestOrigin(request, '/login')
    }

    const allowLoginScreen =
        url.searchParams.has('logged_out') ||
        url.searchParams.has('inactive') ||
        url.searchParams.has('force_login');

    if (user && url.pathname === '/login' && !allowLoginScreen) {
        return redirectOnRequestOrigin(request, '/')
    }

    return response
}
