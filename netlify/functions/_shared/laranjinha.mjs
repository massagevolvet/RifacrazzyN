const BASE_URL = "https://mqvdjjbkjglaimbnpcer.supabase.co/functions/v1/api-proxy";

function apiKey() {
  return Netlify.env.get("LARANJINHA_API_KEY");
}

export function isLaranjinhaConfigured() {
  return Boolean(apiKey());
}

export async function createPixCharge(payload) {
  const key = apiKey();
  if (!key) throw new Error("payment_not_configured");
  const response = await fetch(`${BASE_URL}/charges`, {
    method: "POST",
    headers: { "X-API-Key": key, "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}
