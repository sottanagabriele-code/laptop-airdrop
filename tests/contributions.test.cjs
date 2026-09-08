const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const script = html.match(/\/\* CONTRIBUTIONS_START[\s\S]*?\/\* CONTRIBUTIONS_END \*\//)[0];
const RECIPIENT = '0x1111111111111111111111111111111111111111';
const ORGANIZER = '0x4704c46857f175b12b86428c9b0a3fd32b991af4';
const SENDER = '0x2222222222222222222222222222222222222222';
const HASH = '0x' + 'a'.repeat(64);
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// No real provider, keys, network requests, wallet signatures or transfers.
// The actual inline application script runs against controlled DOM/wallet doubles.
function page(options = {}) {
  const els = {};
  for (const id of [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1])) {
    els[id] = { value: '', textContent: '', className: '', checked: false, disabled: false,
      hidden: ['contribution-receipt', 'contribution-wallet-link', 'contribute-again', 'contribution-sender-row'].includes(id),
      href: '', attributes: {}, setAttribute(name, value) { this.attributes[name] = value; },
      handlers: {}, addEventListener(type, fn) { this.handlers[type] = fn; } };
  }
  els['sell-token'].value = 'eth';
  const state = { chain: '0x2105', accounts: [SENDER], calls: [], sent: [], ...options };
  const events = {};
  const request = async function ({ method, params }) {
    state.calls.push(method);
    if (method === 'eth_requestAccounts' || method === 'eth_accounts') return state.accounts;
    if (method === 'eth_chainId') return state.chain;
    if (method === 'wallet_switchEthereumChain') {
      if (state.rejectSwitch) throw Object.assign(new Error('Rejected'), { code: 4001 });
      if (!state.ignoreSwitch) state.chain = params[0].chainId;
      return null;
    }
    throw new Error('Unexpected wallet method: ' + method);
  };
  const send = async function (tx) {
    if (state.rejectSend) throw Object.assign(new Error('Rejected'), { code: 4001 });
    state.sent.push(tx);
    return { hash: HASH, wait: async function () {
      if (state.wait) return state.wait();
      if (state.waitError) throw state.waitError;
      return { hash: HASH, status: state.receiptStatus ?? 1 };
    } };
  };
  const signer = { getAddress: async () => state.accounts[0], sendTransaction: send };
  const lib = {
    ZeroAddress: '0x' + '0'.repeat(40), MaxUint256: (1n << 256n) - 1n,
    getAddress(value) {
      if (!/^0x[0-9a-fA-F]{40}$/.test(value)) throw new Error('Invalid address');
      return value;
    },
    parseUnits(value, decimals) {
      const [whole, fraction = ''] = value.split('.');
      if (fraction.length > decimals) throw new Error('Too many decimals');
      return BigInt(whole || '0') * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, '0') || '0');
    },
    formatUnits(value, decimals) {
      const raw = value.toString().padStart(decimals + 1, '0');
      return raw.slice(0, -decimals) + '.' + (raw.slice(-decimals).replace(/0+$/, '') || '0');
    },
    BrowserProvider: class { async getSigner() { return signer; } },
    Contract: class {
      constructor(address, abi) {
        assert.equal(address, USDC);
        assert.equal(abi.length, 1);
        assert.match(abi[0], /^function transfer\(/);
      }
      async transfer(to, amount, overrides) { return send({ kind: 'USDC', to, amount, chainId: overrides.chainId }); }
    }
  };
  const window = { ethers: options.noLibrary ? undefined : lib,
    ethereum: options.noWallet ? undefined : { request, on(event, fn) { events[event] = fn; } } };
  const active = options.production ? script : script.replace(/recipient: '[^']*'/, "recipient: '" + (options.recipient ?? RECIPIENT) + "'");
  vm.runInNewContext(active, { window, document: { getElementById: id => els[id] }, console });
  async function click(id = 'contribute-btn') { return els[id].handlers.click(); }
  function setAmount(value, asset = 'eth') {
    els['amount'].value = value;
    els['sell-token'].value = asset;
    els['amount'].handlers.input();
  }
  function accept() { els['contribution-terms'].checked = true; els['contribution-terms'].handlers.change(); }
  async function connect() { setAmount('1'); await click(); setAmount(''); }
  return { els, state, events, click, setAmount, accept, connect };
}

