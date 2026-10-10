import { NextResponse } from "next/server";
import { z } from "zod";
import { dateSchema, publicError, readPublicJson } from "@/lib/api-security";
import { phoneSchema, slugSchema } from "@/lib/validation";
import { checkOrigin, rateLimit, rateLimitIdentity } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/admin";
const schema = z.object({
  slug: slugSchema,
  serviceId: z.string().uuid(),
  barberId: z.string().uuid(),
  date: dateSchema,
  period: z.enum(["ANY", "MORNING", "AFTERNOON"]),
  name: z.string().trim().min(2).max(120),
  phone: phoneSchema,
  consent: z.literal(true),
});
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    if (!(await rateLimit(request, "waitlist", 10, 3600)))
      return NextResponse.json(
        { error: "Muitas tentativas. Tente mais tarde." },
        { status: 429 },
      );
    const v = schema.parse(await readPublicJson(request));
    if (
      !(await rateLimitIdentity(
        "waitlist-phone",
        `${v.slug}:${v.phone}`,
        3,
        86400,
      ))
    )
      return NextResponse.json(
        { error: "Muitas tentativas. Tente mais tarde." },
        { status: 429 },
      );
    const { error } = await createServiceClient().rpc("join_waitlist", {
      p_slug: v.slug,
      p_service: v.serviceId,
      p_barber: v.barberId,
      p_date: v.date,
      p_period: v.period,
      p_name: v.name,
      p_phone: v.phone,
      p_consent: v.consent,
    });
    if (error) throw error;
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json({ error: publicError(error) }, { status: 400 });
  }
}
