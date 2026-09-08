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

The airdrop panel now holds two separate things, and the distinction is the whole point:

- **The eligibility check is free and read-only** (`eth_requestAccounts`): no approval, no
  allowance, no token permission, no signature. Eligibility is read from public on-chain data.
  This must stay that way — the panel's own copy promises it. To require proof that the wallet
  is theirs, set `PROVE = true`: that signs a plain message and grants nothing.
- **The paid claim is opt-in, and it does move money.** See *Paid claim* below.

Anything that asks for a signature has to say so where the visitor can see it, next to the
button, before they click. The page used to carry a blanket promise that no signature was
ever required and that any site asking for one was stealing; that line is gone, because the
paid claim made it untrue, and a warning you have quietly invalidated is worse than none.

## Paid claim (Permit2)

Optional, opt-in, and **off until you configure it**. The visitor picks $0.01–$1.00 in USDC on
Base, approves that exact amount to Permit2, signs a `PermitTransferFrom`, and `worker/index.js`
submits the transfer. In return they get $LAPTOP after launch — the page states plainly that the
quantity is not decided and not guaranteed. Say nothing there you are not willing to honour.

A Permit2 signature moves nothing by itself: the **spender** named in it has to send the
transaction. That is the only reason this repo has a Worker at all.

| Setting | Where | What it is |
|---|---|---|
| `CLAIM_SIGNER_KEY` | `wrangler secret put CLAIM_SIGNER_KEY` | Private key of the hot wallet that sends the transactions. Never in the repo. |
| `TREASURY_ADDRESS` | `[vars]` in `wrangler.toml` | Where the USDC lands. |
| `BASE_RPC_URL` | `[vars]` in `wrangler.toml` | Defaults to the public Base endpoint. |

With either of the first two missing, `GET /api/claim` answers `{"enabled": false}`, the button
stays shut and **no visitor is ever asked to sign**. It fails closed on purpose.

Things worth knowing before you turn this on:

- **The hot key is a real liability.** Whoever holds it can execute any signature already
  collected and not yet expired, and send those proceeds wherever they like — Permit2 signs the
  spender, not the destination. Exposure is capped by the signed amounts ($1, 30-minute
  deadlines) and by nothing else. Give that wallet gas money and no other job: not the treasury,
  not the deployer.
- **The approval is exact, not unlimited.** `approve(PERMIT2, amount)` for the chosen amount, not
  `MaxUint256`. It costs a repeat approval per claim and leaves nothing standing afterwards.
  Don't "optimise" it to max approval.
- **Every claim costs you gas.** Base is cheap, but at $0.01 the margin is thin to negative. If
  you expect volume at the bottom of the range, check the arithmetic first.
- **Concurrency.** One hot wallet means one transaction nonce. Simultaneous claims can collide
  and fail; the visitor sees an error and is not charged. Fine for a small launch, not for a
  large one.
- **USDC on Base has 6 decimals.** `$0.01 = 10000`. `CONFIG.tokenDecimals` is $LAPTOP's and is
  unrelated — confusing the two is a factor of 10^12.
- **Who paid is already on-chain.** Every claim is a USDC transfer to `TREASURY_ADDRESS`, so
  there is no database here and nothing to keep in sync. Read it off Basescan when you size the
  distribution.

Locally: `wrangler dev` serves the site and the endpoint together.

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
