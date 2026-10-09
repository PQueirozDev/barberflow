import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = {
 metadataBase:new URL(process.env.NEXT_PUBLIC_APP_URL||'https://zekro.vercel.app'),
 title:{default:'Zekro | Sua barbearia, no seu ritmo',template:'%s | Zekro'},
 description:'Agenda online, clientes e profissionais em um só lugar. Experimente Zekro por 7 dias. Depois, R$ 49,90/mês.',
 applicationName:'Zekro',icons:{icon:'/icon.svg'},
 openGraph:{title:'Zekro | Sua barbearia, no seu ritmo',description:'Mais organização. Mais espaço para o seu talento.',locale:'pt_BR',type:'website'},
};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>}
