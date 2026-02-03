// Vercel Serverless Function: verify purchase tx then create a marketplace purchase record in Supabase
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { booster, target, txLink } = req.body || {};
  if (!booster || !target || !txLink) return res.status(400).json({ error: 'Missing parameters' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; // service role key
  const CONTRACT_ADDRESS = (process.env.EROL_CONTRACT || '0xCaC4904E1DB1589Aa17A2Ec742F5a6bCF4c4D037').toLowerCase();
  const COMMUNITY_ADDRESS = (process.env.COMMUNITY_ADDRESS || '0x46914D5DC59598801e435AF2a08928Da87C60dF0').toLowerCase();
  const RPC_URL = process.env.RPC_URL || 'https://api.avax.network/ext/bc/C/rpc';

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return res.status(500).json({ error: 'SUPABASE_SERVICE_KEY or SUPABASE_URL not configured' });

  try {
    // 1) fetch booster price from boosters table
    const bRes = await fetch(`${SUPABASE_URL}/rest/v1/boosters?id=eq.${encodeURIComponent(booster)}`, {
      headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
    });
    const bJson = await bRes.json();
    if (!bRes.ok || !bJson || !bJson.length) return res.status(400).json({ error: 'Invalid booster id' });
    const price = parseInt(bJson[0].price, 10);

    // 2) parse tx hash from provided link
    const m = (txLink || '').match(/0x[a-fA-F0-9]{64}/);
    if (!m) return res.status(400).json({ error: 'Could not parse tx hash from txLink' });
    const txHash = m[0];

    // 3) get transaction receipt from RPC
    const receiptRes = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getTransactionReceipt', params: [txHash] })
    });
    const receiptJson = await receiptRes.json();
    const receipt = receiptJson.result;
    if (!receipt) return res.status(400).json({ error: 'Transaction receipt not found or not yet mined' });

    // 4) inspect logs for ERC20 Transfer to COMMUNITY_ADDRESS from CONTRACT_ADDRESS with exact amount
    const TRANSFER_SIG = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
    const expectedAmount = BigInt(price) * BigInt('1000000000000000000'); // assume 18 decimals
    let verified = false;

    for (const log of receipt.logs || []) {
      if (!log.address) continue;
      if (log.address.toLowerCase() !== CONTRACT_ADDRESS) continue;
      if (!log.topics || log.topics[0] !== TRANSFER_SIG) continue;
      // topics[2] is to address (indexed), data is amount (uint256)
      const toRaw = log.topics[2];
      const toAddr = '0x' + toRaw.slice(26).toLowerCase();
      const amount = BigInt(log.data);
      if (toAddr === COMMUNITY_ADDRESS && amount === expectedAmount) { verified = true; break; }
    }

    // 5) insert a record with processed flag depending on verification
    const payload = {
      booster_id: booster,
      target_wallet: target.toLowerCase(),
      tx_link: txLink,
      price: price,
      processed: verified,
      processed_at: verified ? new Date().toISOString() : null,
      processor: verified ? 'auto' : null
    };

    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/marketplace_purchases`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(payload)
    });
    const insertJson = await insertRes.json();
    if (!insertRes.ok) return res.status(500).json({ error: insertJson });

    if (!verified) return res.status(400).json({ error: 'Transaction verification failed (not a matching EROL transfer to community address for exact amount)', record: insertJson[0] });
    return res.status(200).json({ success: true, record: insertJson[0] });

  } catch (err) {
    console.error('purchase error', err);
    return res.status(500).json({ error: err.message });
  }
}
