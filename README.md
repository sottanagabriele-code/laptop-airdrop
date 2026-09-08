# $LAPTOP — laptop-airdrop

Landing page for **$LAPTOP**, an independent memecoin on Base. Launch: **September 9**.

Single-file static site: `index.html` — all CSS and JS inline, Google Fonts only, no build step.

## Fill these in before going live

Search `index.html` for `EDIT`:

| What | Where |
|---|---|
| Contract address | `#ca-text` in the header, and `CONFIG.token` in the script |
| Launch time | `var LAUNCH = '2026-09-09T16:00:00Z'` (UTC) |
| 0x API proxy | `CONFIG.apiBase` — a same-origin endpoint forwarding to `api.0x.org` with the `0x-api-key` and `0x-version: v2` headers. **Never put the API key in this file.** |
| Social links | footer `.links` |
| Open Graph image | `og:image` / `twitter:image` meta tags |
| Video reel | the `.reel` slot |
| Price chart | the `.chart-box` iframe (DEXScreener embed) |

## Swap

**Currently disabled.** With no contract address in `CONFIG.token`, the buy button reads
"Coming soon" and clicking it says the same. It turns back on by itself once `CONFIG.token`
is set and `CONFIG.apiBase` points at a working 0x proxy.

Paying in USDC uses **Permit2** (`0x000000000022D473030F116dDEE9F6B43aC78BA3`) through the
0x Swap API v2 `/swap/permit2/quote` endpoint: a one-time ERC-20 approval to Permit2, then a
scoped EIP-712 signature per swap appended to the calldata. Paying in native ETH skips Permit2.

The airdrop panel connects **read-only** (`eth_requestAccounts`): no approval, no allowance,
no token permission. Eligibility is read from public on-chain data. It must stay that way —
the panel's own copy promises it, and a Permit2 signature there would authorise token
transfers out of the visitor's wallet, not prove ownership. To require proof that the wallet
is theirs, set `PROVE = true`: that signs a plain message and grants nothing.

## Search visibility

`robots.txt`, `sitemap.xml`, a canonical URL and Open Graph tags are all in place, and
`og.png` is the link preview. Indexing still has to be requested: verify the site in
[Google Search Console](https://search.google.com/search-console) and submit
`sitemap.xml`. Expect days, not hours — Google will not have the page indexed for the
September 9 launch.

## Hosting

Live now on GitHub Pages: <https://sottanagabriele-code.github.io/laptop-airdrop/> — that is
the canonical URL declared in the page, and it deploys itself about a minute after each
commit to `main`.

`.github/workflows/pubblica.yml` also publishes to Cloudflare Workers on every push, the same
way `goldenshop` does. It is **not working yet**: the run fails at the wrangler step because
the repository has no Cloudflare credentials. Add both under
Settings → Secrets and variables → Actions:

| Secret | Where to get it |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → My Profile → API Tokens → *Edit Cloudflare Workers* template |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Workers & Pages → right-hand sidebar |

The workflow then deploys to `laptop-airdrop.<your-subdomain>.workers.dev`. Once that URL is
live, update `<link rel="canonical">`, `og:url`, `twitter:image` and `sitemap.xml` to point at
it, or the two copies compete in search results.

Cloudflare also runs functions, which GitHub Pages cannot. That is what the on-site swap needs:
the 0x proxy has to hold the API key server-side.

## Working on this repo

This repository is the single source of truth. Edit it here — the web editor,
`.` for github.dev, or Claude committing straight through the GitHub API.
GitHub Pages redeploys automatically about a minute after each commit.

Live site: https://sottanagabriele-code.github.io/laptop-airdrop/
