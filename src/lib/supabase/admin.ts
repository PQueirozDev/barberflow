import 'server-only';
import { createClient } from '@supabase/supabase-js';
export function createServiceClient(){if(!process.env.SUPABASE_SERVICE_ROLE_KEY||!process.env.NEXT_PUBLIC_SUPABASE_URL)throw new Error('Reservas indisponíveis: configure o servidor Supabase.');return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});}
