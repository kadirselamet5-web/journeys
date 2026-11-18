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

## Source-status chips (places.status, stops.status) and the `naming` flag
- `verified` — attested name matched to an authoritative gazetteer record
- `inferred` — identification or date is a model inference from the described route or sequence
- `approximate` — placed from Quackenbush's distance/direction statements or a described relation to a named feature
- `disputed` — provided sources disagree
- `unlocated` — cannot be placed from the sources
- `naming` — flag, not a status: two attested names denote one gazetteer point; records naming variance, not a dispute about position

## Unlocated places (places.unlocated_kind) — the three silences kept apart
- `withheld` — the location was deliberately not disclosed in the sources
- `contradictory` — the provided statements place it differently and cannot be reconciled
- `ambiguous` — the attested name has several gazetteer homonyms, or the reading of the name is uncertain
- `not_geocoded` — outside the journey; no gazetteer was consulted for it in this build

## Constraints on unlocated places (places.constraints[].kind) — drawn without asserting a point
- `distance` — a stated distance in miles from a located anchor — drawn as a dashed ring around the anchor; no point
- `near` — a stated nearness without a distance — drawn as a leader label at the anchor; no radius
- `identity` — a statement equating the place with a located one — drawn as a bracket at that place; nothing asserted

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
Prosopography. `variants[]` (form, source) records every spelling as written; `roles[]` (role, source) holds offices and
functions only; `characterisations[]` (text, source) holds evaluative phrases from the provided texts (the PI's or a writer's),
kept apart from roles and rendered in the writer's voice; `addresses[]`; `identity_note` flags unresolved identifications;
`pi_characterisation` quotes the PI's Cast of Characters (working notes, unpublished, 2019) verbatim — the build verifies it.
`institutions[]` — one record per affiliation: `id`, `status` (`stated` = a provided text names the person in that
institution and `evidence` ('pi_timeline', 'appointed to the St Petersburg Academy of Science as an adjunct in zoology') carries the verified quotation; `inferred` = the model's reading of context, with a
`note` and no evidence), optional `evidence_kind` `letterhead` (a printed officer list, not a sentence written by the signer).
`scope`: hunt | prologue | research. `kind`: person | unnamed | collective.
`sent`, `received`, `mentioned_in`, `stories`, `findings` are derived cross-references.
Institutions carry `place` and `place_status` (`stated` when a provided text puts the institution at that place —
letterhead, address, permit, or the place in its name; `inferred` when the model placed it).

