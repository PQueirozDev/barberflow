import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabase } from '@/lib/supabase/server';
import { checkOrigin,rateLimit } from '@/lib/http';
import { errorMessage } from '@/lib/validation';
export async function POST(request:Request){try{checkOrigin(request);if(!await rateLimit(request,'login',15,900))return NextResponse.json({error:'Muitas tentativas. Aguarde 15 minutos.'},{status:429});const data=z.object({email:z.string().email(),password:z.string().min(1).max(128)}).parse(await request.json());const db=await createSupabase();const{error}=await db.auth.signInWithPassword(data);if(error)return NextResponse.json({error:'Email ou senha inválidos, ou email ainda não confirmado.'},{status:401});return NextResponse.json({ok:true});}catch(error){return NextResponse.json({error:errorMessage(error)},{status:400});}}
