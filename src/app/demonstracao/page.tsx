import type { Metadata } from 'next';
import { DemoWorkspace } from '@/components/demo/workspace';
export const metadata: Metadata = {title:'Demonstração interativa',description:'Explore agenda, clientes, serviços e relatórios com dados fictícios, sem cadastro.',alternates:{canonical:'/demonstracao'}};
export default function Demo() { return <DemoWorkspace/>; }
