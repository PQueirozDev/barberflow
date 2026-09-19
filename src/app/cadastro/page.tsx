import { AuthForm } from '@/components/auth-form';
import { AuthShell } from '@/components/auth-shell';
import { configured } from '@/lib/supabase/server';
export default function Cadastro(){return <AuthShell title="Seu negócio, em outro nível." description="Crie sua conta grátis. Sua página começa aqui." register><AuthForm mode="register" ready={configured()}/></AuthShell>;}
