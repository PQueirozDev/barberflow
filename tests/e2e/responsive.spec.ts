import { expect, test } from '@playwright/test';

test('páginas públicas reorganizam o conteúdo sem overflow de 320px a 1920px', async ({ page }) => {
  for (const width of [320, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/', '/login', '/cadastro', '/recuperar-senha', '/demonstracao', '/termos', '/http-fixture']) {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${path} em ${width}px`).toBe(true);
    }
  }
});

test('reserva pública mantém formulário e modal utilizáveis em 320px', async ({ page }) => {
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Catálogo fictício existe apenas no ambiente local.');
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/http-fixture');
  await page.getByRole('button', { name: 'Agendar', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Seu próximo atendimento' });
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('menu móvel acessível fecha ao navegar e FAQ explica pagamento manual', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'Abrir navegação' });
  await toggle.click();
  await expect(page.getByRole('button', { name: 'Fechar navegação' })).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('navigation', { name: 'Navegação do celular' }).getByRole('link', { name: 'Recursos', exact: true }).click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await page.locator('summary').filter({ hasText: 'Como faço o pagamento?' }).click();
  await expect(page.getByText('O proprietário gera as instruções Pix no painel.', { exact: false })).toBeVisible();
});

test('movimento reduzido desativa animações sem esconder conteúdo', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await page.locator('.scene-notification').evaluate(element => getComputedStyle(element).animationName)).toBe('none');
  await page.goto('/login');
  await expect(page.getByRole('link', { name: 'Entrar com Google' })).toBeVisible();
});
