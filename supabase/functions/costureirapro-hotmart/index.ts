import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Webhook Hotmart do CostureiraPro (Prompt Mestre V3.43 · §0 regra 21 · §15).
 * Única porta que libera licença de compra. Fonte da verdade = postback autenticado.
 * - Autenticidade: hottok (secret COSTUREIRAPRO_HOTMART_HOTTOK), nunca no frontend.
 * - Idempotência: hotmart_events.event_key único — mesmo evento 2× processa 1×.
 * - Sem licença duplicada: 1 e-mail = 1 linha em licenses.
 */

const SCHEMA = "costureirapro";
const ACTIVATE_EVENTS = new Set(["PURCHASE_APPROVED", "PURCHASE_COMPLETE"]);
const CANCEL_EVENTS = new Set(["PURCHASE_REFUNDED", "PURCHASE_CHARGEBACK", "PURCHASE_CANCELED"]);
const V1_STATUS_TO_EVENT: Record<string, string> = {
  approved: "PURCHASE_APPROVED",
  completed: "PURCHASE_COMPLETE",
  refunded: "PURCHASE_REFUNDED",
  chargeback: "PURCHASE_CHARGEBACK",
  canceled: "PURCHASE_CANCELED",
  cancelled: "PURCHASE_CANCELED",
};

type Outcome = "license_active" | "license_cancelled" | "ignored" | "error";
type Postback = {
  hottok: string;
  hotmartEventId: string | null;
  eventType: string;
  transactionId: string | null;
  productIds: string[];
  buyerEmail: string | null;
  purchaseStatus: string | null;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function adminClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    db: { schema: SCHEMA },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalizeEmail(value: unknown): string | null {
  const email = String(value ?? "").trim().toLowerCase();
  return /^[^\s@,()]+@[^\s@,()]+\.[^\s@,()]+$/.test(email) ? email : null;
}

function text(value: unknown): string | null {
  const s = String(value ?? "").trim();
  return s ? s.slice(0, 200) : null;
}

function safeEqual(a: string, b: string) {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
  return diff === 0;
}

async function readPostback(req: Request): Promise<Postback | null> {
  const headerHottok = (req.headers.get("x-hotmart-hottok") || "").trim();
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return null;
    const data = (body.data ?? {}) as Record<string, Record<string, unknown>>;
    const product = data.product ?? {};
    return {
      hottok: headerHottok || String(body.hottok ?? "").trim(),
      hotmartEventId: text(body.id),
      eventType: String(body.event ?? "").trim().toUpperCase(),
      transactionId: text(data.purchase?.transaction),
      productIds: [text(product.id), text(product.ucode)].filter((v): v is string => Boolean(v)),
      buyerEmail: normalizeEmail(data.buyer?.email),
      purchaseStatus: text(data.purchase?.status),
    };
  }
  const form = await req.formData().catch(() => null);
  if (!form) return null;
  const status = String(form.get("status") ?? "").trim().toLowerCase();
  return {
    hottok: headerHottok || String(form.get("hottok") ?? "").trim(),
    hotmartEventId: null,
    eventType: V1_STATUS_TO_EVENT[status] ?? `V1_${status.toUpperCase() || "UNKNOWN"}`,
    transactionId: text(form.get("transaction")),
    productIds: [text(form.get("prod"))].filter((v): v is string => Boolean(v)),
    buyerEmail: normalizeEmail(form.get("email")),
    purchaseStatus: text(status),
  };
}

