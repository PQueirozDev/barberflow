import { z } from "zod";
const name = z.string().trim().min(2, "Use pelo menos 2 caracteres.").max(120);
const validDDDs = new Set(
  "11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99".split(
    " ",
  ),
);
export const phoneSchema = z
  .string()
  .max(30)
  .regex(/^(\+55[ .-]?)?[0-9() .-]+$/, "Informe DDD e número brasileiro.")
  .transform((v) => {
    const n = v.replace(/\D/g, "");
    return (n.length === 12 || n.length === 13) && n.startsWith("55")
      ? n.slice(2)
      : n;
  })
  .pipe(
    z
      .string()
      .refine(
        (n) =>
          validDDDs.has(n.slice(0, 2)) &&
          /^[1-9]\d([2-5]\d{7}|9\d{8})$/.test(n),
        "Informe telefone brasileiro válido com DDD.",
      ),
  );
const text = z.string().trim().max(2000).default("");
const imageUrl = z
  .string()
  .max(2048)
  .refine((v) => !v || /^https:\/\//.test(v), "Use uma imagem HTTPS.")
  .default("");
export const slugSchema = z
  .string()
  .regex(
    /^[a-z0-9][a-z0-9-]{2,59}$/,
    "Use 3–60 letras minúsculas, números e hífens.",
  )
  .refine(
    (v) =>
      ![
        "admin",
        "api",
        "auth",
        "login",
        "cadastro",
        "onboarding",
        "dashboard",
        "demonstracao",
        "recuperar-senha",
        "redefinir-senha",
        "b",
        "barbearia",
        "termos",
        "privacidade",
        "contato",
      ].includes(v),
    "Este endereço é reservado.",
  );
export const bookingSchema = z.object({
  slug: slugSchema,
  serviceId: z.string().uuid(),
  barberId: z.string().uuid(),
  startsAt: z.string().datetime({ offset: true }),
  name,
  phone: phoneSchema,
  whatsapp: phoneSchema,
  email: z.string().email().max(254).or(z.literal("")).optional(),
});
export const customerSchema = bookingSchema.pick({
  name: true,
  phone: true,
  whatsapp: true,
  email: true,
});
export const serviceSchema = z.object({
  name,
  description: text,
  price_cents: z.coerce.number().int().min(0).max(10000000),
  duration_minutes: z.coerce.number().int().min(5).max(480),
  photo_url: imageUrl,
  active: z.boolean(),
});
export const barberSchema = z.object({
  name,
  phone: phoneSchema.or(z.literal("")).default(""),
  email: z.string().email().or(z.literal("")).default(""),
  specialties: z.string().max(500).default(""),
  description: text,
  photo_url: imageUrl,
  active: z.boolean(),
});
export const shopSchema = z.object({
  name,
  slug: slugSchema,
  phone: z.string().max(30),
  whatsapp: phoneSchema,
  instagram: z.string().max(150),
  address: z.string().max(300),
  city: z.string().max(120),
  state: z.string().max(2),
  description: text,
  primary_color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
  timezone: z.enum([
    "America/Sao_Paulo",
    "America/Manaus",
    "America/Rio_Branco",
    "America/Noronha",
    "America/Cuiaba",
    "America/Porto_Velho",
    "America/Boa_Vista",
    "America/Bahia",
    "America/Fortaleza",
    "America/Recife",
    "America/Belem",
    "America/Campo_Grande",
  ]),
  logo_url: imageUrl,
  cover_url: imageUrl,
  booking_enabled: z.boolean(),
  notifications_enabled: z.boolean(),
});
export const onboardingSchema = shopSchema
  .pick({
    name: true,
    slug: true,
    phone: true,
    whatsapp: true,
    instagram: true,
    address: true,
    city: true,
    state: true,
    description: true,
  })
  .extend({
    service_name: name,
    price_cents: z.coerce.number().int().min(0).max(10000000),
    duration_minutes: z.coerce.number().int().min(5).max(480),
    barber_name: name,
    specialties: z.string().max(500),
    opens_at: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    closes_at: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    primary_color: shopSchema.shape.primary_color,
    timezone: shopSchema.shape.timezone,
  })
  .refine(
    (v) => v.opens_at < v.closes_at,
    "O encerramento deve ser após a abertura.",
  );
export function errorMessage(error: unknown) {
  if (error instanceof z.ZodError)
    return error.issues[0]?.message || "Confira os dados.";
  if (error && typeof error === "object" && "message" in error) {
    const message = String(error.message);
    if (/duplicate key|unique constraint/.test(message))
      return "Este endereço ou registro já está em uso.";
    if (/exclusion constraint/.test(message))
      return "Este horário acabou de ser ocupado. Escolha outro.";
    if (
      /violates|permission denied|schema cache|fetch failed|Invalid API|JWT/.test(
        message,
      )
    )
      return "Não foi possível concluir. Confira a configuração e tente novamente.";
    return message.slice(0, 240);
  }
  return "Não foi possível concluir. Tente novamente.";
}
