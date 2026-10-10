import { tenantData, getAppointments } from "@/services/queries";
import { AppointmentManager } from "@/components/dashboard/appointment-manager";
import { dateSchema } from "@/lib/api-security";
import { addDays, addMonths, localDate } from "@/utils/format";
export default async function Agenda({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const ctx = await tenantData(),
    params = await searchParams;
  const parsed = dateSchema.safeParse(params.date),
    date = parsed.success
      ? parsed.data
      : localDate(new Date(), ctx.shop.timezone);
  const view =
    params.view === "day" || params.view === "month" ? params.view : "week";
  const appointments = await getAppointments(
    ctx,
    addDays(date.slice(0, 8) + "01", -7),
    addDays(addMonths(date, 1), 7),
  );
  return (
    <AppointmentManager
      key={`${date}:${view}`}
      calendar
      initialView={view}
      appointments={appointments}
      data={{
        shop: ctx.shop,
        services: ctx.services,
        barbers: ctx.barbers,
        barber_services: ctx.links,
        hours: ctx.hours,
      }}
      initialDate={date}
    />
  );
}
