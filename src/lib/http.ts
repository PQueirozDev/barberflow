import 'server-only';
import { createHash } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/admin';
import { assertOrigin } from '@/lib/api-security';
export function checkOrigin(request:Request){assertOrigin(request,process.env.NEXT_PUBLIC_APP_URL);}
export async function rateLimit(request:Request,scope:string,limit:number,seconds:number){
 // Vercel substitui este header; em self-hosting configure um proxy confiável.
 const ip=process.env.VERCEL?request.headers.get('x-vercel-forwarded-for')?.split(',')[0]||'unknown':'local';
 return rateLimitIdentity(scope,ip,limit,seconds);
}
export async function rateLimitIdentity(scope:string,identity:string,limit:number,seconds:number){const key=createHash('sha256').update(`${scope}:${identity}`).digest('hex');const{data,error}=await createServiceClient().rpc('consume_rate_limit',{p_key:key,p_limit:limit,p_seconds:seconds});if(error)throw new Error('Serviço temporariamente indisponível.');return data===true;}
