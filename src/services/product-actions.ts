'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireOwner,requireTenant } from '@/lib/auth';
import { customerSchema,errorMessage } from '@/lib/validation';
import type { ActionResult } from '@/types/domain';
const uuid=z.string().uuid();
function refresh(){revalidatePath('/dashboard','layout');}
export async function recordPayment(form:FormData):Promise<ActionResult>{
 const{db}=await requireTenant();try{
  if(form.get('received')!=='on')return{error:'Confirme que o valor foi recebido pela barbearia.'};
  const{error}=await db.rpc('record_service_payment',{p_appointment:uuid.parse(form.get('appointment_id')),p_method:z.enum(['CASH','PIX','CARD']).parse(form.get('method')),p_paid_at:new Date().toISOString()});
  if(error)throw error;refresh();return{success:'Recebimento registrado no financeiro da barbearia.'};
 }catch(error){return{error:errorMessage(error)};}
}
export async function voidPayment(form:FormData):Promise<ActionResult>{const{db}=await requireOwner();try{const{error}=await db.rpc('void_service_payment',{p_payment:uuid.parse(form.get('id')),p_reason:z.string().trim().min(5).max(200).parse(form.get('reason'))});if(error)throw error;refresh();return{success:'Registro anulado. O histórico foi preservado. Nenhum dinheiro foi transferido.'};}catch(error){return{error:errorMessage(error)};}}
export async function createCustomer(form:FormData):Promise<ActionResult>{const{db,shop}=await requireTenant();try{const{error}=await db.rpc('create_customer',{p_shop:shop.id,p_data:customerSchema.parse(Object.fromEntries(form))});if(error)throw error;refresh();return{success:'Cliente cadastrado.'};}catch(error){return{error:errorMessage(error)};}}
export async function setWaitlist(form:FormData):Promise<ActionResult>{const{db,shop}=await requireOwner();try{const{error}=await db.rpc('set_waitlist_enabled',{p_shop:shop.id,p_enabled:form.get('enabled')==='on'});if(error)throw error;refresh();revalidatePath(`/${shop.slug}`);return{success:'Preferência da lista de espera atualizada.'};}catch(error){return{error:errorMessage(error)};}}
export async function updateWaitlist(form:FormData):Promise<ActionResult>{const{db}=await requireTenant();try{const{error}=await db.rpc('close_waitlist',{p_id:uuid.parse(form.get('id')),p_status:z.enum(['CONTACTED','CLOSED']).parse(form.get('status'))});if(error)throw error;refresh();return{success:'Lista de espera atualizada. Nenhuma reserva foi criada.'};}catch(error){return{error:errorMessage(error)};}}
export async function configureLoyalty(form:FormData):Promise<ActionResult>{const{db,shop}=await requireOwner();try{const{error}=await db.rpc('configure_loyalty',{p_shop:shop.id,p_enabled:form.get('enabled')==='on',p_visits:z.coerce.number().int().min(2).max(100).parse(form.get('visits')),p_reward:z.string().trim().min(2).max(200).parse(form.get('reward'))});if(error)throw error;refresh();return{success:'Programa de fidelidade atualizado.'};}catch(error){return{error:errorMessage(error)};}}
export async function redeemLoyalty(form:FormData):Promise<ActionResult>{const{db}=await requireTenant();try{const{error}=await db.rpc('redeem_loyalty',{p_program:uuid.parse(form.get('program_id')),p_customer:uuid.parse(form.get('customer_id')),p_cycle:z.coerce.number().int().positive().parse(form.get('cycle'))});if(error)throw error;refresh();return{success:'Entrega da recompensa registrada.'};}catch(error){return{error:errorMessage(error)};}}
