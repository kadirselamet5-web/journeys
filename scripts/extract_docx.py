"""Extract the PI's transcription .docx into paragraphs with inline formatting preserved as HTML.
Formatting carried: bold, italic, underline, strike, superscript, font colour (red/blue/purple/magenta),
paragraph indentation (block quotes). Output: list of {plain, html, bold_all, underline_all, indent, colors}."""
import sys, json, re
from docx import Document
from docx.shared import RGBColor

def run_html(r):
    t = r.text
    if not t: return ''
    t = t.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')
    f = r.font
    col = None
    try:
        if f.color is not None and f.color.type is not None and f.color.rgb is not None:
            col = str(f.color.rgb)
    except Exception: col = None
    if f.superscript: t = f'<sup>{t}</sup>'
    if f.subscript: t = f'<sub>{t}</sub>'
    if f.strike or f.double_strike: t = f'<s>{t}</s>'
    if r.italic: t = f'<em>{t}</em>'
    if r.underline: t = f'<u>{t}</u>'
    if r.bold: t = f'<b>{t}</b>'
    if col and col not in ('000000','auto'):
        t = f'<span data-color="{col}">{t}</span>'
    return t

out = []
for path in sys.argv[1:]:
    doc = Document(path)
    paras = []
    for p in doc.paragraphs:
        runs = p.runs
        plain = ''.join(r.text for r in runs)
        if not plain.strip():
            paras.append({'plain':'', 'html':'', 'empty':True}); continue
        html = ''.join(run_html(r) for r in runs)
        nonempty = [r for r in runs if r.text.strip()]
        bold_all = all(bool(r.bold) for r in nonempty) if nonempty else False
        ul_all = all(bool(r.underline) for r in nonempty) if nonempty else False
        colors = sorted({str(r.font.color.rgb) for r in nonempty if r.font.color is not None and r.font.color.type is not None and r.font.color.rgb is not None} - {'000000'})
        ind = p.paragraph_format.left_indent
        indent = int(ind.pt) if ind is not None else 0
        paras.append({'plain':plain, 'html':html, 'bold_all':bold_all, 'underline_all':ul_all, 'indent':indent, 'colors':colors, 'style':p.style.name, 'empty':False})
    out.append({'file': path.split('/')[-1], 'paragraphs': paras})
    print(path.split('/')[-1], len(paras), 'paragraphs;', sum(1 for x in paras if x.get('bold_all') and x.get('underline_all')), 'bold+underlined header-like')
json.dump(out, open('../docx_rich.json','w'), ensure_ascii=False, indent=0)
