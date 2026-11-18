# -*- coding: utf-8 -*-
"""Produce dist/quackenbush-journeys-standalone.html: index.html with data/bundle.js inlined,
so the whole site travels as one file (external map tiles, fonts and libraries still load from the web)."""
import os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
bundle = open(os.path.join(ROOT, 'data', 'bundle.js'), encoding='utf-8').read().replace('</script', '<\\/script')
html = html.replace('<script src="data/bundle.js"></script>', '<script>\n' + bundle + '\n</script>')
html = html.replace('href="data/', 'href="https://github.com/kadirselamet5-web/journeys/blob/claude/quackenbush-alaska-maps-f7gnj6/data/')
os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
out = os.path.join(ROOT, 'dist', 'quackenbush-journeys-standalone.html')
open(out, 'w', encoding='utf-8').write(html)
print('wrote', out, len(html), 'bytes')
