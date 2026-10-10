import { requireTenant } from '@/lib/auth';
import { getAnalytics } from '@/services/product-queries';
import { reportPeriod } from '@/lib/report-period';
import { PeriodFilter,Summary } from '@/components/dashboard/summary';
import { PageHeader } from '@/components/ui';
export default async function ReportsPage({searchParams}:{searchParams:Promise<{from?:string;to?:string}>}){
 const ctx=await requireTenant(),period=reportPeriod(await searchParams,ctx.shop.timezone);
 return <><PageHeader title="Relatórios" description="Filtre até 366 dias. Valores de serviços e recebimentos são calculados separadamente."/><PeriodFilter {...period}/><Summary value={await getAnalytics(ctx,period.from,period.to)}/></>;
}
