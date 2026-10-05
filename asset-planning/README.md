# Asset Planning

Painel de planejamento financeiro em um único arquivo HTML: diagnóstico patrimonial, objetivos, caixa e
dívidas, proteção, aposentadoria (fases, IR no resgate, Monte Carlo), sucessão, IRPF/PGBL, plano de ação e
versões. Tudo roda no navegador; os dados ficam no `localStorage` e saem por backup em arquivo.

## Estrutura

    src/          código-fonte (CSS, HTML do corpo e módulos JS puros + app.js com a interface)
    tests/        testes unitários em Node (sem dependências) e testes de navegador (Playwright)
    dist/         saída do build (asset-planning.html é o fragmento publicável)
    build.py      monta dist/ a partir de src/

Os módulos de cálculo (`engine`, `irpf`, `planning`, `goals`, `debt`, `protection`, `succession`, `versions`)
não tocam o DOM e funcionam em Node. Valores em R$ de hoje (poder de compra constante).

## Build e testes

    python3 build.py
    for t in core planning phase2 mc phase3; do node tests/test_$t.js | tail -1; done

Testes de navegador (precisam de Playwright e de `vendor/`, que traz Chart.js e html2pdf localmente):

    mkdir -p vendor && cd vendor
    npm pack chart.js@4.4.0 && mkdir -p package && tar xzf chart.js-4.4.0.tgz
    mkdir -p h2p && (cd h2p && npm pack html2pdf.js@0.10.1 && tar xzf html2pdf.js-0.10.1.tgz)
    cd .. && python3 build.py
    NODE_PATH=$(npm root -g) node tests/browser/functional.js

## Avisos

Material educativo e de apoio ao planejamento. Tabelas do IRPF e alíquotas de ITCMD são estimativas de
fontes secundárias: valide antes de usar com clientes. Nenhum módulo recomenda produto ou valor mobiliário.
