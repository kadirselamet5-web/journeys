# -*- coding: utf-8 -*-
"""Build the evidence dataset for the Quackenbush journey site.

Inputs (all derived from the five files supplied by the Mammoth History Lab; see data/source/):
  data/source/transcription_paragraphs.json  paragraphs with inline formatting from the five .docx files
  data/source/tale_of_two_mammoths.{html,txt}  pandoc conversions of the PI's talk text
  scripts/authored/*.py                        hand-authored normalisation and analysis (see each file)
Outputs: data/*.json, data/csv/*.csv, data/bundle.js, data/DATA_DICTIONARY.md
The build FAILS if any cross-reference does not resolve or any quoted excerpt is not found verbatim
(after normalising quotation marks, dashes and whitespace) in the provided texts."""
import json, re, csv, sys, os, html as htmlmod, datetime
from collections import defaultdict, Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'scripts'))
from authored import documents_meta as DM, people as PP, places as PL, journeys as JJ, network as NW, published as PB, findings as FD, stories as ST, timeline_links as TL, funding as FU

SRC = os.path.join(ROOT, 'data', 'source')
OUT = os.path.join(ROOT, 'data')
os.makedirs(os.path.join(OUT, 'csv'), exist_ok=True)

files = json.load(open(os.path.join(SRC, 'transcription_paragraphs.json'), encoding='utf-8'))
LSQ, TIMELINE, TALE_DOCX, TERSE, CAST = [f['paragraphs'] for f in files]
tale_txt = open(os.path.join(SRC, 'tale_of_two_mammoths.txt'), encoding='utf-8').read()
tale_html = open(os.path.join(SRC, 'tale_of_two_mammoths.html'), encoding='utf-8').read()

errors = []
def err(msg): errors.append(msg)

# ----------------------------------------------------------------------------- helpers
def norm(s):
    s = re.sub(r'\[\d+\]', '', s)
    s = re.sub(r'\^\((\w+)\)', r'\1', s)
    # the PI's caret convention for interlinear insertions in the original (^/text/ or ^text/): the words are the writer's
    s = re.sub(r'\^/([^/\n]{1,120}?)/', r'\1', s)
    s = re.sub(r'\^([^/\n\s][^/\n]{0,40}?)/', r'\1', s)
    s = s.replace('^', '')
    for a, b in [('“', '"'), ('”', '"'), ('‘', "'"), ('’', "'"), ('—', '-'), ('–', '-'), ('---', '-'), ('--', '-'), ('…', '...'), (' ', ' ')]:
        s = s.replace(a, b)
    s = re.sub(r'\s+', ' ', s)
    return s.strip().lower()

ALL_PLAIN = norm(tale_txt + '\n' + '\n'.join(p['plain'] for f in files for p in f['paragraphs'] if not p['empty']))
def quote_exists(q):
    return norm(q) in ALL_PLAIN
def quote_ok(q):
    """quote_exists, retried with every [...] insertion removed (so 'know[s] the location' and
    'This locality [Eschscholtz Bay] is only 30 miles' pass when the bracketed words are the writer's)."""
    if quote_exists(q): return True
    q2 = re.sub(r'\s*\[[^\]]*\]', '', q)
    return q2 != q and bool(q2.strip()) and quote_exists(q2)

ED_INLINE = re.compile(r'(\[(?:sic|\?|\?\?|illeg|or [^\]]{1,40}|ner\?|s\]|Bumpus|[A-Z][a-z]+ \d{4}|\d{1,2} [A-Z][a-z]+ \d{4}|after [^\]]+|February 1908|\?\?\?)\])')

def style_html(h, doc_id=None, slash=False, legend=None):
    """Convert python-docx run HTML into the site's block HTML."""
    h = re.sub(r'^(\s|\t|&nbsp;)+', '', h)
    # colour spans
    def col(m):
        c = m.group(1)
        title = (legend or {}).get(c) or "marked in colour in the PI's transcription"
        return f'<span class="pi-color pc-{c}" title="{htmlmod.escape(title)}">'
    h = re.sub(r'<span data-color="([0-9A-Fa-f]{6})">', col, h)
    # caret insertions (PI convention: ^/text/ or ^text/ marks an interlinear insertion in the original)
    h = re.sub(r'\^/([^/<>]{1,120}?)/', r'<ins class="ms-insert" title="interlinear insertion in the original (PI’s caret)">\1</ins>', h)
    h = re.sub(r'\^(Mr\. Grants camp)', r'<ins class="ms-insert" title="interlinear insertion in the original (PI’s caret)">\1</ins>', h)
    h = re.sub(r'\^([^/<>\s][^/<>]{0,80}?)/', r'<ins class="ms-insert" title="interlinear insertion in the original (PI’s caret)">\1</ins>', h)
    if slash:
        h = re.sub(r'(?<![\w<>/])/([^/<>]{2,140}?)/(?![\w])', r'<span class="ann-inline" title="pencil annotation on the original, marked between slashes by the PI">/\1/</span>', h)
    # editorial inline marks in square brackets
    h = re.sub(r'(\[[^\]<>]{1,60}\])', r'<span class="ed-inline" title="editorial mark in the PI’s transcription">\1</span>', h)
    return h

# ----------------------------------------------------------------------------- 1. documents
EDIT_PAT = re.compile(r'(Stamped|stamped|[Ll]etterhead|^NB\b|\bNB\b|RJHW|[Ii]ndex entry|From the index|Annotated|annotated|Two copies|Neither included|No date|Only the copy|Written, definitely|^Noted|Enclosed presumably|Last clause|^Typed|Form slip|Original location|don[’\']t have|Can[’\']t read|Page two begins|^Signed|^\*|Removal Slip|Typed excerpt|Mammoth hair enclosed|Blue wax|Heavily annotated|^On VP|^Department of Vertebrate|Contains a 15|need to read|^Handwritten|^Written in pencil|^Enclosed:|Six page letter|^Dated June|^The enclosed is|Something about|^A PS about|^Excerpt|^Notes about|^Includes? a map|\*Also included)')

def classify(plain):
    t = plain.strip()
    if t == '2':
        return 'editorial'   # the PI's underlined page-number marker in the six-page letter
    for prefix, typ in DM.PREFIX_TYPES:
        if t.startswith(prefix):
            return typ
    if t.startswith('“') or t.startswith('"') or t.startswith(':'):
        return 'verbatim'
    if re.match(r'^/', t):
        return 'annotation'
    if re.match(r'^\d\.\s', t) or re.match(r'^Total\b', t) or re.match(r'^\d[\d,]*\.\d\d$', t) or t.startswith('2') and 'expenses of travel' in t or t.startswith('3') and 'amount of money' in t:
        return 'verbatim'
    if EDIT_PAT.search(t):
        return 'editorial'
    return 'summary'

def split_sentence(plain, html_):
    for prefix, after, types in DM.SENTENCE_SPLITS:
        if plain.strip().startswith(prefix) and after in plain:
            i = plain.index(after) + len(after)
            a, b = plain[:i].strip(), plain[i:].strip()
            # split html at the same text (strip tags to find)
            j = html_.find(after)
            if j >= 0:
                ha, hb = html_[:j + len(after)], html_[j + len(after):]
            else:
                ha, hb = htmlmod.escape(a), htmlmod.escape(b)
            return [(types[0], a, ha), (types[1], b, hb)]
    return None

docs = []
doc_by_id = {}
collection = None
cur = None
DROP = {262, 263}

def new_doc(meta, pidx):
    d = dict(meta)
    d['paragraph_index'] = pidx
    d['collection'] = collection
    d['archive'] = d.get('archive') or None
    d['blocks'] = []
    docs.append(d); doc_by_id[d['id']] = d
    return d