test('the configured wallet is the exact organizer address and no amount is preselected', async () => {
  const p = page({ production: true });
  assert.equal(p.els['contribution-recipient'].textContent, ORGANIZER);
  assert.equal(p.els.amount.value, '');
  assert.equal(p.els['contribute-btn'].disabled, true);
  await p.click();
  assert.equal(p.state.calls.length, 0);
  assert.equal(p.state.sent.length, 0);
});
test('empty, zero and token-contract receiving addresses remain disabled', async () => {
  for (const recipient of ['', '0x' + '0'.repeat(40), USDC, 'invalid']) {
    const p = page({ recipient });
    await p.click();
    assert.equal(p.els['contribute-btn'].disabled, true);
    assert.equal(p.state.sent.length, 0);
  }
});
test('connecting alone sends no funds, even when an amount was entered', async () => {
  const p = page();
  p.setAmount('0.02');
  p.accept();
  await p.click();
  assert.equal(p.state.sent.length, 0);
  assert.equal(p.els['contribution-sender'].textContent, SENDER);
});
test('an ETH contribution sends exactly the entered amount to the fixed wallet on Base', async () => {
  const p = page();
  await p.connect();
  p.setAmount('0,025'); p.accept();
  await p.click();
  assert.equal(p.state.sent.length, 1);
  const tx = p.state.sent[0];
  assert.equal(tx.to, RECIPIENT);
  assert.equal(tx.value, 25000000000000000n);
  assert.equal(tx.chainId, 8453);
  assert.match(p.els['contribution-status'].textContent, /No \$LAPTOP tokens were delivered/);
  assert.equal(p.els['contribution-receipt'].href, 'https://basescan.org/tx/' + HASH);
});
test('USDC uses a direct transfer of the chosen amount with no approval or permit', async () => {
  const p = page();
  await p.connect();
  p.setAmount('12.345678', 'usdc'); p.accept();
  await p.click();
  assert.deepEqual(p.state.sent, [{ kind: 'USDC', to: RECIPIENT, amount: 12345678n, chainId: 8453 }]);
  assert.equal(p.state.calls.some(m => /sign|approve|permit/i.test(m)), false);
});
test('amount edits clear consent, and unchecked terms block sending', async () => {
  const p = page();
  await p.connect(); p.setAmount('1'); p.accept();
  p.setAmount('2');
  assert.equal(p.els['contribution-terms'].checked, false);
  await p.click();
  assert.equal(p.state.sent.length, 0);
});
test('invalid, nonpositive and overprecision amounts never send funds', async () => {
  const values = ['', '0', '-1', '1e3', 'NaN', 'Infinity', '1.1.1', '0.0000001'];
  for (const value of values) {
    const p = page();
    await p.connect(); p.setAmount(value, 'usdc'); p.accept(); await p.click();
    assert.equal(p.state.sent.length, 0, value);
  }
});
test('a network switch must succeed before the connection can complete', async () => {
  for (const flag of ['rejectSwitch', 'ignoreSwitch']) {
    const p = page({ chain: '0x1', [flag]: true });
    await p.connect(); p.setAmount('1'); p.accept(); await p.click();
    assert.equal(p.state.sent.length, 0);
  }
});
test('switching accounts or networks after review requires a new connection', async () => {
  for (const change of ['accounts', 'chain']) {
    const p = page();
    await p.connect(); p.setAmount('1'); p.accept();
    p.state[change] = change === 'accounts' ? [RECIPIENT] : '0x1';
    await p.click();
    assert.equal(p.state.sent.length, 0);
    assert.equal(p.els['contribution-terms'].checked, false);
    assert.match(p.els['contribution-status'].textContent, /changed/);
  }
});
test('rejection in the wallet reports cancellation and no success receipt', async () => {
  const p = page({ rejectSend: true });
  await p.connect(); p.setAmount('1'); p.accept(); await p.click();
  assert.equal(p.state.sent.length, 0);
  assert.match(p.els['contribution-status'].textContent, /cancelled/);
  assert.equal(p.els['contribution-receipt'].hidden, true);
});
test('repeated clicks during a pending transfer do not send another payment', async () => {
  let resolveReceipt;
  const waiting = new Promise(resolve => { resolveReceipt = resolve; });
  const p = page({ wait: () => waiting });
  await p.connect(); p.setAmount('1'); p.accept();
  const first = p.click();
  for (let i = 0; i < 10; i++) await Promise.resolve();
  await p.click();
  assert.equal(p.state.sent.length, 1);
  assert.equal(p.els.amount.disabled, true);
  resolveReceipt({ hash: HASH, status: 1 });
  await first;
  await p.click();
  assert.equal(p.state.sent.length, 1);
});
test('an uncertain or failed receipt never reports payment success or enables resubmission', async () => {
  for (const options of [{ receiptStatus: 0 }, { waitError: new Error('timeout') }]) {
    const p = page(options);
    await p.connect(); p.setAmount('1'); p.accept(); await p.click();
    assert.match(p.els['contribution-status'].textContent, /could not be confirmed/);
    assert.equal(p.els['contribute-again'].hidden, true);
    await p.click();
    assert.equal(p.state.sent.length, 1);
  }
});
test('a successfully repriced transaction uses its confirmed replacement receipt', async () => {
  const hash = '0x' + 'b'.repeat(64);
  const p = page({ waitError: { code: 'TRANSACTION_REPLACED', reason: 'repriced', cancelled: false, receipt: { hash, status: 1 } } });
  await p.connect(); p.setAmount('1'); p.accept(); await p.click();
  assert.equal(p.els['contribution-receipt'].href, 'https://basescan.org/tx/' + hash);
  assert.equal(p.els['contribute-btn'].textContent, 'Contribution sent');
});
test('a second deliberate contribution requires a new amount and fresh consent', async () => {
  const p = page();
  await p.connect(); p.setAmount('1'); p.accept(); await p.click();
  await p.click('contribute-again');
  assert.equal(p.els.amount.value, '');
  assert.equal(p.els['contribution-terms'].checked, false);
  await p.click();
  assert.equal(p.state.sent.length, 1);
  p.setAmount('2'); p.accept(); await p.click();
  assert.equal(p.state.sent.length, 2);
  assert.equal(p.state.sent[1].value, 2000000000000000000n);
});
test('missing wallet library fails closed', async () => {
  const p = page({ noLibrary: true });
  assert.equal(p.els['contribute-btn'].disabled, true);
  await p.click();
  assert.equal(p.state.sent.length, 0);
});
test('page has no duplicate IDs or old swap/airdrop authorization code', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length);
  assert.doesNotMatch(script, /approve\s*\(|signTypedData|personal_sign|permit2|fetch\s*\(/i);
  assert.doesNotMatch(html, /id="swap-btn"|id="drop-connect-btn"|no presale|No blanket approvals/);
  for (const match of html.matchAll(/<script(?![^>]*(?:src=|application\/ld\+json))[^>]*>([\s\S]*?)<\/script>/g)) {
    new vm.Script(match[1]);
  }
});

