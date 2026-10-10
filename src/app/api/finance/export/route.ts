import { requireTenant } from '@/lib/auth';
import { getPayments } from '@/services/product-queries';
import { reportPeriod } from '@/lib/report-period';
import { csv } from '@/lib/csv';
export async function GET(request:Request){const ctx=await requireTenant(),period=reportPeriod(Object.fromEntries(new URL(request.url).searchParams),ctx.shop.timezone);if(period.error)return new Response(period.error,{status:400});
 const first=await getPayments(ctx,period.from,period.to,1,1000);
 if(first.count>10000)return new Response('Selecione um período menor: limite de 10.000 registros por exportação.',{status:400});
 const items=[...first.items];for(let page=2;items.length<first.count;page++){const batch=await getPayments(ctx,period.from,period.to,page,1000);if(!batch.items.length)break;items.push(...batch.items);}
 return new Response(csv([['ID','Data recebimento (UTC)','Cliente','Serviço','Profissional','Forma','Valor R$','Situação','Motivo anulação'],...items.map(p=>[p.id,p.paid_at,p.appointments.customers.name,p.appointments.services.name,p.appointments.barbers.name,p.method,(p.amount_cents/100).toFixed(2).replace('.',','),p.voided_at?'ANULADO':'REGISTRADO',p.void_reason])]),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="zekro-recebimentos-${period.from}-${period.to}.csv"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
