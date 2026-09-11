import { hasPaidCpf, saveOrder } from "./_shared/orders.mjs";
import { PACKAGES, digits, text, validCpf, hashValue } from "./_shared/checkout-utils.mjs";
import { createPixCharge, isLaranjinhaConfigured } from "./_shared/laranjinha.mjs";

const json = (data, status = 200) => Response.json(data, { status });

export default async (req) => {
  let body = {};
  try { body = await req.json(); } catch {}

  const uid = digits(body.uid);
  const nickname = text(body.nickname, 64);
  const region = text(body.region || "BR", 8).toUpperCase();
  const diamonds = Number(body.diamonds);
  const payerName = text(body.payer_name, 100);
  const cpf = digits(body.payer_document);
  const confirmRegular = body.confirm_regular === true;

  if (uid.length < 6 || !nickname) return json({ok:false,code:"invalid_player",message:"Jogador inválido."},400);
  if (!PACKAGES.has(diamonds)) return json({ok:false,code:"invalid_package",message:"Pacote inválido."},400);
  if (payerName.length < 3) return json({ok:false,code:"invalid_payer_name",message:"Informe o nome do pagador."},400);
  if (!validCpf(cpf)) return json({ok:false,code:"invalid_cpf",message:"Informe um CPF válido para gerar o PIX."},400);
  if (!isLaranjinhaConfigured()) return json({ok:false,code:"payment_not_configured",message:"O PIX ainda não foi ativado pelo lojista."},503);

  const cpfHash = await hashValue(cpf);
  const originalAmount = PACKAGES.get(diamonds);
  const firstRecharge = !(await hasPaidCpf(cpfHash));

  if (!firstRecharge && !confirmRegular) {
    return json({ok:false,code:"discount_not_eligible",message:"A promoção de 30% já foi usada neste CPF.",amount_cents:originalAmount,discount_percent:0},409);
  }

  const chargedAmount = firstRecharge ? Math.round(originalAmount * 0.70) : originalAmount;
  const now = new Date().toISOString();
  const order = {
    id: crypto.randomUUID(), created_at: now, updated_at: now,
    uid, nickname, region, diamonds,
    original_amount_cents: originalAmount,
    charged_amount_cents: chargedAmount,
    first_recharge_discount: firstRecharge,
    payer_name: payerName,
    payer_document_hash: cpfHash,
    charge_id: null,
    payment_status: "creating",
    fulfillment_status: "pending",
    delivered_at: null
  };
  await saveOrder(order);

  try {
    const { response, data } = await createPixCharge({
      amount_cents: chargedAmount,
      description: `blackwhite.recarga - ${diamonds} diamantes - UID ${uid}`,
      payer: { name: payerName, document: cpf },
      metadata: { order_id: order.id, uid, diamonds: String(diamonds) }
    });
    const charge = data.charge;

    if (!response.ok || !data.ok || !charge?.id || !charge?.qr_code) {
      order.payment_status = "payment_error";
      await saveOrder(order);
      return json({ok:false,code:data.code||"payment_provider_error",message:data.message||data.error||"Não foi possível gerar o PIX agora."},502);
    }

    order.charge_id = charge.id;
    order.payment_status = charge.status || "pending";
    await saveOrder(order);

    return json({
      ok: true,
      order_id: order.id,
      promotion: { first_recharge: firstRecharge, discount_percent: firstRecharge ? 30 : 0 },
      amount_cents: chargedAmount,
      charge: {
        id: charge.id,
        status: charge.status || "pending",
        qr_code: charge.qr_code,
        qr_code_image: charge.qr_code_image || null,
        expires_at: charge.expires_at || null
      }
    }, 201);
  } catch (error) {
    console.log("checkout provider error", error?.message || String(error));
    order.payment_status = "payment_error";
    await saveOrder(order);
    return json({ok:false,code:"payment_provider_unavailable",message:"O serviço de PIX está temporariamente indisponível."},502);
  }
};

export const config = { path: "/api/checkout", method: ["POST"] };
