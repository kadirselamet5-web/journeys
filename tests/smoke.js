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
  // WCAG contrast of an element's computed text colour against a computed background colour
  const contrastOf = (fgSel, bgSel) => page.evaluate(([f, b]) => { const p = s => (s.match(/[\d.]+/g) || []).map(Number); const lum = c => { const [r, g, bl] = p(c).slice(0, 3).map(v => v / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return .2126 * r + .7152 * g + .0722 * bl; }; const fe = document.querySelector(f), be = b ? document.querySelector(b) : fe; if (!fe || !be) return -1; const fg = getComputedStyle(fe).color, bg = getComputedStyle(be).backgroundColor; const x = lum(fg), y = lum(bg); return +((Math.max(x, y) + .05) / (Math.min(x, y) + .05)).toFixed(2); }, [fgSel, bgSel]);

  // ---------------------------------------------------------------- D1 / D2 / D6: top bar, help card, stop list as links
  check('#topbar links to #/about (Start here and ?)', (await page.locator('#topbar a[href="#/about"]').count()) >= 2);
  const tabsTxt = await text('#tabs');
  check('#tabs says "Sources cited", not "Published"', /Sources cited/.test(tabsTxt) && !/Published/.test(tabsTxt));
  check('help card shown on first visit at the top of the panel', (await page.locator('#panelInner > #helpcard').count()) === 1);
  check('#stoplist has 41 stop links', (await page.locator('#stoplist a[data-stop]').count()) === 41);
  check('stop list rows carry a status glyph and an sr-only status word', (await page.locator('#stoplist a svg.glyph').count()) >= 41 && (await page.locator('#stoplist a .sr-only.st').count()) === 41);

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
  check('aria-current follows MapView.highlight (one link, the highlighted stop)', (await page.evaluate(() => { const a = [...document.querySelectorAll('#stoplist a[aria-current="true"]')]; return a.length === 1 && a[0].dataset.stop === MapView.state.highlight; })));
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
  await page.click('#stoplist a[data-stop="s1908_08"]'); await page.waitForTimeout(1600);
  check('stop link navigates to its #/map/stop address', (await page.evaluate(() => location.hash)) === '#/map/stop/s1908_08');
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
  // ---------------------------------------------------------------- D2 / D6 / D7 on the story page
  check('story page has no "✕ Close" and shows "↑ Story index" and a breadcrumb', !(await text('#pageview')).includes('✕ Close') && (await page.locator('#pageview .pagenav a.up:has-text("Story index")').count()) === 1 && (await page.locator('#pageview nav.phase[aria-label="Breadcrumb"] a[href="#/stories"]').count()) === 1);
  check('"When" table has exactly four columns (Stop · Date · Evidence · Sources)', (await page.locator('#pageview table.when thead th').count()) === 4);
  check('"When" table is followed by an evidence legend linking to the glossary', (await page.locator('#pageview .evidence-legend a[href="#/about#glossary-status"]').count()) === 1 && (await page.locator('#pageview .evidence-legend svg.glyph').count()) >= 1);
  const fn47 = await page.evaluate(() => { const s = window.JOURNEYS_DATA.stories.find(x => x.id === 'story_05_newyork_deliberation'); return s.tale_excerpts.some(e => (e.footnotes || []).some(f => f.n === 47)); });
  check('stories.json: story_05 excerpt carries PI footnote 47', fn47);
  await go('/story/story_05_newyork_deliberation', 300);
  const s05 = await text('#pageview');
  check('story_05 shows "PI\'s footnote 47" with its text', /PI's footnote 47/.test(s05) && /Matthew to Bumpus 25 March 1907/.test(s05));
  await page.screenshot({ path: 'tests/screenshots/review-after-story-footnotes.png' });
  await page.setViewportSize({ width: 1060, height: 900 });
  const whereStory = await page.evaluate(() => { const s = window.JOURNEYS_DATA.stories.filter(x => x.places.length >= 3).sort((a, b) => b.places.length - a.places.length)[0]; return s.id; });
  await go('/story/' + whereStory, 400);
  const whereCols = await page.evaluate(() => { const g = document.querySelector('#pageview .grid2.where'); return g ? getComputedStyle(g).gridTemplateColumns.split(' ').length : -1; });
  check('"Where" grid has at most two columns at 1060 px', whereCols >= 1 && whereCols <= 2, whereCols + ' columns on ' + whereStory);
  await page.setViewportSize({ width: 1400, height: 900 });
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
  // ---------------------------------------------------------------- D8 Method › Approach
  await go('/method/overview', 300);
  const mo = await text('#pageview');
  check('Method › Approach: no design-literature citations, one model-labelled design sentence', !/Visualizing Emancipation|St Olaf|DHQ/.test(mo) && /cite no literature/.test(mo));
  check('Method › Approach: "What the lab can supply next" with ≥ 8 finding cards', /What the lab can supply next/.test(mo) && (await page.locator('#pageview .finding').count()) >= 8 && /Bulletin’s own wording would also settle/.test(mo));
  await page.screenshot({ path: 'tests/screenshots/review-after-method-overview.png' });
  // ---------------------------------------------------------------- D9 Timeline
  await go('/timeline', 300); await page.screenshot({ path: 'tests/screenshots/09-timeline.png' });
  check('timeline has a sticky year rail with ≥ 6 links', (await page.locator('#pageview nav.yr-rail a').count()) >= 6 && (await page.evaluate(() => getComputedStyle(document.querySelector('nav.yr-rail')).position)) === 'sticky');
  const longPills = await page.evaluate(() => [...document.querySelectorAll('.tlentry .links a')].filter(a => /^(Read the document|On the map:)/.test(a.textContent.trim())).length);
  check('timeline pills are short (no "Read the document" / "On the map:" text); targets kept in aria-label', longPills === 0 && (await page.locator('.tlentry .links a[aria-label^="Read the document"]').count()) > 0 && (await page.locator('.tlentry .links a[aria-label^="On the map"]').count()) > 0);
  await page.evaluate(() => { document.getElementById('pageview').scrollTop = 1200; });
  await page.evaluate(() => { Pages._tl('itin'); }); await page.waitForTimeout(100);
  await page.evaluate(() => { Pages._tl('terse'); }); await page.waitForTimeout(100);
  const tlScroll = await page.evaluate(() => document.getElementById('pageview').scrollTop);
  check('switching timeline streams and back preserves scrollTop (± 50 px)', Math.abs(tlScroll - 1200) <= 50, tlScroll);
  // ---------------------------------------------------------------- D2 Sources cited
  await go('/published', 200); await page.screenshot({ path: 'tests/screenshots/10-published.png' });
  check('Sources cited: h1 and route title renamed', /^Sources cited/.test(await text('#pageview h1')) && (await page.evaluate(() => App.routeTitle('/published') + '|' + App.routeTitle('/published/pub_bamnh26'))) === 'Sources cited|Source cited');
  // ---------------------------------------------------------------- D1 Start here
  await go('/about', 300);
  const about = await text('#pageview');
  check('#/about renders (no "not found"), with abstract, inputs and reading order', !/Not found/.test(about) && /Start here/.test(about) && /SHA-256/.test(about) && (await page.locator('#pageview .reading-order li').count()) === 5 && (await page.locator('#pageview table.inputs tbody tr').count()) === 5);
  check('#/about quotes the Tale\'s "Plan:" paragraph in PI voice', (await page.locator('#pageview .block.pi:has-text("Plan:")').count()) === 1);
  const glossaryRows = await page.locator('#pageview table.glossary tbody tr[id^="glossary-"]:not(.grp)').count();
  check('glossary has ≥ 25 term rows with #glossary-<term> anchors', glossaryRows >= 25, glossaryRows + ' rows');
  check('glossary renders the chip and tag components and the status anchor', (await page.locator('#pageview table.glossary .chip.verified').count()) === 1 && (await page.locator('#pageview table.glossary .tag.model').count()) >= 2 && (await page.locator('#pageview #glossary-status').count()) === 1);
  await page.screenshot({ path: 'tests/screenshots/19-about.png' });
  await page.evaluate(() => document.getElementById('glossary-status').scrollIntoView({ block: 'start' })); await page.waitForTimeout(100);
  await page.screenshot({ path: 'tests/screenshots/review-after-about-glossary.png' });
  check('timeline year rail lists each year once', await (async () => { await go('/timeline', 200); const ys = await page.evaluate(() => [...document.querySelectorAll('nav.yr-rail a')].map(a => a.textContent)); return new Set(ys).size === ys.length && ys.length >= 6; })());
  await go('/tale/t035', 300);
  // integrity crawl: every route of every record renders without "not found"
  const routes = await page.evaluate(() => { const D = window.JOURNEYS_DATA; return [
    ...D.stories.map(s => '/story/' + s.id), ...D.documents.map(d => '/archive/' + d.id), ...D.people.map(p => '/person/' + p.id), ...D.institutions.map(i => '/person/' + i.id), ...D.offices.map(o => '/person/' + o.id),
    ...D.places.map(p => '/place/' + p.id), ...D.published.map(p => '/published/' + p.id), ...D.timeline.slice(0, 10).map(t => '/timeline/' + t.id), '/method/overview', '/method/network', '/method/findings', '/method/data', '/stories', '/cast', '/tale', '/network/focus/p_quackenbush', '/network/doc/d_19070325_matthew_bumpus', ...D.network.views.map(v => '/network/view/' + v.id)]; });
  routes.push('/about', '/about/glossary-status');
  let bad = 0, closeBtns = 0, legendless = 0;
  for (const r of routes) { await go(r); const [txt, hasClose, noLegend] = await page.evaluate(() => { const pv = document.getElementById('pageview'); return [pv.innerText.slice(0, 400), pv.innerText.includes('✕ Close'), !!pv.querySelector('table.when') && !pv.querySelector('.evidence-legend')]; }); if (/\b(story|record|item|place) not found\b/i.test(txt)) { bad++; console.log('NOT FOUND at', r); } if (hasClose) closeBtns++; if (noLegend) legendless++; }
  check('no page contains "✕ Close"', closeBtns === 0, closeBtns + ' pages');
  check('every story page with a "When" table has an evidence legend', legendless === 0, legendless + ' pages without');
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
  // ---------------------------------------------------------------- D3 phone layout (390×844)
  const sheet = await page.evaluate(() => { const p = document.getElementById('panel'); const r = p.getBoundingClientRect(); return { collapsed: p.classList.contains('collapsed'), top: r.top, width: r.width, handle: getComputedStyle(document.getElementById('panelHandle')).display }; });
  check('390×844: panel is a bottom sheet (full width, lower half) with a visible handle, collapsed by default', sheet.handle !== 'none' && sheet.width === 390 && sheet.top >= .4 * 844 && sheet.collapsed, JSON.stringify(sheet));
  if (sheet.collapsed) { await page.click('#panelHandle'); await page.waitForTimeout(400); }
  const open = await page.evaluate(() => { const r = document.getElementById('panel').getBoundingClientRect(); return { top: r.top, h: window.innerHeight, collapsed: document.getElementById('panel').classList.contains('collapsed') }; });
  check('390×844: open sheet top ≥ 40 % of the viewport height', !open.collapsed && open.top >= .4 * open.h, JSON.stringify(open));
  check('390×844: #modeSeg not intersected by the zoom control', !(await boxes('#modeSeg', '.leaflet-control-zoom')));
  await page.screenshot({ path: 'tests/screenshots/review-after-p-map.png' });
  await page.click('#panelHandle'); await page.waitForTimeout(400);
  check('390×844: handle collapses the sheet to a strip', (await page.evaluate(() => document.getElementById('panel').getBoundingClientRect().height)) < 60);
  await page.screenshot({ path: 'tests/screenshots/review-after-p-map-collapsed.png' });
  const noHScroll = async () => page.evaluate(() => { const pv = document.getElementById('pageview'); return [pv.scrollWidth, pv.clientWidth]; });
  await go('/story/story_19_excavation', 1500); let [sw, cw] = await noHScroll();
  check('390×844: story page has no horizontal overflow', sw <= cw, `${sw} ≤ ${cw}`);
  check('390×844: "When" table rows stack (cells display:block with data-label)', (await page.evaluate(() => getComputedStyle(document.querySelector('table.when td')).display)) === 'block');
  await page.screenshot({ path: 'tests/screenshots/review-after-p-story.png' });
  await go('/method/geocoding', 600); [sw, cw] = await noHScroll();
  check('390×844: Method › Geocoding has no horizontal overflow (tables wrapped)', sw <= cw && (await page.locator('#pageview .tablewrap').count()) >= 3, `${sw} ≤ ${cw}`);
  check('390×844: Method segmented control is one scrollable strip', (await page.evaluate(() => { const s = document.querySelector('.methodseg'); return getComputedStyle(s).overflowX === 'auto' && s.getBoundingClientRect().height < 60; })));
  await page.screenshot({ path: 'tests/screenshots/review-after-p-method.png' });
  await go('/tale/t035', 400);
  const pnum = await page.evaluate(() => document.querySelector('#t035 .pnum').getBoundingClientRect().left);
  check('390×844: Tale ¶ numbers sit inline (left ≥ 0)', pnum >= 0, pnum);
  await page.screenshot({ path: 'tests/screenshots/review-after-p-tale.png' });
  await go('/network', 1200);
  check('390×844: network filter rows sit in a closed disclosure', (await page.evaluate(() => { const d = document.querySelector('#netcontrols details.netmore'); return d && !d.open && getComputedStyle(d.querySelector('summary')).display !== 'none'; })));
  await page.screenshot({ path: 'tests/screenshots/review-after-p-network.png' });
  await go('/archive/d_19070416_osborn_bumpus', 400); await page.screenshot({ path: 'tests/screenshots/review-after-p-archive.png' });
  // ---------------------------------------------------------------- D4 reflow: 320 px wide, and 200 % text at 1400×900
  await page.setViewportSize({ width: 320, height: 600 }); await go('/map', 600);
  check('320×600: panel no wider than the viewport', (await page.evaluate(() => document.getElementById('panel').getBoundingClientRect().width <= window.innerWidth)));
  await go('/archive', 400);
  check('320×600: archive list has no horizontal overflow', (await page.evaluate(() => { const l = document.querySelector('#archive .list'); return l.scrollWidth <= l.clientWidth; })));
  await page.setViewportSize({ width: 1400, height: 900 }); await go('/map', 600);
  if (await page.evaluate(() => document.getElementById('panel').classList.contains('collapsed'))) { await page.click('#panelToggle'); await page.waitForTimeout(400); }
  await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; }); await page.waitForTimeout(400);
  const zoomed = await page.evaluate(() => { const tb = document.getElementById('topbar'), tabs = document.querySelector('nav.tabs'), inner = document.querySelector('#panel .inner'); return { tbS: tb.scrollHeight, tbC: tb.clientHeight, tabsS: tabs.scrollWidth, tabsC: tabs.clientWidth, inS: inner.scrollWidth, inC: inner.clientWidth, appTop: document.getElementById('app').getBoundingClientRect().top, tbBottom: tb.getBoundingClientRect().bottom }; });
  check('200 % text: top bar grows instead of clipping, and #app starts below it', zoomed.tbS <= zoomed.tbC + 1 && Math.abs(zoomed.appTop - zoomed.tbBottom) < 2, JSON.stringify(zoomed));
  check('200 % text: no tab clipped, panel content not wider than the panel', zoomed.tabsS <= zoomed.tabsC && zoomed.inS <= zoomed.inC, JSON.stringify(zoomed));
  await page.screenshot({ path: 'tests/screenshots/review-after-zoom200-map.png' });
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
  // ---------------------------------------------------------------- D5 light-scheme contrast of the inferred chip
  await go('/method/geocoding', 400);
  const chipC = await contrastOf('#pageview .chip.inferred', '#pageview .chip.inferred');
  check('light: .chip.inferred text ≥ 4.5:1 on its surface', chipC >= 4.5, chipC);
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
  // ---------------------------------------------------------------- D5 dark scheme: the four typed blocks are legible (the Archive landing shows one of each); hovered rows take the dark token
  const dEd = await dpage.evaluate(() => { const el = document.querySelector('#reader .block.editorial'); const p = s => (s.match(/[\d.]+/g) || []).map(Number); const lum = c => { const [r, g, b] = p(c).slice(0, 3).map(v => v / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return .2126 * r + .7152 * g + .0722 * b; }; const cs = getComputedStyle(el); const x = lum(cs.color), y = lum(cs.backgroundColor); return +((Math.max(x, y) + .05) / (Math.min(x, y) + .05)).toFixed(2); });
  check('dark: Osborn 16 Apr 1907 editorial block text ≥ 4.5:1', dEd >= 4.5, dEd);
  await dpage.evaluate(() => App.go('/archive')); await dpage.waitForTimeout(400);
  const dContrast = await dpage.evaluate(() => { const p = s => (s.match(/[\d.]+/g) || []).map(Number); const lum = c => { const [r, g, b] = p(c).slice(0, 3).map(v => v / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return .2126 * r + .7152 * g + .0722 * b; }; const out = {}; ['editorial', 'summary', 'annotation', 'model'].forEach(k => { const el = document.querySelector('#reader .block.' + k); if (!el) { out[k] = null; return; } const cs = getComputedStyle(el); const x = lum(cs.color), y = lum(cs.backgroundColor); out[k] = +((Math.max(x, y) + .05) / (Math.min(x, y) + .05)).toFixed(2); }); return out; });
  check('dark: editorial / summary / annotation / model block text ≥ 4.5:1 on its background', Object.values(dContrast).every(v => v !== null && v >= 4.5), JSON.stringify(dContrast));
  await dpage.evaluate(() => App.go('/method/geocoding')); await dpage.waitForTimeout(500);
  await dpage.hover('#pageview table.data tbody tr:first-child td:first-child'); await dpage.waitForTimeout(100);
  const hoverBg = await dpage.evaluate(() => getComputedStyle(document.querySelector('#pageview table.data tbody tr:first-child td:first-child')).backgroundColor);
  check('dark: hovered table row background is rgb(38, 42, 47)', hoverBg === 'rgb(38, 42, 47)', hoverBg);
  await dpage.screenshot({ path: 'tests/screenshots/review-after-dark-method-table.png' });
  await dpage.evaluate(() => App.go('/story/story_05_newyork_deliberation')); await dpage.waitForTimeout(500);
  await dpage.screenshot({ path: 'tests/screenshots/review-after-dark-story.png' });
  await dctx.close();

  // ---------------------------------------------------------------- D1 help card dismissal persists; D2 fresh load of a story goes up to the index
  const fctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, ignoreHTTPSErrors: true });
  const fpage = await fctx.newPage(); hook(fpage);
  await fpage.goto(url + '#/map', { waitUntil: 'load' }); await fpage.waitForFunction(() => window.App && window.MapView, null, { timeout: 15000 }); await fpage.waitForTimeout(1500);
  check('fresh context: help card present', (await fpage.locator('#helpcard').count()) === 1);
  await fpage.click('#helpcard .dismiss'); await fpage.waitForTimeout(100);
  await fpage.reload({ waitUntil: 'load' }); await fpage.waitForFunction(() => window.App && window.MapView, null, { timeout: 15000 }); await fpage.waitForTimeout(1500);
  check('after dismissal and reload: help card absent (localStorage flag)', (await fpage.locator('#helpcard').count()) === 0 && (await fpage.evaluate(() => localStorage.getItem('qj_help_dismissed'))) === '1');
  await fpage.goto(url + '#/story/story_19_excavation', { waitUntil: 'load' }); await fpage.waitForFunction(() => window.App, null, { timeout: 15000 }); await fpage.waitForTimeout(600);
  await fpage.reload({ waitUntil: 'load' }); await fpage.waitForFunction(() => window.App, null, { timeout: 15000 }); await fpage.waitForTimeout(600);
  const backLabel = await fpage.evaluate(() => (document.querySelector('#pageview .pagenav button.ghost') || {}).textContent || '');
  await fpage.click('#pageview .pagenav button.ghost'); await fpage.waitForTimeout(300);
  check('fresh load of a story: Back goes up to #/stories', /Back to Story index/.test(backLabel) && (await fpage.evaluate(() => location.hash)) === '#/stories', backLabel + ' → ' + await fpage.evaluate(() => location.hash));
  await fctx.close();

  console.log('warnings (network):', warnings.length, warnings.slice(0, 3));
  console.log('ASSERTIONS failed:', failed.length, failed);
  console.log('JS ERRORS:', errors.length); errors.slice(0, 20).forEach(e => console.log('  ', e));
  await browser.close();
  process.exit(errors.length || bad || failed.length ? 1 : 0);
})().catch(e => { console.error('TEST CRASH', e); process.exit(2); });
