import { getOrder, listOrders, saveOrder } from "./_shared/orders.mjs";

const json = (data, status = 200) => Response.json(data, { status });

function authorized(req) {
  const expected = Netlify.env.get("ADMIN_KEY");
  const provided = req.headers.get("x-admin-key") || "";
  return Boolean(expected && provided && expected === provided);
}

function safeOrder(order) {
  const { payer_document_hash, ...safe } = order;
  return safe;
}

export default async (req) => {
  if (!authorized(req)) return json({ok:false,message:"Acesso não autorizado."},401);

  if (req.method === "POST") {
    let body = {};
    try { body = await req.json(); } catch {}
    const orderId = String(body.order_id || "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(orderId)) return json({ok:false,message:"Pedido inválido."},400);

    const order = await getOrder(orderId);
    if (!order) return json({ok:false,message:"Pedido não encontrado."},404);
    if (order.payment_status !== "paid") return json({ok:false,message:"O pedido precisa estar pago antes de marcar como entregue."},409);

    order.fulfillment_status = "delivered";
    order.delivered_at = new Date().toISOString();
    await saveOrder(order);
    return json({ok:true,order:safeOrder(order)});
  }

  const orders = (await listOrders(100)).map(safeOrder);
  return json({ok:true,orders});
};

export const config = { path: "/api/admin/orders", method: ["GET", "POST"] };
