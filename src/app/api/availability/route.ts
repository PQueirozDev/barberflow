import { NextResponse } from 'next/server';
import { createSupabase } from '@/lib/supabase/server';
import { availabilitySchema,publicError } from '@/lib/api-security';
import { rateLimit } from '@/lib/http';
export async function GET(request:Request){try{const v=availabilitySchema.parse(Object.fromEntries(new URL(request.url).searchParams));if(!await rateLimit(request,'availability',120,60))return NextResponse.json({error:'Muitas consultas. Aguarde um minuto.'},{status:429});const db=await createSupabase();const{data,error}=await db.rpc('available_slots',{p_slug:v.slug,p_service:v.serviceId,p_barber:v.barberId,p_date:v.date,p_exclude:v.exclude||null});if(error)throw error;return NextResponse.json(data,{headers:{'Cache-Control':'no-store'}});}catch(error){return NextResponse.json({error:publicError(error)},{status:400});}}
