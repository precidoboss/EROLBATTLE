// Vercel Serverless Function: create a marketplace purchase record in Supabase
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { booster, target, txLink } = req.body || {};
  if (!booster || !target || !txLink) return res.status(400).json({ error: 'Missing parameters' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return res.status(500).json({ error: 'SUPABASE_SERVICE_KEY or SUPABASE_URL not configured' });

  try {
    const payload = {
      booster_id: booster,
      target_wallet: target,
      tx_link: txLink,
      processed: false
    };
    const r = await fetch(`${SUPABASE_URL}/rest/v1/marketplace_purchases`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(payload)
    });
    const json = await r.json();
    if (!r.ok) return res.status(500).json({ error: json });
    return res.status(200).json({ success: true, record: json[0] });
  } catch (err) {
    console.error('purchase error', err);
    return res.status(500).json({ error: err.message });
  }
}
