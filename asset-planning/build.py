#!/usr/bin/env python3
"""Monta o Asset Planning a partir de src/.

  dist/asset-planning.html        fragmento de artefato (CDN para Chart.js e html2pdf, fontes do Google)
  dist/asset-planning.local.html  página completa com as bibliotecas embutidas, para testes locais
                                  (precisa de vendor/package e vendor/h2p/package: veja o README)
"""
import os
here = os.path.dirname(os.path.abspath(__file__))
src = os.path.join(here, 'src')
dist = os.path.join(here, 'dist')
os.makedirs(dist, exist_ok=True)
def rd(p, base=src): return open(os.path.join(base, p), encoding='utf-8').read()

MODULES = ['engine.js', 'irpf.js', 'planning.js', 'goals.js', 'debt.js', 'protection.js', 'succession.js', 'versions.js', 'app.js']
css, body = rd('style.css'), rd('body.html')
js = "\n".join(rd(m) for m in MODULES)

FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,450;9..144,560;9..144,650&family=Public+Sans:wght@400;500;600;700&display=swap">'
CHART = '<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js"></script>'
H2P = '<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>'

artifact = "<title>Asset Planning</title>\n" + FONTS + "\n<style>\n" + css + "\n</style>\n\n" + body + "\n\n" + CHART + "\n" + H2P + "\n<script>\n" + js + "\n</script>\n"
open(os.path.join(dist, 'asset-planning.html'), 'w', encoding='utf-8').write(artifact)

def vread(p):
    f = os.path.join(here, 'vendor', p)
    return open(f, encoding='utf-8').read() if os.path.exists(f) else None
chart_js, h2p_js = vread('package/dist/chart.umd.js'), vread('h2p/package/dist/html2pdf.bundle.min.js')
local = "<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>\n<title>Asset Planning</title>\n<style>\n" + css + "\n</style></head><body>\n" + body + "\n"
local += ("<script>" + chart_js + "</script>\n") if chart_js else "<script>window.Chart=function(){};</script>\n"
if h2p_js: local += "<script>" + h2p_js + "</script>\n"
local += "<script>\n" + js + "\n</script>\n</body></html>"
open(os.path.join(dist, 'asset-planning.local.html'), 'w', encoding='utf-8').write(local)
print("dist/asset-planning.html:", len(artifact), "bytes | local:", len(local), "bytes | chart.js:", bool(chart_js), "| html2pdf:", bool(h2p_js))
