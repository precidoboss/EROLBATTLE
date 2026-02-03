Vercel setup & security notes

Quick steps to keep secrets out of the client and run safe on Vercel:

1) Rotate the exposed keys immediately
   - Revoke and recreate the SUPABASE key and the RouteScan/API key you previously committed.

2) Add Environment Variables in Vercel (Project → Settings → Environment Variables)
   - SUPABASE_KEY  (if you need to use on client, better to use an ANON public key with limited permissions)
   - API_KEY (used only by the serverless proxy created at `/api/tokenholders`)
- SUPABASE_SERVICE_KEY (server-only service role key used by `/api/purchase` to insert purchase records)
- SUPABASE_URL (your Supabase project URL, e.g. https://xyz.supabase.co)
- EROL_CONTRACT (optional; overrides on-chain EROL token contract address used for verification)
- COMMUNITY_ADDRESS (optional; overrides the community receiving address; defaults to 0x46914D5D...)
- RPC_URL (optional; JSON-RPC endpoint for Avalanche C-Chain; defaults to https://api.avax.network/ext/bc/C/rpc)

Automatic verification behavior:
- The serverless `/api/purchase` endpoint will automatically verify that the provided transaction hash includes an **ERC-20 Transfer** from the EROL token contract to `COMMUNITY_ADDRESS` with an **exact** token amount equal to `booster.price` (multiplied by 10^18 — token uses 18 decimals).
- If verification succeeds, the purchase is stored and marked `processed=true`.
- If verification fails (wrong recipient, wrong token, wrong amount, or tx not mined), the attempt is recorded with `processed=false` and the API returns an error explaining the mismatch.

   - `api/tokenholders.js` is a Vercel Serverless Function included in this repo.
   - It reads `process.env.API_KEY` and proxies the RouteScan call so the API key never reaches the browser.
   - Ensure `API_KEY` is set in Vercel for Production/Preview as required.

4) (Optional) Inject runtime env into `window.__ENV`
   - If you still need env values available in client-side JS, generate a small `public/env.js` during the build that sets `window.__ENV`.
   - Example Build Command (set on Vercel):

     bash -lc "printf \"window.__ENV = { SUPABASE_KEY: '%s', API_KEY: '%s' };\" \"$SUPABASE_KEY\" \"$API_KEY\" > public/env.js || true"

   - Our `index.html` will automatically try to load `/env.js` at runtime if it exists.
   - **Warning:** Any value included in `public/env.js` will be publicly visible. Avoid placing sensitive server-only secrets there.

5) Client-side Supabase usage
   - The current code reads `SUPABASE_KEY` from `window.__ENV` (if present). It's recommended to use a Supabase anon key for public client features or proxy Supabase calls through server-side functions with restricted privileges.

6) Additional fixes applied in code
   - Replaced Tailwind `@apply` rules (which require build-time processing) with explicit CSS in `index.html`.
   - Sanitized dynamic DOM updates (replaced risky `innerHTML` usage with safe DOM creation to reduce XSS risk).
   - Added `rel="noopener noreferrer"` to external links and `crossorigin="anonymous"` to media elements.

If you'd like, I can:
- Add a GitHub Actions workflow that generates `public/env.js` during CI from encrypted secrets, or
- Implement server-side Supabase calls (for any flows that require a secret key) using Vercel functions.

Removing secrets from git history
- After rotating keys, scrub the old secrets from your git history (BFG or git filter-repo are recommended).
- Example (BFG):
  1. Create a file `replacements.txt` with the secrets you want to remove.
  2. Run `bfg --replace-text replacements.txt` and follow BFG's instructions, then `git push --force`.
- See official docs for `bfg` or `git filter-repo` for complete and safe workflows.

