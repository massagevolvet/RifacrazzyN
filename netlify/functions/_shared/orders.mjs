import { getStore } from "@netlify/blobs";

export function ordersStore() {
  return getStore({ name: "blackwhite-orders", consistency: "strong" });
}

export function orderKey(id) {
  return `orders/${id}.json`;
}

export function paidCpfKey(hash) {
  return `paid-cpf/${hash}.json`;
}

export async function getOrder(id) {
  return ordersStore().get(orderKey(id), { type: "json" });
}

export async function saveOrder(order) {
  order.updated_at = new Date().toISOString();
  await ordersStore().setJSON(orderKey(order.id), order);
  return order;
}

export async function markCpfPaid(hash, orderId) {
  await ordersStore().setJSON(paidCpfKey(hash), {
    order_id: orderId,
    paid_at: new Date().toISOString()
  });
}

export async function hasPaidCpf(hash) {
  return Boolean(await ordersStore().get(paidCpfKey(hash), { type: "json" }));
}

export async function listOrders(limit = 100) {
  const store = ordersStore();
  const { blobs } = await store.list({ prefix: "orders/" });
  const selected = blobs.slice(-Math.max(limit, 1));
  const orders = (await Promise.all(selected.map((b) => store.get(b.key, { type: "json" })))).filter(Boolean);
  return orders.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, limit);
}
