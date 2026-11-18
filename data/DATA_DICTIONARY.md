# Data dictionary — The Quackenbush Journeys, 1907–1908

Built 2026-11-18 by `scripts/build_data.py` from the five files supplied by the Mammoth History Lab
(SHA-256 in `data/source/input_files_sha256.jsonl`). Every table is exported as JSON (`data/*.json`) and CSV
(`data/csv/*.csv`); `data/bundle.js` carries the same content for the interface. Lists and objects inside CSV
cells are JSON-encoded.

## Authorship (whose prose, whose transcription, what the model did)
- **historical writers** — Verbatim blocks are the words of the historical correspondents as transcribed by the PI; her editorial marks ([sic], [?], [illeg], struck text, colour) are preserved.
- **principal investigator** — Rebecca J. H. Woods (University of Toronto): transcription file, comprehensive and terse timelines, Cast of Characters, and the talk text “Time, Temperature, and Tissue in the Circumpolar North: A Tale of Two Mammoths” (MIT, 20 Sept 2019). Her summaries and editorial notes are typed and rendered separately from verbatim text.
- **gazetteers** — USGS GNIS (Alaska domestic names file), Canadian Geographical Names Database, GeoNames; Wikidata as cross-check only.
- **model** — Claude (Anthropic) built the data model, typed the blocks, normalised names, geocoded against gazetteers, wrote the geocoding and network rules, selected and ordered quotations, and wrote the short connective notes labelled “model”. It added no fact, date, coordinate or quotation that is not in the inputs or the named gazetteers.

## Block types (documents.blocks[].type) — rendered differently in the Archive reader
- `verbatim` — words of the historical writer, as transcribed
- `summary` — the PI's paraphrase of a document
- `editorial` — the PI's description of the physical document, archival context, or dated research note
- `annotation` — a marginal or interlinear annotation on the original, as transcribed

## Source-status chips (places.status, stops.status)
- `verified` — attested name matched to an authoritative gazetteer record
- `inferred` — identification or date is a model inference from the described route or sequence
- `approximate` — placed from Quackenbush's distance/direction statements or a described relation to a named feature
- `disputed` — provided sources disagree
- `unlocated` — cannot be placed from the sources

## Geocoding hierarchy (places.tier)
- tier 1 — published coordinates in the sources — none exist
- tier 2 — authoritative gazetteers (GNIS, CGNDB, GeoNames; Wikidata cross-check)
- tier 3 — historical maps/charts — none available (1906 Post Route Map not provided)
- tier 4 — Quackenbush's distance/direction statements
- tier 5 — approximate placement with large uncertainty radius

## Tables

### documents
One row per archival item in the PI's transcription file (letters, copies, drafts, telegrams, memoranda, notes,
removal slip, permit, form slip; enclosures are separate items linked by `enclosed_in`).
- `id` — `d_YYYYMMDD_sender_recipient` (undated: `d_nd_…`); `order` — chronological position (undated items placed by `sort_hint`, stated in the record).
- `date` (ISO, or `YYYY-MM`), `date_text` (as the PI header gives it), `precision` — day | month | bracketed (PI-supplied) | undated.
- `title` — normalised from the PI header; `header_raw` — the PI header verbatim.
- `senders`, `recipients` — person (`p_*`), office (`o_*`) or institution (`i_*`) ids. Offices stand for unnamed signers.
- `form` — as stated in the header (copy, draft, telegram, excerpt, …); `original` means only that the header does not say otherwise.
- `place` — place of writing when the header or letterhead states it.
- `archive`, `collection`, `folder` — AMNH Central Archives citation as the PI records it.
- `blocks[]` — `id`, `type` (see above), `speaker`, `text` (plain), `html` (with the PI's marks: `<s>` struck text, `<u>` underline, `<ins class=ms-insert>` caret insertions, `<span class=pi-color pc-RRGGBB>` the PI's colour coding, `<span class=ed-inline>` bracketed editorial marks, `<span class=ann-inline>` slash-marked pencil annotations), `p` (paragraph index in the source extraction).
- `color_legend` — meaning of the colour codes for this item (from the PI's editorial note).
- `mentions` — people named in the text (automatic name-variant match, model); `mentions_method` states this.
- `enclosed_in`, `enclosures`, `stories`, `timeline`, `findings`, `note` — cross-references; `note` is a model note on the record (labelled).

### people / offices / institutions
Prosopography. `variants[]` (form, source) records every spelling as written; `roles[]` (role, source);
`addresses[]`; `institutions[]`; `identity_note` flags unresolved identifications; `pi_characterisation`
quotes the PI's Cast of Characters verbatim. `scope`: hunt | prologue | research. `kind`: person | unnamed | collective.
`sent`, `received`, `mentioned_in`, `stories` are derived cross-references.

### places
Historical gazetteer. `attested[]` (form, source) — the name as it appears and where; `lat`, `lon` (WGS84 decimal; null when unlocated);
`tier`, `precision`, `status`, `radius_km` (uncertainty halo drawn on the map); `coord_source` (authority, id, name, feature_class,
lat, lon, url, file); `crosscheck[]` (other gazetteers); `gnis_note`, `distance_check` (tier-4 consistency check against Quackenbush's own distances);
`why` — "why this point is here"; `scope` hunt | prologue; `mentioned_only`; `stops`, `stories`.

### stops
`journey` 1907 | 1908; `seq`; `place`; `date_start`, `date_end` (ISO bounds of the attested or inferred window); `date_text`;
`date_precision` stated | window | inferred | disputed; `sources[]` (ref = document id, `pub_*`, `tale` or `pi_timeline`; locator = page/quotation);
`status` chip; `story`; `why`.

### segments
Connectors between consecutive stops. `mode` as named in a source; `mode_status` stated | not_stated | inferred; `geometry` is
`schematic` for every segment (no route was traced); `source`; `note`.

### stories
`phase`; `title`, `subtitle`; `places`, `stops`, `docs`, `people`, `published`, `findings`; `tale_excerpts[]` (verbatim PI prose with the Tale paragraph id);
`model_note` — the only model-written prose on a story page; `prev`, `next` — reading order.

### timeline
The PI's terse timeline, entry by entry, in her order (`order`), with `date` parsed by the build, `stream`
(correspondence/events vs itinerary), and links `docs`, `stops`, `stories`, `findings`, `note` (model note on the entry).

### itinerary
The purple-coded itinerary entries of the PI's comprehensive timeline (her digest of B.AMNH 26, pp. 88–91, and two letters).

### tale / tale_footnotes / cast
The PI's talk text paragraph by paragraph (`id`, `section`, `text`, `html`) and its footnotes; the Cast of Characters verbatim.

### network
`nodes[]` (id, label, type person|office|institution, kind, scope, metrics by edge kind) and `edges[]`
(`kind` correspondence | stated | pi | affiliation; `directed`; `label`; `date`; `doc`; `evidence[]` (ref, quote)).
`rules` states the nominalist rules in full.

### published
Sources as CITED in the provided files (`citation_as_given`); `excerpts[]` are passages quoted inside the provided files;
no record was completed from outside knowledge; no full text was provided.

### findings
Register of `discrepancy`, `absence`, `naming`, `unlocated`, `authorship` findings with `refs` and the records they concern.
