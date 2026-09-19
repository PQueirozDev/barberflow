import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { Logo,PageHeader } from '@/components/ui';
import { OnboardingForm } from '@/components/onboarding-form';
export default async function Onboarding(){const{db,user}=await requireUser();const{data}=await db.from('barbershop_members').select('id').eq('user_id',user.id).limit(1).maybeSingle();if(data)redirect('/dashboard');return <main className="onboarding"><Logo/><div className="mt-12"><PageHeader eyebrow="BEM-VINDO À BARBERFLOW" title="Vamos preparar sua barbearia." description="Quatro passos. Um novo jeito de cuidar do seu negócio."/></div><OnboardingForm/></main>;}