test('the amount must be selected before any connection request', async () => {
  const p = page();
  await p.click();
  assert.equal(p.state.calls.length, 0);
  assert.equal(p.els['contribute-btn'].disabled, true);
  p.setAmount('0.004');
  assert.equal(p.els['contribute-btn'].disabled, false);
  assert.equal(p.els['contribution-summary'].textContent, '0.004 ETH');
  await p.click();
  assert.equal(p.state.sent.length, 0);
  assert.equal(p.els['contribution-sender-row'].hidden, false);
});
test('preset selection updates the amount and summary without asking the wallet', async () => {
  const p = page();
  await p.click('preset-1');
  assert.equal(p.els.amount.value, '0.005');
  assert.equal(p.els['contribution-summary'].textContent, '0.005 ETH');
  assert.equal(p.els['preset-1'].attributes['aria-pressed'], 'true');
  assert.equal(p.state.calls.length, 0);
  p.accept();
  await p.click('preset-2');
  assert.equal(p.els['contribution-terms'].checked, false);
  assert.equal(p.els.amount.value, '0.01');
});
test('USDC presets label the selected currency and send its exact reviewed amount', async () => {
  const p = page();
  p.els['sell-token'].value = 'usdc';
  p.els['sell-token'].handlers.change();
  assert.equal(p.els['preset-2'].textContent, '25');
  assert.equal(p.els['preset-2'].attributes['aria-label'], 'Choose 25 USDC');
  await p.click('preset-2');
  assert.equal(p.els['contribution-summary'].textContent, '25.0 USDC');
  await p.click(); p.accept(); await p.click();
  assert.equal(p.state.sent[0].amount, 25000000n);
});
test('the production destination is used for a simulated payment, with no alternate recipient', async () => {
  const p = page({ production: true });
  p.setAmount('0.001');
  await p.click(); p.accept(); await p.click();
  assert.equal(p.state.sent[0].to, ORGANIZER);
  assert.equal(p.state.sent[0].chainId, 8453);
  const addresses = [...html.matchAll(/https:\/\/basescan\.org\/address\/(0x[0-9a-f]{40})/g)].map(m => m[1]);
  assert.ok(addresses.length >= 2);
  assert.ok(addresses.every(address => address === ORGANIZER));
});
