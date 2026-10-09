import { expect, test } from '@playwright/test';

test('página inicial leva à demonstração e ao cadastro', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Zekro Pro' })).toBeVisible();
  await expect(page.getByText('R$ 49,90', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('Grátis', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
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

test('termos, privacidade e contato são acessíveis e cadastro exige aceite',async({page})=>{
 for(const [path,title] of [['/termos','Termos de Uso'],['/privacidade','Política de Privacidade'],['/contato','Contato e suporte']]){
  await page.goto(path);await expect(page.getByRole('heading',{level:1,name:title})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 }
 await page.goto('/cadastro');await expect(page.getByRole('checkbox')).toBeVisible();
 await expect(page.getByRole('link',{name:'Entrar com Google'})).toHaveAttribute('href','/auth/google');
 if(!process.env.PLAYWRIGHT_BASE_URL){
  const response=await page.request.post('/api/register',{headers:{Origin:'http://localhost:3100'},data:{name:'Fixture',email:'fixture@example.invalid',password:'LongPassword123'}});
  expect(response.status()).toBe(400);expect(await response.json()).toEqual({error:'Confira os dados informados.'});
 }
});

test('Google inicia OAuth PKCE com callback fixo e sem redirecionamento externo',async({request})=>{
 test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL),'Fluxo OAuth isolado exige o fixture local.');
 const response=await request.get('/auth/google?next=https://attacker.invalid',{maxRedirects:0});
 expect(response.status()).toBe(307);const target=new URL(response.headers()['location']);
 expect(target.origin).toBe('http://127.0.0.1:3101');expect(target.pathname).toBe('/auth/v1/authorize');
 expect(target.searchParams.get('provider')).toBe('google');expect(target.searchParams.get('redirect_to')).toBe('http://localhost:3100/auth/callback');
 expect(target.searchParams.get('code_challenge')).toBeTruthy();expect(target.searchParams.get('code_challenge_method')).toBe('s256');
 expect(response.headers()['set-cookie']).toContain('code-verifier');
});

test('visitante sem sessão não acessa instruções Pix privadas nem conferência administrativa',async({page})=>{
 for(const path of ['/dashboard/pagamento','/admin/pix']){await page.goto(path);await expect(page).toHaveURL(/\/login/);}
});
