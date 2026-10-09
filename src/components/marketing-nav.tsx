'use client';

import Link from 'next/link';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Logo } from '@/components/ui';

export function MarketingNav() {
  const [open, setOpen] = useState(false);
  return <header className="site-header"><nav className="marketing-nav" aria-label="Navegação principal">
    <Logo/>
    <div className="desktop-navigation"><a href="#recursos">Recursos</a><a href="#como-funciona">Como funciona</a><a href="#planos">Preço</a></div>
    <div className="nav-actions"><Link href="/login" className="nav-login">Entrar</Link><Link href="/cadastro" className="btn btn-lime nav-trial">Testar por 7 dias<ArrowUpRight size={16}/></Link><button className="nav-toggle" aria-label={open ? 'Fechar navegação' : 'Abrir navegação'} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(!open)}>{open ? <X size={22}/> : <Menu size={22}/>}</button></div>
  </nav>{open && <nav id="mobile-navigation" className="mobile-navigation" aria-label="Navegação do celular" onKeyDown={event => { if (event.key === 'Escape') setOpen(false); }}><a href="#recursos" onClick={() => setOpen(false)}>Recursos</a><a href="#como-funciona" onClick={() => setOpen(false)}>Como funciona</a><a href="#planos" onClick={() => setOpen(false)}>Preço</a><Link href="/login">Entrar na minha conta</Link><Link href="/cadastro" className="btn btn-lime">Testar por 7 dias<ArrowUpRight size={16}/></Link></nav>}</header>;
}
