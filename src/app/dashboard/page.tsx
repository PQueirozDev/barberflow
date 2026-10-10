import Link from 'next/link';
import { requireTenant } from '@/lib/auth';
import { getAnalytics } from '@/services/product-queries';
import { reportPeriod } from '@/lib/report-period';
import { PeriodFilter,Summary } from '@/components/dashboard/summary';
import { PageHeader } from '@/components/ui';
export default async function Dashboard({searchParams}:{searchParams:Promise<{from?:string;to?:string}>}){
 const ctx=await requireTenant(),period=reportPeriod(await searchParams,ctx.shop.timezone);
 const summary=await getAnalytics(ctx,period.from,period.to);
 return <><PageHeader eyebrow={ctx.shop.name} title="Seu negócio, de perto." description="Agenda, clientes e recebimentos em uma visão clara."><Link className="btn btn-dark" href="/dashboard/agendamentos?novo=1">Novo agendamento</Link></PageHeader><div className="flex flex-wrap gap-3 mb-6"><Link className="btn btn-outline" href="/dashboard/agenda">Abrir agenda</Link><Link className="btn btn-outline" href="/dashboard/financeiro">Registrar recebimento</Link><Link className="btn btn-outline" href="/dashboard/espera">Ver lista de espera</Link></div><PeriodFilter {...period}/><Summary value={summary} dashboard/></>;
}
