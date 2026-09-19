import { AuthForm } from '@/components/auth-form';
import { AuthShell } from '@/components/auth-shell';
import { requireUser } from '@/lib/auth';
export default async function Reset(){await requireUser();return <AuthShell title="Escolha sua nova senha." description="Use uma senha que você ainda não utiliza em outros sites."><AuthForm mode="reset" ready/></AuthShell>;}
