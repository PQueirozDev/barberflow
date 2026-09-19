import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Barberflow | Agenda para barbearias', description: 'A agenda que deixa sua barbearia em movimento.' };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>}
