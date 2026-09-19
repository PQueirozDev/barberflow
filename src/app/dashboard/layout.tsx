import { requireTenant } from '@/lib/auth';
import { DashboardShell } from '@/components/dashboard/shell';
import { effectivePlan } from '@/services/billing';
export default async function DashboardLayout({children}:{children:React.ReactNode}){const{db,user,shop}=await requireTenant();const[{data:profile},{data:sub}]=await Promise.all([db.from('profiles').select('name,role').eq('id',user.id).single(),db.from('subscriptions').select('*').eq('barbershop_id',shop.id).single()]);return <DashboardShell shop={shop} name={profile?.name||'Minha conta'} plan={effectivePlan(sub)} admin={profile?.role==='ADMIN'}>{children}</DashboardShell>;}
