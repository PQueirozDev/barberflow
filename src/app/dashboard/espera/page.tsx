import { requireTenant } from '@/lib/auth';
import { PageHeader } from '@/components/ui';
import { WaitlistManager } from '@/components/dashboard/waitlist-manager';
import type { WaitlistEntry } from '@/types/product';
export default async function WaitlistPage(){const ctx=await requireTenant();const{data,error}=await ctx.db.rpc('waitlist_opportunities',{p_shop:ctx.shop.id});if(error)throw new Error('Não foi possível carregar a lista de espera.');return <><PageHeader title="Lista de espera" description="Veja os interesses abertos e possíveis vagas. Uma oportunidade exige confirmação do cliente antes de criar a reserva."/><WaitlistManager entries={(data||[]) as WaitlistEntry[]}/></>;}
