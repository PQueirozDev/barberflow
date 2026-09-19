import type { Status } from '@/types/domain';
export const money=(cents:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
export const time=(date:string,timezone='America/Sao_Paulo')=>new Intl.DateTimeFormat('pt-BR',{timeZone:timezone,hour:'2-digit',minute:'2-digit'}).format(new Date(date));
export const day=(date:string,timezone='America/Sao_Paulo')=>new Intl.DateTimeFormat('pt-BR',{timeZone:timezone,day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(date));
export const localDate=(date=new Date(),timezone='America/Sao_Paulo')=>new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
export const addDays=(date:string,count:number)=>{const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+count);return d.toISOString().slice(0,10);};
export const statusLabels:Record<Status,string>={CONFIRMED:'Confirmado',PENDING:'Pendente',COMPLETED:'Concluído',CANCELLED:'Cancelado',NO_SHOW:'Não compareceu'};
export const weekdays=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
export function whatsappLink(phone:string,message=''){const digits=phone.replace(/\D/g,'');return `https://wa.me/${digits.length<=11?'55':''}${digits}?text=${encodeURIComponent(message)}`;}
export function instagramLink(value:string){const handle=value.replace(/^https?:\/\/(www\.)?instagram\.com\//i,'').replace(/^@/,'').split(/[/?#]/)[0];return `https://www.instagram.com/${encodeURIComponent(handle)}`;}
