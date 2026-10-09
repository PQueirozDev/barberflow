import { ActionForm } from '@/components/action-form';
import { Field } from '@/components/ui';
import { saveCustomer } from '@/services/actions';
import type { Customer } from '@/types/domain';
export function CustomerEditor({customer}:{customer:Customer}){
 return <section className="card p-6 mt-6"><h2 className="section-title mb-4">Dados do cliente</h2><p className="text-xs muted mb-5">Confirme os dados com o cliente antes de atualizar. Reservas públicas não alteram um cadastro existente.</p><ActionForm action={saveCustomer}><input type="hidden" name="id" value={customer.id}/><div className="form-grid"><Field label="Nome"><input name="name" required minLength={2} maxLength={120} defaultValue={customer.name}/></Field><Field label="Telefone com DDD"><input name="phone" type="tel" required maxLength={30} defaultValue={customer.phone}/></Field><Field label="WhatsApp com DDD"><input name="whatsapp" type="tel" required maxLength={30} defaultValue={customer.whatsapp}/></Field><Field label="Email (opcional)"><input name="email" type="email" maxLength={254} defaultValue={customer.email||''}/></Field></div></ActionForm></section>;
}