for i, p in enumerate(LSQ):
    if p['empty']: continue
    plain = p['plain'].strip()
    if i in DROP: continue
    if p.get('bold_all') and plain.startswith('Central Archives') and i not in DM.DOCS:
        collection = plain
        continue
    if i in DM.DOCS:
        meta = DM.DOCS[i]
        if plain.startswith('Central Archives'):
            collection = plain
        cur = new_doc(meta, i)
        if plain.startswith('Central Archives'):
            cur['archive'] = plain
        cur['header_raw'] = plain
        continue
    if i in DM.SPLITS:
        sp = DM.SPLITS[i]
        if sp.get('drop'): continue
        meta = DM.DOCS[sp['use_meta']] if sp.get('use_meta') else {k: v for k, v in sp.items() if k not in ('lead_type', 'use_meta')}
        parent = cur
        cur = new_doc(meta, i)
        cur['archive'] = parent['archive'] if parent else None
        cur['header_raw'] = plain
        if sp.get('enclosed_in'):
            cur['enclosed_in'] = sp['enclosed_in']
        if sp.get('lead_type'):
            parts = split_sentence(plain, p['html'])
            if parts:
                for typ, a, ha in parts:
                    cur['blocks'].append(dict(type=typ, text=a, html=ha, p=i))
            else:
                cur['blocks'].append(dict(type=sp['lead_type'], text=plain, html=p['html'], p=i))
        continue
    if i in DM.BOLD_NOT_HEADER:
        cur['blocks'].append(dict(type=DM.BOLD_NOT_HEADER[i], text=plain, html=p['html'], p=i)); continue
    if p.get('underline_all') and plain.startswith('Central Archives'):
        if cur is not None: cur['archive'] = plain
        continue
    if cur is None:
        continue  # title lines before the first item
    if p.get('bold_all') and i < 9:
        continue
    parts = split_sentence(plain, p['html'])
    if parts:
        for typ, a, ha in parts:
            cur['blocks'].append(dict(type=typ, text=a, html=ha, p=i))
    else:
        cur['blocks'].append(dict(type=classify(plain), text=plain, html=p['html'], p=i))

# finalise documents
for d in docs:
    if not d.get('archive'):
        d['archive'] = d['collection']
    legend = DM.COLOR_LEGENDS.get(d['id'])
    for k, b in enumerate(d['blocks']):
        b['id'] = f"{d['id']}#b{k}"
        b['html'] = style_html(b['html'], d['id'], slash=d.get('slash_annotations', False), legend=legend)
        if d.get('slash_annotations') and '\t' in b['text'] and re.search(r'\d+\.\s*$|\d\.\d\d', b['text']):
            b['tabular'] = True
        else:
            b['html'] = re.sub(r'\t+', ' ', b['html']); b['text'] = re.sub(r'\t+', ' ', b['text'])
        b['indent'] = bool(re.match(r'^\s*\t\t', LSQ[b['p']]['plain']))
        b['speaker'] = {'verbatim': 'historical writer (as transcribed by the PI)', 'summary': "researcher's summary (R. J. H. Woods)", 'editorial': 'editorial note (R. J. H. Woods)', 'annotation': 'annotation on the original (as transcribed by the PI)'}[b['type']]
    d['color_legend'] = legend
    d['sort_key'] = d.get('sort_hint') or (d['date'] + ('' if len(d['date']) == 10 else '-15')) if d.get('date') else d.get('sort_hint', '9999')
    if d.get('date') and len(d['date']) == 7: d['sort_key'] = d['date'] + '-15'
    d['year'] = int((d.get('date') or d.get('sort_hint') or '0000')[:4]) if (d.get('date') or d.get('sort_hint')) else None
    d['folder'] = (re.search(r'Folder:?\s*(.+)$', d['archive'] or '') or [None, None])[1]
    d['word_count'] = sum(len(b['text'].split()) for b in d['blocks'])
    d['block_counts'] = dict(Counter(b['type'] for b in d['blocks']))

docs.sort(key=lambda d: (d['sort_key'], d['paragraph_index']))
for n, d in enumerate(docs): d['order'] = n

# enclosures and references between items
for d in docs:
    if d.get('enclosed_in'):
        doc_by_id[d['enclosed_in']].setdefault('enclosures', []).append(d['id'])

# ----------------------------------------------------------------------------- 2. people / institutions
people = []
for p in PP.PEOPLE:
    q = dict(p)
    q['variants'] = [dict(form=a, source=b) for a, b in p.get('variants', [])]
    q['roles'] = [dict(role=a, source=b) for a, b in p.get('roles', [])]
    q['addresses'] = [dict(address=a, source=b) for a, b in p.get('addresses', [])]
    q['characterisations'] = [dict(text=a, source=b) for a, b in p.get('characterisations', [])]
    for c in q['characterisations']:
        if not quote_ok(c['text']): err(f"person {q['id']}: characterisation not found verbatim: {c['text'][:70]}")
    if q.get('pi_characterisation') and not quote_ok(q['pi_characterisation']):
        err(f"person {q['id']}: pi_characterisation is not a verbatim Cast line: {q['pi_characterisation'][:70]}")
    insts = []
    for a in p.get('institutions', []):
        a = dict(a)
        if a.get('status') not in ('stated', 'inferred'): err(f"person {q['id']}: affiliation {a.get('id')} has no status")
        ev = a.pop('evidence', None)
        if a.get('status') == 'stated':
            if not ev: err(f"person {q['id']}: stated affiliation {a['id']} has no evidence")
            else:
                ref, quote = ev
                a['evidence'] = dict(ref=ref, quote=quote)
                if ref not in ('tale', 'cast', 'pi_timeline') and ref not in {d['id'] for d in docs}: err(f"person {q['id']}: affiliation {a['id']} unknown ref {ref}")
                if not quote_ok(quote): err(f"person {q['id']}: affiliation {a['id']} quote not found: {quote[:70]}")
        else:
            a['evidence'] = None
        insts.append(a)
    q['institutions'] = insts
    people.append(q)
offices = [dict(o) for o in PP.OFFICES]
institutions = [dict(i) for i in PP.INSTITUTIONS]
for i in institutions:
    if i.get('place') and not i.get('place_status'): err(f"institution {i['id']}: place without place_status")
    i.setdefault('place_status', None)
pid = {p['id'] for p in people} | {o['id'] for o in offices} | {i['id'] for i in institutions}

# mentions (automatic name match; labelled as such in the UI)
variant_index = []
for p in people:
    forms = {v['form'] for v in p['variants']} | {p['label']}
    for f in forms:
        f2 = re.sub(r'\s*\(.*?\)\s*', ' ', f).strip()
        f2 = re.sub(r'^[‘’\'"“”]|[‘’\'"“”]$', '', f2).strip()
        if len(f2) < 4 or f2.lower() in ('director', 'q.', 'lsq', 'hfo', 'h.f.o.', 'h.c.b.', 'rjhw', 'the indian', 'the eskimos', 'prospectors', 'miners', 'the prospectors', 'a man to act as cook and assistant', 'the man who was with me last summer'):
            continue
        variant_index.append((f2, p['id']))
variant_index.sort(key=lambda x: -len(x[0]))
AMBIG = {'Matthews', 'Mathews', 'Matthews’'}
for d in docs:
    text = ' '.join(b['text'] for b in d['blocks'])
    found = set(d.get('senders', [])) | set(d.get('recipients', []))
    for form, who in variant_index:
        if form in AMBIG: continue
        if re.search(r'(?<![\w])' + re.escape(form) + r'(?![\w])', text):
            found.add(who)
    # 'Doctor Matthew' / 'Dr. Matthew(s)' is always W. D. Matthew of the AMNH (no writer gives J. F. Mathews a title);
    # a bare 'Matthews' / 'Mathews' is J. F. Mathews in items dated 1914 or later and W. D. Matthew before.
    if re.search(r'\b(Doctor|Dr\.?)\s+Mat?thews?\b', text):
        found.add('p_matthew')
    if re.search(r'(?<!Doctor )(?<!Dr\. )(?<!Dr )\bMat?thews\b', text):
        found.add('p_mathews_jf' if (d.get('year') or 0) >= 1914 else 'p_matthew')
    # a few surnames that the variant forms miss
    for surname, who in [('Quackenbush', 'p_quackenbush'), ('Bumpus', 'p_bumpus'), ('Osborn', 'p_osborn'), ('Grant', 'p_grant'), ('Meany', 'p_meany'), ('Meaney', 'p_meany'), ('Startsman', 'p_startsman'), ('Graham', 'p_graham'), ('Rathbun', 'p_rathbun'), ('Pyne', 'p_pyne_percy'), ('Morgan', 'p_morgan'), ('Sherwood', 'p_sherwood'), ('Hoffman', 'p_hoffman'), ('Chilberg', 'p_chilberg'), ('Reed', 'p_reed'), ('Anderson', 'p_anderson'), ('Stone', 'p_stone'), ('Jesup', 'p_jesup'), ('Lucas', 'p_lucas'), ('Maddren', 'p_maddren'), ('Gilmore', 'p_gilmore'), ('Merriam', 'p_merriam'), ('Granger', 'p_granger'), ('Beechey', 'p_beechey'), ('Quinn', 'p_quinn')]:
        if re.search(r'(?<![\w])' + surname + r'(?![\w])', text):
            if surname == 'Lucas' and (d.get('year') or 0) < 1910: found.add('p_lucas_brooklyn_1907'); continue
            if surname == 'Pyne' and 'Momo' in text: found.add('p_pyne_mt')
            found.add(who)
    d['mentions'] = sorted(found - set(d.get('senders', [])) - set(d.get('recipients', [])))
    d['mentions_method'] = ("automatic name-variant match on the transcription text (model); senders and recipients excluded; recall is incomplete. "
                            "Guards: 'Doctor Matthew' / 'Dr. Matthew(s)' is routed to W. D. Matthew whatever the year; a bare 'Matthews' / 'Mathews' goes to J. F. Mathews in items dated 1914 or later and to W. D. Matthew before; "
                            "a bare 'Lucas' in items dated before 1910 is routed to the 1907 Brooklyn Museum mention, not to F. A. Lucas; 'Pyne' with 'Momo' in the text adds M. T. Pyne.")

