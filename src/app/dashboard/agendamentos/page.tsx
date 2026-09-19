import { tenantData,getAppointments } from '@/services/queries';
import { AppointmentManager } from '@/components/dashboard/appointment-manager';
export default async function Appointments({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){const ctx=await tenantData();const[appointments,params]=await Promise.all([getAppointments(ctx),searchParams]);return <AppointmentManager appointments={appointments} data={{shop:ctx.shop,services:ctx.services,barbers:ctx.barbers,barber_services:ctx.links,hours:ctx.hours}} initialNew={params.novo==='1'} initialId={params.id}/>;}
