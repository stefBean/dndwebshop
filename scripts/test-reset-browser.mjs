// Optional integration check: CHROME_PATH must point to an installed Chromium browser.
// Uses only in-memory SQLite, temporary logs and a temporary browser profile.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'node:net';
import { openDatabase } from '../server/db.js';
import { createApp } from '../server/app.js';
import { createPreviewServer } from '../challenge-xss/server.mjs';
import { resetShop, resetVersion } from '../server/reset-shop.js';
import { createChallengeLog } from '../server/challenge-log.js';
import { setPasswordChallengeActive } from '../server/challenge-password.js';
const temporary = await mkdtemp(path.join(os.tmpdir(), 'chs-browser-'));
const db = openDatabase(':memory:');
const log = createChallengeLog({ logPath: path.join(temporary, 'app.log') });
const reserve = createServer().listen(0, '127.0.0.1');
await once(reserve, 'listening');
const port = reserve.address().port;
await new Promise(resolve => reserve.close(resolve));
const base = 'http://localhost:' + port;
const preview = createPreviewServer({ shopOrigins: base }).listen(0, '127.0.0.1');
await once(preview, 'listening');
const previewOrigin = 'http://127.0.0.1:' + preview.address().port;
const start = async () => {
  const server = createApp(db, { xssPreviewOrigin: previewOrigin, challengeOptions: { logPath: log.logPath, adminToken: 'test-only' } }).listen(port, '127.0.0.1');
  await once(server, 'listening');
  return server;
};
let server = await start();
const executable = process.env.CHROME_PATH || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : 'chromium');
const chrome = spawn(executable, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--remote-debugging-port=0', '--user-data-dir=' + path.join(temporary, 'profile'), 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
let socket;
try {
  const debuggerUrl = await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('Chrome startup timeout')), 15000);
    chrome.on('error', error => { clearTimeout(timer); reject(error); });
    chrome.stderr.on('data', chunk => {
      output += chunk;
      const match = output.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
  });
  socket = new WebSocket(debuggerUrl);
  await once(socket, 'open');
  let number = 0;
  const pending = new Map();
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (!message.id) return;
    const entry = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) entry.reject(new Error(JSON.stringify(message.error)));
    else entry.resolve(message.result);
  };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++number;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params, sessionId }));
  });
  const tab = async browserContextId => {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const evaluate = async expression => {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
      if (result.exceptionDetails) throw new Error(expression + ' ' + JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    const wait = async expression => {
      for (let attempt = 0; attempt < 120; attempt++) {
        if (await evaluate(expression)) return;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw new Error('Browser timeout: ' + expression + ' STATE: ' + await evaluate('JSON.stringify({url:location.href,cart:localStorage.getItem("dice-and-lore.cart.v1"),body:document.body.innerText.slice(0,1000),links:Array.from(document.querySelectorAll("header a")).map(a=>a.getAttribute("aria-label"))})'));
    };
    const go = async route => {
      await send('Page.bringToFront', {}, sessionId);
      await send('Page.navigate', { url: base + route }, sessionId);
      await wait('location.pathname === ' + JSON.stringify(route) + ' && document.querySelector("#main-content")?.children.length > 0');
    };
    return { sessionId, evaluate, wait, go };
  };
  const contextA = (await send('Target.createBrowserContext')).browserContextId;
  const contextB = (await send('Target.createBrowserContext')).browserContextId;
  const a = await tab(contextA), b = await tab(contextB), sameOriginTab = await tab(contextA);
  const key = 'dice-and-lore.cart.v1';
  const initial = resetVersion(db);
  const bagHas = count => 'Array.from(document.querySelectorAll("header a")).some(a=>a.getAttribute("aria-label")==="Shopping bag, ' + count + ' items")';
  const seedCart = version => 'localStorage.setItem("preferences","keep");localStorage.setItem(' + JSON.stringify(key) + ',JSON.stringify({resetVersion:' + JSON.stringify(version) + ',items:[{product_id:1,quantity:2}]}));location.reload()';
  const readItems = 'JSON.parse(localStorage.getItem(' + JSON.stringify(key) + ')).items.length';
  for (const current of [a, b]) {
    await current.go('/products');
    await current.wait('document.querySelectorAll("article").length > 0');
    await current.evaluate(seedCart(initial));
    await current.wait(bagHas(2));
  }
  await sameOriginTab.go('/cart');
  await sameOriginTab.wait('document.body.innerText.includes("Quest summary")');

  await a.go('/challenges');
  await a.wait('document.querySelectorAll("article").length===3 && document.body.innerText.includes("Deaktiviert")');
  assert.ok(await a.evaluate('document.body.innerText.includes("Manueller Nachweis erforderlich")'));
  setPasswordChallengeActive(db, true);
  db.prepare("UPDATE challenges SET active=1 WHERE id='log-flood'").run();
  await send('Page.bringToFront', {}, a.sessionId);
  await a.evaluate('window.dispatchEvent(new Event("focus"))');
  const countStatus = text => 'Array.from(document.querySelectorAll("article")).filter(a=>a.innerText.includes(' + JSON.stringify(text) + ')).length===2';
  await a.wait(countStatus('Offen'));
  db.prepare("UPDATE challenges SET solved_at='test-proof' WHERE id='weak-password'").run();
  await writeFile(log.logPath, 'X'.repeat(11 * 1024 * 1024));
  await send('Page.bringToFront', {}, a.sessionId);
  await a.evaluate('window.dispatchEvent(new Event("focus"))');
  await a.wait(countStatus('Geschafft'));
  await send('Network.enable', {}, a.sessionId);
  await send('Network.setBlockedURLs', { urls: ['*log-flood/status*'] }, a.sessionId);
  await a.evaluate('document.querySelectorAll("article")[2].querySelector("button").click()');
  await a.wait('document.querySelectorAll("article")[2].innerText.includes("Nicht erreichbar")');
  await send('Network.setBlockedURLs', { urls: [] }, a.sessionId);
  await a.evaluate('document.querySelectorAll("article")[2].querySelector("button").click()');
  await a.wait(countStatus('Geschafft'));
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  await resetShop(db, log);
  server = await start();
  await send('Page.bringToFront', {}, a.sessionId);
  await a.evaluate('window.dispatchEvent(new Event("focus"))');
  await a.wait(readItems + '===0');
  await a.wait(countStatus('Offen'));
  await sameOriginTab.wait(bagHas(0));
  assert.equal(await a.evaluate('localStorage.getItem("preferences")'), 'keep');
  assert.equal(await b.evaluate(readItems), 1, 'Independent browser stays old until it reconnects');
  await send('Page.bringToFront', {}, b.sessionId);
  await b.evaluate('window.dispatchEvent(new Event("focus"))');
  await b.wait(readItems + '===0');
  assert.equal(await b.evaluate('localStorage.getItem("preferences")'), 'keep');
  await b.evaluate(seedCart(initial));
  await b.wait('JSON.parse(localStorage.getItem(' + JSON.stringify(key) + ')).resetVersion!==' + JSON.stringify(initial) + ' && ' + readItems + '===0');
  // Real browser session and UI checkout after reset.
  await a.go('/products');
  await a.evaluate('(async()=>{const r=await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:"aria",password:"RollForAdventure!24"})});if(!r.ok)throw Error("login");location.reload()})()');
  await a.wait('document.querySelectorAll("article").length>0');
  await a.evaluate('Array.from(document.querySelectorAll("article button")).find(b=>b.textContent.includes("Add")).click()');
  await a.wait(bagHas(1));
  await a.go('/cart');
  await a.wait('document.body.innerText.includes("Place simulated order")');
  await a.evaluate('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.includes("Place simulated order")).click()');
  await a.wait('document.body.innerText.includes("Your next chapter is equipped.")');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 1);
  // Verify JS execution inside the real preview, not just submission of a payload.
  await a.go('/products');
  await a.wait('document.querySelectorAll("article").length>0');
  const payload = "<svg onload=\"document.getElementById('result').textContent='US08 browser proof: JavaScript executed'\"></svg>";
  await a.evaluate('(()=>{const input=document.querySelector("input[type=search]");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,' + JSON.stringify(payload) + ');input.dispatchEvent(new Event("input",{bubbles:true}));})()');
  await a.wait('document.querySelector("iframe") !== null');
  let frameTarget;
  for (let attempt = 0; attempt < 100; attempt++) {
    frameTarget = (await send('Target.getTargets')).targetInfos.find(target => target.type === 'iframe' && target.url.startsWith(previewOrigin));
    if (frameTarget) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(frameTarget, 'XSS frame target');
  const frameSession = (await send('Target.attachToTarget', { targetId: frameTarget.targetId, flatten: true })).sessionId;
  const proof = await send('Runtime.evaluate', { expression: "document.getElementById('result').textContent", returnByValue: true }, frameSession);
  assert.equal(proof.result.value, 'US08 browser proof: JavaScript executed');
  console.log('PASS: independent browsers and same-origin tab, cart reload/focus/storage reset, stale cart rejection, unrelated storage retained, challenge statuses, post-reset login/cart/checkout, actual XSS execution.');
  await send('Browser.close');
} finally {
  socket?.close();
  chrome.kill();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  preview.closeAllConnections();
  await new Promise(resolve => preview.close(resolve));
  db.close();
  if (!temporary.startsWith(path.join(os.tmpdir(), 'chs-browser-'))) throw new Error('Unexpected cleanup path');
  await rm(temporary, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 });
}
