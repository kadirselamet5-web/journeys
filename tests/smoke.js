// Headless smoke + integrity test for index.html. Run: node tests/smoke.js
// Exits non-zero on any JS error, any crawl failure, or any failed assertion (listed under ASSERTIONS).
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const browser = await chromium.launch({ proxy: proxy ? { server: proxy } : undefined, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, ignoreHTTPSErrors: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [], warnings = [], failed = [];
  const check = (name, ok, detail) => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (detail !== undefined ? ' — ' + detail : '')); if (!ok) failed.push(name); };
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') { const t = m.text(); if (!/net::ERR|Failed to load resource|ERR_/.test(t)) errors.push('console: ' + t); else warnings.push(t.slice(0, 120)); } });
  const url = 'file://' + path.resolve(__dirname, '..', 'index.html');
  const go = async (route, ms = 60) => { await page.evaluate(r => window.App.go(r), route); await page.waitForTimeout(ms); };
  const text = async (sel) => page.evaluate(s => (document.querySelector(s) || {}).innerText || '', sel);
  const boxes = async (a, b) => page.evaluate(([a, b]) => { const ra = document.querySelector(a).getBoundingClientRect(), rb = document.querySelector(b).getBoundingClientRect(); return !(ra.right <= rb.left || ra.left >= rb.right || ra.bottom <= rb.top || ra.top >= rb.bottom); }, [a, b]);
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
  console.log('next ->', afterNext, '| back ->', afterBack);
  check('story Back returns to the previous story', afterBack === '#/story/story_13_elephant_point_1907');
  // archive
  await go('/archive/d_19070416_osborn_bumpus', 300);
  const colored = await page.locator('#reader .pi-color').count(); console.log('colour-marked spans in Osborn 16 Apr 1907:', colored);
  await page.screenshot({ path: 'tests/screenshots/06-archive.png' });
  await page.fill('#afq', 'walrus'); await page.waitForTimeout(200);
  console.log('archive search "walrus":', await page.locator('#doclist li').count(), 'items');

  // ---------------------------------------------------------------- network: persons view (C4, C8)
  await go('/network', 2500);
  console.log('network nodes drawn:', await page.locator('#netsvg g.netnode').count());
  check('controls bar does not cover the graph (1400×900)', !(await boxes('#netcontrols', '#netsvg')));
  const statedDash = await page.evaluate(() => { const p = document.querySelector('#netsvg path.netedge.stated'); return p ? getComputedStyle(p).strokeDasharray : null; });
  check('stated ties carry a stroke-dasharray', !!statedDash && statedDash !== 'none', statedDash);
  check('persons header says asserted', /asserted/i.test(await text('#netviewhead')));
  check('rules sit in a disclosure', (await page.locator('#netside details.rules summary').count()) === 1);
  check('Years label covers stated ties', /correspondence and stated ties; PI ties are undated/.test(await text('#netcontrols')));
  await page.fill('#netfind', 'Bumpus'); await page.press('#netfind', 'Enter'); await page.waitForTimeout(600);
  check('node search "Bumpus" + Enter fills the side panel', /H\. C\. Bumpus/.test(await text('#netside')));
  await page.screenshot({ path: 'tests/screenshots/07-network.png' });
  // Years 1914–1914 with only stated ties: the 1914 Lucas/Grant/Mathews ties and nothing from 1907
  for (const k of ['correspondence', 'pi']) await page.uncheck(`#netcontrols input[data-k="${k}"]`);
  await page.selectOption('#nyMin', '1914'); await page.selectOption('#nyMax', '1914'); await page.waitForTimeout(400);
  const titles1914 = await page.evaluate(() => [...document.querySelectorAll('#netsvg path.netedge')].map(p => p.querySelector('title').textContent));
  check('1914-only stated graph shows Lucas ties', titles1914.some(t => /Lucas/.test(t)), titles1914.length + ' ties');
  check('1914-only stated graph shows no 1907 tie', !titles1914.some(t => /Startsman|Meany|Chilberg|Anderson/.test(t)));
  await page.setViewportSize({ width: 1024, height: 768 }); await go('/network', 1200);
  check('controls bar does not cover the graph (1024×768)', !(await boxes('#netcontrols', '#netsvg')));
  await page.setViewportSize({ width: 1400, height: 900 });

  // ---------------------------------------------------------------- network: the four other views (C3, C5, C6, C7, C9)
  await go('/network/view/funding', 800);
  const fundEdges = await page.locator('#netsvg path.netedge').count();
  check('funding view draws ≥ 12 edges', fundEdges >= 12, fundEdges);
  check('funding view labels every edge with its amount', (await page.locator('#netsvg text.netlabel').count()) === fundEdges);
  const fundRule = await page.evaluate(() => window.JOURNEYS_DATA.network.funding.rule);
  check('funding header = network.funding.rule verbatim', (await text('#netviewhead .rule')).trim() === fundRule);
  const caveats = await page.evaluate(() => window.JOURNEYS_DATA.network.funding.caveats);
  const side = await page.evaluate(() => document.getElementById('netside').textContent);
  check('funding side panel shows every caveat verbatim', caveats.every(c => side.includes(c)), caveats.length + ' caveats');
  check('funding header says asserted', /asserted/i.test(await text('#netviewhead')));
  await page.screenshot({ path: 'tests/screenshots/14-network-funding.png' });
  await go('/network/view/coattestation', 2000);
  check('co-attestation view draws ≥ 1 strand', (await page.locator('#netsvg path.netedge').count()) >= 1);
  const coHead = await text('#netviewhead');
  const coCaveat = await page.evaluate(() => window.JOURNEYS_DATA.network.coattestation.caveat);
  check('co-attestation header says derived and shows the caveat verbatim', /derived/i.test(coHead) && coHead.includes(coCaveat));
  await page.selectOption('#ncofilter', 'pi'); await page.waitForTimeout(600);
  const coSide = await text('#netside');
  check('PI-only filter lists Stone and Anderson with Quackenbush', /Stone/.test(coSide) && /Anderson/.test(coSide) && /Quackenbush/.test(coSide));
  await page.screenshot({ path: 'tests/screenshots/15-network-coattestation.png' });
  await go('/network/view/institutions', 2000);
  check('institutions view draws square institution nodes', (await page.locator('#netsvg g.netnode rect').count()) >= 5);
  check('institutions view draws inferred affiliations faintly', (await page.locator('#netsvg path.netedge.affiliation.inferred').count()) >= 1);
  await page.screenshot({ path: 'tests/screenshots/16-network-institutions.png' });
  await go('/network/view/mentions', 2000);
  check('mentions view draws ≥ 1 edge', (await page.locator('#netsvg path.netedge.mention').count()) >= 1);
  check('mentions header contains derived', /derived/i.test(await text('#netviewhead')));
  await page.screenshot({ path: 'tests/screenshots/17-network-mentions.png' });
  await go('/network', 300); for (const k of ['correspondence', 'pi']) await page.check(`#netcontrols input[data-k="${k}"]`); await page.selectOption('#nyMin', '1906'); await page.selectOption('#nyMax', '1930');
  await go('/network/focus/p_quackenbush', 1500);
  check('ego view still works', (await page.locator('#netsvg g.netnode').count()) >= 5);

  // ---------------------------------------------------------------- person pages, cast, stories, method (C2, C3, C10, C11, C12)
  await go('/person/p_grant', 300);
  const grant = await text('#pageview');
  check('Grant: letterhead tag beside the Stone tie', /letterhead/.test(grant));
  check('Grant: f_travel_with_grant on the record', /Did Quackenbush travel with Grant/.test(grant));
  check('Grant: Cast heading says working notes', /working notes/i.test(grant));
  check('Grant: eugenicist is a characterisation, not a role', /Characterisations \(PI\)/.test(grant) && /notorious eugenicist/.test(grant));
  await page.screenshot({ path: 'tests/screenshots/08-person.png' });
  await go('/person/p_ripley', 300);
  check('Ripley: AMNH under "Affiliations inferred by the model"', /Affiliations inferred by the model/.test(await text('#pageview')));
  await go('/person/p_morgan', 300);
  const morgan = await text('#pageview');
  check('Morgan: no PI tie to Quackenbush, funding edges listed', !/paid for half of both expeditions/.test(morgan) && /Funding/.test(morgan) && /\$750/.test(morgan));
  await go('/person/i_amnh', 300);
  check('AMNH: stated and inferred affiliates split', /People affiliated \(stated/.test(await text('#pageview')) && /inferred by the model/.test(await text('#pageview')));
  await go('/cast', 300);
  check('Cast page says working notes', /working notes/.test(await text('#pageview')));
  await go('/story/story_23_accounts', 300);
  check('story_23 shows f_1909_halves', /Total expense 1908 was \$1,712\.27/.test(await text('#pageview')));
  await go('/story/story_06_anderson', 300);
  check('story_06 note carries the PI’s hedge', /presumably/.test(await text('#pageview')));
  await go('/method/findings', 300);
  const fnd = await text('#pageview');
  check('Method › Findings lists the seven new entries', ['Eastern Hemisphere', 'Taken by for Mr. Quackenbush', 'Alaska Mammoth Exp. 1906', 'Robert T. Varnum', 'LSQ writes from Shelton', 'U.S. National', '$856.14'].every(s => fnd.includes(s)));
  await go('/method/network', 300);
  const mn = await text('#pageview');
  const rules = await page.evaluate(() => { const N = window.JOURNEYS_DATA.network; return N.views.map(v => v.rule); });
  check('Method › Network prints every view rule verbatim', rules.every(r => mn.includes(r)));
  check('Method › Network has the Views table and the letterhead sentence', /Views/.test(mn) && /tagged letterhead/.test(mn));
  await page.screenshot({ path: 'tests/screenshots/18-method-network.png' });
  await go('/method/data', 300);
  check('Method › Data shows verified_quotations', /verified_quotations/.test(await text('#pageview')));
  await go('/timeline', 200); await page.screenshot({ path: 'tests/screenshots/09-timeline.png' });
  await go('/published', 200); await page.screenshot({ path: 'tests/screenshots/10-published.png' });
  await go('/method/geocoding', 200); await page.screenshot({ path: 'tests/screenshots/11-method.png' });
  await go('/tale/t035', 300);
  // integrity crawl: every route of every record renders without "not found"
  const routes = await page.evaluate(() => { const D = window.JOURNEYS_DATA; return [
    ...D.stories.map(s => '/story/' + s.id), ...D.documents.map(d => '/archive/' + d.id), ...D.people.map(p => '/person/' + p.id), ...D.institutions.map(i => '/person/' + i.id), ...D.offices.map(o => '/person/' + o.id),
    ...D.places.map(p => '/place/' + p.id), ...D.published.map(p => '/published/' + p.id), ...D.timeline.slice(0, 10).map(t => '/timeline/' + t.id), '/method/overview', '/method/network', '/method/findings', '/method/data', '/stories', '/cast', '/tale', '/network/focus/p_quackenbush', '/network/doc/d_19070325_matthew_bumpus', ...D.network.views.map(v => '/network/view/' + v.id)]; });
  let bad = 0;
  for (const r of routes) { await go(r); const txt = await page.evaluate(() => document.getElementById('pageview').innerText.slice(0, 400)); if (/\b(story|record|item|place) not found\b/i.test(txt)) { bad++; console.log('NOT FOUND at', r); } }
  console.log('crawled', routes.length, 'routes;', bad, 'failures');
  // dangling internal links on rendered story/archive pages
  await go('/stories'); const links = await page.evaluate(() => { const D = window.JOURNEYS_DATA; const ids = new Set([...D.stories.map(s=>'story/'+s.id), ...D.documents.map(d=>'archive/'+d.id), ...D.people.map(p=>'person/'+p.id), ...D.institutions.map(i=>'person/'+i.id), ...D.offices.map(o=>'person/'+o.id), ...D.places.map(p=>'place/'+p.id), ...D.published.map(p=>'published/'+p.id), ...D.timeline.map(t=>'timeline/'+t.id)]); const out=[]; D.stories.forEach(s=>{ s.docs.forEach(d=>{ if(!ids.has('archive/'+d)) out.push(s.id+' -> '+d); }); }); return out; });
  console.log('dangling story->doc links:', links.length);
  console.log('warnings (network):', warnings.length, warnings.slice(0, 3));
  console.log('ASSERTIONS failed:', failed.length, failed);
  console.log('JS ERRORS:', errors.length); errors.slice(0, 20).forEach(e => console.log('  ', e));
  await browser.close();
  process.exit(errors.length || bad || failed.length ? 1 : 0);
})().catch(e => { console.error('TEST CRASH', e); process.exit(2); });
