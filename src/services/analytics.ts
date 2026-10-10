import type { Appointment, Customer } from "@/types/domain";
import { localDate } from "@/utils/format";
export function analytics(
  appointments: Appointment[],
  customers: Customer[],
  from: string,
  to: string,
  timezone: string,
) {
  const inRange = (stamp: string) => {
    const d = localDate(new Date(stamp), timezone);
    return d >= from && d <= to;
  };
  const period = appointments.filter((a) => inRange(a.starts_at));
  const completed = period.filter((a) => a.status === "COMPLETED");
  const active = period.filter(
    (a) => !["CANCELLED", "NO_SHOW"].includes(a.status),
  );
  const counts = new Map<string, number>();
  for (const a of completed)
    counts.set(a.customer_id, (counts.get(a.customer_id) || 0) + 1);
  const recurring = [...counts].filter(
    ([id, n]) =>
      n > 1 ||
      appointments.some(
        (a) =>
          a.customer_id === id &&
          a.status === "COMPLETED" &&
          localDate(new Date(a.starts_at), timezone) < from,
      ),
  ).length;
  function ranking(field: "services" | "barbers") {
    const map = new Map<
      string,
      { id: string; name: string; count: number; total: number }
    >();
    for (const a of completed) {
      const item = a[field];
      const current = map.get(item.id) || {
        id: item.id,
        name: item.name,
        count: 0,
        total: 0,
      };
      current.count++;
      current.total += a.price_cents;
      map.set(item.id, current);
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }
  return {
    estimated: active.reduce((n, a) => n + a.price_cents, 0),
    completedValue: completed.reduce((n, a) => n + a.price_cents, 0),
    completed: completed.length,
    cancelled: period.filter((a) => a.status === "CANCELLED").length,
    newCustomers: customers.filter((c) => inRange(c.created_at)).length,
    recurring,
    services: ranking("services"),
    barbers: ranking("barbers"),
    period,
  };
}