# ----------------------------------------------------------------------------- 3. places
UNLOCATED_KINDS = {'withheld': 'the location was deliberately not disclosed in the sources',
                   'contradictory': 'the provided statements place it differently and cannot be reconciled',
                   'ambiguous': 'the attested name has several gazetteer homonyms, or the reading of the name is uncertain',
                   'not_geocoded': 'outside the journey; no gazetteer was consulted for it in this build'}
CONSTRAINT_KINDS = {'distance': 'a stated distance in miles from a located anchor — drawn as a dashed ring around the anchor; no point',
                    'near': 'a stated nearness without a distance — drawn as a leader label at the anchor; no radius',
                    'identity': 'a statement equating the place with a located one — drawn as a bracket at that place; nothing asserted'}
places = []
for pl in PL.PLACES:
    q = dict(pl)
    q['attested'] = [dict(form=a, source=b) for a, b in pl['attested']]
    q['has_coords'] = q.get('lat') is not None
    q.setdefault('scope', 'hunt'); q.setdefault('mentioned_only', False); q.setdefault('crosscheck', [])
    q.setdefault('naming', False); q.setdefault('constraints', []); q.setdefault('candidates', []); q.setdefault('candidates_note', None); q.setdefault('unlocated_kind', None)
    if 'UNLOCATED' in q['label']: err(f"place {q['id']}: label carries the '(UNLOCATED)' suffix; unlocated_kind carries that now")
    if not q.get('short_label'): err(f"place {q['id']}: no short_label (add it to places.SHORT_LABELS)")
    if q['has_coords'] and q['unlocated_kind']: err(f"place {q['id']}: unlocated_kind on a place with coordinates")
    if not q['has_coords'] and q['unlocated_kind'] not in UNLOCATED_KINDS: err(f"place {q['id']}: unlocated place without a valid unlocated_kind")
    if q['constraints'] and q['has_coords']: err(f"place {q['id']}: constraints on a located place")
    for c in q['constraints']:
        if c.get('kind') not in CONSTRAINT_KINDS: err(f"place {q['id']}: constraint kind {c.get('kind')!r} unknown")
        if c['kind'] == 'distance' and not c.get('miles'): err(f"place {q['id']}: distance constraint without miles")
        if c['kind'] != 'distance' and c.get('miles'): err(f"place {q['id']}: miles on a {c['kind']} constraint")
        if not c.get('quote'): err(f"place {q['id']}: constraint without a quotation (a constraint is a statement in a provided text)")
        elif not quote_ok(c['quote']): err(f"place {q['id']}: constraint quote not found verbatim: {c['quote'][:70]}")
        if not c.get('speaker') or not c.get('model_note'): err(f"place {q['id']}: constraint needs speaker and model_note")
    for cand in q['candidates']:
        if cand.get('authority') != 'USGS GNIS' or not cand.get('id') or cand.get('lat') is None: err(f"place {q['id']}: candidate must be a GNIS record with id, lat, lon")
    if q['candidates'] and not q.get('candidates_note'): err(f"place {q['id']}: candidates without candidates_note")
    places.append(q)
plid = {p['id'] for p in places}
place_by_id = {p['id']: p for p in places}
for q in places:
    for c in q['constraints']:
        a = place_by_id.get(c.get('anchor'))
        if not a: err(f"place {q['id']}: constraint anchor {c.get('anchor')} unknown")
        elif not a['has_coords']: err(f"place {q['id']}: constraint anchor {c['anchor']} has no coordinates")
        c['anchor_label'] = a['label'] if a else None

# gazetteer records are checked against the GNIS Alaska file when it is present (env GNIS_AK_FILE or the scratchpad copy);
# candidates must match id, name, class, county and coordinates; a homonym set must be complete (every row of that name).
GNIS_AK_FILE = os.environ.get('GNIS_AK_FILE') or '/tmp/claude-0/-home-user-journeys/63137abf-387a-5196-816b-790a93984fb7/scratchpad/gaz/Text/DomesticNames_AK.txt'
def gnis_scan(ids, names):
    """{feature_id: row} for the given ids plus every row whose feature_name is in names; None when the file is absent."""
    if not os.path.exists(GNIS_AK_FILE): return None
    out = {}
    with open(GNIS_AK_FILE, encoding='utf-8-sig') as fh:
        col = {k: i for i, k in enumerate(fh.readline().rstrip('\n').split('|'))}
        for line in fh:
            f = line.rstrip('\n').split('|')
            if f[0] in ids or f[col['feature_name']] in names:
                out[f[0]] = dict(id=f[0], name=f[col['feature_name']], feature_class=f[col['feature_class']], county=f[col['county_name']], map=f[col['map_name']], lat=float(f[col['prim_lat_dec']]), lon=float(f[col['prim_long_dec']]))
    return out
_cands = [(q, c) for q in places for c in q['candidates']]
_gnis = gnis_scan({c['id'] for _, c in _cands}, {c['name'] for _, c in _cands})
gnis_checked = 0
if _gnis is None:
    print(f"WARNING: GNIS Alaska file not found at {GNIS_AK_FILE}; candidate records not re-checked (set GNIS_AK_FILE)")
else:
    for q, c in _cands:
        row = _gnis.get(c['id'])
        if not row: err(f"place {q['id']}: candidate GNIS {c['id']} not in the Alaska file"); continue
        for k in ('name', 'feature_class', 'county', 'map'):
            if c.get(k) and c[k] != row[k]: err(f"place {q['id']}: candidate GNIS {c['id']} {k} {c[k]!r} != file {row[k]!r}")
        if abs(c['lat'] - row['lat']) > 1e-7 or abs(c['lon'] - row['lon']) > 1e-7: err(f"place {q['id']}: candidate GNIS {c['id']} coordinates differ from the file")
        gnis_checked += 1
    for q in places:
        if len(q['candidates']) > 1:
            name = q['candidates'][0]['name']
            in_file = sorted(r['id'] for r in _gnis.values() if r['name'] == name)
            if in_file != sorted(c['id'] for c in q['candidates']): err(f"place {q['id']}: GNIS rows named {name!r} are {in_file}, candidates list {[c['id'] for c in q['candidates']]}")

# ----------------------------------------------------------------------------- 4. stops / segments
stops = []
for s in JJ.STOPS:
    q = dict(s); q['sources'] = [dict(ref=a, locator=b) for a, b in s['sources']]
    q.setdefault('naming', False)
    if q['place'] not in plid: err(f"stop {q['id']} -> unknown place {q['place']}")
    elif q['naming'] != place_by_id[q['place']]['naming']: err(f"stop {q['id']}: naming flag disagrees with its place")
    stops.append(q)
