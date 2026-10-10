import 'server-only';
import type { requireTenant } from '@/lib/auth';
import { appointmentDateRange } from '@/lib/date-range';
import type { AnalyticsSummary,Payment } from '@/types/product';
type Context=Awaited<ReturnType<typeof requireTenant>>;
export async function getAnalytics(ctx:Context,from:string,to:string){const{data,error}=await ctx.db.rpc('shop_analytics',{p_shop:ctx.shop.id,p_from:from,p_to:to});if(error)throw new Error('Não foi possível carregar os indicadores.');return data as AnalyticsSummary;}
export async function getPayments(ctx:Context,from:string,to:string,page=1,limit=50){const bounds=appointmentDateRange(from,to,ctx.shop.timezone);const{data,error,count}=await ctx.db.from('service_payments').select('id,appointment_id,amount_cents,method,paid_at,created_at,voided_at,void_reason,appointments(starts_at,customers(name),services(name),barbers(name))',{count:'exact'}).eq('barbershop_id',ctx.shop.id).gte('paid_at',bounds.from!).lt('paid_at',bounds.until!).order('paid_at',{ascending:false}).order('id').range((page-1)*limit,page*limit-1);if(error)throw new Error('Não foi possível carregar os recebimentos.');return{items:data as unknown as Payment[],count:count||0};}
