import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
export async function middleware(request: NextRequest) {
 let response=NextResponse.next({request}); const url=process.env.NEXT_PUBLIC_SUPABASE_URL; const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key) return response;
 const db=createServerClient(url,key,{cookies:{getAll:()=>request.cookies.getAll(),setAll(values){values.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});values.forEach(({name,value,options})=>response.cookies.set(name,value,options));}}});
 const {data:{user}}=await db.auth.getUser();
 if(!user&&/^\/(dashboard|onboarding|admin)(\/|$)/.test(request.nextUrl.pathname)){const target=request.nextUrl.clone();target.pathname='/login';target.search='';const redirect=NextResponse.redirect(target);response.cookies.getAll().forEach(c=>redirect.cookies.set(c));return redirect;}
 return response;
}
export const config={matcher:['/dashboard/:path*','/onboarding/:path*','/admin/:path*','/auth/:path*','/redefinir-senha']};
