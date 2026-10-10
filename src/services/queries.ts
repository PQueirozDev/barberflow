import "server-only";
import { requireTenant } from "@/lib/auth";
import type {
  Appointment,
  Barber,
  Customer,
  PublicShop,
  Service,
} from "@/types/domain";
import { createSupabase } from "@/lib/supabase/server";
import { appointmentDateRange } from "@/lib/date-range";
export async function getPublicShop(slug: string) {
  const db = await createSupabase();
  const [{ data, error }, { data: features, error: featureError }] =
    await Promise.all([
      db.rpc("public_shop", { p_slug: slug }),
      db.rpc("public_features", { p_slug: slug }),
    ]);
  if (error) throw new Error("Não foi possível carregar a barbearia.");
  if (featureError)
    throw new Error("Não foi possível carregar as opções públicas.");
  return data
    ? { ...(data as PublicShop), features: features as PublicShop["features"] }
    : null;
}
export async function tenantData() {
  const ctx = await requireTenant();
  const results = await Promise.all([
    ctx.db
      .from("services")
      .select("*")
      .eq("barbershop_id", ctx.shop.id)
      .order("name"),
    ctx.db
      .from("barbers")
      .select("*")
      .eq("barbershop_id", ctx.shop.id)
      .order("name"),
    ctx.db
      .from("barber_services")
      .select("barber_id,service_id")
      .eq("barbershop_id", ctx.shop.id),
    ctx.db
      .from("business_hours")
      .select("*")
      .eq("barbershop_id", ctx.shop.id)
      .order("weekday"),
  ]);
  for (const result of results)
    if (result.error) throw new Error("Não foi possível carregar os dados.");
  return {
    ...ctx,
    services: results[0].data as Service[],
    barbers: results[1].data as Barber[],
    links: results[2].data as { barber_id: string; service_id: string }[],
    hours: results[3].data!,
  };
}
export async function getAppointments(
  ctx: Awaited<ReturnType<typeof requireTenant>>,
  from?: string,
  to?: string,
  customerId?: string,
) {
  const bounds = appointmentDateRange(from, to, ctx.shop.timezone);
  const rows: Appointment[] = [];
  for (let offset = 0; ; offset += 1000) {
    let q = ctx.db
      .from("appointments")
      .select("*,customers(*),services(*),barbers(*)")
      .eq("barbershop_id", ctx.shop.id)
      .order("starts_at")
      .order("id")
      .range(offset, offset + 999);
    if (bounds.from) q = q.gte("starts_at", bounds.from);
    if (bounds.until) q = q.lt("starts_at", bounds.until);
    if (customerId) q = q.eq("customer_id", customerId);
    const { data, error } = await q;
    if (error) throw new Error("Não foi possível carregar os agendamentos.");
    rows.push(...(data as unknown as Appointment[]));
    if (data.length < 1000) break;
  }
  return rows;
}
export async function getCustomers(
  ctx: Awaited<ReturnType<typeof requireTenant>>,
) {
  const rows: Customer[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await ctx.db
      .from("customers")
      .select("*")
      .eq("barbershop_id", ctx.shop.id)
      .order("name")
      .order("id")
      .range(offset, offset + 999);
    if (error) throw new Error("Não foi possível carregar clientes.");
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}
