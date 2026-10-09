'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function VisualEffects() {
  const pathname = usePathname();
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) { entry.target.classList.add('arrive'); observer.unobserve(entry.target); }
      }
    }, { threshold: 0.08 });
    const elements = document.querySelectorAll('[data-reveal], .feature-card, .stat-card, .page-heading, .legal-content, .service-card');
    elements.forEach(element => observer.observe(element));
    return () => { observer.disconnect(); elements.forEach(element => element.classList.remove('arrive')); };
  }, [pathname]);
  return null;
}
