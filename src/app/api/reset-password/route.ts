import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabase } from '@/lib/supabase/server';
import { checkOrigin,rateLimit } from '@/lib/http';
import { passwordSchema,publicError,readPublicJson } from '@/lib/api-security';
export async function POST(request:Request){try{
 checkOrigin(request);
 if(!await rateLimit(request,'reset-password',10,900))return NextResponse.json({error:'Muitas tentativas. Aguarde 15 minutos.'},{status:429});
 const input=z.object({password:passwordSchema}).parse(await readPublicJson(request));
 const db=await createSupabase();const{data:{user},error:authError}=await db.auth.getUser();
 if(authError||!user)return NextResponse.json({error:'Sessão expirada. Solicite um novo link.'},{status:401});
 const{error}=await db.auth.updateUser(input);
 if(error)return NextResponse.json({error:'Link expirado ou senha inválida. Solicite um novo link.'},{status:400});
 // Refresh sessions are revoked; access JWTs expire according to Auth configuration.
 const{error:logoutError}=await db.auth.signOut({scope:'global'});
 if(logoutError)return NextResponse.json({error:'Senha atualizada. Saia das sessões abertas e entre novamente.'},{status:503});
 return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return NextResponse.json({error:publicError(error)},{status:400});}}
