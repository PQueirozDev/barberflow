import { CustomerEditor } from "@/components/dashboard/customer-editor";
import { notFound } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { requireTenant } from "@/lib/auth";
import { getAppointments } from "@/services/queries";
import { PageHeader, Stat, Badge, EmptyState } from "@/components/ui";
import { money, day, time, whatsappLink } from "@/utils/format";
export default async function CustomerDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireTenant();
  const { data: c } = await ctx.db
    .from("customers")
    .select("*")
    .eq("barbershop_id", ctx.shop.id)
    .eq("id", id)
    .maybeSingle();
  if (!c) notFound();
  const appointments = await getAppointments(ctx, undefined, undefined, id);
  const visits = appointments.filter((a) => a.status === "COMPLETED");
  return (
    <>
      <PageHeader
        title={c.name}
        description={[c.phone, c.email].filter(Boolean).join(" · ")}
      >
        <a
          href={whatsappLink(c.whatsapp)}
          target="_blank"
          rel="noreferrer"
          className="btn btn-dark"
        >
          <MessageCircle size={15} />
          Chamar no WhatsApp
        </a>
      </PageHeader>
      <div className="grid sm:grid-cols-3 gap-5 mb-7">
        <Stat label="Atendimentos concluídos" value={visits.length} />
        <Stat
          label="Valor dos serviços concluídos"
          detail="Não comprova recebimento"
          value={money(visits.reduce((n, a) => n + a.price_cents, 0))}
        />
        <Stat
          label="Último atendimento"
          value={
            visits.length
              ? day(visits.at(-1)!.starts_at, ctx.shop.timezone)
              : "—"
          }
        />
      </div>
      <section className="card overflow-hidden">
        <div className="panel-heading">
          <h2>Histórico de agendamentos</h2>
        </div>
        {appointments.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Serviço</th>
                  <th>Barbeiro</th>
                  <th>Valor</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((a) => (
                  <tr key={a.id}>
                    <td>
                      {day(a.starts_at, ctx.shop.timezone)} ·{" "}
                      {time(a.starts_at, ctx.shop.timezone)}
                    </td>
                    <td>{a.services.name}</td>
                    <td>{a.barbers.name}</td>
                    <td>{money(a.price_cents)}</td>
                    <td>
                      <Badge status={a.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState description="Nenhum atendimento registrado." />
        )}
      </section>
      <CustomerEditor customer={c} />
    </>
  );
}
