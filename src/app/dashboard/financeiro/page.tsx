import Link from "next/link";
import { requireTenant } from "@/lib/auth";
import { getAnalytics, getPayments } from "@/services/product-queries";
import { pageNumber, reportPeriod } from "@/lib/report-period";
import { PeriodFilter } from "@/components/dashboard/summary";
import { PageHeader, Stat, Field } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { recordPayment, voidPayment } from "@/services/product-actions";
import { money, day } from "@/utils/format";
import type { Appointment } from "@/types/domain";
const methods = { CASH: "Dinheiro", PIX: "Pix", CARD: "Cartão" };
export default async function Finance({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; page?: string }>;
}) {
  const ctx = await requireTenant(),
    params = await searchParams,
    period = reportPeriod(params, ctx.shop.timezone),
    page = pageNumber(params.page);
  const [payments, summary, unpaid] = await Promise.all([
    getPayments(ctx, period.from, period.to, page),
    getAnalytics(ctx, period.from, period.to),
    ctx.db.rpc("unpaid_appointments", { p_shop: ctx.shop.id }),
  ]);
  if (unpaid.error)
    throw new Error("Não foi possível carregar atendimentos sem recebimento.");
  const appointments = (unpaid.data || []) as Appointment[];
  const query = new URLSearchParams({ from: period.from, to: period.to });
  return (
    <>
      <PageHeader
        title="Financeiro da barbearia"
        description="Registro manual dos pagamentos dos seus serviços. A assinatura Zekro Pro fica em Pagamento da assinatura."
      />
      <PeriodFilter {...period} />
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <Stat
          label="Recebimentos registrados"
          value={money(summary.received)}
        />
        <Stat label="Pagamentos no período" value={summary.payments} />
        <Stat
          label="Previsão de serviços"
          value={money(summary.expected)}
          detail="Não representa dinheiro recebido"
        />
      </div>
      <section className="card p-6 mb-6">
        <h2 className="section-title mb-4">Registrar recebimento</h2>
        <p className="text-sm muted mb-5">
          Atendimentos concluídos sem recebimento ativo, do mais antigo para o
          mais recente (até 100). O valor vem do preço registrado no
          agendamento. A data de recebimento será agora; este registro não faz
          cobranças.
        </p>
        {appointments.length ? (
          <ActionForm action={recordPayment} label="Registrar valor recebido">
            <Field label="Atendimento">
              <select name="appointment_id" required>
                {appointments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {day(a.starts_at, ctx.shop.timezone)} · {a.customers.name} ·{" "}
                    {a.services.name} · {money(a.price_cents)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Forma de pagamento">
              <select name="method">
                <option value="CASH">Dinheiro</option>
                <option value="PIX">Pix</option>
                <option value="CARD">Cartão</option>
              </select>
            </Field>
            <label className="flex items-start gap-2 text-sm">
              <input name="received" type="checkbox" required />
              Conferi e recebi o valor integral deste atendimento.
            </label>
          </ActionForm>
        ) : (
          <p className="muted">
            Nenhum atendimento concluído aguardando registro de recebimento.
          </p>
        )}
      </section>
      <div className="flex justify-between flex-wrap gap-4 mb-4">
        <h2 className="section-title">Histórico financeiro</h2>
        <a className="btn btn-outline" href={`/api/finance/export?${query}`}>
          Exportar CSV
        </a>
      </div>
      <section className="card table-scroll">
        <table>
          <thead>
            <tr>
              <th>Recebimento</th>
              <th>Cliente / serviço</th>
              <th>Profissional</th>
              <th>Forma / valor</th>
              <th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {payments.items.map((p) => (
              <tr key={p.id}>
                <td>{day(p.paid_at, ctx.shop.timezone)}</td>
                <td>
                  {p.appointments.customers.name}
                  <p className="muted">{p.appointments.services.name}</p>
                </td>
                <td>{p.appointments.barbers.name}</td>
                <td>
                  {methods[p.method]} · {money(p.amount_cents)}
                </td>
                <td>
                  {p.voided_at ? (
                    <span>Anulado: {p.void_reason}</span>
                  ) : (
                    <>
                      <span>Registrado</span>
                      {ctx.role === "OWNER" && (
                        <details className="mt-3">
                          <summary className="underline">
                            Corrigir registro
                          </summary>
                          <ActionForm
                            action={voidPayment}
                            label="Anular registro"
                          >
                            <input type="hidden" name="id" value={p.id} />
                            <Field label="Motivo da anulação">
                              <input
                                name="reason"
                                required
                                minLength={5}
                                maxLength={200}
                              />
                            </Field>
                            <p className="text-xs muted">
                              Preserva o histórico. Não devolve dinheiro;
                              estornos financeiros são feitos fora do Zekro.
                            </p>
                          </ActionForm>
                        </details>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!payments.items.length && (
          <p className="p-6 muted">Nenhum recebimento neste período.</p>
        )}
      </section>
      <nav aria-label="Páginas de recebimentos" className="flex gap-3 mt-5">
        {page > 1 && (
          <Link className="btn btn-outline" href={`?${query}&page=${page - 1}`}>
            Anterior
          </Link>
        )}
        {page * 50 < payments.count && (
          <Link className="btn btn-outline" href={`?${query}&page=${page + 1}`}>
            Próxima
          </Link>
        )}
      </nav>
    </>
  );
}
