import { getOrder, markCpfPaid, saveOrder } from "./_shared/orders.mjs";

const BASE_URL = "https://mqvdjjbkjglaimbnpcer.supabase.co/functions/v1/api-proxy";
const json = (data, status = 200) => Response.json(data, { status });

function publicOrder(order) {
  const { payer_document_hash, payer_name, ...safe } = order;
  return safe;
}

export default async (req) => {
  const url = new URL(req.url);
  const orderId = String(url.searchParams.get("order_id") || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return json({ok:false,message:"Pedido inválido."},400);

  const order = await getOrder(orderId);
  if (!order) return json({ok:false,message:"Pedido não encontrado."},404);

  if (order.payment_status === "paid" || order.fulfillment_status === "delivered" || !order.charge_id) {
    return json({ok:true,order:publicOrder(order)});
  }

  const apiKey = Netlify.env.get("LARANJINHA_API_KEY");
  if (!apiKey) return json({ok:false,message:"PIX não configurado."},503);

  try {
    const response = await fetch(`${BASE_URL}/charges/${encodeURIComponent(order.charge_id)}`, {
      headers: { "X-API-Key": apiKey }
    });
    const data = await response.json().catch(() => ({}));
    const charge = data.charge;

    if (response.ok && data.ok && charge?.status) {
      order.payment_status = charge.status;
      if (charge.status === "paid") {
        order.fulfillment_status = "awaiting_manual_delivery";
        if (order.payer_document_hash) await markCpfPaid(order.payer_document_hash, order.id);
      }
      await saveOrder(order);
    }

    return json({ok:true,order:publicOrder(order)});
  } catch (error) {
    console.log("payment status error", error?.message || String(error));
    return json({ok:true,order:publicOrder(order),warning:"Não foi possível atualizar o status neste instante."});
  }
};

export const config = { path: "/api/payment-status", method: ["GET"] };
