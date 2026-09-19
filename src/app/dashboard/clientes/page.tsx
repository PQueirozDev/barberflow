import { requireTenant } from '@/lib/auth';
import { getCustomers,getAppointments } from '@/services/queries';
import { CustomerList } from '@/components/dashboard/customers';
export default async function Customers(){const ctx=await requireTenant();const[customers,appointments]=await Promise.all([getCustomers(ctx),getAppointments(ctx)]);return <CustomerList customers={customers} appointments={appointments} timezone={ctx.shop.timezone}/>;}
