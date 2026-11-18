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
from authored import documents_meta as DM, people as PP, places as PL, journeys as JJ, network as NW, published as PB, findings as FD, stories as ST, timeline_links as TL

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
    for a, b in [('“', '"'), ('”', '"'), ('‘', "'"), ('’', "'"), ('—', '-'), ('–', '-'), ('---', '-'), ('--', '-'), ('…', '...'), (' ', ' ')]:
        s = s.replace(a, b)
    s = re.sub(r'\s+', ' ', s)
    return s.strip().lower()

ALL_PLAIN = norm(tale_txt + '\n' + '\n'.join(p['plain'] for f in files for p in f['paragraphs'] if not p['empty']))
def quote_exists(q):
    return norm(q) in ALL_PLAIN

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
    people.append(q)
offices = [dict(o) for o in PP.OFFICES]
institutions = [dict(i) for i in PP.INSTITUTIONS]
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
    if re.search(r'\bMat?thews', text):
        found.add('p_mathews_jf' if (d.get('year') or 0) >= 1914 else 'p_matthew')
    # a few surnames that the variant forms miss
    for surname, who in [('Quackenbush', 'p_quackenbush'), ('Bumpus', 'p_bumpus'), ('Osborn', 'p_osborn'), ('Grant', 'p_grant'), ('Meany', 'p_meany'), ('Meaney', 'p_meany'), ('Startsman', 'p_startsman'), ('Graham', 'p_graham'), ('Rathbun', 'p_rathbun'), ('Pyne', 'p_pyne_percy'), ('Morgan', 'p_morgan'), ('Sherwood', 'p_sherwood'), ('Hoffman', 'p_hoffman'), ('Chilberg', 'p_chilberg'), ('Reed', 'p_reed'), ('Anderson', 'p_anderson'), ('Stone', 'p_stone'), ('Jesup', 'p_jesup'), ('Lucas', 'p_lucas'), ('Maddren', 'p_maddren'), ('Gilmore', 'p_gilmore'), ('Merriam', 'p_merriam'), ('Granger', 'p_granger'), ('Beechey', 'p_beechey'), ('Quinn', 'p_quinn')]:
        if re.search(r'(?<![\w])' + surname + r'(?![\w])', text):
            if surname == 'Lucas' and (d.get('year') or 0) < 1910: found.add('p_lucas_brooklyn_1907'); continue
            if surname == 'Pyne' and 'Momo' in text: found.add('p_pyne_mt')
            found.add(who)
    d['mentions'] = sorted(found - set(d.get('senders', [])) - set(d.get('recipients', [])))
    d['mentions_method'] = 'automatic name-variant match on the transcription text (model); senders and recipients excluded'

# ----------------------------------------------------------------------------- 3. places
places = []
for pl in PL.PLACES:
    q = dict(pl)
    q['attested'] = [dict(form=a, source=b) for a, b in pl['attested']]
    q['has_coords'] = q.get('lat') is not None
    q.setdefault('scope', 'hunt'); q.setdefault('mentioned_only', False); q.setdefault('crosscheck', [])
    places.append(q)
plid = {p['id'] for p in places}

# ----------------------------------------------------------------------------- 4. stops / segments
stops = []
for s in JJ.STOPS:
    q = dict(s); q['sources'] = [dict(ref=a, locator=b) for a, b in s['sources']]
    if q['place'] not in plid: err(f"stop {q['id']} -> unknown place {q['place']}")
    stops.append(q)
sid = {s['id'] for s in stops}
segments = []
for g in JJ.SEGMENTS:
    q = dict(g); q['source'] = dict(ref=g['source'][0], locator=g['source'][1])
    for k in ('frm', 'to'):
        if q[k] not in sid: err(f"segment {q['id']} -> unknown stop {q[k]}")
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

# ----------------------------------------------------------------------------- 6. stories
stories = []
for s in ST.STORIES:
    q = dict(s)
    ex = []
    for e in s['tale_excerpts']:
        pid_ = find_tale_para(e)
        if not pid_: err(f"story {s['id']}: Tale excerpt not found verbatim: {e[:80]}…")
        ex.append(dict(text=e, para=pid_, speaker='principal investigator (Tale of Two Mammoths, 2019), verbatim'))
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
for s in stops:
    for sr in s['sources']:
        if sr['ref'] not in doc_by_id and sr['ref'] not in pubid and sr['ref'] not in ('tale', 'pi_timeline'): err(f"stop {s['id']}: unknown source {sr['ref']}")

# ----------------------------------------------------------------------------- 8. network
edges = []
for d in docs:
    for s_ in d.get('senders', []):
        for r_ in d.get('recipients', []):
            edges.append(dict(source=s_, target=r_, kind='correspondence', directed=True, label='wrote to', date=d.get('date'), doc=d['id'], evidence=[dict(ref=d['id'], quote=d['title'])]))
