'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireOwner,requireAdmin } from '@/lib/auth';
import { getPixConfig } from '@/lib/pix-config';
import { errorMessage } from '@/lib/validation';
import type { ActionResult } from '@/types/domain';
const id=z.string().uuid();

export async function requestPixPayment():Promise<ActionResult>{
 const {db,shop}=await requireOwner();const config=getPixConfig();
 if(!config)return{error:'O Pix ainda não está configurado. Entre em contato com o responsável pela plataforma.'};
 try{const{data,error}=await db.rpc('request_pix_invoice',{p_shop:shop.id,p_destination_hash:config.hash});if(error)throw error;
 return{redirect:`/dashboard/pagamento?id=${id.parse(data)}`};}catch(error){return{error:errorMessage(error)};}
}
export async function reportPixPayment(form:FormData):Promise<ActionResult>{
 const {db}=await requireOwner();try{const{error}=await db.rpc('report_pix_payment',{p_invoice:id.parse(form.get('id'))});if(error)throw error;
 revalidatePath('/dashboard/pagamento');return{success:'Aviso enviado. Seu acesso será liberado após a conferência do recebimento no banco.'};}catch(error){return{error:errorMessage(error)};}
}
export async function confirmPixPayment(form:FormData):Promise<ActionResult>{
 const {db}=await requireAdmin();try{
 if(form.get('checked_bank')!=='on')return{error:'Confira o recebimento no extrato bancário antes de confirmar.'};
 const amount=z.string().regex(/^49[,.]90$/,'O valor recebido deve ser R$ 49,90.').parse(form.get('amount'));
 const{error}=await db.rpc('confirm_pix_payment',{p_invoice:id.parse(form.get('id')),p_bank_reference:z.string().trim().regex(/^E[a-zA-Z0-9]{31}$/,'Informe o identificador EndToEnd do Pix (32 caracteres).').parse(form.get('bank_reference')),p_received_cents:Math.round(Number(amount.replace(',','.'))*100)});if(error)throw error;
 revalidatePath('/admin/pix');revalidatePath('/dashboard');return{success:'Recebimento confirmado. Foram adicionados 30 dias ao acesso.'};
 }catch(error){return{error:errorMessage(error)};}
}
export async function rejectPixPayment(form:FormData):Promise<ActionResult>{
 const {db}=await requireAdmin();try{const{error}=await db.rpc('reject_pix_payment',{p_invoice:id.parse(form.get('id')),p_reason:z.string().trim().min(5).max(200).parse(form.get('reason'))});if(error)throw error;
 revalidatePath('/admin/pix');revalidatePath('/dashboard/pagamento');return{success:'Solicitação recusada.'};}catch(error){return{error:errorMessage(error)};}
}
