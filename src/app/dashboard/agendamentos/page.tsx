import { tenantData, getAppointments } from "@/services/queries";
import { AppointmentManager } from "@/components/dashboard/appointment-manager";
import { PeriodFilter } from "@/components/dashboard/summary";
import { reportPeriod } from "@/lib/report-period";
import { addDays, localDate } from "@/utils/format";
export default async function Appointments({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const ctx = await tenantData(),
    params = await searchParams,
    today = localDate(new Date(), ctx.shop.timezone);
  const period = reportPeriod(
    {
      from: params.from || today.slice(0, 8) + "01",
      to: params.to || addDays(today, 90),
    },
    ctx.shop.timezone,
  );
  const appointments = await getAppointments(ctx, period.from, period.to);
  return (
    <>
      <PeriodFilter {...period} />
      <p className="text-sm muted mb-6">
        A lista exibe apenas o intervalo acima. Altere as datas para consultar o
        histórico.
      </p>
      <AppointmentManager
        key={`${period.from}:${period.to}`}
        appointments={appointments}
        data={{
          shop: ctx.shop,
          services: ctx.services,
          barbers: ctx.barbers,
          barber_services: ctx.links,
          hours: ctx.hours,
        }}
        initialNew={params.novo === "1"}
        initialId={params.id}
      />
    </>
  );
}
