import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as bcryptMod from "npm:bcryptjs@2.4.3";
import QRCode from "npm:qrcode@1.5.4";
import {
  generateTotpSecret,
  isSealedTotpSecret,
  openTotpSecret,
  otpauthUrl,
  sealTotpSecret,
  verifyTotp,
} from "./totp.ts";
import { sendRegistrationEmail } from "./resend.ts";

/**
 * CostureiraPro — Edge de identidade própria (Prompt Mestre V3.43).
 * accounts/profiles/licenses/sessions no schema costureirapro · crachá de sessão opaco (sem JWT)
 * · senha só em hash bcrypt · TOTP · Primeiro acesso por e-mail (Resend) · Administração de acessos.
 * Administradores da fábrica: tabela costureirapro.factory_admins + secret ADMIN_EMAILS (nunca no código).
 */

const bcrypt = ((bcryptMod as { default?: typeof bcryptMod }).default ?? bcryptMod) as {
  hashSync: (data: string, saltOrRounds: string | number) => string;
  compareSync: (data: string, encrypted: string) => boolean;
};

const SCHEMA = "costureirapro";
const APP_NAME = "CostureiraPro";
const OFFICIAL_ORIGIN = "https://costureirapro.planilhaprofissional.com";
const SESSION_HEADER = "x-costureirapro-session";
const IDLE_MS = 30 * 60 * 1000;

const LICENSE_DENIED = "Este e-mail não tem licença para este app.";
const LICENSE_READ_LOG =
  "Falha ao ler licenças. Confira se o schema está em Exposed schemas (sem remover os outros).";
const LICENSE_READ_ERROR = "Não foi possível verificar sua licença agora. Tente de novo em instantes.";
const TOO_MANY_ATTEMPTS = "Muitas tentativas. Tente de novo em alguns minutos.";
const SESSION_EXPIRED = "Sua sessão expirou. Entre de novo.";
const RECOVER_GENERIC =
  "Não foi possível trocar a senha. Confira o e-mail e o código do autenticador. Se ainda não cadastrou o autenticador, fale com o suporte.";
const INVALID_EMAIL = "Informe um e-mail válido.";

const ALLOWED_ORIGINS = new Set([
  OFFICIAL_ORIGIN,
  "https://costureirapro.vercel.app",
  "http://localhost:5173",
  "http://localhost:4173",
]);

const CORS_BASE = {
  "Access-Control-Allow-Headers": `authorization, x-client-info, apikey, content-type, ${SESSION_HEADER}`,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

class InvalidEmailError extends Error {}

type Admin = ReturnType<typeof adminClient>;
type Body = Record<string, unknown>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_BASE, "Content-Type": "application/json" },
  });
}

function adminClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    db: { schema: SCHEMA },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalizeEmail(email: unknown) {
  return String(email ?? "").trim().toLowerCase();
}