for t in NW.TIES:
    for ref, q in t['evidence']:
        if ref not in doc_by_id and ref not in ('tale', 'cast', 'pi_timeline'): err(f"tie {t['source']}->{t['target']}: unknown ref {ref}")
        if not quote_exists(q): err(f"tie {t['source']}->{t['target']}: quote not found: {q[:70]}")
    for k in ('source', 'target'):
        if t[k] not in pid: err(f"tie: unknown node {t[k]}")
    edges.append(dict(source=t['source'], target=t['target'], kind=t['kind'], directed=t['directed'], label=t['label'], date=None, doc=None, evidence=[dict(ref=a, quote=b) for a, b in t['evidence']]))
for p in people:
    for inst in p.get('institutions', []):
        if inst not in pid: err(f"person {p['id']}: unknown institution {inst}")
        edges.append(dict(source=p['id'], target=inst, kind='affiliation', directed=True, label='affiliated (as attested in roles)', date=None, doc=None, evidence=[dict(ref='roles', quote=r['role'] + ' — ' + r['source']) for r in p['roles'] if True][:3]))
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
network = dict(nodes=nodes, edges=edges, rules={
    'correspondence': 'One directed edge per archival item from each named sender to each named recipient. Copies, drafts, telegrams, excerpts, enclosures and form slips all count as attestations that A wrote to B. Offices (o_*) stand for unnamed signers.',
    'stated': 'A relation asserted inside a document by its writer (partner, friend, officer of the same company, familiar salutation, recommendation, request). Each edge carries the quotation that asserts it.',
    'pi': "A relation asserted in the principal investigator's own writing (Cast of Characters, Tale §3, timeline summaries). Kept separate because it is interpretation, not attestation.",
    'affiliation': 'Person to institution, derived from the roles recorded in the prosopography (each role cites its source).',
    'exclusions': 'No tie is inferred from co-mention, shared location, or outside knowledge. Mentions are indexed per document but are not edges.'
})

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
    status_chips={'verified': 'attested name matched to an authoritative gazetteer record', 'inferred': 'identification or date is a model inference from the described route or sequence', 'approximate': "placed from Quackenbush's distance/direction statements or a described relation to a named feature", 'disputed': 'provided sources disagree', 'unlocated': 'cannot be placed from the sources'},
    geocoding_tiers={1: 'published coordinates in the sources — none exist', 2: 'authoritative gazetteers (GNIS, CGNDB, GeoNames; Wikidata cross-check)', 3: 'historical maps/charts — none available (1906 Post Route Map not provided)', 4: "Quackenbush's distance/direction statements", 5: 'approximate placement with large uncertainty radius'},
)

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
write_csv('places', places, ['id', 'label', 'lat', 'lon', 'tier', 'precision', 'status', 'radius_km', 'role', 'attested', 'coord_source', 'crosscheck', 'gnis_note', 'distance_check', 'why', 'scope', 'mentioned_only', 'stops', 'stories'])
write_csv('stops', stops, ['id', 'journey', 'seq', 'place', 'label', 'date_start', 'date_end', 'date_text', 'date_precision', 'status', 'story', 'sources', 'why'])
write_csv('segments', segments, ['id', 'journey', 'frm', 'to', 'mode', 'mode_status', 'geometry', 'source', 'note'])
write_csv('documents', docs, ['id', 'order', 'date', 'date_text', 'precision', 'title', 'senders', 'recipients', 'form', 'place', 'archive', 'enclosed_in', 'enclosures', 'block_counts', 'word_count', 'mentions', 'stories', 'timeline', 'note'])
blocks_rows = [dict(doc=d['id'], block=b['id'], type=b['type'], speaker=b['speaker'], text=b['text']) for d in docs for b in d['blocks']]
write_csv('document_blocks', blocks_rows, ['doc', 'block', 'type', 'speaker', 'text'])
write_csv('people', people, ['id', 'label', 'kind', 'scope', 'variants', 'roles', 'addresses', 'institutions', 'identity_note', 'pi_characterisation', 'sent', 'received', 'mentioned_in'])
write_csv('institutions', institutions, ['id', 'label', 'kind', 'place', 'attestations', 'note'])
write_csv('network_edges', edges, ['id', 'source', 'target', 'kind', 'directed', 'label', 'date', 'doc', 'evidence'])
write_csv('network_nodes', nodes, ['id', 'label', 'type', 'kind', 'scope', 'metrics'])
write_csv('timeline', timeline, ['id', 'order', 'date', 'stream', 'text', 'docs', 'stops', 'stories', 'findings', 'note'])
write_csv('itinerary', itinerary, ['id', 'date', 'text', 'source'])
write_csv('findings', findings, ['id', 'kind', 'title', 'text', 'refs', 'stories', 'stops', 'places'])
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

## Source-status chips (places.status, stops.status)
{chr(10).join('- `' + k + '` — ' + v for k, v in meta['status_chips'].items())}

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
"""
open(os.path.join(OUT, 'DATA_DICTIONARY.md'), 'w', encoding='utf-8').write(DD)
print('BUILD OK', json.dumps(meta['counts']))
