import Link from 'next/link';
import { Logo } from './ui';
export function LegalLayout({title,children}:{title:string;children:React.ReactNode}){
 return <main className="max-w-3xl mx-auto px-6 py-10"><nav className="flex flex-wrap justify-between items-center gap-5 mb-14"><Logo/><Link href="/" className="text-xs underline">Voltar ao início</Link></nav><p className="eyebrow">TRANSPARÊNCIA · VERSÃO 08/10/2026</p><h1 className="text-4xl font-semibold tracking-tight mb-8">{title}</h1><article className="legal-content space-y-7 text-sm leading-7">{children}</article><footer className="border-t border-[var(--line)] mt-12 pt-6 flex flex-wrap gap-5 text-xs"><Link href="/termos">Termos de Uso</Link><Link href="/privacidade">Privacidade</Link><Link href="/contato">Contato e suporte</Link></footer></main>;
}
