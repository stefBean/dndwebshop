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
const base = 'http://127.0.0.1:' + port;
const previewRequests = [];
const start = async () => {
  const server = createApp(db, { challengeOptions: { logPath: log.logPath, adminToken: 'test-only' } }).listen(port, '127.0.0.1');
  server.on('request', req => { const url=new URL(req.originalUrl || req.url, base); if (url.pathname === '/api/auth/me' && url.searchParams.has('xss-probe')) previewRequests.push(url.href); });
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
  await a.evaluate('localStorage.setItem("xss-secret","shop-storage-secret");document.cookie="xss_canary=shop-cookie-secret; Path=/; SameSite=Lax"');
  // Control request proves that the server-side network observer is effective.
  await fetch(base+'/api/auth/me?xss-probe');
  assert.equal(previewRequests.length,1);
  previewRequests.length=0;
  assert.equal(await a.evaluate(`(()=>{const script=document.createElement('script');script.textContent="document.body.dataset.unsafeScript='executed'";document.body.append(script);const button=document.createElement('button');button.setAttribute('onclick',"document.body.dataset.unsafeHandler='executed'");document.body.append(button);button.click();script.remove();button.remove();return Boolean(document.body.dataset.unsafeScript||document.body.dataset.unsafeHandler)})()`),false,'Normal shop CSP must still block inline scripts and handlers');
  const sessionCount = db.prepare('SELECT count(*) AS n FROM sessions').get().n;
  const probe = `(async()=>{
    const result={executed:true};
    for(const [name,read] of Object.entries({parent:()=>parent.document.body, cookie:()=>document.cookie, storage:()=>localStorage.getItem('xss-secret'), sessionStorage:()=>sessionStorage.length})){
      try{read();result[name]='ACCESSIBLE'}catch(error){result[name]=error.name}
    }
    try{await fetch('${base}/api/auth/me?xss-probe',{credentials:'include'});result.fetch='ACCESSIBLE'}catch{result.fetch='blocked'}
    document.getElementById('result').textContent=JSON.stringify(result);
  })()`;
  const payload = '<svg onload="' + probe.replaceAll('"','&quot;') + '"></svg>';
  await a.evaluate('(()=>{const input=document.querySelector("input[type=search]");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,' + JSON.stringify(payload) + ');input.dispatchEvent(new Event("input",{bubbles:true}));})()');
  await a.wait('document.querySelector("iframe") !== null');
  assert.equal(await a.evaluate('document.querySelector("iframe").getAttribute("sandbox")'), 'allow-scripts');
  assert.ok(await a.evaluate('document.querySelector("iframe").src.startsWith(location.origin+"/xss-preview/")'));
  async function frameProof() {
    for(let attempt=0;attempt<100;attempt++) {
      const target=(await send('Target.getTargets')).targetInfos.find(t=>t.type==='iframe' && t.url.startsWith(base+'/xss-preview/'));
      if(target) {
        const sid=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true})).sessionId;
        const result=await send('Runtime.evaluate',{expression:"document.getElementById('result')?.textContent",returnByValue:true},sid);
        if(result.result.value?.startsWith('{')) return JSON.parse(result.result.value);
      }
      const {frameTree}=await send('Page.getFrameTree',{},a.sessionId);
      const frame=frameTree.childFrames?.find(child=>child.frame.url.startsWith(base+'/xss-preview/'))?.frame;
      if(frame) {
        try {
          const {executionContextId}=await send('Page.createIsolatedWorld',{frameId:frame.id,worldName:'read-proof'},a.sessionId);
          const result=await send('Runtime.evaluate',{expression:"document.getElementById('result')?.textContent",contextId:executionContextId,returnByValue:true},a.sessionId);
          const text=result.result.value;
          if(text?.startsWith('{')) return JSON.parse(text);
        } catch { /* Frame may still be navigating. */ }
      }
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    throw new Error('XSS browser proof not produced: '+JSON.stringify(await send('Page.getFrameTree',{},a.sessionId))+' TARGETS '+JSON.stringify(await send('Target.getTargets')));
  }
  const proof=await frameProof();
  assert.deepEqual(proof,{executed:true,parent:'SecurityError',cookie:'SecurityError',storage:'SecurityError',sessionStorage:'SecurityError',fetch:'blocked'});
  assert.deepEqual(previewRequests,[], 'CSP must block the request before it reaches the API');
  assert.equal(await a.evaluate('localStorage.getItem("xss-secret")'),'shop-storage-secret');
  assert.ok(await a.evaluate('document.cookie.includes("xss_canary=shop-cookie-secret")'));
  assert.equal(db.prepare('SELECT count(*) AS n FROM sessions').get().n,sessionCount);
  assert.equal(db.prepare('SELECT count(*) AS n FROM orders').get().n,1);
  // A direct-open preview has no iframe attribute: only its HTTP sandbox protects it.
  const direct=await tab(contextA);
  await send('Page.navigate',{url:base+'/xss-preview/?search='+encodeURIComponent(payload)},direct.sessionId);
  await direct.wait('document.getElementById("result")?.textContent.startsWith("{")');
  const directProof=JSON.parse(await direct.evaluate('document.getElementById("result").textContent'));
  for(const key of ['cookie','storage','sessionStorage']) assert.equal(directProof[key],'SecurityError');
  assert.equal(directProof.executed,true);
  assert.equal(directProof.fetch,'blocked');
  assert.deepEqual(previewRequests,[]);
  // Reset the search, then prove the same payload executes in a fresh frame.
  await a.evaluate('Array.from(document.querySelectorAll("button")).find(b=>b.textContent==="Clear search").click()');
  await a.wait('document.querySelector("iframe")===null && document.querySelectorAll("article").length>0');
  await a.evaluate('(()=>{const input=document.querySelector("input[type=search]");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,' + JSON.stringify(payload) + ');input.dispatchEvent(new Event("input",{bubbles:true}));})()');
  assert.deepEqual(await frameProof(),proof);
  console.log('PASS: independent browsers and same-origin tab, cart reload/focus/storage reset, stale cart rejection, unrelated storage retained, challenge statuses, post-reset login/cart/checkout, same-IP XSS execution, parent/cookie/localStorage/sessionStorage isolation, CSP blocks credentialed API fetch before network, HTTP sandbox on direct-open preview, repeatable search reset.');
  await send('Browser.close');
} finally {
  socket?.close();
  chrome.kill();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  db.close();
  if (!temporary.startsWith(path.join(os.tmpdir(), 'chs-browser-'))) throw new Error('Unexpected cleanup path');
  await rm(temporary, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 });
}
