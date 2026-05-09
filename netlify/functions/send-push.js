const webpush = require("web-push");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };

  const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY;
  const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
  const FIREBASE_URL  = "https://matts-35306-default-rtdb.firebaseio.com";

  if (!VAPID_PUBLIC || !VAPID_PRIVATE)
    return { statusCode: 500, body: "VAPID keys not configured" };

  webpush.setVapidDetails("mailto:admin@cornells-floor.ro", VAPID_PUBLIC, VAPID_PRIVATE);

  let payload;
  try { payload = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: "Invalid JSON" }; }

  const resp = await fetch(`${FIREBASE_URL}/push_subscriptions.json`);
  const subs = await resp.json();
  if (!subs) return { statusCode: 200, body: JSON.stringify({ sent: 0 }) };

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

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sent: results.filter(r => r.status === "fulfilled").length,
      failed: results.filter(r => r.status === "rejected").length
    })
  };
};