sid = {s['id'] for s in stops}
stop_by_id = {s['id']: s for s in stops}
segments = []
for g in JJ.SEGMENTS:
    q = dict(g); q['source'] = dict(ref=g['source'][0], locator=g['source'][1])
    for k in ('frm', 'to'):
        if q[k] not in sid: err(f"segment {q['id']} -> unknown stop {q[k]}")
    # out-and-back legs: every via place must resolve, lie between the endpoints, and a stated via must quote a provided text
    via = []
    ends = {stop_by_id[q[k]]['place'] for k in ('frm', 'to') if q[k] in stop_by_id}
    for v in g.get('via', []) or []:
        v = dict(v); v.setdefault('quote', None); v.setdefault('ref', None)
        if v.get('place') not in plid: err(f"segment {q['id']}: via place {v.get('place')} unknown")
        elif not place_by_id[v['place']]['has_coords']: err(f"segment {q['id']}: via place {v['place']} has no coordinates")
        elif v['place'] in ends: err(f"segment {q['id']}: via place {v['place']} is an endpoint")
        if v.get('status') not in ('stated', 'inferred'): err(f"segment {q['id']}: via status must be stated | inferred")
        if v.get('status') == 'stated':
            if not v['quote']: err(f"segment {q['id']}: stated via without a quotation")
            elif not quote_exists(v['quote']): err(f"segment {q['id']}: via quote not found verbatim: {v['quote'][:70]}")
            if v['ref'] not in ('tale', 'pi_timeline') and v['ref'] not in doc_by_id: err(f"segment {q['id']}: via ref {v['ref']} unknown")
        elif v['quote']: err(f"segment {q['id']}: an inferred via carries a quotation; make it stated")
        v['place_label'] = place_by_id[v['place']]['label'] if v.get('place') in place_by_id else None
        via.append(v)
    q['via'] = via
    segments.append(q)
context_arcs = []
for a in JJ.CONTEXT_ARCS:
    q = dict(a); q['source'] = dict(ref=a['source'][0], locator=a['source'][1]); context_arcs.append(q)

# ----------------------------------------------------------------------------- 5. tale
tale_paras_txt = [p.strip() for p in re.split(r'\n\s*\n', tale_txt) if p.strip()]
_cut = re.search(r'<(?:section|div|aside)[^>]*class="footnotes', tale_html)
_main_html = tale_html[:_cut.start()] if _cut else tale_html
tale_paras_html = re.findall(r'<p>(.*?)</p>', _main_html, flags=re.S)
fn_html = ''
m = re.search(r'<(section|div|aside)[^>]*class="footnotes[^>]*>(.*)</\1>', tale_html, flags=re.S)
if m: fn_html = m.group(2)
body_txt = [p for p in tale_paras_txt if not re.match(r'^\[\d+\]', p)]
if len(tale_paras_html) != len(body_txt):
    err(f"tale paragraph count mismatch html={len(tale_paras_html)} txt={len(body_txt)}")
tale = []
section = 'front matter'
for k, (t, h) in enumerate(zip(body_txt, tale_paras_html)):
    tt = t.strip()
    if tt.startswith('Preamble'): section = 'preamble'
    elif tt.startswith('I’ll be talking') or tt.startswith("I'll be talking"): section = 'introduction'
    elif tt.startswith('Plan:'): section = 'plan'
    elif re.match(r'^1\.\s*Adams Mammoth: findings', tt): section = '§1 Adams Mammoth: findings'
    elif re.match(r'^2\.\s*Frozen', tt): section = '§2 Frozen (Mammoth) Meat'
    elif re.match(r'^3\.\s*[“"]A Mammoth Hunt', tt): section = '§3 “A Mammoth Hunt in Alaska”'
    elif tt == 'Conclusion': section = 'Conclusion'
    h2 = re.sub(r'<a href="#fn(\d+)" class="footnote-ref" id="fnref\d+" role="doc-noteref"><sup>(\d+)</sup></a>', r'<sup class="fnref" data-fn="\1">\2</sup>', h)
    tale.append(dict(id=f"t{k:03d}", section=section, text=tt, html=h2))
footnotes = []
for mm in re.finditer(r'<li id="fn(\d+)"[^>]*>(.*?)</li>', fn_html, flags=re.S):
    inner = re.sub(r'<a href="#fnref\d+"[^>]*>.*?</a>', '', mm.group(2), flags=re.S)
    footnotes.append(dict(n=int(mm.group(1)), html=inner.strip()))

def find_tale_para(excerpt):
    ne = norm(excerpt)
    for tp in tale:
        if ne in norm(tp['text']): return tp['id']
    return None

fn_by_n = {f['n']: f for f in footnotes}
def excerpt_footnotes(para_id, excerpt):
    """The PI's footnote markers of the paragraph whose preceding text lies within the excerpt span, as [{n, html}]:
    an excerpt that ends at '…before naming Quackenbush.' carries the marker that follows that full stop."""
    tp = next((t for t in tale if t['id'] == para_id), None)
    if not tp: return []
    parts = re.split(r'<sup class="fnref" data-fn="(\d+)">\d+</sup>', tp['html'])   # [text0, n1, text1, n2, text2, …]
    strip = lambda x: htmlmod.unescape(re.sub(r'<[^>]+>', '', x))
    plain_all = norm(strip(''.join(parts[0::2])))
    ne = norm(excerpt)
    a = plain_all.find(ne)
    if a < 0: return []
    b = a + len(ne)
    out, pre = [], ''
    for i in range(1, len(parts), 2):
        pre += strip(parts[i - 1])
        p = len(norm(pre))                       # position of the marker in the normalised paragraph text
        if a < p <= b + 1:                       # after the excerpt's start, at or just after its end
            n = int(parts[i]); fn = fn_by_n.get(n)
            if fn: out.append(dict(n=n, html=fn['html']))
    return out

# ----------------------------------------------------------------------------- 6. stories
stories = []
for s in ST.STORIES:
    q = dict(s)
    ex = []
    for e in s['tale_excerpts']:
        pid_ = find_tale_para(e)
        if not pid_: err(f"story {s['id']}: Tale excerpt not found verbatim: {e[:80]}…")
        if e.rstrip()[-1:] not in tuple('.!?;:,”’"\')]'): err(f"story {s['id']}: Tale excerpt does not end at a sentence or quotation boundary: …{e.rstrip()[-40:]}")
        ex.append(dict(text=e, para=pid_, speaker='principal investigator (Tale of Two Mammoths, 2019), verbatim', footnotes=excerpt_footnotes(pid_, e) if pid_ else []))
    q['tale_excerpts'] = ex
    for d_ in s['docs']:
        if d_ not in doc_by_id: err(f"story {s['id']}: unknown doc {d_}")
    for p_ in s['people']:
        if p_ not in pid: err(f"story {s['id']}: unknown person {p_}")
    for pl_ in s['places']:
        if pl_ not in plid: err(f"story {s['id']}: unknown place {pl_}")
    for st_ in s['stops']:
        if st_ not in sid: err(f"story {s['id']}: unknown stop {st_}")
    stories.append(q)
story_ids = [s['id'] for s in stories]
for n, s in enumerate(stories):
    s['order'] = n; s['prev'] = story_ids[n - 1] if n > 0 else None; s['next'] = story_ids[n + 1] if n + 1 < len(story_ids) else None
for s in stops:
    if s['story'] not in story_ids: err(f"stop {s['id']} -> unknown story {s['story']}")

# ----------------------------------------------------------------------------- 7. published, findings
published = [dict(p, excerpts=[dict(locator=a, text=b) for a, b in p['excerpts']]) for p in PB.PUBLISHED]
pubid = {p['id'] for p in published}
findings = [dict(f) for f in FD.FINDINGS]
fid = {f['id'] for f in findings}
for s in stories:
    for x in s['published']:
        if x not in pubid: err(f"story {s['id']}: unknown published {x}")
    for x in s['findings']:
        if x not in fid: err(f"story {s['id']}: unknown finding {x}")
for f in findings:
    for r in f.get('refs', []):
        if r not in doc_by_id and r not in pubid and r not in ('tale', 'cast', 'pi_timeline'): err(f"finding {f['id']}: unknown ref {r}")
    for x in f.get('stories', []):
        if x not in story_ids: err(f"finding {f['id']}: unknown story {x}")
    for x in f.get('stops', []):
        if x not in sid: err(f"finding {f['id']}: unknown stop {x}")
    for x in f.get('places', []):
        if x not in plid: err(f"finding {f['id']}: unknown place {x}")
    f.setdefault('people', [])
    for x in f['people']:
        if x not in pid: err(f"finding {f['id']}: unknown person {x}")
    f.setdefault('related', [])
    for x in f['related']:
        if x not in fid or x == f['id']: err(f"finding {f['id']}: unknown related finding {x}")
