import { notFound } from 'next/navigation';
import { configured } from '@/lib/supabase/server';
import { getPublicShop } from '@/services/queries';
import { PublicShopView } from '@/components/public-shop';
export const dynamic='force-dynamic';
export default async function ShopPage({params}:{params:Promise<{slug:string}>}){const{slug}=await params;if(!configured())notFound();const data=await getPublicShop(slug);if(!data)notFound();return <PublicShopView data={data}/>;}