function isStrictEmail(email: string) {
  return /^[^\s@,()"\\]+@[^\s@,()"\\]+\.[^\s@,()"\\]+$/.test(email);
}

/** Filtro .or() seguro (sem vírgula/parênteses que mudariam o sentido no PostgREST). */
function licenseEmailFilter(email: string) {
  if (!isStrictEmail(email)) throw new InvalidEmailError(INVALID_EMAIL);
  return `email.eq.${email},buyer_email.eq.${email}`;
}

function readSessionToken(req: Request, body?: Body) {
  const fromBody = String(body?.token || body?.sessionToken || "").trim();
  if (fromBody) return fromBody;
  return (req.headers.get(SESSION_HEADER) || "").trim();
}

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomHex(bytes = 32) {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function passwordPolicy(password: string): string | null {
  if (password.length < 8) return "A senha precisa ter no mínimo 8 caracteres.";
  if (!/[A-Za-zÀ-ÿ]/.test(password) || !/[0-9]/.test(password)) {
    return "A senha precisa ter pelo menos 1 letra e 1 número.";
  }
  return null;
}

function normalizeTotpCode(input: unknown) {
  return String(input || "").replace(/\D/g, "");
}

async function logError(admin: Admin, screen: string, message: string) {
  const { error } = await admin.from("error_logs").insert({ screen, message: message.slice(0, 500) });
  if (error) console.error("[costureirapro-auth] error_logs:", error.message);
}

// ---------- Administradores da fábrica (regra 58 · nunca no código) ----------

async function isFactoryAdmin(admin: Admin, email: string) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  const extras = (Deno.env.get("ADMIN_EMAILS") || "")
    .split(",")
    .map((e) => normalizeEmail(e))
    .filter(Boolean);
  if (extras.includes(normalized)) return true;
  const { data } = await admin.from("factory_admins").select("email").eq("email", normalized).maybeSingle();
  return Boolean(data);
}

async function roleForEmail(admin: Admin, email: string) {
  return (await isFactoryAdmin(admin, email)) ? "administrador" : "usuario";
}

// ---------- Licença ----------

type LicenseRow = {
  id: string;
  email: string | null;
  buyer_email: string | null;
  status: string;
  plan: string | null;
  expires_at: string | null;
  started_at: string | null;
  created_at: string | null;
};

async function findValidLicense(admin: Admin, email: string): Promise<{ license?: LicenseRow; error?: string }> {
  const { data, error } = await admin
    .from("licenses")
    .select("id, email, buyer_email, status, plan, expires_at, started_at, created_at")
    .or(licenseEmailFilter(email))
    .limit(5);
  if (error) {
    await logError(admin, "costureirapro-auth/licenses", `${LICENSE_READ_LOG} ${String(error.message || "").slice(0, 300)}`);
    return { error: LICENSE_READ_ERROR };
  }
  const license = (data || []).find((row) => {
    const emailMatch = normalizeEmail(row.email) === email || normalizeEmail(row.buyer_email) === email;
    if (!emailMatch) return false;
    if (!["active", "trial"].includes(String(row.status))) return false;
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return false;
    return true;
  }) as LicenseRow | undefined;
  return license ? { license } : {};
}

async function expireOldLicenses(admin: Admin, email: string) {
  const { data } = await admin.from("licenses").select("id, status, expires_at").or(licenseEmailFilter(email));
  const vencidas = (data || []).filter(
    (row) =>
      row.expires_at &&
      new Date(row.expires_at).getTime() < Date.now() &&
      ["active", "trial"].includes(String(row.status)),
  );
  await Promise.all(vencidas.map((row) => admin.from("licenses").update({ status: "expired" }).eq("id", row.id)));
}

async function linkLicenseToAccount(admin: Admin, email: string, accountId: string) {
  await admin
    .from("licenses")
    .update({ account_id: accountId, updated_at: new Date().toISOString() })
    .or(licenseEmailFilter(email))
    .is("account_id", null);
}

// ---------- Anti brute-force (regra 41) ----------

async function isLocked(admin: Admin, key: string) {
  const { data } = await admin.from("login_attempts").select("locked_until").eq("email", key).maybeSingle();
  return Boolean(data?.locked_until && new Date(data.locked_until).getTime() > Date.now());
}

async function registerFailure(admin: Admin, key: string) {
  const { data } = await admin.from("login_attempts").select("failed_count").eq("email", key).maybeSingle();
  const failed = (data?.failed_count || 0) + 1;
  await admin.from("login_attempts").upsert({
    email: key,
    failed_count: failed,
    locked_until: failed >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
  });
}

async function clearFailures(admin: Admin, key: string) {
  await admin.from("login_attempts").upsert({
    email: key,
    failed_count: 0,
    locked_until: null,
    updated_at: new Date().toISOString(),
  });
}

// ---------- Sessões (§2 D) ----------

async function createSession(admin: Admin, accountId: string) {
  const token = randomHex(32);
  const now = new Date();
  const { error } = await admin.from("sessions").insert({
    account_id: accountId,
    token_hash: await hashToken(token),
    last_activity_at: now.toISOString(),
    expires_at: new Date(now.getTime() + IDLE_MS).toISOString(),
  });
  if (error) throw new Error("Não foi possível abrir a sessão. Tente de novo.");
  return token;
}

async function revokeAccountSessions(admin: Admin, accountId: string) {
  const { error } = await admin
    .from("sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("account_id", accountId)
    .is("revoked_at", null);
  if (error) throw new Error("Não foi possível encerrar as sessões da conta.");
}

type SessionCtx = { sessionId: string; accountId: string; email: string; fullName: string | null };

/**
 * Valida o crachá: sessão não revogada, dentro dos 30 min sem uso, conta ativa, perfil ativo e licença válida.
 * Com renew=true renova o relógio (só uso real: touch e ações de escrita). `me` e `log_error` não renovam.
 */
async function requireSession(admin: Admin, token: string, renew: boolean): Promise<SessionCtx | null> {
  if (!token || token.length < 32) return null;
  const now = new Date();
  const { data: session } = await admin
    .from("sessions")
    .select("id, account_id, last_activity_at, expires_at, revoked_at")
    .eq("token_hash", await hashToken(token))
    .maybeSingle();
  if (!session || session.revoked_at) return null;
  const idleOver =
    new Date(session.expires_at).getTime() <= now.getTime() ||
    now.getTime() - new Date(session.last_activity_at).getTime() > IDLE_MS;
  if (idleOver) {
    await admin.from("sessions").update({ revoked_at: now.toISOString() }).eq("id", session.id).is("revoked_at", null);
    return null;
  }
  const { data: account } = await admin
    .from("accounts")
    .select("id, email, full_name, is_active")
    .eq("id", session.account_id)
    .maybeSingle();
  if (!account || account.is_active !== true) return null;
  const { data: profile } = await admin.from("profiles").select("is_active").eq("account_id", account.id).maybeSingle();
  if (profile && profile.is_active === false) return null;
  const email = normalizeEmail(account.email);
  const lic = await findValidLicense(admin, email);
  if (lic.error || !lic.license) return null;

  if (renew) {
    await admin
      .from("sessions")
      .update({ last_activity_at: now.toISOString(), expires_at: new Date(now.getTime() + IDLE_MS).toISOString() })
      .eq("id", session.id)
      .is("revoked_at", null);
  }
  return { sessionId: session.id, accountId: account.id, email, fullName: account.full_name };
}

// ---------- TOTP (QR só no 1º cadastro ou após reset — regra 45) ----------

async function totpEnrollment(admin: Admin, account: { id: string; email: string; totp_secret_enc: string | null }) {
  // Pendente: reutiliza o MESMO segredo até confirmar (não força "instalar de novo").
  let secret = account.totp_secret_enc ? await openTotpSecret(account.totp_secret_enc) : "";
  if (!secret) {
    secret = generateTotpSecret();
    await admin
      .from("accounts")
      .update({ totp_secret_enc: await sealTotpSecret(secret), updated_at: new Date().toISOString() })
      .eq("id", account.id);
  }
  const url = otpauthUrl(secret, account.email, APP_NAME);
  const svg = await QRCode.toString(url, {
    type: "svg",
    margin: 1,
    width: 200,
    color: { dark: "#184A4E", light: "#FFFCF2" },
  });
  const qrDataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
  const manualKey = secret.replace(/(.{4})/g, "$1 ").trim();
  return { needsTotp: true, qrDataUrl, manualKey };
}

async function resealLegacyTotp(admin: Admin, accountId: string, stored: string, plain: string) {
  if (isSealedTotpSecret(stored)) return;
  try {
    await admin
      .from("accounts")
      .update({ totp_secret_enc: await sealTotpSecret(plain) })
      .eq("id", accountId)
      .eq("totp_secret_enc", stored);
  } catch (e) {
    console.error("[costureirapro-auth] reseal:", e instanceof Error ? e.message : e);
  }
}

// ---------- Handlers: Entrar ----------

async function handleLogin(body: Body) {
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  if (!email || !password) return json({ error: "Informe e-mail e senha." }, 400);
  if (!isStrictEmail(email)) return json({ error: INVALID_EMAIL }, 400);

  const admin = adminClient();
  if (await isLocked(admin, email)) return json({ error: TOO_MANY_ATTEMPTS }, 429);

  const { data: account } = await admin
    .from("accounts")
    .select("id, email, full_name, password_hash, is_active, totp_secret_enc, totp_enabled_at")
    .eq("email", email)
    .maybeSingle();

  if (!account || !account.password_hash || !bcrypt.compareSync(password, account.password_hash)) {
    await registerFailure(admin, email);
    if (!account) {
      // Licença liberada sem senha ainda → orienta Primeiro acesso, sem revelar detalhes.
      const lic = await findValidLicense(admin, email);
      if (lic.license) return json({ error: "E-mail ou senha incorretos. Se é sua primeira vez, use Primeiro acesso." }, 401);
    }
    return json({ error: "E-mail ou senha incorretos." }, 401);
  }
  if (account.is_active === false) return json({ error: "Esta conta está desativada." }, 403);

  await expireOldLicenses(admin, email);
  const lic = await findValidLicense(admin, email);
  if (lic.error) return json({ error: lic.error }, 500);
  if (!lic.license) return json({ error: LICENSE_DENIED }, 403);

  const { data: profile } = await admin.from("profiles").select("is_active").eq("account_id", account.id).maybeSingle();
  if (profile && profile.is_active === false) return json({ error: "Esta conta está desativada." }, 403);
  if (!profile) {
    await admin.from("profiles").upsert(
      {
        account_id: account.id,
        email,
        full_name: account.full_name,
        role: await roleForEmail(admin, email),
        is_active: true,
      },
      { onConflict: "account_id" },
    );
  }

  await clearFailures(admin, email);
  await linkLicenseToAccount(admin, email, account.id);

  if (!account.totp_enabled_at) {
    return json(await totpEnrollment(admin, account));
  }
  try {
    const token = await createSession(admin, account.id);
    return json({ token });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro de sessão." }, 500);
  }
}

/** Confirma o 1º código do autenticador (após login ou após criar a senha) e abre a sessão. */
async function handleTotpEnable(body: Body) {
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  const code = normalizeTotpCode(body.totpCode);
  if (!email || !password) return json({ error: "Informe e-mail e senha." }, 400);
  if (!/^\d{6}$/.test(code)) return json({ error: "Informe o código de 6 dígitos do autenticador." }, 400);

  const admin = adminClient();
  const key = `totp:${email}`;
  if (await isLocked(admin, key)) return json({ error: TOO_MANY_ATTEMPTS }, 429);

  const { data: account } = await admin
    .from("accounts")
    .select("id, email, password_hash, is_active, totp_secret_enc, totp_enabled_at")
    .eq("email", email)
    .maybeSingle();
  if (!account || !bcrypt.compareSync(password, account.password_hash) || account.is_active === false) {
    await registerFailure(admin, key);
    return json({ error: "Não foi possível validar. Entre de novo." }, 401);
  }
  const lic = await findValidLicense(admin, email);
  if (lic.error) return json({ error: lic.error }, 500);
  if (!lic.license) return json({ error: LICENSE_DENIED }, 403);

  if (!account.totp_enabled_at) {
    if (!account.totp_secret_enc) return json({ error: "Escaneie o QR antes de confirmar o código." }, 400);
    const secret = await openTotpSecret(account.totp_secret_enc);
    if (!(await verifyTotp(secret, code, 2))) {
      await registerFailure(admin, key);
      return json({ error: "Código do autenticador inválido. Use o código atual de 6 dígitos." }, 401);
    }
    await resealLegacyTotp(admin, account.id, account.totp_secret_enc, secret);
    await admin
      .from("accounts")
      .update({ totp_enabled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", account.id);
  }
  await clearFailures(admin, key);
  await linkLicenseToAccount(admin, email, account.id);
  try {
    const token = await createSession(admin, account.id);
    return json({ token });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro de sessão." }, 500);
  }
}

// ---------- Primeiro acesso (regra 55 · e-mail pelo Resend) ----------

async function handleRegister(req: Request, body: Body) {
  if (body.termsAccepted !== true) return json({ error: "Aceite os Termos de Uso e a Privacidade / LGPD para continuar." }, 400);
  const email = normalizeEmail(body.email);
  if (!isStrictEmail(email)) return json({ error: INVALID_EMAIL }, 400);

  const admin = adminClient();
  if (await isLocked(admin, `register:${email}`)) return json({ error: TOO_MANY_ATTEMPTS }, 429);
  const lic = await findValidLicense(admin, email);
  if (lic.error) return json({ error: lic.error }, 500);
  if (!lic.license) {
    await registerFailure(admin, `register:${email}`);
    return json({ error: LICENSE_DENIED }, 403);
  }

  const { data: existing } = await admin.from("accounts").select("id").eq("email", email).maybeSingle();
  if (existing) return json({ error: "Este e-mail já tem senha. Use Entrar ou Esqueci senha." }, 400);

  await admin.from("registration_verifications").delete().lt("expires_at", new Date().toISOString());

  const now = new Date();
  const { data: pending, error: pendingError } = await admin
    .from("registration_verifications")
    .select("send_count, last_sent_at")
    .eq("email", email)
    .maybeSingle();
  if (pendingError) return json({ error: "Não foi possível iniciar o Primeiro acesso." }, 500);
  const lastSentAt = pending?.last_sent_at ? new Date(pending.last_sent_at).getTime() : 0;
  if (pending && now.getTime() - lastSentAt < 60_000) {
    return json({ emailVerificationRequired: true });
  }
  const withinHour = pending && now.getTime() - lastSentAt < 60 * 60 * 1000;
  if (withinHour && (pending?.send_count || 0) >= 5) {
    return json({ error: "Limite de reenvios atingido. Tente novamente mais tarde." }, 429);
  }

  const verificationToken = randomHex(32);
  const { error: writeError } = await admin.from("registration_verifications").upsert(
    {
      email,
      token_hash: await hashToken(verificationToken),
      full_name: String(body.fullName || "").trim() || null,
      terms_accepted_at: now.toISOString(),
      expires_at: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
      verified_at: null,
      failed_attempts: 0,
      send_count: withinHour ? (pending?.send_count || 0) + 1 : 1,
      last_sent_at: now.toISOString(),
    },
    { onConflict: "email" },
  );
  if (writeError) return json({ error: "Não foi possível iniciar o Primeiro acesso." }, 500);

  const origin = req.headers.get("origin") || "";
  const base = ALLOWED_ORIGINS.has(origin) ? origin : OFFICIAL_ORIGIN;
  const link = new URL("/login", base);
  link.searchParams.set("registration-token", verificationToken);
  try {
    await sendRegistrationEmail(email, link.toString());
  } catch (e) {
    await admin.from("registration_verifications").delete().eq("email", email);
    await logError(admin, "costureirapro-auth/resend", e instanceof Error ? e.message : String(e));
    return json({ error: "Não foi possível enviar a confirmação. Tente novamente mais tarde." }, 503);
  }
  return json({ emailVerificationRequired: true });
}

async function handleVerifyRegistration(body: Body) {
  const token = String(body.registrationToken || "");
  if (!/^[0-9a-f]{64}$/i.test(token)) return json({ error: "Link de confirmação inválido ou expirado." }, 400);
  const admin = adminClient();
  const tokenHash = await hashToken(token);
  const { data: pending, error } = await admin
    .from("registration_verifications")
    .select("email, full_name, verified_at")
    .eq("token_hash", tokenHash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) return json({ error: "Não foi possível validar o link." }, 500);
  if (!pending) return json({ error: "Link de confirmação inválido ou expirado. Peça um novo em Primeiro acesso." }, 400);
  const email = normalizeEmail(pending.email);
  const lic = await findValidLicense(admin, email);
  if (lic.error) return json({ error: lic.error }, 500);
  if (!lic.license) return json({ error: LICENSE_DENIED }, 403);
  if (!pending.verified_at) {
    await admin
      .from("registration_verifications")
      .update({ verified_at: new Date().toISOString() })
      .eq("email", email)
      .eq("token_hash", tokenHash)
      .is("verified_at", null);
  }
  return json({ emailVerified: true, email, fullName: pending.full_name });
}

async function handleFinishRegistration(body: Body) {
  const token = String(body.registrationToken || "");
  if (!/^[0-9a-f]{64}$/i.test(token)) return json({ error: "Confirme o e-mail pelo link antes de criar a senha." }, 401);
  const password = String(body.password || "");
  const policy = passwordPolicy(password);
  if (policy) return json({ error: policy }, 400);

  const admin = adminClient();
  const tokenHash = await hashToken(token);
  const { data: pending, error } = await admin
    .from("registration_verifications")
    .select("email, full_name, terms_accepted_at")
    .eq("token_hash", tokenHash)
    .not("verified_at", "is", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) return json({ error: "Não foi possível validar o cadastro." }, 500);
  if (!pending) return json({ error: "Link expirado. Peça um novo em Primeiro acesso." }, 401);
  const email = normalizeEmail(pending.email);
  const lic = await findValidLicense(admin, email);
  if (lic.error) return json({ error: lic.error }, 500);
  if (!lic.license) return json({ error: LICENSE_DENIED }, 403);

  const { data: existing } = await admin.from("accounts").select("id").eq("email", email).maybeSingle();
  if (existing) {
    await admin.from("registration_verifications").delete().eq("email", email);
    return json({ error: "Este e-mail já tem senha. Use Entrar ou Esqueci senha." }, 409);
  }

  const now = new Date().toISOString();
  const { data: created, error: createError } = await admin
    .from("accounts")
    .insert({
      email,
      password_hash: bcrypt.hashSync(password, 12),
      full_name: pending.full_name,
      is_active: true,
      password_changed_at: now,
    })
    .select("id, email, totp_secret_enc")
    .single();
  if (createError || !created) return json({ error: "Não foi possível concluir o cadastro." }, 500);

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      account_id: created.id,
      email,
      full_name: pending.full_name,
      role: await roleForEmail(admin, email),
      is_active: true,
      terms_accepted_at: pending.terms_accepted_at,
      password_changed_at: now,
    },
    { onConflict: "account_id" },
  );
  if (profileError) return json({ error: "Conta criada, mas não foi possível concluir o perfil." }, 500);
  await linkLicenseToAccount(admin, email, created.id);
  await admin.from("registration_verifications").delete().eq("email", email);

  return json({ ...(await totpEnrollment(admin, created)), email });
}

// ---------- Sessão logada ----------

async function handleMe(req: Request, body: Body) {
  const admin = adminClient();
  const ctx = await requireSession(admin, readSessionToken(req, body), false);
  if (!ctx) return json({ error: SESSION_EXPIRED }, 401);
  await expireOldLicenses(admin, ctx.email);
  const lic = await findValidLicense(admin, ctx.email);
  if (lic.error) return json({ error: lic.error }, 500);
  if (!lic.license) return json({ error: "Sua licença não está ativa. Fale com o suporte." }, 403);
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, role, terms_accepted_at, password_changed_at")
    .eq("account_id", ctx.accountId)
    .maybeSingle();
  const isAdmin = await isFactoryAdmin(admin, ctx.email);
  return json({
    user: {
      account_id: ctx.accountId,
      email: ctx.email,
      full_name: profile?.full_name || ctx.fullName,
      role: isAdmin ? "administrador" : profile?.role || "usuario",
      is_admin: isAdmin,
      terms_accepted_at: profile?.terms_accepted_at || null,
      password_changed_at: profile?.password_changed_at || null,
      license_status: lic.license.status,
      license_plan: lic.license.plan,
      license_expires_at: lic.license.expires_at,
      license_created_at: lic.license.started_at || lic.license.created_at,
    },
  });
}

/** Renova o relógio de 30 min durante o uso real (V3.36 · no máximo 1×/5 min pelo cliente). */
async function handleTouch(req: Request, body: Body) {
  const ctx = await requireSession(adminClient(), readSessionToken(req, body), true);
  if (!ctx) return json({ error: SESSION_EXPIRED }, 401);
  return json({ ok: true });
}

async function handleLogout(req: Request, body: Body) {
  const token = readSessionToken(req, body);
  if (!token) return json({ ok: true });
  const { error } = await adminClient()
    .from("sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("token_hash", await hashToken(token))
    .is("revoked_at", null);
  if (error) return json({ error: "Não foi possível encerrar a sessão no servidor." }, 500);
  return json({ ok: true });
}

async function handleAcceptTerms(req: Request, body: Body) {
  const admin = adminClient();
  const ctx = await requireSession(admin, readSessionToken(req, body), true);
  if (!ctx) return json({ error: SESSION_EXPIRED }, 401);
  const { data: profile } = await admin
    .from("profiles")
    .select("terms_accepted_at")
    .eq("account_id", ctx.accountId)
    .maybeSingle();
  if (!profile?.terms_accepted_at) {
    await admin.from("profiles").update({ terms_accepted_at: new Date().toISOString() }).eq("account_id", ctx.accountId);
  }
  return json({ ok: true });
}

async function handleChangePassword(req: Request, body: Body) {
  const newPassword = String(body.newPassword || "");
  const currentPassword = String(body.currentPassword || "");
  const policy = passwordPolicy(newPassword);
  if (policy) return json({ error: policy }, 400);
  if (!currentPassword) return json({ error: "Informe a senha atual." }, 400);
  const admin = adminClient();
  const ctx = await requireSession(admin, readSessionToken(req, body), true);
  if (!ctx) return json({ error: SESSION_EXPIRED }, 401);
  const key = `senha:${ctx.accountId}`;
  if (await isLocked(admin, key)) return json({ error: TOO_MANY_ATTEMPTS }, 429);
  const { data: account } = await admin
    .from("accounts")
    .select("id, email, password_hash")
    .eq("id", ctx.accountId)
    .maybeSingle();
  if (!account) return json({ error: "Conta não encontrada." }, 404);
  if (!bcrypt.compareSync(currentPassword, account.password_hash)) {
    await registerFailure(admin, key);
    return json({ error: "Senha atual incorreta." }, 401);
  }
  await clearFailures(admin, key);
  await revokeAccountSessions(admin, account.id);
  const now = new Date().toISOString();
  await admin
    .from("accounts")
    .update({ password_hash: bcrypt.hashSync(newPassword, 12), password_changed_at: now, updated_at: now })
    .eq("id", account.id);
  await admin.from("profiles").update({ password_changed_at: now }).eq("account_id", account.id);
  await admin.from("password_change_log").insert({ account_id: account.id, email: account.email, source: "alterar_senha" });
  return json({ ok: true, message: "Senha alterada. Entre de novo com a nova senha." });
}

/** Esqueci senha: e-mail → TOTP → nova senha → revoga sessões → password_change_log. NÃO envia e-mail. */
async function handleForgot(body: Body) {
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  const code = normalizeTotpCode(body.totpCode);
  if (!email || !password || !code) return json({ error: "Informe e-mail, código do autenticador e a nova senha." }, 400);
  if (!isStrictEmail(email)) return json({ error: INVALID_EMAIL }, 400);
  const policy = passwordPolicy(password);
  if (policy) return json({ error: policy }, 400);

  const admin = adminClient();
  const key = `recover:${email}`;
  if (await isLocked(admin, key)) return json({ error: TOO_MANY_ATTEMPTS }, 429);
  const lic = await findValidLicense(admin, email);
  if (lic.error) return json({ error: lic.error }, 500);
  const { data: account } = await admin
    .from("accounts")
    .select("id, email, is_active, totp_secret_enc, totp_enabled_at")
    .eq("email", email)
    .maybeSingle();
  if (!lic.license || !account || account.is_active === false || !account.totp_secret_enc || !account.totp_enabled_at) {
    await registerFailure(admin, key);
    return json({ error: RECOVER_GENERIC }, 400);
  }
  const secret = await openTotpSecret(account.totp_secret_enc);
  if (!(await verifyTotp(secret, code, 1))) {
    await registerFailure(admin, key);
    return json({ error: RECOVER_GENERIC }, 401);
  }
  await clearFailures(admin, key);
  await revokeAccountSessions(admin, account.id);
  const now = new Date().toISOString();
  await admin
    .from("accounts")
    .update({ password_hash: bcrypt.hashSync(password, 12), password_changed_at: now, updated_at: now })
    .eq("id", account.id);
  await admin.from("profiles").update({ password_changed_at: now }).eq("account_id", account.id);
  await admin.from("password_change_log").insert({ account_id: account.id, email: account.email, source: "esqueci_senha" });
  await clearFailures(admin, email);
  return json({ ok: true });
}

async function handleLogError(req: Request, body: Body) {
  const admin = adminClient();
  const ctx = await requireSession(admin, readSessionToken(req, body), false);
  if (!ctx) return json({ error: SESSION_EXPIRED }, 401);
  const screen = String(body.screen || "app").slice(0, 120);
  const message = String(body.message || "erro").replace(/senha|password|token|service_role/gi, "[oculto]");
  await logError(admin, screen, message);
  return json({ ok: true });
}

// ---------- Administração de acessos (§15 · regra 57) ----------

async function requireAdmin(req: Request, body: Body): Promise<{ admin: Admin; ctx: SessionCtx } | { error: Response }> {
  const admin = adminClient();
  const ctx = await requireSession(admin, readSessionToken(req, body), true);
  if (!ctx) return { error: json({ error: SESSION_EXPIRED }, 401) };
  if (!(await isFactoryAdmin(admin, ctx.email))) return { error: json({ error: "Acesso negado." }, 403) };
  return { admin, ctx };
}

async function audit(admin: Admin, ctx: SessionCtx, action: string, target: string) {
  const { error } = await admin
    .from("audit_logs")
    .insert({ account_id: ctx.accountId, action: `${action}: ${target}`.slice(0, 300), screen: "admin" });
  if (error) console.error("[costureirapro-auth] audit_logs:", error.message);
}

type LicenseFields = { plan: string; status: string; expires_at: string | null };

function licenseTypeFields(type: unknown, expiresOn: unknown): { fields: LicenseFields | null } | { error: string } {
  const value = String(type ?? "").trim();
  if (!value) return { fields: null };
  if (value === "vitalicia") return { fields: { plan: "vitalicia", status: "active", expires_at: null } };
  if (value === "trial7") {
    return { fields: { plan: "trial", status: "trial", expires_at: new Date(Date.now() + 7 * 86400000).toISOString() } };
  }
  if (value === "data") {
    const day = String(expiresOn ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { error: "Informe a data de vencimento." };
    const end = new Date(`${day}T23:59:59-04:00`);
    if (Number.isNaN(end.getTime())) return { error: "Data de vencimento inválida." };
    if (end.getTime() <= Date.now()) return { error: "A data de vencimento precisa ser futura." };
    return { fields: { plan: "vencimento", status: "active", expires_at: end.toISOString() } };
  }
  return { error: "Tipo de licença inválido." };
}

async function upsertLicense(
  admin: Admin,
  email: string,
  opts: { hotmartId?: string; notes?: string; fields: LicenseFields | null },
) {
  const now = new Date().toISOString();
  const { data: existing } = await admin.from("licenses").select("id").or(licenseEmailFilter(email)).limit(1).maybeSingle();
  const payload: Record<string, unknown> = {
    email,
    buyer_email: email,
    ...(opts.fields ?? { plan: "vitalicia", status: "active", expires_at: null }),
    source: opts.hotmartId ? "hotmart" : "manual",
    updated_at: now,
  };
  if (opts.hotmartId) payload.hotmart_txn_id = opts.hotmartId.slice(0, 120);
  if (opts.notes !== undefined) payload.notes = opts.notes.slice(0, 500) || null;
  if (existing?.id) {
    const { error } = await admin.from("licenses").update(payload).eq("id", existing.id);
    if (error) throw new Error("Não foi possível salvar a licença.");
    return existing.id as string;
  }
  const { data: created, error } = await admin.from("licenses").insert({ ...payload, started_at: now }).select("id").single();
  if (error || !created) throw new Error("Não foi possível liberar a licença.");
  return created.id as string;
}

async function handleAdminList(req: Request, body: Body) {
  const gate = await requireAdmin(req, body);
  if ("error" in gate) return gate.error;
  const { data, error } = await gate.admin
    .from("licenses")
    .select("id, email, buyer_email, status, plan, expires_at, notes, hotmart_txn_id, started_at, created_at");
  if (error) return json({ error: "Não foi possível listar os autorizados." }, 500);
  const items = (data || [])
    .map((row) => ({
      id: row.id,
      email: normalizeEmail(row.email || row.buyer_email),
      status: String(row.status || ""),
      plan: String(row.plan || ""),
      notes: row.notes || "",
      hotmartId: row.hotmart_txn_id || "",
      createdAt: row.started_at || row.created_at,
      expiresAt: row.expires_at,
    }))
    .filter((r) => r.email)
    .sort((a, b) => a.email.localeCompare(b.email, "pt-BR"));
  return json({ items });
}

async function handleAdminLiberar(req: Request, body: Body, kind: "liberar" | "convite") {
  const gate = await requireAdmin(req, body);
  if ("error" in gate) return gate.error;
  const email = normalizeEmail(body.targetEmail);
  if (!isStrictEmail(email)) return json({ error: INVALID_EMAIL }, 400);
  const type = licenseTypeFields(body.licenseType, body.expiresOn);
  if ("error" in type) return json({ error: type.error }, 400);
  try {
    await upsertLicense(gate.admin, email, {
      hotmartId: kind === "liberar" ? String(body.hotmartId || "").trim() || undefined : undefined,
      notes: body.notes !== undefined ? String(body.notes || "").trim() : undefined,
      fields: type.fields,
    });
    await audit(gate.admin, gate.ctx, kind, email);
    return json({
      ok: true,
      message:
        kind === "convite"
          ? "Licença liberada. Oriente a cliente a abrir o app e tocar em Primeiro acesso com este e-mail."
          : "Licença liberada. A cliente cria a senha em Primeiro acesso.",
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Falha ao liberar." }, 500);
  }
}

async function handleAdminCriarConta(req: Request, body: Body) {
  const gate = await requireAdmin(req, body);
  if ("error" in gate) return gate.error;
  const { admin, ctx } = gate;
  const email = normalizeEmail(body.targetEmail);
  const fullName = String(body.fullName || "").trim();
  const password = String(body.password || "");
  if (!fullName) return json({ error: "Informe o nome." }, 400);
  if (!isStrictEmail(email)) return json({ error: INVALID_EMAIL }, 400);
  const policy = passwordPolicy(password);
  if (policy) return json({ error: policy }, 400);
  const type = licenseTypeFields(body.licenseType, body.expiresOn);
  if ("error" in type) return json({ error: type.error }, 400);
  try {
    await upsertLicense(admin, email, { fields: type.fields });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Falha ao liberar licença." }, 500);
  }
  const { data: existing } = await admin.from("accounts").select("id").eq("email", email).maybeSingle();
  if (existing) {
    await audit(admin, ctx, "cadastro_manual_so_licenca", email);
    return json({ ok: true, message: "Este e-mail já tinha conta: só a licença foi atualizada." });
  }
  const now = new Date().toISOString();
  const { data: created, error } = await admin
    .from("accounts")
    .insert({ email, password_hash: bcrypt.hashSync(password, 12), full_name: fullName, is_active: true, password_changed_at: now })
    .select("id")
    .single();
  if (error || !created) return json({ error: "Não foi possível criar a conta." }, 500);
  await admin.from("profiles").upsert(
    { account_id: created.id, email, full_name: fullName, role: await roleForEmail(admin, email), is_active: true, password_changed_at: now },
    { onConflict: "account_id" },
  );
  await linkLicenseToAccount(admin, email, created.id);
  await audit(admin, ctx, "cadastro_manual", email);
  return json({ ok: true, message: "Conta criada. No 1º login a cliente cadastra o autenticador (QR)." });
}

async function licenseById(admin: Admin, id: unknown) {
  const licenseId = String(id || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(licenseId)) return null;
  const { data } = await admin
    .from("licenses")
    .select("id, email, buyer_email, status, plan, expires_at")
    .eq("id", licenseId)
    .maybeSingle();
  return data;
}

async function revokeByEmail(admin: Admin, email: string) {
  const { data: account } = await admin.from("accounts").select("id").eq("email", email).maybeSingle();
  if (account) await revokeAccountSessions(admin, account.id);
}

async function handleAdminEditar(req: Request, body: Body) {
  const gate = await requireAdmin(req, body);
  if ("error" in gate) return gate.error;
  const row = await licenseById(gate.admin, body.licenseId);
  if (!row) return json({ error: "Registro não encontrado." }, 404);
  const email = normalizeEmail(body.targetEmail);
  if (!isStrictEmail(email)) return json({ error: INVALID_EMAIL }, 400);
  const type = licenseTypeFields(body.licenseType, body.expiresOn);
  if ("error" in type) return json({ error: type.error }, 400);
  const payload: Record<string, unknown> = { email, buyer_email: email, updated_at: new Date().toISOString() };
  if (body.notes !== undefined) payload.notes = String(body.notes || "").trim().slice(0, 500) || null;
  if (body.hotmartId !== undefined) payload.hotmart_txn_id = String(body.hotmartId || "").trim().slice(0, 120) || null;
  if (type.fields) Object.assign(payload, type.fields);
  const { error } = await gate.admin.from("licenses").update(payload).eq("id", row.id);
  if (error) {
    const dup = error.code === "23505";
    return json({ error: dup ? "Já existe outro autorizado com este e-mail." : "Não foi possível editar." }, dup ? 409 : 500);
  }
  await audit(gate.admin, gate.ctx, "editar", `${normalizeEmail(row.email)} → ${email}`);
  return json({ ok: true, message: "Autorizado atualizado." });
}

async function handleAdminRevogar(req: Request, body: Body) {
  const gate = await requireAdmin(req, body);
  if ("error" in gate) return gate.error;
  const row = await licenseById(gate.admin, body.licenseId);
  if (!row) return json({ error: "Registro não encontrado." }, 404);
  const { error } = await gate.admin
    .from("licenses")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", row.id);
  if (error) return json({ error: "Não foi possível revogar." }, 500);
  await revokeByEmail(gate.admin, normalizeEmail(row.email || row.buyer_email));
  await audit(gate.admin, gate.ctx, "revogar", normalizeEmail(row.email));
  return json({ ok: true, message: "Acesso revogado e sessões encerradas." });
}

async function handleAdminReativar(req: Request, body: Body) {
  const gate = await requireAdmin(req, body);
  if ("error" in gate) return gate.error;
  const row = await licenseById(gate.admin, body.licenseId);
  if (!row) return json({ error: "Registro não encontrado." }, 404);
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
    return json({ error: "Licença vencida: use Editar e escolha o novo tipo de licença." }, 400);
  }
  const status = String(row.plan) === "trial" ? "trial" : "active";
  const { error } = await gate.admin.from("licenses").update({ status, updated_at: new Date().toISOString() }).eq("id", row.id);
  if (error) return json({ error: "Não foi possível reativar." }, 500);
  await audit(gate.admin, gate.ctx, "reativar", normalizeEmail(row.email));
  return json({ ok: true, message: "Acesso reativado." });
}

async function handleAdminExcluir(req: Request, body: Body) {
  const gate = await requireAdmin(req, body);
  if ("error" in gate) return gate.error;
  const row = await licenseById(gate.admin, body.licenseId);
  if (!row) return json({ error: "Registro não encontrado." }, 404);
  const { error } = await gate.admin.from("licenses").delete().eq("id", row.id);
  if (error) return json({ error: "Não foi possível excluir." }, 500);
  for (const e of new Set([normalizeEmail(row.email), normalizeEmail(row.buyer_email)].filter(Boolean))) {
    await revokeByEmail(gate.admin, e);
  }
  await audit(gate.admin, gate.ctx, "excluir", normalizeEmail(row.email));
  return json({ ok: true, message: "E-mail excluído da lista." });
}

async function handleAdminResetTotp(req: Request, body: Body) {
  const gate = await requireAdmin(req, body);
  if ("error" in gate) return gate.error;
  const email = normalizeEmail(body.targetEmail);
  if (!isStrictEmail(email)) return json({ error: INVALID_EMAIL }, 400);
  const { data: account } = await gate.admin.from("accounts").select("id").eq("email", email).maybeSingle();
  if (!account) return json({ error: "Conta não encontrada." }, 404);
  await revokeAccountSessions(gate.admin, account.id);
  await gate.admin
    .from("accounts")
    .update({ totp_secret_enc: null, totp_enabled_at: null, updated_at: new Date().toISOString() })
    .eq("id", account.id);
  await audit(gate.admin, gate.ctx, "reset_totp", email);
  return json({
    ok: true,
    message: "Autenticador resetado. Peça para a cliente apagar a entrada antiga do CostureiraPro no celular e escanear só o QR novo no próximo login.",
  });
}

// ---------- Roteamento + CORS ----------

function withCors(req: Request, res: Response) {
  const origin = req.headers.get("origin") || "";
  const headers = new Headers(res.headers);
  if (ALLOWED_ORIGINS.has(origin) || /^https:\/\/costureirapro-[a-z0-9-]+\.vercel\.app$/.test(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }
  return new Response(res.body, { status: res.status, headers });
}

async function route(req: Request) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_BASE });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const body = ((await req.json().catch(() => ({}))) || {}) as Body;
    switch (String(body.action || "")) {
      case "login": return await handleLogin(body);
      case "totp_enable": return await handleTotpEnable(body);
      case "register": return await handleRegister(req, body);
      case "verify_registration": return await handleVerifyRegistration(body);
      case "finish_registration": return await handleFinishRegistration(body);
      case "me": return await handleMe(req, body);
      case "touch": return await handleTouch(req, body);
      case "logout": return await handleLogout(req, body);
      case "accept_terms": return await handleAcceptTerms(req, body);
      case "change_password": return await handleChangePassword(req, body);
      case "forgot": return await handleForgot(body);
      case "log_error": return await handleLogError(req, body);
      case "admin_list": return await handleAdminList(req, body);
      case "admin_liberar": return await handleAdminLiberar(req, body, "liberar");
      case "admin_convite": return await handleAdminLiberar(req, body, "convite");
      case "admin_criar_conta": return await handleAdminCriarConta(req, body);
      case "admin_editar": return await handleAdminEditar(req, body);
      case "admin_revogar": return await handleAdminRevogar(req, body);
      case "admin_reativar": return await handleAdminReativar(req, body);
      case "admin_excluir": return await handleAdminExcluir(req, body);
      case "admin_reset_totp": return await handleAdminResetTotp(req, body);
      default: return json({ error: "Ação inválida." }, 400);
    }
  } catch (e) {
    if (e instanceof InvalidEmailError) return json({ error: INVALID_EMAIL }, 400);
    console.error("[costureirapro-auth]", e);
    return json({ error: "Não foi possível concluir agora. Tente de novo." }, 500);
  }
}

Deno.serve(async (req) => withCors(req, await route(req)));
