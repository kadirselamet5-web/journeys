// Headless smoke + integrity test for index.html. Run: node tests/smoke.js
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const browser = await chromium.launch({ proxy: proxy ? { server: proxy } : undefined, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, ignoreHTTPSErrors: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [], warnings = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') { const t = m.text(); if (!/net::ERR|Failed to load resource|ERR_/.test(t)) errors.push('console: ' + t); else warnings.push(t.slice(0, 120)); } });
  const url = 'file://' + path.resolve(__dirname, '..', 'index.html');
  const go = async (route) => { await page.evaluate(r => window.App.go(r), route); await page.waitForTimeout(60); };
  await page.goto(url + '#/map', { waitUntil: 'load' });
  await page.waitForFunction(() => window.App && window.MapView, null, { timeout: 15000 });
  await page.waitForTimeout(2500);
  const markers = await page.locator('#leaflet path.leaflet-interactive').count();
  console.log('map markers+lines drawn:', markers);
  await page.screenshot({ path: 'tests/screenshots/01-map-flat.png' });
  await page.click('#modeSeg button[data-mode="relief"]'); await page.waitForTimeout(1500);
  await page.screenshot({ path: 'tests/screenshots/02-map-relief.png' });
  await page.click('#modeSeg button[data-mode="globe"]'); await page.waitForTimeout(2500);
  const globePaths = await page.locator('#globe svg path').count(); console.log('globe paths:', globePaths);
  await page.screenshot({ path: 'tests/screenshots/03-map-globe.png' });
  await page.click('#modeSeg button[data-mode="flat"]'); await page.waitForTimeout(500);
  // stop list click opens popup
  await page.click('#stoplist li[data-stop="s1908_08"]'); await page.waitForTimeout(1200);
  const popup = await page.locator('.leaflet-popup-content').count(); console.log('popup open:', popup);
  await page.screenshot({ path: 'tests/screenshots/04-map-popup.png' });
  // open story from popup
  await page.click('.leaflet-popup-content button.primary'); await page.waitForTimeout(800);
  console.log('route after popup click:', await page.evaluate(() => location.hash));
  await page.screenshot({ path: 'tests/screenshots/05-story.png', fullPage: false });
  // next / back navigation
  await page.click('text=Next ›'); await page.waitForTimeout(300);
  const afterNext = await page.evaluate(() => location.hash);
  await page.evaluate(() => window.App.back()); await page.waitForTimeout(300);
  const afterBack = await page.evaluate(() => location.hash);
  console.log('next ->', afterNext, '| back ->', afterBack, afterBack === '#/story/story_13_elephant_point_1907' ? 'OK' : 'BACK FAILED');
  // archive
  await go('/archive/d_19070416_osborn_bumpus'); await page.waitForTimeout(300);
  const colored = await page.locator('#reader .pi-color').count(); console.log('colour-marked spans in Osborn 16 Apr 1907:', colored);
  await page.screenshot({ path: 'tests/screenshots/06-archive.png' });
  await page.fill('#afq', 'walrus'); await page.waitForTimeout(200);
  console.log('archive search "walrus":', await page.locator('#doclist li').count(), 'items');
  await go('/network'); await page.waitForTimeout(2500);
  console.log('network nodes drawn:', await page.locator('#netsvg g.netnode').count());
  await page.screenshot({ path: 'tests/screenshots/07-network.png' });
  await go('/person/p_grant'); await page.waitForTimeout(200); await page.screenshot({ path: 'tests/screenshots/08-person.png' });
  await go('/timeline'); await page.waitForTimeout(200); await page.screenshot({ path: 'tests/screenshots/09-timeline.png' });
  await go('/published'); await page.waitForTimeout(200); await page.screenshot({ path: 'tests/screenshots/10-published.png' });
  await go('/method/geocoding'); await page.waitForTimeout(200); await page.screenshot({ path: 'tests/screenshots/11-method.png' });
  await go('/tale/t035'); await page.waitForTimeout(300);
  // integrity crawl: every route of every record renders without "not found"
  const routes = await page.evaluate(() => { const D = window.JOURNEYS_DATA; return [
    ...D.stories.map(s => '/story/' + s.id), ...D.documents.map(d => '/archive/' + d.id), ...D.people.map(p => '/person/' + p.id), ...D.institutions.map(i => '/person/' + i.id), ...D.offices.map(o => '/person/' + o.id),
    ...D.places.map(p => '/place/' + p.id), ...D.published.map(p => '/published/' + p.id), ...D.timeline.slice(0, 10).map(t => '/timeline/' + t.id), '/method/overview', '/method/network', '/method/findings', '/method/data', '/stories', '/cast', '/tale', '/network/focus/p_quackenbush', '/network/doc/d_19070325_matthew_bumpus']; });
  let bad = 0;
  for (const r of routes) { await go(r); const txt = await page.evaluate(() => document.getElementById('pageview').innerText.slice(0, 400)); if (/\b(story|record|item|place) not found\b/i.test(txt)) { bad++; console.log('NOT FOUND at', r); } }
  console.log('crawled', routes.length, 'routes;', bad, 'failures');
  // dangling internal links on rendered story/archive pages
  await go('/stories'); const links = await page.evaluate(() => { const D = window.JOURNEYS_DATA; const ids = new Set([...D.stories.map(s=>'story/'+s.id), ...D.documents.map(d=>'archive/'+d.id), ...D.people.map(p=>'person/'+p.id), ...D.institutions.map(i=>'person/'+i.id), ...D.offices.map(o=>'person/'+o.id), ...D.places.map(p=>'place/'+p.id), ...D.published.map(p=>'published/'+p.id), ...D.timeline.map(t=>'timeline/'+t.id)]); const out=[]; D.stories.forEach(s=>{ s.docs.forEach(d=>{ if(!ids.has('archive/'+d)) out.push(s.id+' -> '+d); }); }); return out; });
  console.log('dangling story->doc links:', links.length);
  console.log('warnings (network):', warnings.length, warnings.slice(0, 3));
  console.log('JS ERRORS:', errors.length); errors.slice(0, 20).forEach(e => console.log('  ', e));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('TEST CRASH', e); process.exit(2); });
