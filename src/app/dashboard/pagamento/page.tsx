import Link from 'next/link';
import Image from 'next/image';
import QRCode from 'qrcode';
import { z } from 'zod';
import { requireOwner } from '@/lib/auth';
import { getPixConfig } from '@/lib/pix-config';
import { createPixPayload } from '@/lib/pix';
import { PageHeader } from '@/components/ui';
import { PixCopy } from '@/components/pix-copy';
import { ActionForm } from '@/components/action-form';
import { requestPixPayment,reportPixPayment } from '@/services/pix-actions';
export default async function Payment({searchParams}:{searchParams:Promise<{id?:string}>}){
 const {db,shop}=await requireOwner();const config=getPixConfig();const params=await searchParams;
 const parsed=z.string().uuid().safeParse(params.id);
 const {data:invoice,error}=parsed.success?await db.from('pix_invoices').select('id,txid,destination_hash,status,amount_cents,access_ends_at,rejection_reason').eq('id',parsed.data).eq('barbershop_id',shop.id).maybeSingle():{data:null,error:null};
 if(error)throw new Error('Não foi possível carregar a solicitação Pix. Verifique a migração do banco.');
 const payable=config&&invoice&&['PENDING','REPORTED'].includes(invoice.status)&&invoice.destination_hash===config.hash;
 const payload=payable?createPixPayload(config,invoice.txid):null;
 const qr=payload?await QRCode.toDataURL(payload,{width:280,margin:4,errorCorrectionLevel:'M'}):null;
 return <><PageHeader eyebrow="ZEKRO PRO" title="Pague com Pix direto" description="R$ 49,90 por 30 dias de acesso. Sem renovação automática."/>
 <section className="card p-6 max-w-2xl space-y-6"><p className="notice">O Pix vai diretamente para a conta do responsável pela plataforma. A liberação é manual, depois da conferência no banco. Não pague novamente se já fez a transferência.</p>
 {!config?<p role="status">O Pix ainda não está configurado. Entre em contato com o responsável antes de efetuar qualquer pagamento.</p>:!invoice?<ActionForm action={requestPixPayment} label="Gerar instruções de Pix"><p className="text-sm muted">Ao continuar, você solicita instruções para contratar 30 dias de Zekro Pro por R$ 49,90. Confira os <Link className="underline" href="/termos">Termos de Uso</Link> e a <Link className="underline" href="/privacidade">Política de Privacidade</Link>.</p></ActionForm>:<>
 <p className="text-sm">Referência: <strong className="break-all">{invoice.txid}</strong></p>
 {invoice.status==='CONFIRMED'?<p className="notice success" role="status">Pagamento confirmado. Acesso até {new Date(invoice.access_ends_at).toLocaleDateString('pt-BR')}.</p>:invoice.status==='REJECTED'?<><p className="notice error" role="status">Solicitação recusada: {invoice.rejection_reason}</p><p className="text-xs muted">Se houve débito na sua conta, contate o suporte antes de pagar novamente.</p></>:payable&&payload&&qr?<>
 <div className="flex flex-wrap items-center gap-6"><Image unoptimized src={qr} width={240} height={240} alt="QR Code para pagamento direto por Pix de R$ 49,90"/><div className="text-sm space-y-2"><p>Valor: <strong>R$ 49,90</strong></p><p>Recebedor informado: <strong>{config.name}</strong></p><p className="muted max-w-xs">Confira no banco o titular real da chave e o valor antes de transferir.</p></div></div>
 <PixCopy payload={payload}/>
 {invoice.status==='REPORTED'?<p className="notice" role="status">Seu aviso foi enviado. Aguarde a conferência manual. Avisar o pagamento não libera acesso automaticamente.</p>:<ActionForm action={reportPixPayment} label="Já fiz o Pix — solicitar conferência"><input type="hidden" name="id" value={invoice.id}/><p className="text-xs muted">Use este botão somente depois de concluir o pagamento no banco. Não é necessário enviar documentos ou comprovantes nesta página.</p></ActionForm>}
 </>:<><p className="notice">As instruções de recebimento mudaram. Se já fez o Pix, procure o suporte antes de gerar outra solicitação.</p><ActionForm action={requestPixPayment} label="Obter instruções atualizadas"><p className="text-xs muted">O novo código utilizará o recebedor atualmente configurado.</p></ActionForm></>}
 </>}
 <p className="text-xs muted">Cada pagamento confirmado acrescenta 30 dias ao prazo vigente. O teste de 7 dias é preservado. Para renovar, faça um novo Pix depois de conferir o prazo do seu acesso.</p><Link className="text-xs underline" href="/contato">Contato e suporte</Link>
 </section><Link className="btn btn-outline mt-6" href="/dashboard/configuracoes#plano">Voltar às configurações</Link></>;
}
