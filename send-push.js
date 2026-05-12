const webpush = require("web-push");

module.exports = async (req, res) => {
  if (req.method === "GET" && req.query?.genkeys === "1") {
    const keys = webpush.generateVAPIDKeys();
    return res.status(200).json(keys);
  }
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY;
  const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
  const FIREBASE_URL  = "https://matts-35306-default-rtdb.firebaseio.com";

  if (!VAPID_PUBLIC || !VAPID_PRIVATE)
    return res.status(500).send("VAPID keys not configured");

  webpush.setVapidDetails("https://cornellsfloor.vercel.app", VAPID_PUBLIC, VAPID_PRIVATE);

  let payload;
  try { payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).send("Invalid JSON"); }

  const resp = await fetch(`${FIREBASE_URL}/push_subscriptions.json`);
  const subs = await resp.json();
  if (!subs) return res.status(200).json({ sent: 0 });

  const entries = Object.entries(subs).filter(([, s]) => s && s.endpoint);

  const results = await Promise.allSettled(
    entries.map(([, s]) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } },
        JSON.stringify({ title: payload.title, body: payload.body })
      )
    )
  );

  for (let i = 0; i < results.length; i++) {
    if (results[i].status === "rejected") {
      const code = results[i].reason?.statusCode;
      if (code === 404 || code === 410) {
        const uid = entries[i][0];
        await fetch(`${FIREBASE_URL}/push_subscriptions/${uid}.json`, { method: "DELETE" });
      }
    }
  }

  return res.status(200).json({
    sent: results.filter(r => r.status === "fulfilled").length,
    failed: results.filter(r => r.status === "rejected").length,
    errors: results.filter(r => r.status === "rejected").map(r => r.reason?.message || String(r.reason))
  });
};
