import { AuthForm } from '@/components/auth-form';
import { AuthShell } from '@/components/auth-shell';
import { configured } from '@/lib/supabase/server';
export default function Recover(){return <AuthShell title="Vamos recuperar seu acesso." description="Enviaremos as instruções para o seu email."><AuthForm mode="recover" ready={configured()}/></AuthShell>;}
