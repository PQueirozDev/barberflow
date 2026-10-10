import Link from 'next/link';
import { requireTenant } from '@/lib/auth';
import { pageNumber } from '@/lib/report-period';
import { PageHeader } from '@/components/ui';
import { CustomerCreate } from '@/components/dashboard/customer-create';
import type { CustomerSummary } from '@/types/product';
import { day,money } from '@/utils/format';
export default async function Customers({searchParams}:{searchParams:Promise<{q?:string;page?:string}>}){
 const ctx=await requireTenant(),params=await searchParams,page=pageNumber(params.page),search=(params.q||'').slice(0,120);
 const{data,error}=await ctx.db.rpc('customer_directory',{p_shop:ctx.shop.id,p_search:search,p_page:page});if(error)throw new Error('Não foi possível carregar clientes.');
 const result=data as {total:number;items:CustomerSummary[]};
 return <><PageHeader title="Clientes" description="Histórico, frequência e preferências de quem visita sua barbearia."><CustomerCreate/></PageHeader><form className="filters"><input type="search" aria-label="Buscar clientes" placeholder="Nome ou telefone" name="q" defaultValue={search} maxLength={120}/><button className="btn btn-outline">Buscar</button></form><p className="text-sm muted mb-4">{result.total} clientes · Página {page}</p><section className="card table-scroll"><table><thead><tr><th>Cliente</th><th>Visitas concluídas</th><th>Último atendimento</th><th>Serviço favorito</th><th>Recebimentos registrados</th></tr></thead><tbody>{result.items.map(c=><tr key={c.id}><td><Link className="underline" href={`/dashboard/clientes/${c.id}`}>{c.name}</Link><p className="muted">{c.phone}</p></td><td>{c.visits}{c.visits>1?' · Recorrente':''}</td><td>{c.last_visit?day(c.last_visit,ctx.shop.timezone):'—'}</td><td>{c.favorite||'—'}</td><td>{money(c.received)}</td></tr>)}</tbody></table>{!result.items.length&&<p className="p-6 muted">Nenhum cliente encontrado.</p>}</section><nav aria-label="Páginas de clientes" className="flex gap-3 mt-5">{page>1&&<Link className="btn btn-outline" href={`?q=${encodeURIComponent(search)}&page=${page-1}`}>Anterior</Link>}{page*50<result.total&&<Link className="btn btn-outline" href={`?q=${encodeURIComponent(search)}&page=${page+1}`}>Próxima</Link>}</nav></>;
}
