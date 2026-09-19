import { NextResponse } from 'next/server';
import { bookingSchema,errorMessage } from '@/lib/validation';
import { checkOrigin,rateLimit } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase/admin';
export async function POST(request:Request){try{checkOrigin(request);if(!await rateLimit(request,'booking',20,3600))return NextResponse.json({error:'Muitas tentativas. Tente mais tarde.'},{status:429});const v=bookingSchema.parse(await request.json());const{data,error}=await createServiceClient().rpc('book_appointment',{p_slug:v.slug,p_service:v.serviceId,p_barber:v.barberId,p_start:v.startsAt,p_name:v.name,p_phone:v.phone,p_whatsapp:v.whatsapp,p_email:v.email||null});if(error)return NextResponse.json({error:errorMessage(error)},{status:409});return NextResponse.json(data,{status:201,headers:{'Cache-Control':'no-store'}});}catch(error){return NextResponse.json({error:errorMessage(error)},{status:400});}}
