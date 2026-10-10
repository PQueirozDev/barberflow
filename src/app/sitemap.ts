import type { MetadataRoute } from 'next';
import { createServiceClient } from '@/lib/supabase/admin';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://zekro.vercel.app').replace(/\/$/, '');
  const entries: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/demonstracao`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/termos`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/privacidade`, changeFrequency: 'yearly', priority: 0.2 },
  ];
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) return entries;
  try {
    const db = createServiceClient();
    const { data } = await db.from('barbershops').select('slug,updated_at').eq('booking_enabled', true).eq('suspended', false).limit(5000);
    for (const shop of data || []) entries.push({ url: `${base}/${encodeURIComponent(shop.slug)}`, lastModified: shop.updated_at || undefined, changeFrequency: 'weekly', priority: 0.6 });
  } catch {
    // Sitemap básico continua disponível enquanto o ambiente Supabase estiver indisponível.
  }
  return entries;
}
