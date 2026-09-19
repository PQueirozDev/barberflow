import type { BookingReceipt } from '@/types/domain';
import { day,time,whatsappLink } from '@/utils/format';
export function confirmationMessage(r:BookingReceipt){return `Olá ${r.customer}! Seu horário na ${r.shop} está confirmado.\n\nServiço: ${r.service}\nBarbeiro: ${r.barber}\nData: ${day(r.starts_at,r.timezone)}\nHorário: ${time(r.starts_at,r.timezone)}\n\nTe esperamos!`;}
export function confirmationLink(phone:string,receipt:BookingReceipt){return whatsappLink(phone,confirmationMessage(receipt));}
export interface NotificationProvider {sendConfirmation(receipt:BookingReceipt,recipient:string):Promise<{messageId:string}>;}
