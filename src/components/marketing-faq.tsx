import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

const questions = [
  ['Como funciona o teste?', 'Você tem sete dias para experimentar. Depois, o acesso para receber novas reservas depende de uma assinatura ativa de R$ 49,90 por 30 dias.'],
  ['Como faço o pagamento?', 'O proprietário gera as instruções Pix no painel. Após pagar, informa o pagamento; o acesso é liberado quando o administrador confere o recebimento. Não há cobrança automática.'],
  ['Meus clientes precisam criar uma conta?', 'Não. Seus clientes escolhem o serviço, o profissional e um horário disponível na página da sua barbearia.'],
  ['Posso usar no celular?', 'Sim. Você pode gerenciar a barbearia e seus clientes podem reservar pelo navegador do celular, sem instalar um aplicativo.'],
];

export function MarketingFaq() {
  return <section className="marketing-section launch-section" aria-labelledby="faq-title">
    <div className="faq-intro"><span className="feature-symbol"><ShieldCheck size={24}/></span><p className="eyebrow">SIMPLES DESDE O COMEÇO</p><h2 id="faq-title">Sua próxima agenda,<br/>sem complicação.</h2><p className="muted mt-5">Tudo o que você precisa saber antes de começar.</p><Link href="/cadastro" className="btn btn-dark mt-7">Testar por 7 dias<ArrowUpRight size={16}/></Link></div>
    <div className="faq-list">{questions.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div>
  </section>;
}
