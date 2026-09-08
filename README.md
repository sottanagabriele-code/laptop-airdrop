# $LAPTOP — laptop-airdrop

A focused airdrop contribution page: the amount selector, quick presets, recipient
and participation terms are presented before the wallet confirmation. No amount is
preselected, and the page does not invent participant counts, urgency or token allocations.

Single-file static site for the planned $LAPTOP token on Base. All application
CSS and JavaScript are inline in index.html; ethers 6.13.4 loads from the
existing CDN. No build step or payment backend is required.

## Direct contributions

Visitors choose an amount of ETH or native USDC on Base and explicitly confirm
a direct transfer to the organizer's displayed wallet. The page does not swap,
approve token allowances, ask for Permit2 signatures, or distribute tokens.

The token has not been created. Page copy and a required acknowledgment explain
that funds are sent now and the organizer plans a manual token distribution
after launch, with amounts decided later and no fixed rate or guaranteed allocation.
Connecting a wallet alone does not request a payment.

The organizer supplied this public receiving address, configured in the CONTRIBUTIONS
object in index.html:

    recipient: '0x4704c46857f175b12b86428c9b0a3fd32b991af4'

The existing Base network is retained. ETH is selected by default; USDC remains available.
The page requires a valid amount before requesting a wallet connection, and requires
acknowledgment of the distribution terms before requesting the payment.

This is the organizer's designated receiving wallet on Base. Do not substitute the
future $LAPTOP contract address, USDC's contract address, or a private key.
Recipient, sender and exact amount are shown before the wallet confirmation.
ETH and USDC are transferred as selected; this page does not convert currencies.
Visitors need ETH on Base to cover their wallet's displayed network fee.

Transfers create an on-chain record of sender, recipient and amount. Each confirmed
contribution links to its Basescan receipt. There is no off-chain donor database
and no automatic token allocation, refund or distribution. The organizer must
review the confirmed transfers and decide any later distribution manually.

## Validation

Run the application-flow tests with Node's built-in test runner:

    node --test tests/contributions.test.cjs

These tests run the actual inline payment script against mock wallets and DOM
elements. They cover exact ETH/USDC amounts, required consent, recipient validation,
network/account changes, rejection, duplicate clicks and uncertain receipts.
They never access a real wallet or send a real transaction. They do not verify
browser rendering or prove an on-chain payment succeeds.

The recipient has been supplied by the organizer. Complete
a user-confirmed end-to-end payment check. Changing main triggers the existing
Cloudflare publication workflow.

## Later token launch

The token contract is not needed to receive contributions. Update the published token information and distribution details
when those details exist. Do not present unverified supply, transfer fees or
allocation terms as established facts.

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

Direct contributions use the visitor's wallet and work with the existing static hosting.
No 0x API key, swap proxy or new Cloudflare service is needed.

## Working on this repo

This repository is the single source of truth. Edit it here — the web editor,
`.` for github.dev, or Claude committing straight through the GitHub API.
GitHub Pages redeploys automatically about a minute after each commit.

Live site: https://sottanagabriele-code.github.io/laptop-airdrop/
