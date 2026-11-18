// Final verification captures: light and dark renders of the main routes at 1400×900 and the map at 390×844.
// Run: node tests/final_screenshots.js  → tests/screenshots/final-<scheme>-<name>.png (no assertions; see tests/smoke.js).
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const browser = await chromium.launch({ proxy: proxy ? { server: proxy } : undefined, args: ['--no-sandbox'] });
  const url = 'file://' + path.resolve(__dirname, '..', 'index.html');
  const out = (scheme, name) => path.resolve(__dirname, 'screenshots', `final-${scheme}-${name}.png`);
  const errors = [];
  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, ignoreHTTPSErrors: true, deviceScaleFactor: 1, colorScheme: scheme });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(scheme + ': ' + e.message));
    const go = async (route, ms = 800) => { await page.evaluate(r => window.App.go(r), route); await page.waitForTimeout(ms); };
    const shot = (name) => page.screenshot({ path: out(scheme, name) });
    await page.goto(url + '#/map', { waitUntil: 'load' });
    await page.waitForFunction(() => window.App && window.MapView, null, { timeout: 20000 });
    await page.waitForTimeout(3000);
    await shot('map-flat');   // the default: the 1907 journey alone at the Alaska frame, crowded places collapsed
    // the 1908 journey alone, then both overlaid (the comparison mode)
    await page.click('#journeySeg button[data-jm="1908"]'); await page.waitForTimeout(1200); await shot('map-1908');
    await page.click('#journeySeg button[data-jm="both"]'); await page.waitForTimeout(1200); await shot('map-both');
    // Kotzebue Sound frame: the dense part of the journey (both journeys, clusters open at this zoom)
    await page.click('#frames .pill[data-frame="kotzebue"]'); await page.waitForTimeout(2000); await shot('map-kotzebue');
    // an unlocated place opened: constraint rings, leader labels, candidate squares
    await go('/map/pl_stones_camp', 2200); await shot('map-unlocated');
    await go('/map', 1200); await page.click('#frames .pill[data-frame="alaska"]'); await page.waitForTimeout(1500);
    await page.click('#modeSeg button[data-mode="relief"]'); await page.waitForTimeout(3000); await shot('map-relief');
    await page.click('#modeSeg button[data-mode="globe"]'); await page.waitForTimeout(3000); await shot('map-globe');
    await page.click('#modeSeg button[data-mode="flat"]'); await page.waitForTimeout(800);
    await go('/story/story_19_excavation', 1800); await shot('story');
    for (const v of ['persons', 'institutions', 'funding', 'coattestation', 'mentions']) {
      await go(v === 'persons' ? '/network' : '/network/view/' + v, 3000); await shot('network-' + v);
    }
    await go('/archive', 1200); await shot('archive');
    await go('/timeline', 1200); await shot('timeline');
    await go('/method', 1200); await shot('method');
    await ctx.close();
    // phone: a fresh load at 390×844 (resizing a desktop context would keep Leaflet's previous centre and zoom)
    const pctx = await browser.newContext({ viewport: { width: 390, height: 844 }, ignoreHTTPSErrors: true, deviceScaleFactor: 1, colorScheme: scheme });
    const ppage = await pctx.newPage();
    ppage.on('pageerror', e => errors.push(scheme + ' phone: ' + e.message));
    await ppage.goto(url + '#/map', { waitUntil: 'load' });
    await ppage.waitForFunction(() => window.App && window.MapView, null, { timeout: 20000 });
    await ppage.waitForTimeout(3000);
    await ppage.screenshot({ path: out(scheme, 'map-phone') });
    if (await ppage.locator('#panelHandle').isVisible()) { await ppage.click('#panelHandle'); await ppage.waitForTimeout(600); await ppage.screenshot({ path: out(scheme, 'map-phone-sheet') }); }
    await pctx.close();
  }
  await browser.close();
  console.log('page errors:', errors.length, errors);
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