for s in stops:
    for sr in s['sources']:
        if sr['ref'] not in doc_by_id and sr['ref'] not in pubid and sr['ref'] not in ('tale', 'pi_timeline'): err(f"stop {s['id']}: unknown source {sr['ref']}")

# ----------------------------------------------------------------------------- 8. network
edges = []
for d in docs:
    for s_ in d.get('senders', []):
        for r_ in d.get('recipients', []):
            edges.append(dict(source=s_, target=r_, kind='correspondence', directed=True, label='wrote to', date=d.get('date'), doc=d['id'], evidence=[dict(ref=d['id'], quote=d['title'])]))
def tie_date(refs):
    """Date of the first evidence ref that is a dated document (ISO or YYYY-MM); None for tale/cast/pi_timeline or undated items.
    The date is the document's, not the relationship's."""
    for ref in refs:
        d_ = doc_by_id.get(ref)
        if d_ and d_.get('date'): return d_['date']
    return None
for t in NW.TIES:
    for ref, q in t['evidence']:
        if ref not in doc_by_id and ref not in ('tale', 'cast', 'pi_timeline'): err(f"tie {t['source']}->{t['target']}: unknown ref {ref}")
        if not quote_exists(q): err(f"tie {t['source']}->{t['target']}: quote not found: {q[:70]}")
    for k in ('source', 'target'):
        if t[k] not in pid: err(f"tie: unknown node {t[k]}")
    e_ = dict(source=t['source'], target=t['target'], kind=t['kind'], directed=t['directed'], label=t['label'], date=tie_date([r for r, _ in t['evidence']]), doc=None, evidence=[dict(ref=a, quote=b) for a, b in t['evidence']])
    if t.get('evidence_kind'): e_['evidence_kind'] = t['evidence_kind']
    edges.append(e_)
for p in people:
    for a in p.get('institutions', []):
        if a['id'] not in pid: err(f"person {p['id']}: unknown institution {a['id']}")
        if a['status'] == 'stated':
            e_ = dict(source=p['id'], target=a['id'], kind='affiliation', directed=True, affiliation_status='stated', label='affiliated (stated)', date=tie_date([a['evidence']['ref']]), doc=None, evidence=[dict(a['evidence'])])
            if a.get('evidence_kind'): e_['evidence_kind'] = a['evidence_kind']
        else:
            e_ = dict(source=p['id'], target=a['id'], kind='affiliation', directed=True, affiliation_status='inferred', label='affiliated (inferred by the model)', date=None, doc=None, evidence=[])
        if a.get('note'): e_['note'] = a['note']
        edges.append(e_)
for n, e in enumerate(edges): e['id'] = f"e{n:04d}"
# metrics
deg = defaultdict(lambda: Counter())
for e in edges:
    deg[e['source']][e['kind'] + '_out'] += 1; deg[e['target']][e['kind'] + '_in'] += 1
    deg[e['source']]['total'] += 1; deg[e['target']]['total'] += 1
nodes = []
for p in people:
    nodes.append(dict(id=p['id'], label=p['label'], type='person', kind=p['kind'], scope=p['scope'], metrics=dict(deg[p['id']])))
for o in offices:
    nodes.append(dict(id=o['id'], label=o['label'], type='office', kind='office', scope='hunt', metrics=dict(deg[o['id']])))
for i in institutions:
    nodes.append(dict(id=i['id'], label=i['label'], type='institution', kind=i['kind'], scope=i.get('scope', 'hunt'), metrics=dict(deg[i['id']])))
# ----------------------------------------------------------------------------- 8b. funding flow (authored in funding.py)
fund_node_ids = {n['id'] for n in FU.FUNDING_NODES}
FUNDING_STATUSES = ('promised', 'paid', 'acknowledged', 'requested', 'budgeted', 'ceiling', 'offered')
funding_edges = []
for k, row in enumerate(FU.FUNDING_EDGES + FU.FUNDING_PI_EDGES):
    r = dict(row); r.setdefault('kind', 'funding'); r['id'] = f"fe{k:03d}"; r['derived'] = False
    for key in ('source', 'target'):
        if r[key] not in pid and r[key] not in fund_node_ids: err(f"funding {r['id']}: unknown node {r[key]}")
    if r['status'] not in FUNDING_STATUSES: err(f"funding {r['id']}: unknown status {r['status']}")
    if r['doc'] not in doc_by_id and r['doc'] != 'cast': err(f"funding {r['id']}: unknown doc {r['doc']}")
    if not quote_ok(r['quote']): err(f"funding {r['id']}: quote not found: {r['quote'][:70]}")
    if r['doc'] in doc_by_id:
        dd = doc_by_id[r['doc']]
        if r.get('date') is None and dd.get('date'): r['date'] = dd['date']
        if r.get('date') and dd.get('date') and r['date'][:7] != dd['date'][:7]: err(f"funding {r['id']}: date {r['date']} disagrees with document {dd['date']}")
    funding_edges.append(r)
_person_label = {p['id']: p['label'] for p in people}
funding_people = []
for pid_ in sorted({e['source'] for e in funding_edges} | {e['target'] for e in funding_edges}):
    if pid_ in fund_node_ids: continue
    layer = 3 if pid_ in ('p_quackenbush', 'p_quinn') else 0   # funders left, the Museum's fund, the expeditions, the field (Quackenbush; Quinn holding the canoe) right
    funding_people.append(dict(id=pid_, label=_person_label.get(pid_, pid_), type='person', layer=layer))
funding = dict(nodes=[dict(n) for n in FU.FUNDING_NODES] + funding_people, edges=funding_edges, rule=FU.RULE, caveats=list(FU.CAVEATS), derived=False,
               statuses={'promised': 'a pledge or an intention to pay', 'paid': 'a cheque sent or a sum wired', 'acknowledged': "receipt recorded by the Museum", 'requested': 'the Museum asks for a stated sum', 'budgeted': 'an estimate or a salary rate', 'ceiling': 'an upper limit set', 'offered': 'a sum named in an offer of service or sale'})

# ----------------------------------------------------------------------------- 8c. co-attestation pairs (derived)
pair_acc = {}
for e in edges:
    if e['kind'] == 'affiliation': continue
    a, b = sorted([e['source'], e['target']])
    pr = pair_acc.setdefault((a, b), dict(a=a, b=b, correspondence=0, stated=0, pi=0, edges=[]))
    pr[e['kind']] += 1; pr['edges'].append(e['id'])
pairs = []
for pr in pair_acc.values():
    pr['n_kinds'] = sum(1 for k in ('correspondence', 'stated', 'pi') if pr[k])
    pr['n_edges'] = len(pr['edges']); pr['derived'] = True
    pairs.append(pr)
pairs.sort(key=lambda x: (-x['n_kinds'], -x['n_edges'], x['a'], x['b']))
coattestation = dict(pairs=pairs, derived=True, rule='Derived by counting the existing edges per pair; it adds no tie.',
                     caveat='Co-attestation measures the surviving file, not the strength of a historical relationship; a kind count of 1 means one surviving voice, not a weak tie.')

# ----------------------------------------------------------------------------- 8d. name-mention layer (derived)
mention_edges = []
for d in docs:
    for s_ in d.get('senders', []):
        for m_ in d.get('mentions', []):
            if m_ == s_: continue
            mention_edges.append(dict(id=f"me{len(mention_edges):04d}", source=s_, target=m_, kind='mention', doc=d['id'], date=d.get('date'), derived=True))
mentions_layer = dict(edges=mention_edges, derived=True,
                      rule='Derived automatically by name-variant matching on the transcription text (model); not an asserted tie; recall is incomplete.',
                      caveat="A mention is a name in the text, not a relationship; senders and recipients are excluded; the matching guards are stated in each document's mentions_method.",
                      method=docs[0]['mentions_method'] if docs else '')

