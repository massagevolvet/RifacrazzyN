function cleanUid(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 20);
}

function cleanRegion(value) {
  const allowed = new Set(["BR", "IND", "SG", "RU", "ID", "TW", "US", "VN", "TH", "ME", "PK", "CIS", "BD"]);
  const region = String(value || "BR").toUpperCase();
  return allowed.has(region) ? region : "BR";
}

function pickBasicInfo(payload) {
  return payload?.basicinfo || payload?.basicInfo || payload?.basic_info || payload?.data?.basicinfo || payload?.data?.basicInfo || payload?.data?.basic_info || null;
}

function json(data, status = 200) {
  return Response.json(data, { status });
}

export default async (req) => {
  const url = new URL(req.url);
  const uid = cleanUid(url.searchParams.get("uid"));
  const region = cleanRegion(url.searchParams.get("region"));

  if (uid.length < 6) return json({ ok: false, message: "ID inválido. Use apenas números." }, 400);

  const sources = [
    { name: "wz-player-info", url: `https://wzapiinfo.vercel.app/get?uid=${encodeURIComponent(uid)}` },
    { name: "ashu-player-info", url: `https://ffinfo-ashu-psi.vercel.app/api/player?uid=${encodeURIComponent(uid)}&key=ashumodder` },
    { name: "glob-info", url: `https://glob-info2.vercel.app/info?uid=${encodeURIComponent(uid)}` },
    { name: "freefireinfo", url: `https://freefireinfo-zy9l.onrender.com/api/v1/player-profile?uid=${encodeURIComponent(uid)}&server=${encodeURIComponent(region)}` }
  ];

  for (const source of sources) {
    try {
      const upstream = await fetch(source.url, {
        headers: { accept: "application/json", "user-agent": "blackwhite.recarga/1.0" }
      });
      if (!upstream.ok) continue;
      const payload = await upstream.json();
      const basic = pickBasicInfo(payload);
      const nickname = basic?.nickname || payload?.nickname || payload?.data?.nickname;
      if (!nickname) continue;
      const accountId = String(basic?.accountid || basic?.accountId || basic?.account_id || payload?.uid || uid);
      const playerRegion = String(basic?.region || region).toUpperCase();
      const level = Number(basic?.level || 0) || null;
      return json({ ok: true, player: { uid: accountId, nickname: String(nickname), region: playerRegion, level }, source: source.name });
    } catch (error) {
      console.log("player source failed", source.name, error?.message || String(error));
    }
  }

  return json({ ok: false, message: "Jogador não encontrado ou consulta temporariamente indisponível." }, 404);
};

export const config = { path: "/api/player", method: ["GET"] };
