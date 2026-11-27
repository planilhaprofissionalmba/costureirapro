/** TOTP (RFC 6238) — segredo Base32, 6 dígitos, janela ±1. */

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateTotpSecret(bytes = 20): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return encodeBase32(buf);
}

function encodeBase32(data: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of data) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function decodeBase32(input: string): Uint8Array {
  const cleaned = input.replace(/=+$/g, "").toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of cleaned) {
    const idx = BASE32.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

function counterBytes(counter: number): Uint8Array {
  const buf = new Uint8Array(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) {
    buf[i] = c & 255;
    c = Math.floor(c / 256);
  }
  return buf;
}

async function hotp(secret: Uint8Array, counter: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, counterBytes(counter)));
  const offset = sig[sig.length - 1] & 0xf;
  const code =
    ((sig[offset] & 0x7f) << 24) |
    ((sig[offset + 1] & 0xff) << 16) |
    ((sig[offset + 2] & 0xff) << 8) |
    (sig[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

export async function verifyTotp(secretBase32: string, code: string, window = 1): Promise<boolean> {
  const digits = String(code || "").replace(/\D/g, "");
  if (!/^\d{6}$/.test(digits)) return false;
  const secret = decodeBase32(secretBase32);
  if (secret.length < 10) return false;
  const step = Math.floor(Date.now() / 1000 / 30);
  for (let w = -window; w <= window; w++) {
    const expected = await hotp(secret, step + w);
    if (expected === digits) return true;
  }
  return false;
}

/**
 * Segredo TOTP cifrado no banco (auditoria M6): AES-GCM com o secret COSTUREIRAPRO_TOTP_KEY
 * (32 bytes em base64). Formato gravado: "v1:" + base64(iv 12 bytes + texto cifrado).
 * Valores antigos sem "v1:" ainda são lidos como texto puro (transição sem novo QR).
 */
const SEALED_PREFIX = "v1:";

async function totpKey(): Promise<CryptoKey> {
  const raw = Deno.env.get("COSTUREIRAPRO_TOTP_KEY")?.trim();
  const bytes = raw ? Uint8Array.from(atob(raw), (c) => c.charCodeAt(0)) : new Uint8Array();
  if (bytes.length !== 32) throw new Error("Autenticador indisponível no momento. Fale com o suporte.");
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export function isSealedTotpSecret(stored: string) {
  return stored.startsWith(SEALED_PREFIX);
}

export async function sealTotpSecret(secretBase32: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await totpKey(), new TextEncoder().encode(secretBase32)),
  );
  const packed = new Uint8Array(iv.length + cipher.length);
  packed.set(iv);
  packed.set(cipher, iv.length);
  return SEALED_PREFIX + btoa(String.fromCharCode(...packed));
}

export async function openTotpSecret(stored: string): Promise<string> {
  if (!isSealedTotpSecret(stored)) return stored;
  const packed = Uint8Array.from(atob(stored.slice(SEALED_PREFIX.length)), (c) => c.charCodeAt(0));
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: packed.slice(0, 12) },
    await totpKey(),
    packed.slice(12),
  );
  return new TextDecoder().decode(plain);
}

export function otpauthUrl(secret: string, email: string, issuer = "CostureiraPro"): string {
  const label = encodeURIComponent(`${issuer}:${email}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
