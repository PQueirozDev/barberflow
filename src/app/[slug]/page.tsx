import { notFound } from 'next/navigation';
import { configured } from '@/lib/supabase/server';
import { getPublicShop } from '@/services/queries';
import { PublicShopView } from '@/components/public-shop';
import type { Metadata } from 'next';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
 const {slug}=await params;
 if(!configured())return {title:'Barbearia | Zekro',robots:{index:false,follow:false}};
 const shop=await getPublicShop(slug);
 if(!shop)return {title:'Página não encontrada | Zekro',robots:{index:false,follow:false}};
 const title=shop.shop.name;
 const description=shop.shop.description||`Conheça os serviços e agende seu horário em ${title}.`;
 return {title,description,alternates:{canonical:`/${encodeURIComponent(slug)}`},openGraph:{title,description,images:shop.shop.cover_url?[shop.shop.cover_url]:shop.shop.logo_url?[shop.shop.logo_url]:[]},robots:{index:true,follow:true}};
}
export default async function ShopPage({params}:{params:Promise<{slug:string}>}){const{slug}=await params;if(!configured())notFound();const data=await getPublicShop(slug);if(!data)notFound();return <PublicShopView data={data}/>;}