rules = {
    'correspondence': 'One directed edge per archival item from each named sender to each named recipient. Copies, drafts, telegrams, excerpts, enclosures and form slips all count as attestations that A wrote to B. Offices (o_*) stand for unnamed signers.',
    'stated': "A relation asserted inside a document by its writer (partner, friend, officer of the same company, familiar salutation, recommendation, request). Each edge carries the quotation that asserts it and the date of the document that carries the quotation. The date is the document's, not the relationship's. Letterhead officer lists are printed, not written by the signer; such ties are tagged letterhead.",
    'pi': "A relation asserted in the principal investigator's own writing (Cast of Characters, Tale §3, timeline summaries). Kept separate because it is interpretation, not attestation; PI ties are undated.",
    'affiliation': "Person to institution. Each edge carries one quotation that names the person in that institution (status 'stated'), or is marked 'inferred' where the model read the affiliation from context; inferred affiliations are drawn dashed and listed separately. Letterhead attestations are tagged letterhead.",
    'funding': FU.RULE,
    'coattestation': coattestation['rule'],
    'mentions': mentions_layer['rule'],
    'exclusions': 'No tie is inferred from co-mention, shared location, or outside knowledge. Mentions are indexed per document and shown only as a layer labelled derived; they are not asserted ties.'
}
views = [
    dict(id='persons', label='Persons', derived=False, node='persons, unnamed offices and institutions (circles; offices dashed)', edge='correspondence (solid, arrow) · stated (dash 7 3) · PI (dash 4 3) · affiliation (dash 1 3)',
         rule='A tie exists only where a provided text asserts it; the four kinds of evidence are kept apart and can be shown separately.', caveats=['Node size and degree describe the surviving file, not the historical world: a person whose letters were not kept has a low degree.']),
    dict(id='institutions', label='Institutions', derived=False, node='persons (circles) and institutions (squares sized by the persons attested in them)', edge='affiliation, labelled with the attested role; inferred affiliations dashed',
         rule=rules['affiliation'], caveats=["An 'inferred' affiliation is the model's reading of context, not a statement in the file; the institution's place may itself be inferred (place_status)."]),
    dict(id='funding', label='Funding', derived=False, node='funders · the Museum fund · the expeditions · the field (Quackenbush; Quinn)', edge='a stated sum or promise, labelled with the amount as written; status as dash pattern',
         rule=FU.RULE, caveats=list(FU.CAVEATS)),
    dict(id='coattestation', label='Co-attestation', derived=True, node='persons and offices', edge='up to three parallel strands per pair, one per kind of evidence that attests the pair',
         rule=coattestation['rule'], caveats=[coattestation['caveat']]),
    dict(id='mentions', label='Mentions', derived=True, node='persons and offices', edge='sender → person named in the text of the item (grey, dotted)',
         rule=mentions_layer['rule'], caveats=[mentions_layer['caveat']]),
]
network = dict(nodes=nodes, edges=edges, rules=rules, views=views, funding=funding, pairs=pairs, coattestation=dict(rule=coattestation['rule'], caveat=coattestation['caveat'], derived=True), mentions=mentions_layer)

