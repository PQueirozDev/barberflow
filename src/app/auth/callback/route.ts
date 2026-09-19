import { NextResponse } from 'next/server';
import { createSupabase } from '@/lib/supabase/server';
export async function GET(request:Request){const url=new URL(request.url);const code=url.searchParams.get('code');if(code){const db=await createSupabase();const{error}=await db.auth.exchangeCodeForSession(code);if(!error)return NextResponse.redirect(new URL(url.searchParams.get('next')==='/redefinir-senha'?'/redefinir-senha':'/dashboard',url.origin));}return NextResponse.redirect(new URL('/login?error=callback',url.origin));}
