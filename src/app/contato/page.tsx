import type { Metadata } from 'next';
import { z } from 'zod';
import { LegalLayout } from '@/components/legal-layout';
export const metadata:Metadata={title:'Contato e suporte'};
export default function Contact(){const email=z.string().email().safeParse(process.env.SUPPORT_EMAIL);const operator=process.env.PLATFORM_OPERATOR_NAME?.trim();return <LegalLayout title="Contato e suporte">
 <section><h2 className="section-title">Responsável pela plataforma</h2>{operator?<p>{operator}</p>:<p>A identificação do responsável ainda precisa ser configurada antes da abertura comercial do Zekro.</p>}</section>
 <section><h2 className="section-title">Atendimento</h2>{email.success?<p>Para dúvidas, conferência de Pix, cancelamento, reembolso ou privacidade: <a className="underline" href={`mailto:${email.data}`}>{email.data}</a>.</p>:<p>O email de atendimento ainda não está configurado. Confirme o contato do responsável pela plataforma antes de realizar um pagamento.</p>}<p>Informe apenas a referência da solicitação e uma descrição do problema. Nunca envie senhas, tokens, códigos de recuperação ou dados bancários de acesso.</p></section>
 <section><h2 className="section-title">Agendamentos e serviços</h2><p>Para remarcar, cancelar ou esclarecer um atendimento, procure diretamente a barbearia no contato exibido em sua página pública.</p></section>
 </LegalLayout>;}
