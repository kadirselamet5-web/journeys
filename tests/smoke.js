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
  const hook = (p) => { p.on('pageerror', e => errors.push('pageerror: ' + e.message + ' @ ' + ((e.stack || '').split('\n').slice(1, 3).join(' | ')).trim())); p.on('console', m => { if (m.type() === 'error') { const t = m.text(); if (!/net::ERR|Failed to load resource|ERR_/.test(t)) errors.push('console: ' + t); else warnings.push(t.slice(0, 120)); } }); };
  hook(page);
  const url = 'file://' + path.resolve(__dirname, '..', 'index.html');
  const go = async (route, ms = 60) => { await page.evaluate(r => window.App.go(r), route); await page.waitForTimeout(ms); };
  const text = async (sel) => page.evaluate(s => (document.querySelector(s) || {}).innerText || '', sel);
  const boxes = async (a, b) => page.evaluate(([a, b]) => { const ra = document.querySelector(a).getBoundingClientRect(), rb = document.querySelector(b).getBoundingClientRect(); return !(ra.right <= rb.left || ra.left >= rb.right || ra.bottom <= rb.top || ra.top >= rb.bottom); }, [a, b]);
  // every sampled point of the toggle's box must resolve to the toggle itself (nothing is stacked over it)
  const toggleFree = () => page.evaluate(() => { const t = document.getElementById('panelToggle'); const r = t.getBoundingClientRect(); const pts = [[r.left + 2, r.top + 2], [r.right - 2, r.top + 2], [r.left + 2, r.bottom - 2], [r.right - 2, r.bottom - 2], [(r.left + r.right) / 2, (r.top + r.bottom) / 2]]; return pts.every(([x, y]) => { const e = document.elementFromPoint(x, y); return e && (e === t || t.contains(e)); }); });
  const visibleLabelOverlaps = () => page.evaluate(() => { const r = [...document.querySelectorAll('#leaflet .lbl:not(.tip)')].filter(e => e.style.display !== 'none').map(e => e.getBoundingClientRect()).filter(b => b.width > 0); let n = 0; for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) { const a = r[i], b = r[j]; if (!(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom)) n++; } return [r.length, n]; });

  await page.goto(url + '#/map', { waitUntil: 'load' });
  await page.waitForFunction(() => window.App && window.MapView, null, { timeout: 15000 });
  await page.waitForTimeout(2500);
  const markers = await page.locator('#leaflet path.leaflet-interactive').count();
  console.log('map markers+lines drawn:', markers);
  await page.screenshot({ path: 'tests/screenshots/01-map-flat.png' });

  // ---------------------------------------------------------------- B1 controls
  check('zoom control sits in .leaflet-top.leaflet-right', (await page.locator('.leaflet-top.leaflet-right .leaflet-control-zoom').count()) === 1);
  check('scale bar present', (await page.locator('.leaflet-control-scale').count()) === 1);
  check('panel toggle not overlapped (1400×900, panel open)', await toggleFree());
  await page.click('#panelToggle', { timeout: 2000 }); await page.waitForTimeout(350);
  check('panel collapses on click', await page.evaluate(() => document.getElementById('panel').classList.contains('collapsed')));
  check('panel toggle not overlapped (collapsed)', await toggleFree());
  await page.click('#panelToggle', { timeout: 2000 }); await page.waitForTimeout(350);
  check('panel re-opens on click', !(await page.evaluate(() => document.getElementById('panel').classList.contains('collapsed'))));
  // ---------------------------------------------------------------- B9 frames (fresh load opens on Alaska)
  const z0 = await page.evaluate(() => MapView.zoom());
  const nomeVisible = await page.evaluate(() => { const m = document.querySelector('#leaflet path[data-place="pl_nome"]'); const r = m.getBoundingClientRect(), s = document.getElementById('leaflet').getBoundingClientRect(); return r.left > s.left && r.right < s.right && r.top > s.top && r.bottom < s.bottom; });
  check('fresh #/map opens at zoom ≥ 4 with Nome visible (Alaska frame)', z0 >= 4 && nomeVisible, 'zoom ' + z0);
  // ---------------------------------------------------------------- B2/B3 legs, markers, badges
  const legs = await page.evaluate(() => MapView.state.legs);
  check('no connector joins Candle–Elephant Point or Solomon River–Keewalik directly (via legs)', legs.length > 0 && !legs.some(l => (l.a === 'pl_candle' && l.b === 'pl_elephant_point') || (l.a === 'pl_solomon_river' && l.b === 'pl_keewalik')), legs.length + ' legs');
  const seaNome = legs.filter(l => [l.a, l.b].sort().join('|') === 'pl_nome|pl_seattle');
  check('Seattle–Nome drawn as three offset parallel legs', seaNome.length === 3 && seaNome.every(l => l.n === 3), JSON.stringify(seaNome.map(l => l.seg + '/' + l.k)));
  for (const id of ['pl_nome', 'pl_seattle', 'pl_keewalik', 'pl_elephant_point']) {
    const [m, b] = await page.evaluate(i => [document.querySelectorAll(`#leaflet path[data-place="${i}"]`).length, document.querySelectorAll(`#leaflet .seq[data-place="${i}"]`).length], id);
    check(`${id}: one marker element and two badges`, m === 1 && b === 2, `${m} marker(s), ${b} badge(s)`);
  }
  // ---------------------------------------------------------------- B6 unlocated layers and panel
  const [nC, nK] = await page.evaluate(() => [MapView.state.constraintCount, MapView.state.candidateCount]);
  check('2 constraint rings and 6 candidate squares drawn at #/map', nC === 2 && nK === 6, `${nC} rings, ${nK} squares`);
  check('panel unlocated section is a <ul> with 3 <li>', (await page.locator('#panelInner ul.unlocated > li').count()) === 3);
  // ---------------------------------------------------------------- B8 legend
  check('#maplegend details[open] exists at 1400×900', (await page.locator('#maplegend details[open]').count()) === 1);
  const legendHit = await page.evaluate(() => { const lg = document.querySelector('#maplegend details').getBoundingClientRect(); const rects = [...document.querySelectorAll('#leaflet .leaflet-marker-icon')].filter(e => e.style.display !== 'none').map(e => (e.querySelector('.seq') || e).getBoundingClientRect()).filter(r => r.width > 0); return rects.filter(r => !(r.right <= lg.left || r.left >= lg.right || r.bottom <= lg.top || r.top >= lg.bottom)).length; });
  check('legend does not intersect any visible marker icon at the default extent', legendHit === 0, legendHit + ' intersecting');
  check('legend HTML carries no hex colour literal (tokens only)', !/#[0-9a-fA-F]{3,8}\b/.test(await page.evaluate(() => document.querySelector('#maplegend').innerHTML)));
  // ---------------------------------------------------------------- B7 labels and reference tiles
  await page.evaluate(() => MapView.setFrame('whole')); await page.waitForTimeout(1200);
  check('reference tile layer absent at zoom ≤ 3', (await page.evaluate(() => MapView.zoom())) <= 3 && (await page.locator('#leaflet img.leaflet-tile[src*="Reference"]').count()) === 0);
  await page.evaluate(() => MapView.setView([66.2589, -161.3347], 6)); await page.waitForTimeout(1500);
  const [nLab, nOv] = await visibleLabelOverlaps();
  check('zoom 6 on Elephant Point: no two visible labels intersect', nLab > 5 && nOv === 0, `${nLab} labels, ${nOv} overlaps`);
  check('reference tile layer present at zoom 6 (dimmed)', (await page.locator('#leaflet img.leaflet-tile[src*="Reference"]').count()) > 0);
  await page.evaluate(() => MapView.setFrame('kotzebue')); await page.waitForTimeout(1500);
  const nSeq = await page.evaluate(() => [...document.querySelectorAll('#leaflet .seq')].filter(e => e.getBoundingClientRect().width > 0).length);
  const nArr = await page.locator('#leaflet .arrow').count();
  check('Kotzebue Sound at zoom ≥ 6: ≥ 10 sequence badges visible and ≥ 8 arrows', nSeq >= 10 && nArr >= 8, `${nSeq} badges, ${nArr} arrows, zoom ${await page.evaluate(() => MapView.zoom())}`);
  await page.evaluate(() => MapView.setView([56, -140], 4)); await page.waitForTimeout(1500);
  await page.screenshot({ path: 'tests/screenshots/review-after-map-offsets.png' });
  // ---------------------------------------------------------------- B4 step-through, card, popups, route
  await go('/map/stop/s1908_08', 1600);
  check('#/map/stop/s1908_08 marks the stop active in the list', (await page.locator('#stoplist li.active[data-stop="s1908_08"]').count()) === 1);
  check('selected-stop card names Elephant Point', /Elephant Point/.test(await text('#stopcard')));
  check('popup has no button.primary', (await page.locator('.leaflet-popup-content button.primary').count()) === 0 && (await page.locator('.leaflet-popup-content').count()) === 1);
  await page.focus('#nextStop'); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(1300);
  check('ArrowRight with focus in the panel steps to s1908_09', (await page.evaluate(() => MapView.state.highlight)) === 's1908_09');
  await go('/map/pl_nome', 1600);
  check('#/map/pl_nome highlights Nome\'s first stop', (await page.evaluate(() => MapView.state.highlight)) === 's1907_07');
  const popH = await page.evaluate(() => { const p = document.querySelector('.leaflet-popup-content-wrapper'); return p ? p.getBoundingClientRect().height : -1; });
  check('Nome popup is compact (< 260 px)', popH > 0 && popH < 260, popH + ' px');
  await page.screenshot({ path: 'tests/screenshots/04-map-popup.png' });
  await go('/map/pl_coffee_creek', 1600);
  const allSix = await page.evaluate(() => { const s = document.getElementById('leaflet').getBoundingClientRect(); return [...document.querySelectorAll('#leaflet .cand[data-place="pl_coffee_creek"]')].map(e => e.getBoundingClientRect()).filter(r => r.left >= s.left && r.right <= s.right && r.top >= s.top && r.bottom <= s.bottom).length; });
  check('#/map/pl_coffee_creek fits all six candidates in view', allSix === 6, allSix + ' in view');
  await go('/map/pl_stones_camp', 1600);
  await page.screenshot({ path: 'tests/screenshots/review-after-map-unlocated.png' });
  await page.click('#frames .pill[data-frame="buckland"]'); await page.waitForTimeout(1300);
  const buck = await page.evaluate(() => { const s = document.getElementById('leaflet').getBoundingClientRect(); const ids = ['pl_buckland_mouth', 'pl_buckland_8mi', 'pl_buckland_62mi', 'pl_buckland_86mi']; return ids.filter(i => { const e = document.querySelector(`#leaflet [data-place="${i}"]`); if (!e) return false; const r = e.getBoundingClientRect(); return r.left >= s.left && r.right <= s.right && r.top >= s.top && r.bottom <= s.bottom; }).length; });
  check('Buckland River frame fits the four Buckland points', buck === 4, buck + ' of 4 in view');
  // ---------------------------------------------------------------- relief and globe (B10)
  await page.click('#modeSeg button[data-mode="relief"]'); await page.waitForTimeout(1500);
  await page.screenshot({ path: 'tests/screenshots/02-map-relief.png' });
  await page.click('#modeSeg button[data-mode="globe"]'); await page.waitForTimeout(2500);
  const globePaths = await page.locator('#globe svg path').count(); console.log('globe paths:', globePaths);
  check('globe svg has role=img with a <title>', (await page.locator('#globe svg[role="img"] > title').count()) === 1);
  await page.evaluate(() => MapView.clearStop());
  const ep = page.locator('#globe g.pt').filter({ has: page.locator('title', { hasText: 'Elephant Point' }) }).first();
  await ep.dispatchEvent('click'); await page.waitForTimeout(400);
  check('globe click on Elephant Point keeps #/map and fills the selected-stop card', /^#\/map/.test(await page.evaluate(() => location.hash)) && /Elephant Point/.test(await text('#stopcard')));
  const s0 = await page.evaluate(() => MapView.globeScale()); await page.focus('#globe svg'); await page.keyboard.press('+'); await page.waitForTimeout(500);
  check('"+" with the globe focused increases projection.scale()', (await page.evaluate(() => MapView.globeScale())) > s0);
  check('globe +/− buttons shown in the View row', await page.locator('#globeZoom:not(.hidden)').count() === 1);
  await page.screenshot({ path: 'tests/screenshots/03-map-globe.png' });
  await page.click('#modeSeg button[data-mode="flat"]'); await page.waitForTimeout(500);
  // stop list click opens popup; story opens from the popup link
  await page.click('#stoplist li[data-stop="s1908_08"]'); await page.waitForTimeout(1600);
  const popup = await page.locator('.leaflet-popup-content').count(); console.log('popup open:', popup);
  await page.click('.leaflet-popup-content a:text("Open story")'); await page.waitForTimeout(800);
  console.log('route after popup click:', await page.evaluate(() => location.hash));
  await page.screenshot({ path: 'tests/screenshots/05-story.png', fullPage: false });
  // next / back navigation
  await page.click('#pageview button:has-text("Next ›")'); await page.waitForTimeout(300);
  const afterNext = await page.evaluate(() => location.hash);
  await page.evaluate(() => window.App.back()); await page.waitForTimeout(300);
  const afterBack = await page.evaluate(() => location.hash);
  console.log('next ->', afterNext, '| back ->', afterBack);
  check('story Back returns to the previous story', afterBack === '#/story/story_19_excavation');
  // ---------------------------------------------------------------- B9 story minimap, B6 place records, B3/B11 Method
  await go('/story/story_20_buckland', 1800);
  check('story_20 minimap draws sequence badges', (await page.locator('#minimap .seq').count()) >= 4);
  check('story_20 "When" rows link to #/map/stop/s1908_1x', (await page.locator('#pageview a[href^="#/map/stop/s1908_1"]').count()) >= 4);
  check('story minimap carries its caption', /Symbols as on the main map/.test(await text('#pageview')));
  await go('/place/pl_reported_mammoth', 300);
  const rm = await text('#pageview');
  check('pl_reported_mammoth: "Why no point is drawn", no "Show on map"', /Why no point is drawn/.test(rm) && !/Show on map/.test(rm) && /Show constraints on map/.test(rm));
  await go('/place/pl_long_island', 300);
  check('pl_long_island: no map link at all (nothing to draw)', !/Show (constraints )?on map/.test(await text('#pageview')));
  await go('/place/pl_lanes_landing', 300);
  check('Lane\'s Landing carries the naming chip, not disputed', (await page.locator('#pageview .chip.naming').count()) >= 1 && (await page.locator('#pageview h1 + .card .chip.disputed, #pageview .card h4 .chip.disputed').count()) === 0);
  await go('/method/geocoding', 400);
  const mg = await text('#pageview');
  check('Method › Geocoding: Connectors table shows "via Keewalik"', /via Keewalik/.test(mg));
  check('Method › Geocoding: scale-bar sentence and constraints table', /scale bar on the map is Leaflet/.test(mg) && /constraints drawn and candidates listed/i.test(mg));
  await page.screenshot({ path: 'tests/screenshots/11-method.png' });
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
  check('f_lanes_landing_shelton links its related finding', /See also:/.test(fnd));
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
  await go('/tale/t035', 300);
  // integrity crawl: every route of every record renders without "not found"
  const routes = await page.evaluate(() => { const D = window.JOURNEYS_DATA; return [
    ...D.stories.map(s => '/story/' + s.id), ...D.documents.map(d => '/archive/' + d.id), ...D.people.map(p => '/person/' + p.id), ...D.institutions.map(i => '/person/' + i.id), ...D.offices.map(o => '/person/' + o.id),
    ...D.places.map(p => '/place/' + p.id), ...D.published.map(p => '/published/' + p.id), ...D.timeline.slice(0, 10).map(t => '/timeline/' + t.id), '/method/overview', '/method/network', '/method/findings', '/method/data', '/stories', '/cast', '/tale', '/network/focus/p_quackenbush', '/network/doc/d_19070325_matthew_bumpus', ...D.network.views.map(v => '/network/view/' + v.id)]; });
  let bad = 0;
  for (const r of routes) { await go(r); const txt = await page.evaluate(() => document.getElementById('pageview').innerText.slice(0, 400)); if (/\b(story|record|item|place) not found\b/i.test(txt)) { bad++; console.log('NOT FOUND at', r); } }
  // map routes: every stop and every place resolve on the map without error
  const mapRoutes = await page.evaluate(() => { const D = window.JOURNEYS_DATA; return [...D.stops.map(s => '/map/stop/' + s.id), ...D.places.map(p => '/map/' + p.id)]; });
  for (const r of mapRoutes) await go(r, 20);
  console.log('crawled', routes.length + mapRoutes.length, 'routes;', bad, 'failures');
  // dangling internal links on rendered story/archive pages
  await go('/stories'); const links = await page.evaluate(() => { const D = window.JOURNEYS_DATA; const ids = new Set([...D.stories.map(s=>'story/'+s.id), ...D.documents.map(d=>'archive/'+d.id), ...D.people.map(p=>'person/'+p.id), ...D.institutions.map(i=>'person/'+i.id), ...D.offices.map(o=>'person/'+o.id), ...D.places.map(p=>'place/'+p.id), ...D.published.map(p=>'published/'+p.id), ...D.timeline.map(t=>'timeline/'+t.id)]); const out=[]; D.stories.forEach(s=>{ s.docs.forEach(d=>{ if(!ids.has('archive/'+d)) out.push(s.id+' -> '+d); }); }); return out; });
  console.log('dangling story->doc links:', links.length);

  // ---------------------------------------------------------------- responsive: legend in the panel below 900 px; phone toggle and no popup
  await go('/map', 300); await page.evaluate(() => MapView.clearStop());
  await page.setViewportSize({ width: 800, height: 600 }); await go('/map', 800);
  check('800×600: legend rendered inside #panelInner, #maplegend hidden', (await page.locator('#panelInner #panellegend details.legend').isVisible()) && !(await page.locator('#maplegend').isVisible()));
  await page.setViewportSize({ width: 390, height: 844 }); await go('/map', 800);
  check('390×844: panel toggle not overlapped', await toggleFree());
  await go('/map/stop/s1908_08', 1500);
  check('390×844: stepping opens no popup (card only)', (await page.locator('.leaflet-popup-content').count()) === 0 && /Elephant Point/.test(await text('#stopcard')));
  await page.setViewportSize({ width: 1400, height: 900 });

  // ---------------------------------------------------------------- dark scheme: Esri dark-gray tiles, no CSS inversion
  const dctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, ignoreHTTPSErrors: true, colorScheme: 'dark' });
  const dpage = await dctx.newPage(); hook(dpage);
  await dpage.goto(url + '#/map', { waitUntil: 'load' }); await dpage.waitForFunction(() => window.App && window.MapView, null, { timeout: 15000 }); await dpage.waitForTimeout(2500);
  const firstTile = await dpage.evaluate(() => (document.querySelector('.leaflet-tile-pane img') || {}).src || '');
  check('dark scheme: first basemap tile is Esri Dark_Gray', /Dark_Gray/.test(firstTile), firstTile.slice(0, 90));
  check('dark scheme: tile pane carries no CSS filter in flat mode', (await dpage.evaluate(() => getComputedStyle(document.querySelector('.leaflet-tile-pane')).filter)) === 'none');
  await dpage.screenshot({ path: 'tests/screenshots/13-map-dark.png' });
  await dpage.evaluate(() => App.go('/archive/d_19070416_osborn_bumpus')); await dpage.waitForTimeout(400);
  await dpage.screenshot({ path: 'tests/screenshots/12-archive-dark.png' });
  await dctx.close();

  console.log('warnings (network):', warnings.length, warnings.slice(0, 3));
  console.log('ASSERTIONS failed:', failed.length, failed);
  console.log('JS ERRORS:', errors.length); errors.slice(0, 20).forEach(e => console.log('  ', e));
  await browser.close();
  process.exit(errors.length || bad || failed.length ? 1 : 0);
})().catch(e => { console.error('TEST CRASH', e); process.exit(2); });
