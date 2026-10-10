import type { Appointment, Customer, PublicShop, Service } from '@/types/domain';
import { addDays } from '@/utils/format';

export function demoData(today: string): {data: PublicShop; customers: Customer[]; appointments: Appointment[]} {
 const shop = {id:'demo-shop',name:'Barber House · Demo',slug:'barber-house-demo',phone:'',whatsapp:'',instagram:'',address:'Rua Exemplo, 100',city:'São Paulo',state:'SP',description:'Um espaço fictício para experimentar o dia a dia da sua barbearia.',logo_url:null,cover_url:null,primary_color:'#153d2e',timezone:'America/Sao_Paulo',booking_enabled:true,suspended:false,notifications_enabled:false,created_at:today+'T12:00:00Z'};
 const services: Service[] = [{id:'cut',barbershop_id:shop.id,name:'Corte clássico',description:'Corte e acabamento',price_cents:4000,duration_minutes:30,photo_url:null,active:true},{id:'combo',barbershop_id:shop.id,name:'Corte + barba',description:'Cuidado completo',price_cents:6500,duration_minutes:60,photo_url:null,active:true}];
 const barbers = ['João','Lucas'].map((name,i)=>({id:`barber-${i}`,barbershop_id:shop.id,name,photo_url:null,phone:'',email:'',specialties:'Corte e barba',description:'Profissional fictício',active:true}));
 const customers = ['Rafael Costa','Gustavo Silva','André Lima'].map((name,i)=>({id:`customer-${i}`,name,phone:'',whatsapp:'',email:null,created_at:addDays(today,-15)+'T12:00:00Z'}));
 const appointments: Appointment[] = Array.from({length:9},(_,i)=>{
  const service=services[i%2],barber=barbers[i%2],customer=customers[i%3];
  const starts_at=`${addDays(today,i<6?-3+Math.floor(i/2):0)}T${i===8?'16':i%2?'14':'09'}:00:00-03:00`;
  return {id:`appointment-${i}`,code:`DEMO-${i+1}`,updated_at:starts_at,barber_id:barber.id,service_id:service.id,customer_id:customer.id,starts_at,ends_at:new Date(Date.parse(starts_at)+service.duration_minutes*60000).toISOString(),price_cents:service.price_cents,status:i<6?'COMPLETED':'CONFIRMED',customers:customer,services:service,barbers:barber};
 });
 return {data:{shop,services,barbers,barber_services:barbers.flatMap(b=>services.map(s=>({barber_id:b.id,service_id:s.id}))),hours:Array.from({length:6},(_,i)=>({weekday:i+1,opens_at:'09:00',closes_at:'18:00'}))},customers,appointments};
}
export function demoConflict(appointments: Appointment[], barber: string, start: string, minutes: number, exclude?: string) {
 const time=Date.parse(start),end=time+minutes*60000;
 return appointments.some(a=>a.id!==exclude&&a.barber_id===barber&&!['CANCELLED','NO_SHOW'].includes(a.status)&&Date.parse(a.starts_at)<end&&Date.parse(a.ends_at)>time);
}
