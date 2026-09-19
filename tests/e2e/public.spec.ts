import { expect, test } from '@playwright/test';

test('página inicial leva à demonstração e ao cadastro', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('agendamentos');
  await page.getByRole('link', { name: 'Ver demonstração' }).click();
  await expect(page).toHaveURL(/\/demonstracao$/);
  await expect(page.getByText('Demonstração ilustrativa', { exact: false })).toBeVisible();
  await page.getByRole('link', { name: 'Criar minha barbearia', exact: true }).click();
  await expect(page).toHaveURL(/\/cadastro$/);
  await expect(page.getByLabel('Nome do responsável')).toBeVisible();
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
});

test('login oferece recuperação de senha', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('link', { name: 'Esqueci minha senha' }).click();
  await expect(page).toHaveURL(/\/recuperar-senha$/);
  await expect(page.getByRole('button', { name: 'Enviar link de recuperação' })).toBeVisible();
});
