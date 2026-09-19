import { requireTenant } from '@/lib/auth';
import { getAppointments,getCustomers } from '@/services/queries';
import { Reports } from '@/components/dashboard/reports';
export default async function ReportsPage(){const ctx=await requireTenant();const[appointments,customers]=await Promise.all([getAppointments(ctx),getCustomers(ctx)]);return <Reports appointments={appointments} customers={customers} timezone={ctx.shop.timezone}/>;}
