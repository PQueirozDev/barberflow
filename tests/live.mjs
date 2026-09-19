// Run explicitly against the configured Supabase project; creates and removes only its own fixtures.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

assert.equal(process.env.RUN_LIVE_TESTS, '1', 'Set RUN_LIVE_TESTS=1 to allow temporary remote test data.');
const origin = process.env.NEXT_PUBLIC_APP_URL;
assert.ok(origin && process.env.SUPABASE_SERVICE_ROLE_KEY);
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, options);
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, options);
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, options);
const run = randomUUID();
const email = `barberflow-test-${run}@example.com`;
const password = `${randomUUID()}Aa!9`;
let userId, shopId, mediaPath;
function ok(result) {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
try {
  userId = ok(await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name: 'Teste automatizado' } })).user.id;
  ok(await client.auth.signInWithPassword({ email, password }));
  assert.equal(ok(await client.from('profiles').select('name').eq('id', userId).single()).name, 'Teste automatizado');
  const login = await fetch(`${origin}/api/login`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  assert.equal(login.status, 200, 'Login HTTP');
  const cookie = login.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
  assert.ok(cookie.includes('auth-token'), 'SSR auth cookie');
  console.log('PASS Auth, profile trigger and HTTP login');

  const slug = `teste-${run}`;
  shopId = ok(await client.rpc('create_barbershop', { p_data: { name: 'Teste automatizado temporário', slug, phone: '11900000000', whatsapp: '11900000000', service_name: 'Serviço de teste', price_cents: 4000, duration_minutes: 30, barber_name: 'Profissional de teste', opens_at: '09:00', closes_at: '18:00' } }));
  const shop = ok(await anon.rpc('public_shop', { p_slug: slug }));
  assert.equal(shop.shop.id, shopId);
  const privateRows = await anon.from('customers').select('*');
  assert.ok(privateRows.error || privateRows.data.length === 0, 'Anonymous customers must be hidden');
  for (const route of ['/dashboard', '/dashboard/agenda', '/dashboard/clientes', '/dashboard/servicos', '/dashboard/configuracoes']) {
    const response = await fetch(`${origin}${route}`, { headers: { Cookie: cookie }, redirect: 'manual' });
    assert.equal(response.status, 200, route);
    assert.ok(!(await response.text()).includes('NEXT_HTTP_ERROR_FALLBACK;500'), route);
  }
  assert.equal((await fetch(`${origin}/${slug}`)).status, 200);
  console.log('PASS Onboarding, public page, tenant access and dashboard routes');

  let slots, date;
  for (let offset = 1; offset <= 7; offset++) {
    date = new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
    const query = new URLSearchParams({ slug, serviceId: shop.services[0].id, barberId: shop.barbers[0].id, date });
    const response = await fetch(`${origin}/api/availability?${query}`);
    assert.equal(response.status, 200);
    slots = await response.json();
    if (slots.length) break;
  }
  assert.ok(slots.length, 'Available slots');
  const payload = { slug, serviceId: shop.services[0].id, barberId: shop.barbers[0].id, startsAt: slots[0].starts_at, name: 'Cliente de teste', phone: '11900000001', whatsapp: '11900000001', email: '' };
  const book = () => fetch(`${origin}/api/appointments`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const first = await book();
  assert.equal(first.status, 201, await first.text());
  assert.equal((await book()).status, 409, 'Conflicting booking rejected');
  const appointment = ok(await client.from('appointments').select('id,price_cents').eq('barbershop_id', shopId).single());
  assert.equal(appointment.price_cents, 4000);
  ok(await client.rpc('manage_appointment', { p_id: appointment.id, p_status: 'CANCELLED' }));
  const released = ok(await anon.rpc('available_slots', { p_slug: slug, p_service: shop.services[0].id, p_barber: shop.barbers[0].id, p_date: date }));
  assert.ok(released.some(s => new Date(s.starts_at).getTime() === new Date(payload.startsAt).getTime()));
  console.log('PASS Availability, booking, conflict, price snapshot and cancellation');

  mediaPath = `${shopId}/${run}.png`;
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=', 'base64');
  ok(await client.storage.from('barbershops').upload(mediaPath, png, { contentType: 'image/png' }));
  const publicUrl = client.storage.from('barbershops').getPublicUrl(mediaPath).data.publicUrl;
  assert.equal((await fetch(publicUrl)).status, 200);
  ok(await client.storage.from('barbershops').remove([mediaPath]));
  mediaPath = undefined;
  console.log('PASS Authenticated image upload and public image access');
} finally {
  const errors = [];
  async function clean(result) { if (result.error) errors.push(result.error.message); }
  if (mediaPath) await clean(await admin.storage.from('barbershops').remove([mediaPath]));
  if (shopId) {
    await clean(await admin.from('appointments').delete().eq('barbershop_id', shopId));
    await clean(await admin.from('barbershops').delete().eq('id', shopId));
    await clean(await admin.from('rate_limits').delete().eq('key', `booking:${shopId}:11900000001`));
  }
  if (userId) await clean(await admin.auth.admin.deleteUser(userId));
  if (errors.length) throw new Error(`Fixture cleanup: ${errors.join('; ')}`);
  console.log('Temporary fixtures removed. No emails or messages sent.');
}
