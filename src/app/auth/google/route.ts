import { NextResponse } from 'next/server';
import { configured,createSupabase } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/http';

export async function GET(request:Request){
 const origin=new URL(process.env.NEXT_PUBLIC_APP_URL||request.url).origin;
 const fail=()=>NextResponse.redirect(new URL('/login?error=google',origin));
 try{
  if(!configured())return fail();
  if(!await rateLimit(request,'google-login',10,600))return NextResponse.redirect(new URL('/login?error=rate',origin));
  const db=await createSupabase();
  const {data,error}=await db.auth.signInWithOAuth({provider:'google',options:{redirectTo:`${origin}/auth/callback`,skipBrowserRedirect:true,scopes:'openid email profile'}});
  if(error||!data.url)return fail();
  const target=new URL(data.url);const supabaseOrigin=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin;
  if(target.origin!==supabaseOrigin||target.pathname!=='/auth/v1/authorize')return fail();
  return NextResponse.redirect(target,{headers:{'Cache-Control':'no-store'}});
 }catch{return fail();}
}
