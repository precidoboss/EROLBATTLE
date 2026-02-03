// Vercel Serverless Function: proxies token holder list requests so the API key remains on the server
export default async function handler(req, res) {
  const API_KEY = process.env.API_KEY;
  const CONTRACT_ADDRESS = '0xCaC4904E1DB1589Aa17A2Ec742F5a6bCF4c4D037';
  if (!API_KEY) return res.status(500).json({ error: 'API_KEY not configured' });
  try {
    const url = `https://api.routescan.io/v2/network/mainnet/evm/43114/etherscan/api?module=token&action=tokenholderlist&contractaddress=${CONTRACT_ADDRESS}&page=1&offset=155&apikey=${API_KEY}`;
    const r = await fetch(url);
    const json = await r.json();
    res.status(200).json(json);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
