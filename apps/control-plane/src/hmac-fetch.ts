import crypto from "crypto";

const HMAC_SECRET = process.env.AUTOMIT_HMAC_SECRET || "";

export async function hmacFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const body = options.body ? String(options.body) : "";
  const signature = crypto.createHmac("sha256", HMAC_SECRET).update(body).digest("hex");
  const headers = new Headers(options.headers);
  headers.set("X-Signature", signature);
  if (!headers.has("Content-Type") && options.method !== "GET") {
    headers.set("Content-Type", "application/json");
  }
  return fetch(url, { ...options, headers });
}
