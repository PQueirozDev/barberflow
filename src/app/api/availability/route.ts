import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabase } from '@/lib/supabase/server';
import { errorMessage,slugSchema } from '@/lib/validation';
export async function GET(request:Request){try{const v=z.object({slug:slugSchema,serviceId:z.string().uuid(),barberId:z.string().uuid(),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),exclude:z.string().uuid().optional()}).parse(Object.fromEntries(new URL(request.url).searchParams));const db=await createSupabase();const{data,error}=await db.rpc('available_slots',{p_slug:v.slug,p_service:v.serviceId,p_barber:v.barberId,p_date:v.date,p_exclude:v.exclude||null});if(error)throw error;return NextResponse.json(data,{headers:{'Cache-Control':'no-store'}});}catch(error){return NextResponse.json({error:errorMessage(error)},{status:400});}}
