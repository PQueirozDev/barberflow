"use client";
import { useState } from "react";
import { Check, ArrowLeft, MessageCircle } from "lucide-react";
import { Field } from "@/components/ui";
import { useSlots } from "@/hooks/use-slots";
import {
  money,
  time,
  day,
  localDate,
  addDays,
  whatsappLink,
} from "@/utils/format";
import type { PublicShop, BookingReceipt } from "@/types/domain";
export function BookingFlow({
  data,
  initialService,
  onBooked,
}: {
  data: PublicShop;
  initialService?: string;
  onBooked?: () => void;
}) {
  const [service, setService] = useState(initialService || "");
  const [barber, setBarber] = useState("");
  const [date, setDate] = useState(localDate(new Date(), data.shop.timezone));
  const [start, setStart] = useState("");
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [receipt, setReceipt] = useState<BookingReceipt | null>(null);
  const [waitlistDone, setWaitlistDone] = useState(false);
  const {
    slots,
    loading,
    error: slotError,
  } = useSlots(data.shop.slug, service, barber, date, undefined, refresh);
  const selected = data.services.find((s) => s.id === service);
  const professional = data.barbers.find((b) => b.id === barber);
  const eligible = data.barbers.filter((b) =>
    data.barber_services.some(
      (l) => l.barber_id === b.id && l.service_id === service,
    ),
  );
  async function joinWaitlist(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setError("");
    const values = Object.fromEntries(new FormData(form));
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          slug: data.shop.slug,
          serviceId: service,
          barberId: barber,
          date,
          consent: values.consent === "on",
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setWaitlistDone(true);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível enviar o interesse. Tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!slots.includes(start)) return;
    setBusy(true);
    setError("");
    const values = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          phone: values.phone,
          whatsapp: values.whatsapp || values.phone,
          slug: data.shop.slug,
          serviceId: service,
          barberId: barber,
          startsAt: start,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setStart("");
          setStep(0);
          setRefresh((v) => v + 1);
        }
        throw new Error(body.error);
      }
      setReceipt(body);
      onBooked?.();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Falha de conexão. Tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (receipt)
    return (
      <div className="text-center">
        <span className="mx-auto w-16 h-16 rounded-full bg-[#eaf4dd] text-[#789a51] grid place-items-center">
          <Check size={28} />
        </span>
        <h3 className="text-2xl mt-5">Agendamento confirmado!</h3>
        <p className="muted text-sm mt-3">Te esperamos na {receipt.shop}.</p>
        <div className="card bg-[#f8faf4] p-6 my-6 text-left space-y-3">
          <p>
            <strong>{receipt.service}</strong> · {money(receipt.price_cents)}
          </p>
          <p className="text-sm">
            {day(receipt.starts_at, receipt.timezone)} às{" "}
            {time(receipt.starts_at, receipt.timezone)} · {receipt.barber}
          </p>
          <p className="text-xs muted">Cliente: {receipt.customer}</p>
          <p className="text-[10px] muted break-all">Código: {receipt.code}</p>
        </div>
        {receipt.whatsapp && (
          <a
            href={whatsappLink(
              receipt.whatsapp,
              `Olá! Agendei ${receipt.service} com ${receipt.barber} para ${day(receipt.starts_at, receipt.timezone)} às ${time(receipt.starts_at, receipt.timezone)}. Meu nome é ${receipt.customer}. Código: ${receipt.code}.`,
            )}
            target="_blank"
            rel="noreferrer"
            className="btn btn-dark"
          >
            <MessageCircle size={15} />
            Falar com a barbearia
          </a>
        )}
        <p className="text-xs muted mt-4">
          Para cancelar ou remarcar, entre em contato com a barbearia.
        </p>
      </div>
    );
  return (
    <div className="form-stack">
      <p className="eyebrow !mb-0">
        {step === 0
          ? "01 · ESCOLHA SEU HORÁRIO"
          : "02 · SEUS DADOS E CONFIRMAÇÃO"}
      </p>
      {step === 0 ? (
        <>
          <Field label="Serviço">
            <select
              value={service}
              onChange={(e) => {
                setService(e.target.value);
                setBarber("");
                setStart("");
                setWaitlistDone(false);
              }}
            >
              <option value="">Escolha um serviço</option>
              {data.services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {money(s.price_cents)} · {s.duration_minutes} min
                </option>
              ))}
            </select>
          </Field>
          <Field label="Barbeiro">
            <select
              value={barber}
              disabled={!service}
              onChange={(e) => {
                setBarber(e.target.value);
                setStart("");
                setWaitlistDone(false);
              }}
            >
              <option value="">Escolha um profissional</option>
              {eligible.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          {service && !eligible.length && (
            <p className="notice">
              Nenhum profissional disponível para este serviço.
            </p>
          )}
          <Field
            label="Data"
            hint={`Horários locais da barbearia · ${data.shop.timezone}`}
          >
            <input
              type="date"
              value={date}
              min={localDate(new Date(), data.shop.timezone)}
              max={addDays(localDate(new Date(), data.shop.timezone), 90)}
              onChange={(e) => {
                setDate(e.target.value);
                setStart("");
                setWaitlistDone(false);
              }}
            />
          </Field>
          {loading ? (
            <div
              className="skeleton h-24"
              role="status"
              aria-label="Carregando horários"
            />
          ) : slotError ? (
            <p className="notice error" role="alert">
              {slotError}
            </p>
          ) : (
            barber && (
              <div>
                <p className="text-xs font-semibold mb-3">
                  Horários disponíveis
                </p>
                {slots.length ? (
                  <div className="slot-grid max-h-56 overflow-auto">
                    {slots.map((s) => (
                      <button
                        type="button"
                        key={s}
                        className={s === start ? "active" : ""}
                        onClick={() => setStart(s)}
                      >
                        {time(s, data.shop.timezone)}
                      </button>
                    ))}
                  </div>
                ) : (
                  <>
                    <p className="notice mb-4">
                      Nenhum horário disponível nesta data. Tente outro dia ou
                      profissional.
                    </p>
                    {data.features?.waitlist_enabled &&
                      data.shop.booking_enabled &&
                      (waitlistDone ? (
                        <p className="notice success" role="status">
                          Interesse registrado. A barbearia poderá entrar em
                          contato; a lista não cria uma reserva.
                        </p>
                      ) : (
                        <form className="form-stack" onSubmit={joinWaitlist}>
                          <h3 className="section-title">
                            Quer receber uma oportunidade?
                          </h3>
                          <p className="text-xs muted">
                            Informe seus dados para a barbearia avisar caso
                            surja uma vaga. Você ainda precisará confirmar o
                            horário.
                          </p>
                          <Field label="Seu nome">
                            <input
                              name="name"
                              required
                              minLength={2}
                              maxLength={120}
                            />
                          </Field>
                          <Field label="Seu telefone / WhatsApp">
                            <input
                              name="phone"
                              required
                              type="tel"
                              maxLength={30}
                            />
                          </Field>
                          <Field label="Período preferido">
                            <select name="period">
                              <option value="ANY">Qualquer horário</option>
                              <option value="MORNING">Manhã</option>
                              <option value="AFTERNOON">Tarde</option>
                            </select>
                          </Field>
                          <label className="flex gap-2 items-start text-xs">
                            <input name="consent" type="checkbox" required />
                            <span>
                              Autorizo a barbearia a usar meu telefone para me
                              avisar sobre uma vaga nesta data. Posso entrar em
                              contato com a barbearia para pedir a remoção do
                              meu interesse.
                            </span>
                          </label>
                          <button className="btn btn-outline" disabled={busy}>
                            {busy ? "Enviando…" : "Entrar na lista de espera"}
                          </button>
                        </form>
                      ))}
                  </>
                )}
              </div>
            )
          )}
          <button
            className="btn btn-dark"
            disabled={!start || loading || !slots.includes(start)}
            onClick={() => setStep(1)}
          >
            Continuar →
          </button>
        </>
      ) : (
        <form onSubmit={submit} className="form-stack">
          <button
            type="button"
            onClick={() => setStep(0)}
            className="flex gap-2 items-center text-xs muted self-start"
          >
            <ArrowLeft size={14} />
            Alterar horário
          </button>
          <div className="notice">
            <strong>{selected?.name}</strong> ·{" "}
            {money(selected?.price_cents || 0)}
            <p>
              {professional?.name} · {day(start, data.shop.timezone)} às{" "}
              {time(start, data.shop.timezone)}
            </p>
          </div>
          <Field label="Seu nome">
            <input
              name="name"
              required
              minLength={2}
              maxLength={120}
              autoComplete="name"
            />
          </Field>
          <Field label="Telefone / WhatsApp com DDD">
            <input
              name="phone"
              required
              type="tel"
              minLength={10}
              maxLength={20}
              autoComplete="tel"
            />
          </Field>
          <Field label="WhatsApp diferente (opcional)">
            <input name="whatsapp" type="tel" minLength={10} maxLength={20} />
          </Field>
          <Field label="Email (opcional)">
            <input
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
            />
          </Field>
          <p className="text-[11px] muted">
            Seus dados serão usados pela barbearia para organizar este
            atendimento e entrar em contato sobre sua reserva.
          </p>
          <button disabled={busy || !start} className="btn btn-dark">
            {busy ? "Confirmando…" : "Confirmar agendamento"}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
    </div>
  );
}
