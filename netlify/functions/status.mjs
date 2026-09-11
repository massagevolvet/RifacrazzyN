export default async () => Response.json({
  ok: true,
  app: "blackwhite.recarga",
  mode: "manual-fulfillment",
  payments: "laranjinha",
  fulfillment: "manual",
  hosting: "netlify"
});

export const config = { path: "/api/status", method: ["GET"] };
