import { ActionForm } from '@/components/action-form';
import { Field } from '@/components/ui';
import { saveMemberRole } from '@/services/actions';
import type { MemberRole } from '@/lib/permissions';
export function MemberPermissions({members,currentUser}:{members:{user_id:string;role:MemberRole}[];currentUser:string}){
 return <section className="card p-6"><h2 className="section-title mb-4">Permissões da equipe</h2><p className="text-xs muted mb-5">OWNER gerencia equipe, configurações e preços. MANAGER gerencia agenda, clientes, serviços e horários. Os usuários abaixo já possuem acesso à barbearia.</p>{members.map(member=><ActionForm key={member.user_id} action={saveMemberRole} label="Atualizar permissão" className="mb-6"><input type="hidden" name="user_id" value={member.user_id}/><Field label={member.user_id===currentUser?'Sua conta':`Usuário ${member.user_id}`}><select name="role" defaultValue={member.role}><option value="OWNER">Proprietário (OWNER)</option><option value="MANAGER">Gerente (MANAGER)</option></select></Field></ActionForm>)}</section>;
}
