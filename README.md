# The Quackenbush Journeys, 1907–1908

An evidence-based historical reconstruction of L. S. Quackenbush's two Alaskan mammoth expeditions
for the American Museum of Natural History, built for the Mammoth History Lab from five files supplied
by the principal investigator (Rebecca J. H. Woods): her talk text *A Tale of Two Mammoths* (2019), her
transcription file of the AMNH correspondence, two timelines, and a Cast of Characters.

Open `index.html` in a browser (it loads `data/bundle.js` and map libraries from CDNs).
A single-file copy is in `dist/quackenbush-journeys-standalone.html`. **Start here** (`#/about`, also the `?` in the
top bar) gives the abstract, the five inputs with their SHA-256, a suggested reading order and one glossary of every
chip, tag, status and rule the site uses (`#/about/glossary-<term>`); a dismissible help card on the map explains the
symbology on a first visit (flag `qj_help_dismissed` in localStorage).

## What is where

| Tab | What it does |
|---|---|
| Map | Flat, relief and globe views of the 1907 and 1908 journeys. **Journey shown** draws one journey at a time (1907 by default; 1908; or Both overlaid for comparison; routes `#/map/1907`, `#/map/1908`, `#/map/both`); a stop of the hidden journey, opened from a story or the timeline, switches the map to its year. At low zoom, stop places whose markers would overprint are **collapsed into one disc** with a count and the sequence range of each journey (members, badges, labels, halos and the legs between them hidden; click or Enter on the disc opens it; the disc asserts nothing: its centre is the mean of its members' coordinates and its name is its most-visited member; layer toggle in the panel). **Follow the journey** steps through the stops (Previous / Next, ← →, route `#/map/stop/<stopId>`) and shows a selected-stop card with the evidence; every stop carries a sequence badge (1907 round, 1908 square-cornered) and every connector a direction arrow; out-and-back side trips are drawn through their return place (`via`), coincident connectors are offset side by side; frame presets (Whole route · Alaska · Kotzebue Sound · Buckland River); legend as a disclosure; scale bar. Unlocated places are never drawn as points: the map draws the constraints the sources state (dashed distance rings, leader labels, brackets, each with its verbatim quotation) and the gazetteer homonyms of an ambiguous name (equal hollow squares, none chosen). Marker form = source status, hue and badge shape = journey, halos = uncertainty radius, line style = whether the mode of travel is attested. All connectors are schematic. |
| Story | 25 pages; backbone = the PI's prose quoted verbatim; enrichment = typed correspondence blocks; people, documents, findings and sources cross-linked; previous/next navigation. |
| Network | Five views over one nominalist data set, each with its evidence rule and caveat printed in the header, the side panel and Method › Network: **Persons** (opens as *one line per pair*: every kind of tie between two nodes merged into one grey line whose width is the number of attestations, click it for the ties by kind; *by kind of evidence* draws correspondence · relation stated in a document · PI's writing · affiliation apart by hue and dash pattern; hovering or focusing a node previews its neighbourhood and a click pins it; 'hide single-attestation nodes' prunes the leaves and reports how many; the Years filter dates correspondence and stated ties by their document), **Institutions** (person–institution bipartite graph; each affiliation carries one verified quotation and is *stated* or *inferred by the model*; the role quotations on the edges appear for the hovered or selected node, or for every edge when Labels = all), **Funding** (every sum or promise of one that a provided text states, amounts exactly as written, no total computed), **Co-attestation** (derived: how many kinds of evidence attest each pair; a 'PI only' filter shows ties no document states) and **Mentions** (derived: sender → person named in the text, by name matching). Node search, ego views; letterhead-based ties are tagged; every tie carries its quotation. |
| Archive | Primary-source reader: 99 archival items, 402 blocks typed verbatim / researcher's summary / editorial note / annotation, with the PI's marks and colour coding preserved. |
| Timeline | The PI's terse timeline entry by entry, with a sticky year rail and Document / Map / Story / Discrepancy links on each entry (the full target in the link's label). |
| Sources cited | Every source cited in the supplied files, recorded as cited; no full text was supplied. |
| Method & Data | Authorship statement, geocoding decisions place by place, network rules, register of discrepancies and absences, downloads. |

Every page carries `← Back to <previous page>` (the app's own history) and `↑ <one level up>` (story → Story index,
archive item → Archive, person → Network, place → Map, source → Sources cited, timeline entry → Timeline); a page opened
directly goes up rather than to the map. Record pages open with a breadcrumb (`Story · 1908 excavation · page 20 of 25`).
Story pages carry the PI's footnotes with the excerpts that contain their markers (`tale_excerpts[].footnotes`), a four-column
'When' table (Stop · Date · Evidence · Sources) with an evidence legend, and 'Where' cards that reflow by container width.
Layout: the top bar wraps and the views follow it (200 % text works); below 600 px the map panel is a bottom sheet with a
'Stops & layers' handle, tables scroll inside wrappers, the 'When' table stacks, and the network filters sit in a disclosure.
Colours are tokens on `:root` with two dark-scheme blocks; text that sits on a soft background uses a `-text` variant
(`--j1907-text`, `--inferred-text`, `--summary-text`, …) checked at ≥ 4.5:1, and the journey colours in the scripts are read
from the stylesheet (`App.JCOLOR`), so no colour literal remains outside the token blocks and the vendored Leaflet CSS.

## Accessibility (WCAG 2.2 AA)

Everything is operable from the keyboard. A skip link is first in the tab order; every route change sets `document.title`,
announces the page in a polite live region (`#announce`; 'Returned to …' after Back) and moves focus to the page's `h1`
(on the map, to the selected stop or the 'Follow the journey' heading). On the map every stop marker and every connector
is a named, focusable button (`aria-label` = place, visits by year, status; or from → to, mode and its status): Tab reaches
them, Enter opens the popup, which is a dialog named by its heading and focused; Escape closes it and focus returns to the
marker, link or button that opened it; ← → step through the journey; labels, badges and arrows are never focusable; the
stop list and the Method › Geocoding tables carry the same information as text. In the network every node and tie is a
focusable button (Enter = the same as a click), the SVG is a named group described by the live status line, and the
**Table** toggle renders the nodes and ties drawn under the current filters as captioned tables in the side panel.
Lists are lists (archive items and stops are links with `aria-current`, grouped as nested lists), every data table has a
caption and `scope`d headers, every form control a name, tabs `aria-current="page"`, segmented controls `aria-pressed`,
the panel toggle `aria-expanded`. Chips point (`aria-describedby`) at one hidden definitions list built from the data
vocabularies, and a 'What the chips mean' disclosure sits above the tables that use them. Links inside text are underlined;
control borders, the timeline spine and affiliation edges reach 3:1; a single `:focus-visible` ring (`--j1907`) covers
everything, including SVG; the Tale's footnote references are 24 px `doc-noteref` links with `doc-backlink` returns.
`prefers-reduced-motion` is honoured by one flag (`App.REDUCE`): no fly-to, no globe tween, no smooth scrolling, no CSS
transitions, and the network simulation is settled in one pass. Decorative glyphs (arrows, ¶, bullets) are hidden from
assistive technology and new-tab links say so.

`tests/a11y/axe-run.js` audits thirteen rendered routes (light: WCAG 2.0/2.1/2.2 A+AA and best-practice rules; dark: the
colour rules) with axe-core 4.10.2, writes `tests/a11y/axe-after.json`, prints a before/after table against the baseline
`tests/a11y/axe-before.json` (commit `50a3c59`) and exits non-zero on any A/AA violation:

```bash
npm --prefix tests/a11y install      # axe-core (test dependency only; never loaded by the page)
node tests/a11y/axe-run.js
```

## Data (exported separately from the interface)

`data/*.json`, `data/csv/*.csv`, `data/bundle.js` (same content, for the page), `data/DATA_DICTIONARY.md`.
`network.json` carries, besides nodes and edges, `views` (rule and caveats of each view), `funding`
(`data/csv/funding.csv`), the derived `pairs` (`network_pairs.csv`) and `mentions` (`network_mentions.csv`).
`places.json` carries, for every place, the model's `short_label` (map labels only) and, for places without a
coordinate, `unlocated_kind` (withheld | contradictory | ambiguous | not_geocoded), `constraints[]` (the spatial
statements a provided text makes, each with its verified quotation and a model note on what the geometry can show)
and `candidates[]` (GNIS records bearing the attested name, re-checked against the GNIS file at build).
`segments.json` carries `via[]` for out-and-back legs (status stated with a verified quotation, or inferred).
Inputs are identified by SHA-256 in `data/source/input_files_sha256.jsonl`.

## Rebuilding

```bash
python3 scripts/extract_docx.py <the five .docx files>      # -> data/source/transcription_paragraphs.json
python3 scripts/build_data.py                               # -> data/*.json, data/csv, data/bundle.js, DATA_DICTIONARY.md
python3 scripts/make_standalone.py                          # -> dist/
node tests/smoke.js                                         # headless Chromium smoke + integrity test
node tests/final_screenshots.js                             # -> tests/screenshots/final-{light,dark}-*.png (verification captures)
```

The build fails if any cross-reference does not resolve or if any quoted excerpt is not found verbatim
in the supplied texts (after normalising quotation marks, dashes and whitespace). Four classes of quotation
are verified: tie and funding evidence, Tale excerpts (which must also end at a sentence or quotation
boundary), the PI's Cast lines and characterisations, and every quoted fragment inside the model's own
prose (model notes, place/stop/segment fields, findings, roles, labels, record notes: about 450 spans;
the count is printed as `verified_quotations` and shown on Method › Data). Changing one letter inside any
quoted span makes the build exit 1 naming the table, record and field. Constraint quotations and stated `via`
quotations are verified in the same way, and every gazetteer candidate (id, name, class, county, map, coordinates)
is re-checked against the GNIS Alaska file when it is present (`GNIS_AK_FILE`, or the scratchpad copy; a warning,
not an error, when absent). After editing an authored module in place, clear `scripts/authored/__pycache__` if a
file was restored with its old size and mtime, or Python may import stale bytecode.

`tests/smoke.js` renders every route headlessly and asserts the behaviour of each feature (network views,
filters, search, person pages, Method tables, the Start-here page and glossary, navigation, phone / 320 px / 200 %-text
layouts, dark-scheme contrast of the typed blocks, keyboard operation of the map, the archive list and the network,
focus management and live announcements, popup dialogs, table captions, and a reduced-motion context); it exits
non-zero on any JavaScript error, crawl failure or failed assertion. `tests/final_screenshots.js` renders the
verification captures (`tests/screenshots/final-<scheme>-<name>.png`): the map in flat, relief and globe modes, the
Kotzebue Sound frame, an unlocated place with its constraints, a story page, the five network views, the archive, the
timeline and the method page at 1400 × 900 in both colour schemes, and the map on a fresh 390 × 844 load. `docs/REVIEW_REPORT.md`
records the three reviews behind the current work packages, what each package implemented, and the final verification.

## Authorship

Verbatim blocks are the historical writers' words as transcribed by the PI; summaries and editorial
notes are hers and are rendered as such; gazetteer coordinates are cited record by record (USGS GNIS,
CGNDB, GeoNames; Wikidata as cross-check). The data model, block typing, name normalisation,
geocoding and network rules, selection of quotations and the short notes labelled "model" are the
model's work. No fact, date, coordinate or quotation was added from outside the inputs and the named
gazetteers.
