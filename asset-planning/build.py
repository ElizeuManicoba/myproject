#!/usr/bin/env python3
"""Monta o Asset Planning a partir de src/.

  dist/asset-planning.html        fragmento para artefato do claude.ai (Chart.js e html2pdf por CDN)
  dist/asset-planning.local.html  página completa e autônoma (tudo embutido), usada pelos testes de navegador
  ../docs/                        site estático para o GitHub Pages (pasta /docs na raiz do repositório): app instalável (PWA), sem dependências externas
"""
import hashlib, json, os, shutil
here = os.path.dirname(os.path.abspath(__file__))
root = os.path.dirname(here)  # raiz do repositório: o GitHub Pages só publica a raiz ou a pasta /docs dela
src, dist = (os.path.join(here, d) for d in ('src', 'dist'))
docs = os.path.join(root, 'docs')
assets = os.path.join(src, 'assets')
for d in (dist, docs): os.makedirs(d, exist_ok=True)
def rd(p, base=src): return open(os.path.join(base, p), encoding='utf-8').read()
def wr(p, s, base=here):
    full = os.path.join(base, p); os.makedirs(os.path.dirname(full), exist_ok=True)
    open(full, 'w', encoding='utf-8').write(s)

MODULES = ['engine.js', 'irpf.js', 'planning.js', 'goals.js', 'debt.js', 'protection.js', 'succession.js', 'versions.js', 'synthesis.js', 'app.js']
MODULES = [m for m in MODULES if os.path.exists(os.path.join(src, m))]
css, body = rd('style.css'), rd('body.html')
js = "\n".join(rd(m) for m in MODULES)
BUILD = hashlib.sha256((css + body + js).encode('utf-8')).hexdigest()[:10]

# ---------- 1) fragmento do artefato ----------
FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,450;9..144,560;9..144,650&family=Public+Sans:wght@400;500;600;700&display=swap">'
CHART = '<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js"></script>'
H2P = '<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>'
artifact = "<title>Asset Planning</title>\n" + FONTS + "\n<style>\n" + css + "\n</style>\n\n" + body + "\n\n" + CHART + "\n" + H2P + "\n<script>\n" + js + "\n</script>\n"
wr('dist/asset-planning.html', artifact)

# ---------- 2) página autônoma para testes ----------
chart_js, h2p_js = rd('chart.umd.min.js', assets), rd('html2pdf.bundle.min.js', assets)
local = "<!doctype html><html lang='pt-BR'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>\n<title>Asset Planning</title>\n<meta name='build-id' content='" + BUILD + "'>\n<style>\n" + css + "\n</style></head><body>\n" + body + "\n<script>" + chart_js + "</script>\n<script>" + h2p_js + "</script>\n<script>\n" + js + "\n</script>\n</body></html>"
wr('dist/asset-planning.local.html', local)

# ---------- 3) site para o GitHub Pages ----------
shutil.rmtree(os.path.join(docs, 'assets'), ignore_errors=True)
os.makedirs(os.path.join(docs, 'assets'), exist_ok=True)
for name in ('chart.umd.min.js', 'html2pdf.bundle.min.js', 'icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'):
    shutil.copy(os.path.join(assets, name), os.path.join(docs, 'assets', name))
shutil.copytree(os.path.join(assets, 'fonts'), os.path.join(docs, 'assets', 'fonts'))
shutil.copytree(os.path.join(assets, 'licenses'), os.path.join(docs, 'assets', 'licenses'))

fontface = ('@font-face{font-family:"Fraunces";src:url(fonts/fraunces-opsz.woff2) format("woff2");font-weight:100 900;font-style:normal;font-display:swap}\n'
            '@font-face{font-family:"Public Sans";src:url(fonts/public-sans.woff2) format("woff2");font-weight:100 900;font-style:normal;font-display:swap}\n')
wr('assets/app.css', fontface + css, docs)
wr('assets/app.js', js + "\n", docs)

CSP = ("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; "
       "connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'")
index = f'''<!doctype html>
<html lang="pt-BR" data-host="pages">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="{CSP}">
<meta name="build-id" content="{BUILD}">
<meta name="robots" content="noindex,nofollow">
<meta name="theme-color" content="#f2f4ee" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#131512" media="(prefers-color-scheme: dark)">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Asset Planning">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<title>Asset Planning</title>
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="assets/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="assets/apple-touch-icon.png">
<link rel="stylesheet" href="assets/app.css">
</head>
<body>
{body}
<script src="assets/chart.umd.min.js"></script>
<script src="assets/html2pdf.bundle.min.js"></script>
<script src="assets/app.js"></script>
</body>
</html>
'''
wr('index.html', index, docs)
wr('manifest.webmanifest', json.dumps({
    "name": "Asset Planning", "short_name": "Asset Planning", "lang": "pt-BR",
    "description": "Planejamento financeiro e tributário: diagnóstico, objetivos, aposentadoria, proteção, sucessão e plano de ação.",
    "start_url": "./", "scope": "./", "display": "standalone", "background_color": "#f2f4ee", "theme_color": "#8a5a1e",
    "icons": [
        {"src": "assets/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
        {"src": "assets/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
        {"src": "assets/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}]
}, ensure_ascii=False, indent=2) + "\n", docs)
shell = ["./", "index.html", "manifest.webmanifest", "assets/app.css", "assets/app.js", "assets/chart.umd.min.js", "assets/html2pdf.bundle.min.js",
         "assets/icon.svg", "assets/icon-192.png", "assets/icon-512.png", "assets/apple-touch-icon.png", "assets/fonts/fraunces-opsz.woff2", "assets/fonts/public-sans.woff2"]
wr('sw.js', rd('pwa/sw.template.js').replace('__BUILD_ID__', BUILD).replace('__SHELL__', json.dumps(shell)), docs)
wr('.nojekyll', '', docs)
wr('robots.txt', 'User-agent: *\nDisallow: /\n', docs)
print(f"build {BUILD} | artefato {len(artifact)//1024} KB | autônomo {len(local)//1024} KB | ../docs/assets/app.js {len(js)//1024} KB")