# ----------------------------------------------------------------------------- 9. timelines
def parse_date_text(t):
    m = re.match(r'^\[?(?:(\d{1,2})(?:-\d{1,2})?\s+)?([A-Z][a-z]+)\s+(\d{4})\]?', t)
    months = {m_: i for i, m_ in enumerate(['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'], 1)}
    months.update({'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'Jun': 6, 'Jul': 7, 'Aug': 8, 'Sept': 9, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12})
    if m and m.group(2) in months:
        d_ = int(m.group(1)) if m.group(1) else None
        return f"{m.group(3)}-{months[m.group(2)]:02d}" + (f"-{d_:02d}" if d_ else '')
    m = re.match(r'^(\d{4})', t)
    if m: return m.group(1)
    return None

timeline = []
merged = {}
for i, p in enumerate(TERSE):
    if p['empty'] or i == 0: continue
    L = TL.LINKS.get(i, {})
    if L.get('merge_into') is not None:
        merged[L['merge_into']] = merged.get(L['merge_into'], '') + ' ' + p['plain'].strip()
        continue
    entry = dict(id=f"tl{i:03d}", para=i, text=p['plain'].strip(), html=p['html'], date=parse_date_text(p['plain'].strip()),
                 docs=L.get('docs', []), stops=L.get('stops', []), stories=L.get('stories', []), findings=L.get('findings', []), people=L.get('people', []), note=L.get('note'),
                 stream='itinerary (from B.AMNH 26 via PI)' if 'B.AMNH' in p['plain'] else 'correspondence / events (PI summary)')
    timeline.append(entry)
for e in timeline:
    if e['para'] in merged:
        e['text'] += merged[e['para']]
    for x in e['docs']:
        if x not in doc_by_id: err(f"timeline {e['id']}: unknown doc {x}")
    for x in e['stops']:
        if x not in sid: err(f"timeline {e['id']}: unknown stop {x}")
    for x in e['stories']:
        if x not in story_ids: err(f"timeline {e['id']}: unknown story {x}")
    e['sort'] = (e['date'] or '0000') + ('' if e['date'] and len(e['date']) == 10 else '-00')
for n, e in enumerate(timeline): e['order'] = n   # keep the PI's own order (including her two out-of-order entries)

itinerary = []
for i, p in enumerate(TIMELINE):
    if p['empty'] or '7030A0' not in p.get('colors', []): continue
    t = p['plain'].strip()
    src = re.search(r'\((B\.AMNH 26, p\.\s*\d+|LSQ.*?)\)?$', t)
    itinerary.append(dict(id=f"it{i:03d}", text=t, html=style_html(p['html']), date=parse_date_text(t), source=(src.group(1) if src else None), colour='7030A0 (purple) in the PI timeline = itinerary stream'))

# cast of characters (PI's own words)
cast = []
k = 0
while k < len(CAST):
    p = CAST[k]
    if not p['empty'] and p.get('bold_all') and k > 1:
        name = p['plain'].strip(); k += 1
        while k < len(CAST) and CAST[k]['empty']: k += 1
        text = CAST[k]['plain'].strip() if k < len(CAST) and not CAST[k].get('bold_all') else ''
        cast.append(dict(name=name, text=text))
    k += 1

# ----------------------------------------------------------------------------- 10. cross-indexes
for pl in places:
    pl['stops'] = [s['id'] for s in stops if s['place'] == pl['id']]
    pl['stories'] = [s['id'] for s in stories if pl['id'] in s['places']]
for d in docs:
    d['stories'] = [s['id'] for s in stories if d['id'] in s['docs']]
    d['timeline'] = [e['id'] for e in timeline if d['id'] in e['docs']]
    d['findings'] = [f['id'] for f in findings if d['id'] in f.get('refs', [])]
for p in people:
    p['sent'] = [d['id'] for d in docs if p['id'] in d.get('senders', [])]
    p['received'] = [d['id'] for d in docs if p['id'] in d.get('recipients', [])]
    p['mentioned_in'] = [d['id'] for d in docs if p['id'] in d.get('mentions', [])]
    p['stories'] = [s['id'] for s in stories if p['id'] in s['people']]
    p['findings'] = [f['id'] for f in findings if p['id'] in f.get('people', [])]
for pb_ in published:
    pb_['stories'] = [s['id'] for s in stories if pb_['id'] in s['published']]

# ----------------------------------------------------------------------------- 11. input provenance
inputs = []
for line in open(os.path.join(SRC, 'input_files_sha256.jsonl'), encoding='utf-8'):
    j = json.loads(line); inputs.append(dict(file=j['name'].split('-', 1)[1], sha256=j['sha256'], bytes=j['size']))

meta = dict(
    title='The Quackenbush Journeys, 1907–1908: an evidence-based reconstruction',
    built=datetime.date.today().isoformat(),
    inputs=inputs,
    authorship={
        'historical writers': 'Verbatim blocks are the words of the historical correspondents as transcribed by the PI; her editorial marks ([sic], [?], [illeg], struck text, colour) are preserved.',
        'principal investigator': 'Rebecca J. H. Woods (University of Toronto): transcription file, comprehensive and terse timelines, Cast of Characters, and the talk text “Time, Temperature, and Tissue in the Circumpolar North: A Tale of Two Mammoths” (MIT, 20 Sept 2019). Her summaries and editorial notes are typed and rendered separately from verbatim text.',
        'gazetteers': 'USGS GNIS (Alaska domestic names file), Canadian Geographical Names Database, GeoNames; Wikidata as cross-check only.',
        'model': 'Claude (Anthropic) built the data model, typed the blocks, normalised names, geocoded against gazetteers, wrote the geocoding and network rules, selected and ordered quotations, and wrote the short connective notes labelled “model”. It added no fact, date, coordinate or quotation that is not in the inputs or the named gazetteers.'
    },
    counts=dict(documents=len(docs), blocks=sum(len(d['blocks']) for d in docs), people=len(people), institutions=len(institutions), places=len(places), stops=len(stops), segments=len(segments), stories=len(stories), timeline=len(timeline), itinerary=len(itinerary), edges=len(edges), published=len(published), findings=len(findings)),
    block_types={'verbatim': 'words of the historical writer, as transcribed', 'summary': "the PI's paraphrase of a document", 'editorial': "the PI's description of the physical document, archival context, or dated research note", 'annotation': 'a marginal or interlinear annotation on the original, as transcribed'},
    status_chips={'verified': 'attested name matched to an authoritative gazetteer record', 'inferred': 'identification or date is a model inference from the described route or sequence', 'approximate': "placed from Quackenbush's distance/direction statements or a described relation to a named feature", 'disputed': 'provided sources disagree', 'unlocated': 'cannot be placed from the sources',
                  'naming': 'flag, not a status: two attested names denote one gazetteer point; records naming variance, not a dispute about position'},
    unlocated_kinds=UNLOCATED_KINDS,
    constraint_kinds=CONSTRAINT_KINDS,
    geocoding_tiers={1: 'published coordinates in the sources — none exist', 2: 'authoritative gazetteers (GNIS, CGNDB, GeoNames; Wikidata cross-check)', 3: 'historical maps/charts — none available (1906 Post Route Map not provided)', 4: "Quackenbush's distance/direction statements", 5: 'approximate placement with large uncertainty radius'},
)
meta['counts']['unlocated_places'] = sum(1 for p in places if not p['has_coords'])
meta['counts']['unlocated_constraints'] = sum(len(p['constraints']) for p in places)
meta['counts']['gazetteer_candidates'] = sum(len(p['candidates']) for p in places)
meta['counts']['out_and_back_legs'] = sum(len(g['via']) for g in segments)
meta['gnis_candidates_checked_against_file'] = (_gnis is not None)

# ----------------------------------------------------------------------------- 11b. every quoted fragment in authored free text must exist in the sources
# Spans between “…”, ‘…’, straight '…' and straight "…" whose opening quote follows start-of-string, whitespace, a bracket,
# a dash or another quote, and whose closing quote precedes end-of-string, whitespace, punctuation or another quote, are split
# at … / ... and every part of >= 10 characters must pass quote_ok(). Only vocabulary words quoted as terms are allowed through.
QUOTED_TERMS = {'verified', 'inferred', 'approximate', 'disputed', 'unlocated', 'model', 'via PI'}   # vocabulary words quoted as terms; nothing else
_OPEN_BEFORE = set(' \t\n([{—–-/"“‘\'')
_CLOSE_AFTER = set(' \t\n.,;:!?)]}—–-/"”’\'')
def quoted_spans(text):
    out = []
    for o, c in (('“', '”'), ('‘', '’'), ("'", "'"), ('"', '"')):
        i = 0
        while True:
            i = text.find(o, i)
            if i < 0: break
            prev = text[i - 1] if i > 0 else ' '
            if prev not in _OPEN_BEFORE: i += 1; continue
            j = i + 1; found = None
            while True:
                j = text.find(c, j)
                if j < 0: break
                nxt = text[j + 1] if j + 1 < len(text) else ' '
                if nxt in _CLOSE_AFTER: found = j; break
                j += 1
            if found is None: i += 1; continue
            out.append(text[i + 1:found]); i = found + 1
    return out
verified_quotations = 0
def check_quotes(table, rid, field, text, gazetteer_names=()):
    """gazetteer_names: names of the gazetteer records cited by this row; a quoted span equal to one of them is a
    quotation from the gazetteer, not from the five sources, and passes."""
    global verified_quotations
    if not text or not isinstance(text, str): return
    for span in quoted_spans(text):
        for part in re.split(r'…|\.\.\.', span):
            part = part.strip()
            if len(part) < 10 or part in QUOTED_TERMS: continue
            if part in gazetteer_names: verified_quotations += 1; continue
            if quote_ok(part) or quote_ok(part.rstrip('.,;:')):
                verified_quotations += 1
            else:
                err(f"{table} {rid} {field}: quoted span not found in the sources: ‘{part[:90]}’")
for s_ in stories: check_quotes('stories', s_['id'], 'model_note', s_.get('model_note'))
for pl in places:
    gz = {r.get('name') for r in ([pl.get('coord_source')] if pl.get('coord_source') else []) + list(pl.get('crosscheck') or []) + list(pl.get('candidates') or []) if r and r.get('name')}
    for f_ in ('why', 'role', 'gnis_note', 'distance_check', 'candidates_note'): check_quotes('places', pl['id'], f_, pl.get(f_), gz)
    for a in pl['attested']: check_quotes('places', pl['id'], 'attested.form', a['form'], gz)
    for c in pl['constraints']: check_quotes('places', pl['id'], 'constraints.model_note', c.get('model_note'), gz)
    for c in pl['candidates']: check_quotes('places', pl['id'], 'candidates.note', c.get('note'), gz)
for st in stops:
    for f_ in ('label', 'date_text', 'why'): check_quotes('stops', st['id'], f_, st.get(f_))
    for sr in st['sources']: check_quotes('stops', st['id'], 'sources.locator', sr['locator'])
for g in segments:
    for f_ in ('mode', 'note'): check_quotes('segments', g['id'], f_, g.get(f_))
    check_quotes('segments', g['id'], 'source.locator', g['source'].get('locator'))
    for v in g.get('via', []) or []: check_quotes('segments', g['id'], 'via.quote', v.get('quote'))
_all_gz = {r.get('name') for pl in places for r in ([pl.get('coord_source')] if pl.get('coord_source') else []) + list(pl.get('crosscheck') or []) + list(pl.get('candidates') or []) if r and r.get('name')}
for f in findings:
    for f_ in ('title', 'text'): check_quotes('findings', f['id'], f_, f.get(f_), _all_gz)
for p in people:
    for r in p['roles']: check_quotes('people', p['id'], 'roles.role', r['role'])
    for v in p['variants']: check_quotes('people', p['id'], 'variants.form', v['form'])
    for a in p['addresses']: check_quotes('people', p['id'], 'addresses.address', a['address'])
    for c in p['characterisations']: check_quotes('people', p['id'], 'characterisations.text', c['text'])
    for a in p['institutions']: check_quotes('people', p['id'], 'institutions.note', a.get('note'))
    for f_ in ('identity_note', 'pi_characterisation'): check_quotes('people', p['id'], f_, p.get(f_))
for o in offices: check_quotes('offices', o['id'], 'note', o.get('note'))
for i in institutions:
    for a in i.get('attestations', []): check_quotes('institutions', i['id'], 'attestations', a)
    check_quotes('institutions', i['id'], 'note', i.get('note'))
for pb_ in published:
    for e in pb_['excerpts']: check_quotes('published', pb_['id'], 'excerpts.text', e['text'])
    check_quotes('published', pb_['id'], 'note', pb_.get('note'))
for d in docs: check_quotes('documents', d['id'], 'note', d.get('note'))
for e in timeline: check_quotes('timeline', e['id'], 'note', e.get('note'))
for e in edges:
    if e['kind'] != 'correspondence': check_quotes('network', e['id'], 'label', e.get('label'))
    check_quotes('network', e['id'], 'note', e.get('note'))
for e in funding_edges: check_quotes('funding', e['id'], 'note', e.get('note'))
for cv in FU.CAVEATS: check_quotes('funding', 'caveats', 'caveat', cv)
for v in views:
    for cv in v['caveats']: check_quotes('network', v['id'], 'caveat', cv)
meta['counts']['verified_quotations'] = verified_quotations
meta['counts']['funding_edges'] = len(funding_edges)
meta['counts']['coattestation_pairs'] = len(pairs)
meta['counts']['mention_edges'] = len(mention_edges)
meta['quotation_classes'] = {
    'tie evidence': 'every quotation on a stated / PI / affiliation tie is found verbatim in the sources (build fails otherwise)',
    'funding': 'every funding edge quotes a sum or promise verbatim',
    'Tale excerpts': 'every story excerpt is an exact substring of the Tale and ends at a sentence or quotation boundary',
    'Cast lines and characterisations': "every pi_characterisation and characterisation is a verbatim line of the PI's texts",
    'quoted fragments in authored prose': f"{verified_quotations} quoted spans in model notes, place/stop/segment fields, findings, roles, variants, addresses, institutions, published excerpts and notes, tie labels, and record notes are verified (allow-list of quoted vocabulary, none of it currently needed: {', '.join(sorted(QUOTED_TERMS))})",
}

DATA = dict(meta=meta, documents=docs, people=people, offices=offices, institutions=institutions, places=places, stops=stops, segments=segments, context_arcs=context_arcs, stories=stories, timeline=timeline, itinerary=itinerary, tale=tale, tale_footnotes=footnotes, cast=cast, network=network, published=published, findings=findings)

if errors:
    print('BUILD FAILED with %d problem(s):' % len(errors))
    for e in errors: print(' -', e)
    sys.exit(1)

# ----------------------------------------------------------------------------- 12. write
for name in ['documents', 'people', 'offices', 'institutions', 'places', 'stops', 'segments', 'context_arcs', 'stories', 'timeline', 'itinerary', 'tale', 'tale_footnotes', 'cast', 'network', 'published', 'findings', 'meta']:
    json.dump(DATA[name], open(os.path.join(OUT, f'{name}.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
with open(os.path.join(OUT, 'bundle.js'), 'w', encoding='utf-8') as fh:
    fh.write('// Generated by scripts/build_data.py — do not edit by hand. Same content as data/*.json.\n')
    fh.write('window.JOURNEYS_DATA = ' + json.dumps(DATA, ensure_ascii=False) + ';\n')

def write_csv(name, rows, cols):
    with open(os.path.join(OUT, 'csv', name + '.csv'), 'w', encoding='utf-8', newline='') as fh:
        w = csv.writer(fh); w.writerow(cols)
        for r in rows: w.writerow([r.get(c, '') if not isinstance(r.get(c), (list, dict)) else json.dumps(r.get(c), ensure_ascii=False) for c in cols])
write_csv('places', places, ['id', 'label', 'short_label', 'lat', 'lon', 'tier', 'precision', 'status', 'naming', 'radius_km', 'role', 'attested', 'coord_source', 'crosscheck', 'gnis_note', 'distance_check', 'why', 'unlocated_kind', 'constraints', 'candidates', 'candidates_note', 'scope', 'mentioned_only', 'stops', 'stories'])
write_csv('stops', stops, ['id', 'journey', 'seq', 'place', 'label', 'date_start', 'date_end', 'date_text', 'date_precision', 'status', 'naming', 'story', 'sources', 'why'])
write_csv('segments', segments, ['id', 'journey', 'frm', 'to', 'via', 'mode', 'mode_status', 'geometry', 'source', 'note'])
write_csv('documents', docs, ['id', 'order', 'date', 'date_text', 'precision', 'title', 'senders', 'recipients', 'form', 'place', 'archive', 'enclosed_in', 'enclosures', 'block_counts', 'word_count', 'mentions', 'stories', 'timeline', 'note'])
blocks_rows = [dict(doc=d['id'], block=b['id'], type=b['type'], speaker=b['speaker'], text=b['text']) for d in docs for b in d['blocks']]
write_csv('document_blocks', blocks_rows, ['doc', 'block', 'type', 'speaker', 'text'])
write_csv('people', people, ['id', 'label', 'kind', 'scope', 'variants', 'roles', 'characterisations', 'addresses', 'institutions', 'identity_note', 'pi_characterisation', 'sent', 'received', 'mentioned_in', 'findings'])
write_csv('institutions', institutions, ['id', 'label', 'kind', 'place', 'place_status', 'attestations', 'note'])
write_csv('network_edges', edges, ['id', 'source', 'target', 'kind', 'directed', 'label', 'date', 'doc', 'evidence', 'evidence_kind', 'affiliation_status', 'note'])
write_csv('funding', funding_edges, ['id', 'source', 'target', 'kind', 'amount_as_written', 'status', 'date', 'doc', 'quote', 'note'])
write_csv('network_pairs', pairs, ['a', 'b', 'correspondence', 'stated', 'pi', 'n_kinds', 'n_edges', 'edges', 'derived'])
write_csv('network_mentions', mention_edges, ['id', 'source', 'target', 'kind', 'doc', 'date', 'derived'])
write_csv('network_nodes', nodes, ['id', 'label', 'type', 'kind', 'scope', 'metrics'])
write_csv('timeline', timeline, ['id', 'order', 'date', 'stream', 'text', 'docs', 'stops', 'stories', 'findings', 'note'])
write_csv('itinerary', itinerary, ['id', 'date', 'text', 'source'])
write_csv('findings', findings, ['id', 'kind', 'title', 'text', 'refs', 'stories', 'stops', 'places', 'people', 'related'])
write_csv('published', published, ['id', 'short', 'citation_as_given', 'author', 'year', 'type', 'cited_in', 'note', 'excerpts'])
write_csv('stories', stories, ['id', 'order', 'phase', 'title', 'subtitle', 'places', 'stops', 'docs', 'people', 'published', 'findings', 'model_note'])

DD = f"""# Data dictionary — The Quackenbush Journeys, 1907–1908

Built {meta['built']} by `scripts/build_data.py` from the five files supplied by the Mammoth History Lab
(SHA-256 in `data/source/input_files_sha256.jsonl`). Every table is exported as JSON (`data/*.json`) and CSV
(`data/csv/*.csv`); `data/bundle.js` carries the same content for the interface. Lists and objects inside CSV
cells are JSON-encoded.

## Authorship (whose prose, whose transcription, what the model did)
{chr(10).join('- **' + k + '** — ' + v for k, v in meta['authorship'].items())}

## Block types (documents.blocks[].type) — rendered differently in the Archive reader
{chr(10).join('- `' + k + '` — ' + v for k, v in meta['block_types'].items())}

## Source-status chips (places.status, stops.status) and the `naming` flag
{chr(10).join('- `' + k + '` — ' + v for k, v in meta['status_chips'].items())}

## Unlocated places (places.unlocated_kind) — the three silences kept apart
{chr(10).join('- `' + k + '` — ' + v for k, v in meta['unlocated_kinds'].items())}

## Constraints on unlocated places (places.constraints[].kind) — drawn without asserting a point
{chr(10).join('- `' + k + '` — ' + v for k, v in meta['constraint_kinds'].items())}

## Geocoding hierarchy (places.tier)
{chr(10).join('- tier ' + str(k) + ' — ' + v for k, v in meta['geocoding_tiers'].items())}

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
institution and `evidence` {ref, quote} carries the verified quotation; `inferred` = the model's reading of context, with a
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
`speaker`, `footnotes[]` = the PI's footnotes `{{n, html}}` whose markers fall inside the excerpt, so that a quoted sentence keeps its note);
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
  `status` promised | paid | acknowledged | requested | budgeted | ceiling | offered, `date`, `doc`, `quote` verified verbatim, `note`). No total is computed anywhere. Rule: {funding["rule"]}
- `pairs[]` — co-attestation, **derived**: for every unordered pair of nodes joined by at least one non-affiliation edge, the counts
  per kind (`correspondence`, `stated`, `pi`), `n_kinds`, `n_edges` and the edge ids. Rule: {coattestation["rule"]} Caveat: {coattestation["caveat"]}
- `mentions` — **derived** name-mention layer: `edges[]` sender → person named in the text of the item (`doc`, `date`), from
  `documents[].mentions`; `method` states the matching guards. Rule: {mentions_layer["rule"]}

### published
Sources as CITED in the provided files (`citation_as_given`); `excerpts[]` are passages quoted inside the provided files;
no record was completed from outside knowledge; no full text was provided.

### findings
Register of `discrepancy`, `absence`, `naming`, `unlocated`, `authorship` findings with `refs` and the records they concern
(`stories`, `stops`, `places`, `people`); `related[]` links findings that bear on the same question.

## Verified quotation classes (meta.quotation_classes)
{chr(10).join('- **' + k + '** — ' + v for k, v in meta['quotation_classes'].items())}

`meta.counts.verified_quotations` = {meta['counts']['verified_quotations']} quoted fragments verified in this build; the build fails on any miss.
"""
open(os.path.join(OUT, 'DATA_DICTIONARY.md'), 'w', encoding='utf-8').write(DD)
print('BUILD OK', json.dumps(meta['counts']))
