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

  // ---------------------------------------------------------------- A4 / A11: skip link first, landmarks, headings, legend before the map in the tab order
  await page.evaluate(() => document.activeElement && document.activeElement.blur()); await page.keyboard.press('Tab');
  check('Tab from a fresh load lands first on the skip link', await page.evaluate(() => document.activeElement.classList.contains('skip') && document.activeElement.textContent === 'Skip to content'));
  check('document.title carries the route title', (await page.title()) === 'Map · The Quackenbush Journeys', await page.title());
  check('#announce is a polite live region holding the route title', (await page.evaluate(() => { const a = document.getElementById('announce'); return a.getAttribute('aria-live') === 'polite' && a.textContent === 'Map'; })));
  check('landmarks: #panel is a labelled section (not an aside inside main), #leaflet a labelled region, nav.tabs labelled', (await page.evaluate(() => document.querySelector('section#panel[aria-label]') && !document.querySelector('aside#panel') && document.querySelector('#leaflet[role="region"][aria-label]') && document.querySelector('nav.tabs[aria-label="Sections"]') && document.querySelector('#maplegend[role="region"][aria-label]') && document.querySelector('#mapnote[role="note"]') ? true : false)));
  check('map has an sr-only h1 and the panel sections are h2', (await page.evaluate(() => document.querySelector('#mapview h1.sr-only') && document.querySelectorAll('#panel h2.panel-h').length >= 5 && document.querySelectorAll('#panel h3:not(.grp)').length === 1)));
  check('legend summary precedes every Leaflet interactive element in the tab order (DOM order, both focusable)', (await page.evaluate(() => { const s = document.querySelector('#maplegend details.legend summary'), m = document.querySelector('#leaflet .leaflet-interactive[tabindex="0"]'); return !!s && !!m && !!(s.compareDocumentPosition(m) & Node.DOCUMENT_POSITION_FOLLOWING); })));
  // ---------------------------------------------------------------- A2: markers and connectors are named, focusable buttons; labels, badges and arrows are not
  const focusablePaths = await page.locator('#leaflet path.leaflet-interactive[tabindex="0"][aria-label][role="button"]').count();
  check('≥ 49 map paths are focusable, named buttons', focusablePaths >= 49, focusablePaths);
  check('no label, badge or arrow element is focusable', (await page.evaluate(() => [...document.querySelectorAll('#leaflet .lbl, #leaflet .seq, #leaflet .arrow, #leaflet .badgewrap, #leaflet .arrowwrap')].filter(e => e.tabIndex >= 0 || e.getAttribute('role') === 'button').length)) === 0);
  check('marker name carries place, visits by year and status', /Nome — 1907: stops .*; 1908: stops .*; verified/.test(await page.evaluate(() => document.querySelector('#leaflet path[data-place="pl_nome"]').getAttribute('aria-label'))));
  check('connector name carries from → to, mode status and schematic', /→ .*mode status (stated|not stated|inferred).*schematic/.test(await page.evaluate(() => document.querySelector('#leaflet path[data-seg]').getAttribute('aria-label'))));
  await page.evaluate(() => document.querySelector('#leaflet path[data-place="pl_nome"]').focus()); await page.keyboard.press('Enter'); await page.waitForTimeout(500);
  check('Enter on a focused marker opens its popup as a dialog named by its heading, and focuses it', (await page.evaluate(() => { const c = document.querySelector('.leaflet-popup-content'); return !!c && c.getAttribute('role') === 'dialog' && !!c.getAttribute('aria-labelledby') && document.activeElement === c && !!c.querySelector('h3'); })));
  await page.screenshot({ path: 'tests/screenshots/review-after-a11y-map-popup-dialog.png' });
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  check('Escape closes the popup and focus returns to the marker that opened it', (await page.evaluate(() => document.querySelectorAll('.leaflet-popup-content').length === 0 && document.activeElement.getAttribute('data-place') === 'pl_nome')));
  await page.evaluate(() => MapView.clearStop());
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
  check('#panelToggle: aria-expanded false and label "Show layer panel" when collapsed', (await page.evaluate(() => { const t = document.getElementById('panelToggle'); return t.getAttribute('aria-expanded') === 'false' && t.getAttribute('aria-label') === 'Show layer panel' && t.getAttribute('aria-controls') === 'panel'; })));
  check('panel toggle not overlapped (collapsed)', await toggleFree());
  await page.click('#panelToggle', { timeout: 2000 }); await page.waitForTimeout(350);
  check('panel re-opens on click', !(await page.evaluate(() => document.getElementById('panel').classList.contains('collapsed'))));
  check('#panelToggle: aria-expanded true and label "Hide layer panel" when open', (await page.evaluate(() => { const t = document.getElementById('panelToggle'); return t.getAttribute('aria-expanded') === 'true' && t.getAttribute('aria-label') === 'Hide layer panel'; })));
  check('every toggle button in the map\'s segmented controls carries aria-pressed (the globe + / − are momentary buttons)', (await page.evaluate(() => [...document.querySelectorAll('#panel .seg button')].filter(b => !b.closest('#globeZoom')).every(b => b.hasAttribute('aria-pressed')) && [...document.querySelectorAll('#globeZoom button')].every(b => !b.hasAttribute('aria-pressed') && b.getAttribute('aria-label')))));
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
  check('after clicking a stop the popup (a dialog) holds focus', (await page.evaluate(() => !!document.activeElement.closest('.leaflet-popup-content') && document.activeElement.closest('.leaflet-popup-content').getAttribute('role') === 'dialog')));
  await page.evaluate(() => document.activeElement.blur()); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  check('Escape with focus on body closes the popup and focus returns to the active stop link', (await page.evaluate(() => document.querySelectorAll('.leaflet-popup-content').length === 0 && document.activeElement.matches('#stoplist a[aria-current="true"][data-stop="s1908_08"]'))));
  await page.evaluate(() => MapView.stepTo('s1908_08')); await page.waitForTimeout(600);
  await page.click('.leaflet-popup-content a:text("Open story")'); await page.waitForTimeout(800);
  console.log('route after popup click:', await page.evaluate(() => location.hash));
  await page.screenshot({ path: 'tests/screenshots/05-story.png', fullPage: false });
  // next / back navigation
  await page.click('#pageview .pagenav button:has-text("Next")'); await page.waitForTimeout(300);
  const afterNext = await page.evaluate(() => location.hash);
  await page.evaluate(() => window.App.back()); await page.waitForTimeout(300);
  const afterBack = await page.evaluate(() => location.hash);
  console.log('next ->', afterNext, '| back ->', afterBack);
  check('story Back returns to the previous story', afterBack === '#/story/story_19_excavation');
  // ---------------------------------------------------------------- A4 / A8 / A9 / A10 on the story page
  await go('/map', 300); await go('/story/story_19_excavation', 400);
  const storyFocus = await page.evaluate(() => ({ tag: document.activeElement.tagName, title: document.title, ann: document.getElementById('announce').textContent, route: App.routeTitle('/story/story_19_excavation'), label: document.getElementById('pageview').getAttribute('aria-label') }));
  check('App.go to a story focuses its h1; document.title and #announce carry the story title', storyFocus.tag === 'H1' && storyFocus.title === storyFocus.route + ' · The Quackenbush Journeys' && storyFocus.ann === storyFocus.route && storyFocus.label === storyFocus.route, JSON.stringify(storyFocus));
  await page.evaluate(() => App.back()); await page.waitForTimeout(200);
  check('#announce says "Returned to …" after Back', /^Returned to /.test(await page.evaluate(() => document.getElementById('announce').textContent)));
  await go('/story/story_19_excavation', 1800);
  check('story: a link inside a PI block is underlined; tab links, pills and footer links are not', (await page.evaluate(() => { const a = document.querySelector('#pageview .block.pi a.small'); const t = document.querySelector('nav.tabs a'); const p = document.querySelector('#pageview .pill'); const f = document.querySelector('#pageview .footer-nav a'); const u = e => e && getComputedStyle(e).textDecorationLine; return u(a) === 'underline' && u(t) === 'none' && u(p) === 'none' && u(f) === 'none'; })));
  check('story: every table.data has a caption and th[scope]; a "What the chips mean" disclosure precedes the When table', (await page.evaluate(() => [...document.querySelectorAll('#pageview table.data')].filter(t => !t.querySelector('caption') || t.querySelector('th:not([scope])')).length === 0 && document.querySelectorAll('#pageview details.chip-help').length === 1)));
  check('story: #minimap is an image with a label and nothing focusable inside', (await page.evaluate(() => { const m = document.getElementById('minimap'); return m && m.getAttribute('role') === 'img' && /Map of \d+ places on this page/.test(m.getAttribute('aria-label')) && [...m.querySelectorAll('path, [tabindex]')].filter(e => e.tabIndex >= 0).length === 0; })));
  check('story: document cards have h3 titles and an expand button with aria-expanded/aria-controls', (await page.evaluate(() => document.querySelectorAll('#pageview .doccard h3.title').length >= 1 && [...document.querySelectorAll('#pageview .doccard button[aria-controls]')].every(b => b.hasAttribute('aria-expanded')))));
  await page.evaluate(() => document.querySelector('#pageview .doccard button[aria-controls]').click()); await page.waitForTimeout(100);
  check('expandDoc toggles aria-expanded to true', (await page.evaluate(() => document.querySelector('#pageview .doccard button[aria-controls]').getAttribute('aria-expanded'))) === 'true');
  check('chips point at definitions in the hidden #statusDefs list', (await page.evaluate(() => { const c = document.querySelector('#pageview .chip[aria-describedby]'); return !!c && !!document.querySelector('#statusDefs #' + c.getAttribute('aria-describedby')) && document.querySelectorAll('#statusDefs [id^="def-"]').length >= 20; })));
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
  check('Method › Geocoding: every table.data has a caption and th[scope]', (await page.evaluate(() => [...document.querySelectorAll('#pageview table.data')].filter(t => !t.querySelector('caption') || t.querySelector('th:not([scope])')).length)) === 0);
  check('Method › Geocoding: ≥ 100 elements described by a definition; no new-tab link without an sr-only warning', (await page.evaluate(() => [document.querySelectorAll('[aria-describedby^="def-"]').length, [...document.querySelectorAll('a[target="_blank"]')].filter(a => !a.querySelector('.sr-only')).length])).join() .match(/^(\d+),0$/) && (await page.locator('[aria-describedby^="def-"]').count()) >= 100);
  await go('/method/geocoding', 300); await page.keyboard.press('Shift+Tab');
  const ring = await page.evaluate(() => { const b = document.activeElement; const cs = getComputedStyle(b); const tok = getComputedStyle(document.documentElement).getPropertyValue('--j1907').trim(); const c = document.createElement('i'); c.style.color = tok; document.body.appendChild(c); const rgb = getComputedStyle(c).color; c.remove(); return { cls: b.className, style: cs.outlineStyle, width: cs.outlineWidth, color: cs.outlineColor, token: rgb }; });
  check('a keyboard-focused .ghost button shows a 2px solid outline in --j1907', /ghost/.test(ring.cls) && ring.style === 'solid' && ring.width === '2px' && ring.color === ring.token, JSON.stringify(ring));
  await page.screenshot({ path: 'tests/screenshots/11-method.png' });
  // archive
  await go('/archive/d_19070416_osborn_bumpus', 300);
  const colored = await page.locator('#reader .pi-color').count(); console.log('colour-marked spans in Osborn 16 Apr 1907:', colored);
  await page.screenshot({ path: 'tests/screenshots/06-archive.png' });
  check('archive: filters sit in a fieldset with a legend and every control is named', (await page.evaluate(() => document.querySelectorAll('#archive fieldset.filters > legend').length === 1 && ['afq', 'affolder', 'afyear', 'afwho', 'aftype'].every(i => document.getElementById(i).getAttribute('aria-label')))));
  check('archive: rows are links, one aria-current, year groups are nested lists, #doccount is live', (await page.evaluate(() => document.querySelectorAll('#doclist > li.grp > ul > li > a[href^="#/archive/"]').length === 99 && document.querySelectorAll('#doclist a[aria-current="true"]').length === 1 && document.querySelectorAll('#doclist > :not(li)').length === 0 && document.getElementById('doccount').getAttribute('aria-live') === 'polite')));
  check('archive: Connections is an h2 after the h1', (await page.evaluate(() => [...document.querySelectorAll('#reader h2')].some(h => h.textContent === 'Connections') && document.querySelectorAll('#reader h3').length === 0)));
  await page.fill('#afq', 'walrus'); await page.waitForTimeout(200);
  console.log('archive search "walrus":', await page.locator('#doclist a').count(), 'items');
  await page.fill('#afq', ''); await page.waitForTimeout(200);
  // keyboard path: skip link, then Tab through the filter controls to the first item link; Enter opens it
  await page.goto('about:blank'); await page.goto(url + '#/archive', { waitUntil: 'load' }); await page.waitForFunction(() => window.App, null, { timeout: 15000 }); await page.waitForTimeout(400);
  await page.keyboard.press('Tab'); const onSkip = await page.evaluate(() => document.activeElement.classList.contains('skip')); await page.keyboard.press('Enter'); await page.waitForTimeout(100);
  let hops = 0; while (hops < 12 && !(await page.evaluate(() => !!document.activeElement.closest('#doclist')))) { await page.keyboard.press('Tab'); hops++; }
  const hashBefore = await page.evaluate(() => location.hash); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  check('archive (fresh load): Tab → skip link, Enter, then a #doclist link within 12 presses; Enter opens the item', onSkip && hops < 12 && hashBefore === '#/archive' && /^#\/archive\/d_/.test(await page.evaluate(() => location.hash)), hops + ' presses → ' + await page.evaluate(() => location.hash));
  await page.goto('about:blank'); await page.goto(url + '#/map', { waitUntil: 'load' }); await page.waitForFunction(() => window.App && window.MapView, null, { timeout: 15000 }); await page.waitForTimeout(1500);

  // ---------------------------------------------------------------- network: persons view (C4, C8)
  await go('/network', 2500);
  console.log('network nodes drawn:', await page.locator('#netsvg g.netnode').count());
  check('controls bar does not cover the graph (1400×900)', !(await boxes('#netcontrols', '#netsvg')));
  const statedDash = await page.evaluate(() => { const p = document.querySelector('#netsvg path.netedge.stated'); return p ? getComputedStyle(p).strokeDasharray : null; });
  check('stated ties carry a stroke-dasharray', !!statedDash && statedDash !== 'none', statedDash);
  check('persons header says asserted', /asserted/i.test(await text('#netviewhead')));
  check('rules sit in a disclosure', (await page.locator('#netside details.rules summary').count()) === 1);
  check('Years label covers stated ties', /correspondence and stated ties; PI ties are undated/.test(await text('#netcontrols')));
  check('network: SVG is a named group with a <title>, described by the live status line; controls sit in fieldsets with legends', (await page.evaluate(() => { const s = document.getElementById('netsvg'); return s.getAttribute('role') === 'group' && !!s.querySelector(':scope > title#netTitle') && s.getAttribute('aria-labelledby') === 'netTitle' && s.getAttribute('aria-describedby') === 'netstat' && document.getElementById('netstat').getAttribute('aria-live') === 'polite' && [...document.querySelectorAll('#netcontrols fieldset > legend')].map(l => l.textContent).join() === 'Evidence,Nodes,Years,Labels' && ['nyMin', 'nyMax', 'nlab', 'netfind'].every(i => document.getElementById(i).getAttribute('aria-label')); })));
  check('network: every .seg button carries aria-pressed; one tab is aria-current', (await page.evaluate(() => [...document.querySelectorAll('#netcontrols .seg button')].every(b => b.hasAttribute('aria-pressed')) && document.querySelectorAll('#tabs a[aria-current="page"]').length === 1)));
  const nodeName = await page.evaluate(() => { const g = document.querySelector('#netsvg g.netnode[tabindex="0"][role="button"]'); g.focus(); return document.activeElement === g ? g.getAttribute('aria-label') : null; });
  await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  check('network: a node is a focusable named button; Enter fills the side panel with its label', !!nodeName && /, (person|office|institution), \d+ attestation/.test(nodeName) && (await text('#netside')).includes(nodeName.split(',')[0]), nodeName);
  await page.evaluate(() => document.querySelector('#netsvg path.netedge[tabindex="0"]').focus()); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  check('network: a tie is a focusable named button; Enter opens its evidence', /^tie · /i.test(await text('#netside .phase')) && /attestation/.test(await page.evaluate(() => document.querySelector('#netsvg path.netedge[tabindex="0"]').getAttribute('aria-label'))), await text('#netside .phase'));
  await page.click('#netTable'); await page.waitForTimeout(400);
  const tblRows = await page.locator('#netside .tableview table.data tbody tr').count();
  check('network: the Table toggle renders the filtered nodes and ties as captioned tables (≥ 40 rows)', tblRows >= 40 && (await page.locator('#netside .tableview table.data caption').count()) === 2 && (await page.evaluate(() => document.getElementById('netTable').getAttribute('aria-pressed'))) === 'true', tblRows + ' rows');
  await page.screenshot({ path: 'tests/screenshots/review-after-a11y-network-table.png' });
  await page.click('#netTable'); await page.waitForTimeout(200);
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
  check('Grant: every table.data has a caption and th[scope]; Sent/Received and tie kinds are h3 under h2', (await page.evaluate(() => [...document.querySelectorAll('#pageview table.data')].filter(t => !t.querySelector('caption') || t.querySelector('th:not([scope])')).length === 0 && document.querySelectorAll('#pageview h4').length === 0 && [...document.querySelectorAll('#pageview h3')].some(h => h.textContent === 'Sent'))));
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
  check('timeline: stream buttons carry aria-pressed; the ¶ permalink is named', (await page.evaluate(() => [...document.querySelectorAll('#pageview .seg button')].every(b => b.hasAttribute('aria-pressed')) && document.querySelectorAll('.tlentry .links a[aria-label="Permalink to this entry"] [aria-hidden="true"]').length > 0)));
  await go('/method/network', 200); check('Method: section buttons carry aria-pressed', (await page.evaluate(() => [...document.querySelectorAll('#pageview .seg button')].every(b => b.hasAttribute('aria-pressed')))));
  await go('/tale/t035', 300);
  const fn = await page.evaluate(() => { const as = [...document.querySelectorAll('.fnref a[role="doc-noteref"]')]; return { n: as.length, minW: Math.min(...as.map(a => a.getBoundingClientRect().width)), minH: Math.min(...as.map(a => a.getBoundingClientRect().height)), back: document.querySelectorAll('.fnotes-list a[role="doc-backlink"]').length, lh: getComputedStyle(document.querySelector('#t035')).lineHeight }; });
  check('Tale: ≥ 50 footnote references are 24 px doc-noteref links with backlinks in the notes', fn.n >= 50 && fn.minW >= 24 && fn.minH >= 24 && fn.back === fn.n, JSON.stringify(fn));
  await page.evaluate(() => document.querySelector('.fnref a').click()); await page.waitForTimeout(500);
  check('Tale: clicking a footnote reference keeps the route and moves focus to the note', (await page.evaluate(() => location.hash === '#/tale/t035' && /^fn\d+$/.test(document.activeElement.id))));
  await page.screenshot({ path: 'tests/screenshots/review-after-a11y-tale-footnotes.png' });
  // integrity crawl: every route of every record renders without "not found"
  const routes = await page.evaluate(() => { const D = window.JOURNEYS_DATA; return [
    ...D.stories.map(s => '/story/' + s.id), ...D.documents.map(d => '/archive/' + d.id), ...D.people.map(p => '/person/' + p.id), ...D.institutions.map(i => '/person/' + i.id), ...D.offices.map(o => '/person/' + o.id),
    ...D.places.map(p => '/place/' + p.id), ...D.published.map(p => '/published/' + p.id), ...D.timeline.slice(0, 10).map(t => '/timeline/' + t.id), '/method/overview', '/method/network', '/method/findings', '/method/data', '/stories', '/cast', '/tale', '/network/focus/p_quackenbush', '/network/doc/d_19070325_matthew_bumpus', ...D.network.views.map(v => '/network/view/' + v.id)]; });
  routes.push('/about', '/about/glossary-status');
  let bad = 0, closeBtns = 0, legendless = 0, noCurrent = 0, noFocus = 0, badTables = 0, blankTargets = 0;
  for (const r of routes) { await go(r); const [txt, hasClose, noLegend, cur, foc, tbl, bt] = await page.evaluate((r) => { const pv = document.getElementById('pageview'); const tab = document.querySelectorAll('#tabs a[aria-current="page"]').length; const expectTab = !/^\/about/.test(r); return [pv.innerText.slice(0, 400), pv.innerText.includes('✕ Close'), !!pv.querySelector('table.when') && !pv.querySelector('.evidence-legend'), expectTab ? tab === 1 : tab === 0, document.activeElement && (document.activeElement.tagName === 'H1' || document.activeElement.classList.contains('pagenav')), [...pv.querySelectorAll('table.data')].filter(t => !t.querySelector('caption') || t.querySelector('th:not([scope])')).length, [...pv.querySelectorAll('a[target="_blank"]')].filter(a => !a.querySelector('.sr-only')).length]; }, r); if (/\b(story|record|item|place) not found\b/i.test(txt)) { bad++; console.log('NOT FOUND at', r); } if (hasClose) closeBtns++; if (noLegend) legendless++; if (!cur) { noCurrent++; if (noCurrent < 4) console.log('aria-current wrong at', r); } if (!foc) { noFocus++; if (noFocus < 4) console.log('focus not on h1 at', r); } badTables += tbl; blankTargets += bt; }
  check('no page contains "✕ Close"', closeBtns === 0, closeBtns + ' pages');
  check('every page route marks exactly one tab aria-current=page (none on Start here)', noCurrent === 0, noCurrent + ' routes');
  check('every page route moves focus to its h1 (or its nav bar)', noFocus === 0, noFocus + ' routes');
  check('every table.data on every page route has a caption and th[scope]', badTables === 0, badTables + ' tables');
  check('no new-tab link anywhere lacks its sr-only warning', blankTargets === 0, blankTargets + ' links');
  check('every story page with a "When" table has an evidence legend', legendless === 0, legendless + ' pages without');
  // map routes: every stop and every place resolve on the map without error
  const mapRoutes = await page.evaluate(() => { const D = window.JOURNEYS_DATA; return ['/map/stop/s1908_08', ...D.stops.map(s => '/map/stop/' + s.id), ...D.places.map(p => '/map/' + p.id)]; });
  for (const r of mapRoutes) await go(r, 20);
  check('#/map/stop/<id> keeps one tab current and focuses the current stop link', (await page.evaluate(() => { App.go('/map/stop/s1908_08'); return document.querySelectorAll('#tabs a[aria-current="page"]').length === 1; })) && (await page.evaluate(() => document.activeElement.matches('#stoplist a[aria-current="true"]'))));
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
  const tokenContrast = (p) => p.evaluate(() => { const cs = getComputedStyle(document.documentElement); const rgb = v => { const i = document.createElement('i'); i.style.color = v; document.body.appendChild(i); const c = getComputedStyle(i).color; i.remove(); return (c.match(/[\d.]+/g) || []).map(Number).slice(0, 3); }; const lum = c => { const [r, g, b] = c.map(v => v / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return .2126 * r + .7152 * g + .0722 * b; }; const x = lum(rgb(cs.getPropertyValue('--control-border').trim())), y = lum(rgb(cs.getPropertyValue('--surface').trim())); return +((Math.max(x, y) + .05) / (Math.min(x, y) + .05)).toFixed(2); });
  const cbLight = await tokenContrast(page);
  check('light: --control-border on --surface ≥ 3:1', cbLight >= 3, cbLight);
  const cbSeg = await page.evaluate(() => { const cs = getComputedStyle(document.documentElement); const i = document.createElement('i'); i.style.color = cs.getPropertyValue('--control-border').trim(); document.body.appendChild(i); const tok = getComputedStyle(i).color; i.remove(); return getComputedStyle(document.querySelector('#pageview .seg')).borderTopColor === tok; });
  await go('/archive', 300);
  check('light: the segmented control, selects, the search box and pills take the control border', cbSeg && (await page.evaluate(() => { const cs = getComputedStyle(document.documentElement); const i = document.createElement('i'); i.style.color = cs.getPropertyValue('--control-border').trim(); document.body.appendChild(i); const tok = getComputedStyle(i).color; i.remove(); return ['#affolder', '#afq', '#reader .pill, #pageview .pill'].every(s => { const e = document.querySelector(s); return !e || getComputedStyle(e).borderTopColor === tok; }); })));
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
  const cbDark = await tokenContrast(dpage);
  check('dark: --control-border on --surface ≥ 3:1', cbDark >= 3, cbDark);
  check('dark: links in table cells and running text are underlined', (await dpage.evaluate(() => ['#pageview td a', '#pageview p a'].every(s => { const e = document.querySelector(s); return !e || getComputedStyle(e).textDecorationLine === 'underline'; }))));
  await dpage.screenshot({ path: 'tests/screenshots/review-after-dark-method-table.png' });
  await dpage.evaluate(() => App.go('/story/story_05_newyork_deliberation')); await dpage.waitForTimeout(500);
  await dpage.screenshot({ path: 'tests/screenshots/review-after-dark-story.png' });
  await dctx.close();

  // ---------------------------------------------------------------- A6 / A3: reduced motion — no fly-to, no running simulation, App.REDUCE exposed
  const rctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, ignoreHTTPSErrors: true, reducedMotion: 'reduce' });
  const rpage = await rctx.newPage(); hook(rpage);
  await rpage.goto(url + '#/map', { waitUntil: 'load' }); await rpage.waitForFunction(() => window.App && window.MapView, null, { timeout: 15000 }); await rpage.waitForTimeout(1500);
  // highlight() under reduced motion uses setView(animate:false): the centre is Elephant Point at once (within pixel rounding, < 100 m) and the popup is open
  const rmo = await rpage.evaluate(() => { MapView.highlight('s1908_08'); const p = JOURNEYS_DATA.places.find(x => x.id === 'pl_elephant_point'); return { reduce: App.REDUCE, distNow: Math.round(MapView.distTo(p.lat, p.lon)), popup: document.querySelectorAll('.leaflet-popup-content').length, target: [p.lat, p.lon] }; });
  await rpage.waitForTimeout(50);
  rmo.dist50 = await rpage.evaluate(t => Math.round(MapView.distTo(t[0], t[1])), rmo.target); rmo.centre = await rpage.evaluate(() => MapView.centre());
  check('reduced motion: App.REDUCE is true, the map centre is Elephant Point at once and still within 50 ms of highlight (no animation) and the popup is open', rmo.reduce === true && rmo.distNow < 100 && rmo.dist50 < 100 && rmo.popup === 1, JSON.stringify(rmo));
  await rpage.evaluate(() => App.go('/network')); await rpage.waitForTimeout(1000);
  const pos1 = await rpage.evaluate(() => [...document.querySelectorAll('#netsvg g.netnode')].map(g => g.getAttribute('transform')).join('|'));
  await rpage.waitForTimeout(500);
  const pos2 = await rpage.evaluate(() => [...document.querySelectorAll('#netsvg g.netnode')].map(g => g.getAttribute('transform')).join('|'));
  check('reduced motion: no network node moves between 1.0 s and 1.5 s after load (simulation settled in one pass)', pos1.length > 0 && pos1 === pos2);
  await rctx.close();
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
