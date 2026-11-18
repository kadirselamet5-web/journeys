# The Quackenbush Journeys, 1907–1908

An evidence-based historical reconstruction of L. S. Quackenbush's two Alaskan mammoth expeditions
for the American Museum of Natural History, built for the Mammoth History Lab from five files supplied
by the principal investigator (Rebecca J. H. Woods): her talk text *A Tale of Two Mammoths* (2019), her
transcription file of the AMNH correspondence, two timelines, and a Cast of Characters.

Open `index.html` in a browser (it loads `data/bundle.js` and map libraries from CDNs).
A single-file copy is in `dist/quackenbush-journeys-standalone.html`.

## What is where

| Tab | What it does |
|---|---|
| Map | Flat, relief and globe views of the 1907 and 1908 journeys; left panel with layers and a chronological stop list; marker style = source status, halos = uncertainty radius, line style = whether the mode of travel is attested. All connectors are schematic. |
| Story | 25 pages; backbone = the PI's prose quoted verbatim; enrichment = typed correspondence blocks; people, documents, findings and sources cross-linked; previous/next navigation. |
| Network | Five views over one nominalist data set, each with its evidence rule and caveat printed in the header, the side panel and Method › Network: **Persons** (correspondence · relation stated in a document · PI's writing · affiliation, told apart by hue and dash pattern; the Years filter dates correspondence and stated ties by their document), **Institutions** (person–institution bipartite graph; each affiliation carries one verified quotation and is *stated* or *inferred by the model*), **Funding** (every sum or promise of one that a provided text states, amounts exactly as written, no total computed), **Co-attestation** (derived: how many kinds of evidence attest each pair; a 'PI only' filter shows ties no document states) and **Mentions** (derived: sender → person named in the text, by name matching). Node search, ego views; letterhead-based ties are tagged; every tie carries its quotation. |
| Archive | Primary-source reader: 99 archival items, 402 blocks typed verbatim / researcher's summary / editorial note / annotation, with the PI's marks and colour coding preserved. |
| Timeline | The PI's terse timeline entry by entry, with "Read the document", "On the map" and "In the story" links. |
| Published | Every source cited in the supplied files, recorded as cited; no full text was supplied. |
| Method & Data | Authorship statement, geocoding decisions place by place, network rules, register of discrepancies and absences, downloads. |

## Data (exported separately from the interface)

`data/*.json`, `data/csv/*.csv`, `data/bundle.js` (same content, for the page), `data/DATA_DICTIONARY.md`.
`network.json` carries, besides nodes and edges, `views` (rule and caveats of each view), `funding`
(`data/csv/funding.csv`), the derived `pairs` (`network_pairs.csv`) and `mentions` (`network_mentions.csv`).
Inputs are identified by SHA-256 in `data/source/input_files_sha256.jsonl`.

## Rebuilding

```bash
python3 scripts/extract_docx.py <the five .docx files>      # -> data/source/transcription_paragraphs.json
python3 scripts/build_data.py                               # -> data/*.json, data/csv, data/bundle.js, DATA_DICTIONARY.md
python3 scripts/make_standalone.py                          # -> dist/
node tests/smoke.js                                         # headless Chromium smoke + integrity test
```

The build fails if any cross-reference does not resolve or if any quoted excerpt is not found verbatim
in the supplied texts (after normalising quotation marks, dashes and whitespace). Four classes of quotation
are verified: tie and funding evidence, Tale excerpts (which must also end at a sentence or quotation
boundary), the PI's Cast lines and characterisations, and every quoted fragment inside the model's own
prose (model notes, place/stop/segment fields, findings, roles, labels, record notes: about 450 spans;
the count is printed as `verified_quotations` and shown on Method › Data). Changing one letter inside any
quoted span makes the build exit 1 naming the table, record and field.

`tests/smoke.js` renders every route headlessly and asserts the behaviour of each feature (network views,
filters, search, person pages, Method tables); it exits non-zero on any JavaScript error, crawl failure or
failed assertion. `docs/REVIEW_REPORT.md` records the three reviews behind the current work packages and
what each package implemented.

## Authorship

Verbatim blocks are the historical writers' words as transcribed by the PI; summaries and editorial
notes are hers and are rendered as such; gazetteer coordinates are cited record by record (USGS GNIS,
CGNDB, GeoNames; Wikidata as cross-check). The data model, block typing, name normalisation,
geocoding and network rules, selection of quotations and the short notes labelled "model" are the
model's work. No fact, date, coordinate or quotation was added from outside the inputs and the named
gazetteers.