### places
Historical gazetteer. `attested[]` (form, source) — the name as it appears and where; `lat`, `lon` (WGS84 decimal; null when unlocated);
`tier`, `precision`, `status`, `radius_km` (uncertainty halo drawn on the map); `coord_source` (authority, id, name, feature_class,
lat, lon, url, file); `crosscheck[]` (other gazetteers); `gnis_note`, `distance_check` (tier-4 consistency check against Quackenbush's own distances);
`why` — "why this point is here" (for an unlocated place: why no point is drawn); `scope` hunt | prologue; `mentioned_only`; `stops`, `stories`.
- `short_label` — the model's display normalisation of the attested label, used for map and globe labels only (`places.SHORT_LABELS`);
  tooltips, popups, records and tables keep `label`.
- `naming` — flag (true for Lane's Landing / Shelton): two attested names denote one gazetteer point; rendered as a `naming` chip beside the status;
  it records naming variance, not a dispute about where the traveller was. Stops at the place carry the same flag.
- `unlocated_kind` — on every place with `lat` null: withheld | contradictory | ambiguous | not_geocoded (vocabulary above).
- `constraints[]` — spatial statements a provided text makes about an unlocated place: `kind` distance | near | identity, `anchor`
  (id of the located place the statement refers to) and `anchor_label`, `miles` (distance only), `quote` (verbatim, verified at build),
  `ref` (document id, `tale` or `pi_timeline`), `speaker`, `model_note` (the model's statement of what the drawn geometry can and cannot show).
  The map draws each constraint around its anchor and never a point; the finding register carries the disagreement.
- `candidates[]` — gazetteer records bearing the attested name (authority USGS GNIS, id, name, feature_class, county, map, lat, lon, url,
  optional note); drawn as equal hollow squares, none asserted; `candidates_note` says so. When the GNIS Alaska file is present at build
  (`GNIS_AK_FILE` or the scratchpad copy; `meta.gnis_candidates_checked_against_file`) every candidate is checked against it and a homonym set
  must list every row of that name.

### stops
`journey` 1907 | 1908; `seq` (the numeral shown on the map badge and in the stop list); `place`; `date_start`, `date_end` (ISO bounds of the
attested or inferred window); `date_text`; `date_precision` stated | window | inferred | disputed; `sources[]` (ref = document id, `pub_*`,
`tale` or `pi_timeline`; locator = page/quotation); `status` chip; `naming` flag (see places); `story`; `why`.

### segments
Connectors between consecutive stops. `mode` as named in a source; `mode_status` stated | not_stated | inferred; `geometry` is
`schematic` for every segment (no route was traced); `source`; `note`.
- `via[]` — **out-and-back**: a side trip whose return passes through a named place before the next stop. The connector is drawn
  through that place (legs a → via → b) instead of asserting a through-route the sources deny. Each entry: `place`, `place_label`,
  `status` stated (a provided text states the return; `quote` verified at build; `ref`) | inferred (the model inferred it from the
  sequence; no quote; drawn with the inferred dash). Three segments carry a via: g1907_08 (Solomon River → Nome → Keewalik, stated),
  g1907_10 (Candle → Keewalik → Elephant Point, stated), g1907_12 (Buckland mouth → Elephant Point → Keewalik, inferred).

### stories
`phase`; `title`, `subtitle`; `places`, `stops`, `docs`, `people`, `published`, `findings`; `tale_excerpts[]` (`text` = verbatim PI prose, `para` = the Tale paragraph id,
`speaker`, `footnotes[]` = the PI's footnotes `{n, html}` whose markers fall inside the excerpt, so that a quoted sentence keeps its note);
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
(`kind` correspondence | stated | pi | affiliation; `directed`; `label`; `date`; `doc`; `evidence[]` (ref, quote);
optional `evidence_kind` = `letterhead`; on affiliation edges `affiliation_status` stated | inferred and an optional `note`).
`date` on a stated or affiliation edge is the date of the first evidence document (ISO or `YYYY-MM`; null for Tale, Cast,
PI-timeline evidence or undated items): the date is the document's, not the relationship's. PI edges are undated.
`rules` states the nominalist rules in full; `views[]` (id, label, derived, node, edge, rule, caveats) is the single source
of the view headers in the interface and of the Views table on Method › Network.

Additional networks, each with its own `rule` and `caveats`:
- `funding` — `nodes[]` (the authored non-person nodes `x_amnh_fund`, `x_exp_1907`, `x_exp_1908`, `x_exp_1914` with `layer`, plus the
  persons they connect) and `edges[]` (`source`, `target`, `kind` funding | pi, `amount_as_written` exactly as the text writes it,
  `status` promised | paid | acknowledged | requested | budgeted | ceiling | offered, `date`, `doc`, `quote` verified verbatim, `note`). No total is computed anywhere. Rule: A funding edge exists only where a provided text states a sum or a promise of one; amounts are as written; no total is computed.
- `pairs[]` — co-attestation, **derived**: for every unordered pair of nodes joined by at least one non-affiliation edge, the counts
  per kind (`correspondence`, `stated`, `pi`), `n_kinds`, `n_edges` and the edge ids. Rule: Derived by counting the existing edges per pair; it adds no tie. Caveat: Co-attestation measures the surviving file, not the strength of a historical relationship; a kind count of 1 means one surviving voice, not a weak tie.
- `mentions` — **derived** name-mention layer: `edges[]` sender → person named in the text of the item (`doc`, `date`), from
  `documents[].mentions`; `method` states the matching guards. Rule: Derived automatically by name-variant matching on the transcription text (model); not an asserted tie; recall is incomplete.

### published
Sources as CITED in the provided files (`citation_as_given`); `excerpts[]` are passages quoted inside the provided files;
no record was completed from outside knowledge; no full text was provided.

### findings
Register of `discrepancy`, `absence`, `naming`, `unlocated`, `authorship` findings with `refs` and the records they concern
(`stories`, `stops`, `places`, `people`); `related[]` links findings that bear on the same question.

## Verified quotation classes (meta.quotation_classes)
- **tie evidence** — every quotation on a stated / PI / affiliation tie is found verbatim in the sources (build fails otherwise)
- **funding** — every funding edge quotes a sum or promise verbatim
- **Tale excerpts** — every story excerpt is an exact substring of the Tale and ends at a sentence or quotation boundary
- **Cast lines and characterisations** — every pi_characterisation and characterisation is a verbatim line of the PI's texts
- **quoted fragments in authored prose** — 459 quoted spans in model notes, place/stop/segment fields, findings, roles, variants, addresses, institutions, published excerpts and notes, tie labels, and record notes are verified (allow-list of quoted vocabulary, none of it currently needed: approximate, disputed, inferred, model, unlocated, verified, via PI)

`meta.counts.verified_quotations` = 459 quoted fragments verified in this build; the build fails on any miss.
