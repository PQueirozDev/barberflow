import 'server-only';
import { createHash } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/admin';
export function checkOrigin(request:Request){const origin=request.headers.get('origin');const expected=process.env.NEXT_PUBLIC_APP_URL||new URL(request.url).origin;if(!origin||origin!==new URL(expected).origin)throw new Error('Origem da solicitação inválida.');}
export async function rateLimit(request:Request,scope:string,limit:number,seconds:number){
 // Vercel substitui este header; em self-hosting configure um proxy confiável.
 const ip=process.env.VERCEL?request.headers.get('x-vercel-forwarded-for')?.split(',')[0]||'unknown':'local';
 const key=createHash('sha256').update(`${scope}:${ip}`).digest('hex');const{data,error}=await createServiceClient().rpc('consume_rate_limit',{p_key:key,p_limit:limit,p_seconds:seconds});if(error)throw new Error('Serviço temporariamente indisponível.');return data===true;
}
