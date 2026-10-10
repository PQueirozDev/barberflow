import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://zekro.vercel.app';
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/dashboard/', '/admin/', '/api/', '/auth/', '/cadastro', '/login', '/onboarding', '/recuperar-senha', '/redefinir-senha'] }],
    sitemap: `${base.replace(/\/$/, '')}/sitemap.xml`,
  };
}
