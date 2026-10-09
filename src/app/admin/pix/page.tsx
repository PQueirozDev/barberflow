import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { PageHeader,Field } from '@/components/ui';
import { ActionForm } from '@/components/action-form';
import { confirmPixPayment,rejectPixPayment } from '@/services/pix-actions';
export default async function PixAdmin(){
 const {db}=await requireAdmin();const{data:invoices,error}=await db.from('pix_invoices').select('id,txid,status,amount_cents,created_at,barbershops(name)').in('status',['PENDING','REPORTED']).order('created_at').limit(50);
 if(error)throw new Error('Não foi possível carregar a fila de Pix. Verifique a migração do banco.');
 return <main className="max-w-4xl mx-auto px-6 py-8"><Link className="text-xs underline" href="/admin">← Administração</Link><PageHeader eyebrow="PIX DIRETO" title="Conferência de pagamentos" description="Confira cada recebimento no extrato bancário antes de liberar acesso. Um aviso ou comprovante não confirma o crédito."/>
 <p className="notice mb-6">Até 50 solicitações abertas, da mais antiga para a mais recente. Compare valor, recebedor e referência da transferência. Registre o identificador EndToEnd do crédito recebido; ele não pode ser usado duas vezes.</p>
 <div className="space-y-6">{!invoices?.length&&<p className="card p-6">Nenhuma solicitação aguardando conferência.</p>}{invoices?.map(invoice=><section className="card p-6" key={invoice.id}><h2 className="section-title">{(invoice.barbershops as unknown as {name:string}|null)?.name||'Barbearia'}</h2><p className="text-xs muted mt-3 break-all">Referência: {invoice.txid} · {invoice.status==='REPORTED'?'Cliente informou pagamento':'Aguardando pagamento'} · {new Date(invoice.created_at).toLocaleString('pt-BR')}</p>
 <div className="grid md:grid-cols-2 gap-6 mt-6"><ActionForm action={confirmPixPayment} label="Confirmar recebimento e liberar 30 dias"><input type="hidden" name="id" value={invoice.id}/><Field label="Valor creditado (R$)"><input name="amount" inputMode="decimal" placeholder="Digite o valor recebido" required pattern="49[,.]90"/></Field><Field label="Identificador EndToEnd do Pix"><input name="bank_reference" required minLength={32} maxLength={32} placeholder="E… (32 caracteres)" autoComplete="off"/></Field><label className="flex gap-2 text-xs items-start"><input type="checkbox" name="checked_bank" required/>Conferi este crédito no extrato da conta recebedora.</label></ActionForm>
 <ActionForm action={rejectPixPayment} label="Recusar solicitação"><input type="hidden" name="id" value={invoice.id}/><Field label="Motivo da recusa (visível ao responsável)"><textarea name="reason" required minLength={5} maxLength={200}/></Field></ActionForm></div></section>)}</div></main>;
}
