import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabase } from '@/lib/supabase/server';
import { checkOrigin,rateLimit,rateLimitIdentity } from '@/lib/http';
import { emailSchema,publicError,readPublicJson } from '@/lib/api-security';
export async function POST(request:Request){try{
 checkOrigin(request);
 if(!await rateLimit(request,'recover',5,900))return NextResponse.json({error:'Muitas tentativas. Aguarde 15 minutos.'},{status:429});
 const input=z.object({email:emailSchema}).parse(await readPublicJson(request));
 if(!await rateLimitIdentity('recover-email',input.email.toLowerCase(),3,900))return NextResponse.json({error:'Muitas tentativas. Aguarde 15 minutos.'},{status:429});
 const db=await createSupabase();const origin=new URL(process.env.NEXT_PUBLIC_APP_URL||request.url).origin;
 // Same response for unknown accounts/provider errors: no account enumeration.
 await db.auth.resetPasswordForEmail(input.email,{redirectTo:`${origin}/auth/callback?next=/redefinir-senha`});
 return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return NextResponse.json({error:publicError(error)},{status:400});}}