function allowedProduct(productIds: string[]) {
  const allowed = (Deno.env.get("COSTUREIRAPRO_HOTMART_PRODUCT_IDS") || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  if (allowed.length === 0) return true;
  return productIds.some((id) => allowed.includes(id));
}

async function findLicenseByEmail(admin: ReturnType<typeof adminClient>, email: string) {
  const byEmail = await admin.from("licenses").select("id, account_id, hotmart_txn_id").eq("email", email).maybeSingle();
  if (byEmail.error) throw new Error(byEmail.error.message);
  if (byEmail.data) return byEmail.data;
  const byBuyer = await admin
    .from("licenses")
    .select("id, account_id, hotmart_txn_id")
    .eq("buyer_email", email)
    .limit(1)
    .maybeSingle();
  if (byBuyer.error) throw new Error(byBuyer.error.message);
  return byBuyer.data;
}

async function revokeSessionsByEmail(admin: ReturnType<typeof adminClient>, email: string) {
  const { data: account } = await admin.from("accounts").select("id").eq("email", email).maybeSingle();
  if (!account) return;
  await admin
    .from("sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("account_id", account.id)
    .is("revoked_at", null);
}

async function activateLicense(
  admin: ReturnType<typeof adminClient>,
  email: string,
  transactionId: string | null,
  retried = false,
): Promise<string> {
  const now = new Date().toISOString();
  const existing = await findLicenseByEmail(admin, email);
  if (existing) {
    const patch: Record<string, unknown> = { email, buyer_email: email, status: "active", plan: "vitalicia", expires_at: null, updated_at: now };
    if (transactionId) patch.hotmart_txn_id = transactionId;
    const { error } = await admin.from("licenses").update(patch).eq("id", existing.id);
    if (error) throw new Error(error.message);
    return existing.id as string;
  }
  const { data: created, error } = await admin
    .from("licenses")
    .insert({
      email,
      buyer_email: email,
      status: "active",
      plan: "vitalicia",
      expires_at: null,
      source: "hotmart",
      hotmart_txn_id: transactionId,
      started_at: now,
      updated_at: now,
    })
    .select("id")
    .single();
  if (error?.code === "23505" && !retried) return await activateLicense(admin, email, transactionId, true);
  if (error || !created) throw new Error(error?.message || "Falha ao criar licença.");
  return created.id as string;
}

/** Cancela só a licença desta compra (hotmart_txn_id igual) — nunca cortesia/manual sem vínculo. */
async function cancelLicense(admin: ReturnType<typeof adminClient>, email: string, transactionId: string | null) {
  const existing = await findLicenseByEmail(admin, email);
  if (!existing || !transactionId || existing.hotmart_txn_id !== transactionId) {
    return { outcome: "ignored" as Outcome, licenseId: existing?.id ?? null };
  }
  const { error } = await admin
    .from("licenses")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", existing.id);
  if (error) throw new Error(error.message);
  await revokeSessionsByEmail(admin, email);
  return { outcome: "license_cancelled" as Outcome, licenseId: existing.id as string };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const expected = (Deno.env.get("COSTUREIRAPRO_HOTMART_HOTTOK") || "").trim();
  if (!expected) return json({ error: "Webhook não configurado." }, 503);

  const postback = await readPostback(req);
  if (!postback) return json({ error: "Payload inválido." }, 400);
  if (!postback.hottok || !safeEqual(postback.hottok, expected)) return json({ error: "Não autorizado." }, 401);
  if (!postback.eventType) return json({ error: "Evento ausente." }, 400);

  const eventKey = postback.hotmartEventId ?? `${postback.eventType}:${postback.transactionId ?? "sem-transacao"}`;
  const admin = adminClient();

  let eventRowId: string;
  const inserted = await admin
    .from("hotmart_events")
    .insert({
      event_key: eventKey,
      hotmart_event_id: postback.hotmartEventId,
      event_type: postback.eventType,
      transaction_id: postback.transactionId,
      product_id: postback.productIds[0] ?? null,
      buyer_email: postback.buyerEmail,
      purchase_status: postback.purchaseStatus,
    })
    .select("id")
    .single();
  if (inserted.error) {
    if (inserted.error.code !== "23505") return json({ error: "Falha ao registrar evento." }, 500);
    const { data: previous } = await admin.from("hotmart_events").select("id, outcome").eq("event_key", eventKey).maybeSingle();
    if (!previous || previous.outcome !== "error") return json({ ok: true, duplicate: true });
    eventRowId = previous.id as string;
  } else {
    eventRowId = inserted.data.id as string;
  }

  let outcome: Outcome = "ignored";
  let licenseId: string | null = null;
  try {
    if (!allowedProduct(postback.productIds) || !postback.buyerEmail) {
      outcome = "ignored";
    } else if (ACTIVATE_EVENTS.has(postback.eventType)) {
      licenseId = await activateLicense(admin, postback.buyerEmail, postback.transactionId);
      outcome = "license_active";
    } else if (CANCEL_EVENTS.has(postback.eventType)) {
      ({ outcome, licenseId } = await cancelLicense(admin, postback.buyerEmail, postback.transactionId));
    }
  } catch (error) {
    console.error("[costureirapro-hotmart] falha ao processar:", error);
    await admin.from("hotmart_events").update({ outcome: "error", processed_at: new Date().toISOString() }).eq("id", eventRowId);
    return json({ error: "Falha ao processar evento." }, 500);
  }
  await admin
    .from("hotmart_events")
    .update({ outcome, license_id: licenseId, processed_at: new Date().toISOString() })
    .eq("id", eventRowId);
  return json({ ok: true, outcome });
});
