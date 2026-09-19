import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabase } from '@/lib/supabase/server';
import { checkOrigin,rateLimit } from '@/lib/http';
import { errorMessage } from '@/lib/validation';
export async function POST(request:Request){try{checkOrigin(request);if(!await rateLimit(request,'register',5,3600))return NextResponse.json({error:'Limite atingido. Tente mais tarde.'},{status:429});const input=z.object({name:z.string().trim().min(2).max(120),email:z.string().email(),password:z.string().min(10).max(128)}).parse(await request.json());const db=await createSupabase();const{data,error}=await db.auth.signUp({email:input.email,password:input.password,options:{data:{name:input.name},emailRedirectTo:`${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`}});if(error)return NextResponse.json({error:'Não foi possível criar sua conta. Verifique os dados ou recupere sua senha.'},{status:400});return NextResponse.json({session:Boolean(data.session)});}catch(error){return NextResponse.json({error:errorMessage(error)},{status:400});}}
