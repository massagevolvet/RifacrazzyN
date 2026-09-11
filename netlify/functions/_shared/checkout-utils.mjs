export const PACKAGES = new Map([[100,499],[310,1399],[520,2299],[1060,4499],[2180,8999],[5600,21999]]);

export const digits = (value) => String(value ?? "").replace(/\D/g, "");
export const text = (value, max = 80) => String(value ?? "").trim().slice(0, max);

export function validCpf(cpf) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (base, factor) => {
    let sum = 0;
    for (const digit of base) sum += Number(digit) * factor--;
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(cpf.slice(0,9),10) === Number(cpf[9]) && calc(cpf.slice(0,10),11) === Number(cpf[10]);
}

export async function hashValue(value) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
