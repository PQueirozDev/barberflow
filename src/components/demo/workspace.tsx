'use client';
import Link from 'next/link';
import { useState } from 'react';
import { BarChart3, CalendarDays, ClipboardList, Globe, LayoutDashboard, Scissors, Settings, Sparkles, Users } from 'lucide-react';
import { Badge, Field, Logo, PageHeader, Stat } from '@/components/ui';
import { Modal } from '@/components/modal';
import { Reports } from '@/components/dashboard/reports';
import { PublicShopView } from '@/components/public-shop';
import { demoConflict, demoData } from './data';
import { day, localDate, money, time } from '@/utils/format';
import type { Appointment, Customer, Service } from '@/types/domain';

const sections=['Dashboard','Agenda','Agendamentos','Clientes','Profissionais','Serviços','Relatórios','Configurações','Página pública'] as const;
type Section=typeof sections[number];
const sectionIcons={Dashboard:LayoutDashboard,Agenda:CalendarDays,Agendamentos:ClipboardList,Clientes:Users,Profissionais:Scissors,'Serviços':Sparkles,'Relatórios':BarChart3,'Configurações':Settings,'Página pública':Globe} satisfies Record<Section,unknown>;
export function DemoWorkspace() {
 const [seed]=useState(()=>demoData(localDate()));
 const [data,setData]=useState(seed.data),[customers,setCustomers]=useState(seed.customers),[appointments,setAppointments]=useState(seed.appointments);
 const [section,setSection]=useState<Section>('Dashboard'),[modal,setModal]=useState<'appointment'|'customer'|'service'|null>(null);
 const [editing,setEditing]=useState<Appointment|null>(null),[message,setMessage]=useState(''),[error,setError]=useState('');
 const [date,setDate]=useState(localDate()),[selectedService,setSelectedService]=useState('');
 const today=localDate(),live=appointments.filter(a=>!['CANCELLED','NO_SHOW'].includes(a.status));
 function open(kind:typeof modal,a:Appointment|null=null){setEditing(a);setError('');setModal(kind);}
 function save(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();const form=new FormData(event.currentTarget);setError('');
  if(modal==='customer'){
   const name=String(form.get('name')).trim(); if(name.length<2){setError('Informe o nome.');return;}
   const customer:Customer={id:crypto.randomUUID(),name,phone:'',whatsapp:'',email:null,created_at:new Date().toISOString()};
   setCustomers([...customers,customer]);setMessage('Cliente fictício cadastrado.');
  } else if(modal==='service'){
   const price=Math.round(Number(form.get('price'))*100),minutes=Number(form.get('minutes')),name=String(form.get('name')).trim();
   if(name.length<2||!Number.isInteger(price)||price<0||price>10000000||!Number.isInteger(minutes)||minutes<5||minutes>480){setError('Confira nome, preço e duração.');return;}
   const service:Service={id:crypto.randomUUID(),barbershop_id:data.shop.id,name,description:'Serviço fictício',price_cents:price,duration_minutes:minutes,photo_url:null,active:true};
   setData({...data,services:[...data.services,service],barber_services:[...data.barber_services,...data.barbers.map(b=>({barber_id:b.id,service_id:service.id}))]});setMessage('Serviço fictício cadastrado.');
  } else {
   const customer=customers.find(c=>c.id===form.get('customer')),service=data.services.find(s=>s.id===form.get('service')),barber=data.barbers.find(b=>b.id===form.get('barber'));
   const starts_at=`${form.get('date')}T${form.get('hour')}:00-03:00`;
   if(!customer||!service||!barber||!Number.isFinite(Date.parse(starts_at))){setError('Preencha os dados do agendamento.');return;}
   const minutes=editing&&editing.service_id===service.id?(Date.parse(editing.ends_at)-Date.parse(editing.starts_at))/60000:service.duration_minutes;
   const hour=String(form.get('hour')),endHour=Number(hour.slice(0,2))*60+Number(hour.slice(3))+minutes;
   if(hour<'09:00'||endHour>18*60){setError('Escolha um horário entre 09:00 e 18:00, incluindo a duração.');return;}
   if(demoConflict(appointments,barber.id,starts_at,minutes,editing?.id)){setError('Este profissional já tem um agendamento nesse horário.');return;}
   const appointment:Appointment={id:editing?.id||crypto.randomUUID(),code:editing?.code||'DEMO',updated_at:new Date().toISOString(),starts_at,ends_at:new Date(Date.parse(starts_at)+minutes*60000).toISOString(),customer_id:customer.id,service_id:service.id,barber_id:barber.id,price_cents:editing&&editing.service_id===service.id?editing.price_cents:service.price_cents,status:'CONFIRMED',customers:customer,services:service,barbers:barber};
   setAppointments([...appointments.filter(a=>a.id!==appointment.id),appointment].sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at)));setMessage(editing?'Horário alterado na demonstração.':'Agendamento fictício criado.');
  }
  setModal(null);
 }
 const rows=section==='Agenda'?appointments.filter(a=>localDate(new Date(a.starts_at))===date):section==='Dashboard'?live.filter(a=>localDate(new Date(a.starts_at))===today):appointments;
 function table(){return <div className="table-scroll"><table><caption className="sr-only">Agendamentos fictícios</caption><thead><tr><th>Data / horário</th><th>Cliente / serviço</th><th>Profissional</th><th>Status</th><th>Ações</th></tr></thead><tbody>{rows.map(a=><tr key={a.id}><td>{day(a.starts_at)}<br/>{time(a.starts_at)}</td><td><strong>{a.customers.name}</strong><p>{a.services.name} · {money(a.price_cents)}</p></td><td>{a.barbers.name}</td><td><Badge status={a.status}/></td><td>{['CONFIRMED','PENDING'].includes(a.status)&&<div className="flex flex-wrap gap-3"><button className="btn-chip" onClick={()=>open('appointment',a)} aria-label={`Reagendar ${a.customers.name}`}>Reagendar</button><button className="btn-chip" aria-label={`Cancelar ${a.customers.name}`} onClick={()=>{setAppointments(appointments.map(x=>x.id===a.id?{...x,status:'CANCELLED'}:x));setMessage('Agendamento cancelado na demonstração.');}}>Cancelar</button></div>}</td></tr>)}</tbody></table>{!rows.length&&<p className="p-6 muted">Nenhum agendamento neste dia.</p>}</div>;}
 return <main className="demo-workspace"><header className="demo-banner"><Logo/><p>Demonstração ilustrativa e interativa · Dados fictícios</p><Link href="/cadastro" className="btn btn-dark">Criar minha barbearia</Link></header><div className="demo-body"><nav className="demo-nav" aria-label="Módulos da demonstração">{sections.map(s=><button key={s} aria-current={s===section?'page':undefined} onClick={()=>{setSection(s);setMessage('');}}>{(()=>{const Icon=sectionIcons[s];return <Icon size={17} aria-hidden="true"/>;})()}{s}</button>)}</nav><div className="demo-content">
 <p className="notice mb-6">Explore à vontade. As simulações ficam apenas nesta página e reiniciam ao recarregar. Use somente nomes fictícios.</p>
 {message&&<p role="status" className="notice success mb-5">{message}</p>}
 {section!=='Relatórios'&&section!=='Página pública'&&<PageHeader eyebrow="BARBER HOUSE · DEMONSTRAÇÃO" title={section} description="Experimente a organização da sua futura barbearia.">{['Dashboard','Agenda','Agendamentos'].includes(section)&&<button className="btn btn-dark" onClick={()=>{setSelectedService('');open('appointment');}}>Novo agendamento</button>}</PageHeader>}
 {section==='Dashboard'&&<><div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6"><Stat label="Agendamentos hoje" value={rows.length}/><Stat label="Clientes fictícios" value={customers.length}/><Stat label="Previsão de hoje" value={money(rows.reduce((sum,a)=>sum+a.price_cents,0))}/><Stat label="Recebimentos registrados" value={money(0)} detail="A demo não registra pagamentos reais"/></div><section className="card">{table()}</section></>}
 {section==='Agenda'&&<><Field label="Data da agenda"><input type="date" value={date} onChange={e=>e.target.value&&setDate(e.target.value)}/></Field><section className="card mt-5">{table()}</section></>}
 {section==='Agendamentos'&&<section className="card">{table()}</section>}
 {section==='Clientes'&&<><button className="btn btn-dark mb-5" onClick={()=>open('customer')}>Cadastrar cliente</button><div className="grid sm:grid-cols-2 gap-4">{customers.map(c=><article className="card p-6" key={c.id}><h2 className="section-title">{c.name}</h2><p className="muted mt-3">{appointments.filter(a=>a.customer_id===c.id&&a.status==='COMPLETED').length} atendimentos concluídos</p></article>)}</div></>}
 {section==='Serviços'&&<><button className="btn btn-dark mb-5" onClick={()=>open('service')}>Cadastrar serviço</button><div className="grid sm:grid-cols-2 gap-4">{data.services.map(s=><article className="card p-6" key={s.id}><h2 className="section-title">{s.name}</h2><p className="muted mt-3">{money(s.price_cents)} · {s.duration_minutes} minutos</p></article>)}</div></>}
 {section==='Profissionais'&&<div className="grid sm:grid-cols-2 gap-4">{data.barbers.map(b=><article className="card p-6" key={b.id}><h2 className="section-title">{b.name}</h2><p className="muted mt-3">{b.specialties} · 09:00–18:00</p><p className="mt-3">{appointments.filter(a=>a.barber_id===b.id&&a.status==='COMPLETED').length} atendimentos concluídos</p></article>)}</div>}
 {section==='Relatórios'&&<Reports appointments={appointments} customers={customers} timezone={data.shop.timezone}/>}
 {section==='Configurações'&&<section className="card p-6 form-stack"><Field label="Nome da barbearia na demonstração"><input maxLength={120} value={data.shop.name} onChange={e=>setData({...data,shop:{...data.shop,name:e.target.value}})}/></Field><Field label="Cor da página"><input type="color" value={data.shop.primary_color} onChange={e=>setData({...data,shop:{...data.shop,primary_color:e.target.value}})}/></Field><button className="btn btn-outline self-start" onClick={()=>setSection('Página pública')}>Visualizar página</button><p className="notice">Zekro Pro · 7 dias de teste, depois R$ 49,90/mês via Pix com conferência administrativa.</p><button className="btn btn-outline self-start" onClick={()=>{setData(seed.data);setCustomers(seed.customers);setAppointments(seed.appointments);setMessage('Demonstração reiniciada.');}}>Reiniciar simulações</button></section>}
 {section==='Página pública'&&<PublicShopView data={data} onSelectService={id=>{setSelectedService(id);open('appointment');}}/>}
 </div></div>{modal&&<Modal title={modal==='customer'?'Cadastrar cliente fictício':modal==='service'?'Cadastrar serviço fictício':editing?'Reagendar atendimento fictício':'Criar agendamento fictício'} onClose={()=>setModal(null)}><form onSubmit={save} className="form-stack">{modal==='customer'||modal==='service'?<><Field label={modal==='customer'?'Nome do cliente':'Nome do serviço'}><input name="name" required minLength={2} maxLength={120}/></Field>{modal==='service'&&<div className="form-grid"><Field label="Preço (R$)"><input name="price" type="number" min="0" max="100000" step="0.01" required defaultValue="40"/></Field><Field label="Duração (minutos)"><input name="minutes" type="number" min="5" max="480" required defaultValue="30"/></Field></div>}</>:<><Field label="Cliente"><select name="customer" defaultValue={editing?.customer_id}>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field><Field label="Serviço"><select name="service" defaultValue={editing?.service_id||selectedService||data.services[0]?.id}>{data.services.map(s=><option key={s.id} value={s.id}>{s.name} · {money(s.price_cents)}</option>)}</select></Field><Field label="Profissional"><select name="barber" defaultValue={editing?.barber_id}>{data.barbers.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></Field><div className="form-grid"><Field label="Data"><input name="date" type="date" min={today} required defaultValue={editing?localDate(new Date(editing.starts_at)):today}/></Field><Field label="Horário"><input name="hour" type="time" min="09:00" max="17:55" step="300" defaultValue={editing?time(editing.starts_at):'11:00'} required/></Field></div><p className="notice">Simulação de horário local de São Paulo. Confira os dados antes de confirmar.</p></>}{error&&<p role="alert" className="notice error">{error}</p>}<button className="btn btn-dark">{modal==='appointment'?'Confirmar simulação':'Salvar simulação'}</button></form></Modal>}</main>;
}
