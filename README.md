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

Paying in USDC uses **Permit2** (`0x000000000022D473030F116dDEE9F6B43aC78BA3`) through the
0x Swap API v2 `/swap/permit2/quote` endpoint: a one-time ERC-20 approval to Permit2, then a
scoped EIP-712 signature per swap appended to the calldata. Paying in native ETH skips Permit2.

The airdrop panel connects **read-only** (`eth_requestAccounts`): no approval, no allowance,
no token permission. Eligibility is read from public on-chain data.

## Hosting

Static — GitHub Pages, Netlify, Vercel or Cloudflare Pages. The 0x proxy needs a serverless
function, so the on-site swap requires a host that supports them.

## Working on this repo

This repository is the single source of truth. Edit it here — the web editor,
`.` for github.dev, or Claude committing straight through the GitHub API.
GitHub Pages redeploys automatically about a minute after each commit.

Live site: https://sottanagabriele-code.github.io/laptop-airdrop/
