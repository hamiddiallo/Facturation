import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

function expireSupabaseCookies(request: NextRequest, response: NextResponse) {
    request.cookies
        .getAll()
        .filter((cookie) => cookie.name.startsWith('sb-'))
        .forEach((cookie) => {
            response.cookies.set(cookie.name, '', {
                maxAge: 0,
                expires: new Date(0),
                path: '/'
            });
        });
}

async function handleLogout(request: NextRequest) {
    const redirectTo = request.nextUrl.clone();
    redirectTo.pathname = '/login';
    redirectTo.search = '?logged_out=1';
    redirectTo.hash = '';
    const response = NextResponse.redirect(redirectTo, 303);

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        response.cookies.set(name, value, options);
                    });
                },
            },
        }
    );

    // Best effort: invalidates refresh token server-side.
    try {
        await supabase.auth.signOut();
    } catch {
        // Even if remote signout fails, we still clear local cookies below.
    }

    expireSupabaseCookies(request, response);

    return response;
}

export async function GET(request: NextRequest) {
    return handleLogout(request);
}

export async function POST(request: NextRequest) {
    const response = NextResponse.json({ ok: true });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        response.cookies.set(name, value, options);
                    });
                },
            },
        }
    );

    try {
        await supabase.auth.signOut();
    } catch {
        // ignore
    }

    expireSupabaseCookies(request, response);
    return response;
}
