// Signs/verifies the auth cookie so it carries *which* staff member is
// logged in (not just "authed or not"), without needing a server-side
// session store. Uses Web Crypto so this also works in Edge middleware.

const SECRET = process.env.LILY_AUTH_TOKEN || "lily-authed";
const encoder = new TextEncoder();

function toB64Url(bytes: Uint8Array): string {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(padded + "===".slice((padded.length + 3) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function hmacKey() {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

// Cookie value: "<base64url staffId>.<base64url hmac signature>"
export async function signStaffId(staffId: string): Promise<string> {
  const payload = toB64Url(encoder.encode(staffId));
  const key = await hmacKey();
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return `${payload}.${toB64Url(new Uint8Array(sig))}`;
}

export async function verifySessionCookie(value: string | undefined): Promise<string | null> {
  if (!value) return null;
  const [payload, sig] = value.split(".");
  if (!payload || !sig) return null;
  try {
    const key = await hmacKey();
    const ok = await crypto.subtle.verify("HMAC", key, fromB64Url(sig).slice().buffer, encoder.encode(payload));
    if (!ok) return null;
    return new TextDecoder().decode(fromB64Url(payload));
  } catch {
    return null;
  }
}
