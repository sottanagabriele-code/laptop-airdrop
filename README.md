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

`robots.txt`, `sitemap.xml`, a canonical URL, Open Graph tags and `WebSite` JSON-LD are all
in place, and `og.png` is the link preview.

Submission is automated where it can be. Every deploy pings **IndexNow**, which Bing,
Yandex, Seznam and Naver honour without any registration — DuckDuckGo reads Bing's index,
so it follows. The key is the 32-hex `.txt` file at the repository root; it has to stay
served at the site root for the ping to be accepted, so do not delete or rename it.

**Google is the exception and it is manual.** Google does not participate in IndexNow and
retired its sitemap ping endpoint, so the only way in is to verify the site in
[Google Search Console](https://search.google.com/search-console) and submit `sitemap.xml`
by hand. Expect days, not hours: the page will not be in Google for the September 9 launch,
so launch traffic has to come from X, Telegram and DEXScreener.

## Hosting

Live on Cloudflare Workers: <https://laptop-airdrop.bluefootprovider.workers.dev/> — that is the
canonical URL declared in the page, and where search engines are pointed.

GitHub Pages still serves the same files at
<https://sottanagabriele-code.github.io/laptop-airdrop/> and redeploys about a minute after
each commit to `main`. It is a mirror: the canonical tag sends search engines to the
Cloudflare copy, so the two do not compete. Keep it as a fallback or turn it off in
Settings -> Pages.

`.github/workflows/pubblica.yml` also publishes to Cloudflare Workers, the same way
`goldenshop` does. Without credentials it skips that step rather than failing the run.

A manual run with the `temporaneo` input deploys anyway, using wrangler's temporary-account
mode: no credentials, but the account has to be claimed within 60 minutes or it disappears,
and every run creates a fresh one on a new random subdomain. It is a way to see the site on
Cloudflare, not a deployment path to rely on.

For a deploy that survives, add both secrets under
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
