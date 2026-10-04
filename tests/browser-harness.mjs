// Workspace-only browser harness: no installed widget, IPC or desktop follower.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { makeFixture } from './desktop-fixture.mjs';
import { createDispatcher } from '../runtime/dispatcher.mjs';

export async function createBrowserHarness(output, options = {}) {
  output = path.resolve(output); fs.mkdirSync(output, { recursive: true });
  const dataDir = fs.mkdtempSync(path.join(output, 'data-'));
  const fixture = await makeFixture(dataDir);
  const dispatcher = createDispatcher({ dataDir, ...fixture });
  const server = http.createServer(async (req,res) => {
    try {
      const chunks=[]; for await (const part of req) chunks.push(part);
      const result = await dispatcher.dispatch(req.url, { method:req.method, headers:req.headers, body:chunks.length ? Buffer.concat(chunks) : null });
      res.writeHead(result.status,result.headers); res.end(result.body);
    } catch { res.writeHead(500); res.end('Fixture error'); }
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port;
  const require=createRequire(import.meta.url);
  const { chromium }=require(process.env.WHALE_PLAYWRIGHT_ROOT || 'playwright');
  const profile=fs.mkdtempSync(path.join(output,'browser-'));
  const context=await chromium.launchPersistentContext(profile, {
    executablePath:process.env.WHALE_BROWSER_EXECUTABLE || path.join(process.env['ProgramFiles(x86)'] || process.env.ProgramFiles,'Microsoft','Edge','Application','msedge.exe'),
    headless:true, viewport:options.viewport || {width:1100,height:850}, deviceScaleFactor:options.deviceScaleFactor || 1,
    args:['--disable-gpu','--disable-extensions','--no-first-run'],
  });
  await context.addInitScript(() => {
    window.whaleDesktop={testMode:true,platform:'browser',ready(){},interactive(){},keyboardFocus(){},onCursor(){},shape(){},
      save:values=>fetch('/api/ui-state',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(values)}),
      command:async command=>command==='mode'?'follow-codex':true,openExternal:async()=>true};
  });
  const page=context.pages()[0] || await context.newPage();
  const errors=[]; page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url+'/widget.html');
  return {page,context,url,dispatcher,fixture,dataDir,errors,output,
    async close(){await context.close();await dispatcher.close();await new Promise(resolve=>server.close(resolve));}};
}
