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
| Network | Nominalist network with three evidence kinds kept apart (correspondence · relation stated in a document · PI's writing), plus affiliations; ego views; every tie carries its quotation. |
| Archive | Primary-source reader: 99 archival items, 402 blocks typed verbatim / researcher's summary / editorial note / annotation, with the PI's marks and colour coding preserved. |
| Timeline | The PI's terse timeline entry by entry, with "Read the document", "On the map" and "In the story" links. |
| Published | Every source cited in the supplied files, recorded as cited; no full text was supplied. |
| Method & Data | Authorship statement, geocoding decisions place by place, network rules, register of discrepancies and absences, downloads. |

## Data (exported separately from the interface)

`data/*.json`, `data/csv/*.csv`, `data/bundle.js` (same content, for the page), `data/DATA_DICTIONARY.md`.
Inputs are identified by SHA-256 in `data/source/input_files_sha256.jsonl`.

## Rebuilding

```bash
python3 scripts/extract_docx.py <the five .docx files>      # -> data/source/transcription_paragraphs.json
python3 scripts/build_data.py                               # -> data/*.json, data/csv, data/bundle.js, DATA_DICTIONARY.md
python3 scripts/make_standalone.py                          # -> dist/
node tests/smoke.js                                         # headless Chromium smoke + integrity test
```

The build fails if any cross-reference does not resolve or if any quoted excerpt is not found verbatim
in the supplied texts (after normalising quotation marks, dashes and whitespace).

## Authorship

Verbatim blocks are the historical writers' words as transcribed by the PI; summaries and editorial
notes are hers and are rendered as such; gazetteer coordinates are cited record by record (USGS GNIS,
CGNDB, GeoNames; Wikidata as cross-check). The data model, block typing, name normalisation,
geocoding and network rules, selection of quotations and the short notes labelled "model" are the
model's work. No fact, date, coordinate or quotation was added from outside the inputs and the named
gazetteers.
