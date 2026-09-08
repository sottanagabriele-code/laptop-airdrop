/**
 * Cloudflare Pages Function — /api/claim
 *
 * File-based routing: this path is the URL. Pages runs it before static
 * assets, so no route configuration is needed anywhere else.
 *
 * A Permit2 signature does not move anything on its own. The spender named in
 * the signature has to send permitTransferFrom on-chain, and this Function is
 * that spender. Without it the page would be collecting signatures nobody can
 * execute.
 *
 * Configuration (none of it lives in the repo):
 *   CLAIM_SIGNER_KEY  secret  private key of the hot wallet that sends the
 *                             transactions. Set it with
 *                             `wrangler pages secret put CLAIM_SIGNER_KEY`.
 *                             It only needs ETH for gas — see SECURITY below.
 *   TREASURY_ADDRESS  var     where the USDC lands.
 *   BASE_RPC_URL      var     Base RPC, defaults to the public endpoint.
 *
 * If either of the first two is missing the endpoint reports itself closed and
 * the page never asks anyone to sign. Fail closed, not open.
 *
 * SECURITY, stated plainly: whoever holds CLAIM_SIGNER_KEY can execute any
 * signature that has already been collected and is not past its deadline, and
 * can send the proceeds of those to an address of their choosing — Permit2
 * signs the spender, not the destination. Exposure is bounded by the signed
 * amounts ($1 each, 30-minute deadlines) and nothing else. Keep the key to
 * gas money, never reuse it as a treasury or a deployer key.
 */

import { ethers } from 'ethers';

const PERMIT2 = '0x000000000022D473030F116dDEE9F6B43aC78BA3';
const USDC    = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';  // USDC on Base
const CHAIN   = 8453;

// USDC has 6 decimals. $0.01 and $1.00 — the same bounds the page offers,
// re-checked here because the page is not the authority on this.
const MIN_AMOUNT = 10000n;
const MAX_AMOUNT = 1000000n;
const MAX_TTL    = 3600;   // reject deadlines further out than an hour

const PERMIT2_ABI = [
  'function permitTransferFrom(' +
    '((address token,uint256 amount) permitted,uint256 nonce,uint256 deadline) permit,' +
    '(address to,uint256 requestedAmount) transferDetails,' +
    'address owner,' +
    'bytes signature)'
];

const EIP712_TYPES = {
  PermitTransferFrom: [
    { name: 'permitted', type: 'TokenPermissions' },
    { name: 'spender',   type: 'address' },
    { name: 'nonce',     type: 'uint256' },
    { name: 'deadline',  type: 'uint256' }
  ],
  TokenPermissions: [
    { name: 'token',  type: 'address' },
    { name: 'amount', type: 'uint256' }
  ]
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });
}

function configured(env) {
  return Boolean(env.CLAIM_SIGNER_KEY && env.TREASURY_ADDRESS);
}

function signerFor(env) {
  const provider = new ethers.JsonRpcProvider(
    env.BASE_RPC_URL || 'https://mainnet.base.org',
    CHAIN,
    { staticNetwork: true }
  );
  return new ethers.Wallet(env.CLAIM_SIGNER_KEY, provider);
}

/** Everything the page needs to build a signature, and nothing secret. */
function handleGet(env) {
  if (!configured(env)) return json({ enabled: false });
  let spender, treasury;
  try {
    spender  = new ethers.Wallet(env.CLAIM_SIGNER_KEY).address;
    treasury = ethers.getAddress(env.TREASURY_ADDRESS);
  } catch {
    return json({ enabled: false });
  }
  return json({
    enabled:  true,
    chainId:  CHAIN,
    token:    USDC,
    decimals: 6,
    spender,
    treasury,
    min: MIN_AMOUNT.toString(),
    max: MAX_AMOUNT.toString()
  });
}

async function handlePost(request, env) {
  if (!configured(env)) return json({ error: 'Claims are not open.' }, 503);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Malformed request.' }, 400); }

  // ── validate before touching the chain ──────────────────────────────
  let owner, amount, nonce, deadline, signature;
  try {
    owner     = ethers.getAddress(body.owner);
    amount    = BigInt(body.amount);
    nonce     = BigInt(body.nonce);
    deadline  = BigInt(body.deadline);
    signature = String(body.signature || '');
  } catch {
    return json({ error: 'Malformed request.' }, 400);
  }

  if (amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
    return json({ error: 'Amount out of range.' }, 400);
  }
  if (!/^0x[0-9a-fA-F]{130}$/.test(signature)) {
    return json({ error: 'Malformed signature.' }, 400);
  }
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (deadline <= now) return json({ error: 'This signature has expired. Try again.' }, 400);
  if (deadline > now + BigInt(MAX_TTL)) return json({ error: 'Deadline too far out.' }, 400);

  const wallet = signerFor(env);

  // Recover the signer locally. This is free, and it stops anyone from making
  // the Worker burn gas on a transaction that was always going to revert.
  const domain = { name: 'Permit2', chainId: CHAIN, verifyingContract: PERMIT2 };
  const value  = {
    permitted: { token: USDC, amount },
    spender:   wallet.address,
    nonce,
    deadline
  };
  let recovered;
  try { recovered = ethers.verifyTypedData(domain, EIP712_TYPES, value, signature); }
  catch { return json({ error: 'Signature does not verify.' }, 400); }
  if (recovered.toLowerCase() !== owner.toLowerCase()) {
    return json({ error: 'Signature does not match the wallet.' }, 400);
  }

  const permit2 = new ethers.Contract(PERMIT2, PERMIT2_ABI, wallet);
  const permit  = { permitted: { token: USDC, amount }, nonce, deadline };
  const details = { to: ethers.getAddress(env.TREASURY_ADDRESS), requestedAmount: amount };

  // Dry run: catches a spent nonce, a missing approval or an empty balance
  // without paying for the failure.
  try {
    await permit2.permitTransferFrom.staticCall(permit, details, owner, signature);
  } catch (e) {
    const reason = (e && (e.shortMessage || e.reason || e.message)) || 'unknown';
    return json({ error: 'The transfer would fail (' + reason + '). Nothing was charged.' }, 400);
  }

  try {
    const tx = await permit2.permitTransferFrom(permit, details, owner, signature);
    return json({ ok: true, hash: tx.hash, amount: amount.toString() });
  } catch (e) {
    const reason = (e && (e.shortMessage || e.message)) || 'unknown';
    return json({ error: 'Could not submit the claim (' + reason + ').' }, 502);
  }
}

// Pages answers 405 by itself for any method without a handler here.
export const onRequestGet  = ({ env })          => handleGet(env);
export const onRequestPost = ({ request, env }) => handlePost(request, env);

// exported for the test script only
export { handleGet, handlePost };
