// axe-core 4.10.2 audit of index.html as rendered. Run: npm --prefix tests/a11y install && node tests/a11y/axe-run.js
// Light scheme: WCAG 2.0/2.1/2.2 A+AA rules and axe's best-practice rules; dark scheme: the colour rules.
// Writes tests/a11y/axe-after.json, prints a before/after table per rule against tests/a11y/axe-before.json (the
// baseline taken on commit 50a3c59) and exits 1 on any violation tagged wcag2a/wcag2aa/wcag21a/wcag21aa/wcag22aa in
// either scheme. best-practice and the AAA rule color-contrast-enhanced are reported only.
// axe-core is a test dependency under tests/a11y/ and is never loaded by the page itself.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const AXE = require.resolve('axe-core/axe.min.js', { paths: [__dirname] });
const AXE_VERSION = require(require.resolve('axe-core/package.json', { paths: [__dirname] })).version;
const ROOT = path.resolve(__dirname, '..', '..');
const URL = 'file://' + path.join(ROOT, 'index.html');
const BEFORE = path.join(__dirname, 'axe-before.json'), AFTER = path.join(__dirname, 'axe-after.json');
// the nine baseline routes, the three routes added by the later packages, and the map in globe mode (A11)
const ROUTES = ['/map', '/stories', '/story/story_19_excavation', '/archive/d_19070416_osborn_bumpus', '/network', '/person/p_grant', '/timeline', '/published', '/method/geocoding', '/about', '/network/view/funding', '/map/stop/s1908_08', '/map@globe'];
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
const AA = new Set(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']);
const isAA = v => v.tags.some(t => AA.has(t));

(async () => {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const browser = await chromium.launch({ proxy: proxy ? { server: proxy } : undefined, args: ['--no-sandbox'] });
  const results = { generated: new Date().toISOString(), axe_version: AXE_VERSION, tags: TAGS, viewport: { width: 1400, height: 900 }, light: {}, dark: {} };
  const pageErrors = [];
  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, ignoreHTTPSErrors: true, colorScheme: scheme });
    const page = await ctx.newPage();
    page.on('pageerror', e => pageErrors.push(scheme + ': ' + e.message));
    await page.goto(URL + '#/map', { waitUntil: 'load' });
    await page.waitForFunction(() => window.App && window.MapView, null, { timeout: 20000 });
    await page.waitForTimeout(2500);
    await page.addScriptTag({ path: AXE });
    for (const route of ROUTES) {
      const [hash, mode] = route.split('@');
      await page.evaluate(r => window.App.go(r), hash);
      if (mode === 'globe') { await page.evaluate(() => window.MapView.setMode('globe')); await page.waitForTimeout(2500); }
      else await page.waitForTimeout(/^\/network/.test(hash) ? 2500 : /^\/map/.test(hash) ? 1800 : 800);
      const opts = scheme === 'light' ? { runOnly: TAGS } : { runOnly: { type: 'rule', values: ['color-contrast', 'color-contrast-enhanced', 'link-in-text-block'] } };
      const r = await page.evaluate(async (o) => {
        const res = await window.axe.run(document, o);
        return { url: res.url, timestamp: res.timestamp, violations: res.violations, incomplete: res.incomplete, passes: res.passes.map(p => ({ id: p.id, impact: p.impact, nodes: p.nodes.length })), inapplicable: res.inapplicable.map(p => p.id) };
      }, opts);
      results[scheme][route] = r;
      const v = r.violations.map(x => `${x.id}(${x.impact}:${x.nodes.length}${isAA(x) ? '' : ', reported only'})`).join(' ');
      console.log(`[${scheme}] ${route}: ${r.violations.length} violation rule(s), ${r.incomplete.length} incomplete :: ${v}`);
      if (mode === 'globe') await page.evaluate(() => window.MapView.setMode('flat'));
    }
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(AFTER, JSON.stringify(results, null, 1));
  console.log('wrote', path.relative(ROOT, AFTER), fs.statSync(AFTER).size, 'bytes');

  // failing-node counts per rule and scheme, before (baseline) and after
  const tally = (res) => { const t = {}; for (const scheme of ['light', 'dark']) for (const r of Object.values(res[scheme] || {})) for (const v of r.violations) { const k = v.id + ' [' + scheme + ']'; t[k] = t[k] || { nodes: 0, aa: isAA(v) }; t[k].nodes += v.nodes.length; } return t; };
  const before = fs.existsSync(BEFORE) ? tally(JSON.parse(fs.readFileSync(BEFORE, 'utf8'))) : {};
  const after = tally(results);
  const rules = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  console.log('\n| rule [scheme] | level | before (50a3c59, 9 routes) | after (' + ROUTES.length + ' routes) |\n|---|---|---|---|');
  for (const k of rules) { const b = before[k], a = after[k]; console.log(`| ${k} | ${(a || b).aa ? 'A/AA' : 'reported only'} | ${b ? b.nodes : 0} | ${a ? a.nodes : 0} |`); }
  const aaFail = Object.entries(after).filter(([, v]) => v.aa).reduce((s, [, v]) => s + v.nodes, 0);
  const aaBefore = Object.entries(before).filter(([, v]) => v.aa).reduce((s, [, v]) => s + v.nodes, 0);
  console.log(`\nA/AA failing nodes: before ${aaBefore}, after ${aaFail}`);
  if (pageErrors.length) console.log('page errors:', pageErrors);
  process.exit(aaFail || pageErrors.length ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
