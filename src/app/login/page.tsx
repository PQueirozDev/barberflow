import { AuthForm } from '@/components/auth-form';
import { AuthShell } from '@/components/auth-shell';
import { configured } from '@/lib/supabase/server';
export default async function Login({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){const params=await searchParams;return <AuthShell title="Bom ter você de volta." description="Entre e acompanhe o ritmo da sua barbearia.">{params.suspended&&<p className="notice error mt-5">Sua barbearia está suspensa. Entre em contato com o administrador da plataforma.</p>}{params.error&&<p className="notice error mt-5">Link inválido ou expirado. Solicite um novo email.</p>}<AuthForm mode="login" ready={configured()}/></AuthShell>;}
