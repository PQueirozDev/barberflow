import './globals.css';
import './redesign.css';
import './zekro2.css';
import './zekro3.css';
import { VisualEffects } from '@/components/visual-effects';
import type { Metadata, Viewport } from 'next';
import { Instrument_Serif, Manrope } from 'next/font/google';
const sans = Manrope({subsets:['latin'],variable:'--font-sans',display:'swap'});
const serif = Instrument_Serif({subsets:['latin'],weight:'400',style:['normal','italic'],variable:'--font-serif',display:'swap'});
export const metadata: Metadata = {
 metadataBase:new URL(process.env.NEXT_PUBLIC_APP_URL||'https://zekro.vercel.app'),
 title:{default:'Zekro | Sua barbearia, no seu ritmo',template:'%s | Zekro'},
 description:'Agenda online, clientes e profissionais em um só lugar. Experimente Zekro por 7 dias. Depois, R$ 49,90/mês.',
 applicationName:'Zekro',
 openGraph:{title:'Zekro | Sua barbearia, no seu ritmo',description:'Mais organização. Mais espaço para o seu talento.',locale:'pt_BR',type:'website'},
};
export const viewport: Viewport = {themeColor:'#102b21'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR" className={`${sans.variable} ${serif.variable}`}><body><VisualEffects/>{children}</body></html>}
