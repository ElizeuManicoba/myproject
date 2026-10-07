# Asset Planning

Ferramenta de planejamento financeiro para reuniões com clientes, em PT-BR. Segue as etapas da conversa e termina
em um diagnóstico claro, um plano de ação e um **IPS de planejamento** (o compromisso que o cliente assume).
Tudo roda no navegador; os dados ficam no aparelho (`localStorage`) e saem por backup em arquivo.

## A reunião em sete etapas

| # | Etapa | Telas | Pergunta que a etapa responde |
|---|-------|-------|-------------------------------|
| 1 | Abertura | roteiro, cliente, documentos, percepção de risco, profissional e escopo | Quem é o cliente e o que espera? |
| 2 | Diagnóstico | balanço, fluxo, reserva, indicadores, qualidade dos dados | Qual é a situação de hoje? |
| 3 | Objetivos | metas de vida | O que o cliente quer realizar e até quando? |
| 4 | Análises | caixa e dívidas, proteção, aposentadoria, sucessão | Os recursos dão conta? |
| 5 | Tributação (opcional) | IRPF mensal, IRPF anual e PGBL, PGBL no longo prazo | Há eficiência tributária a avaliar? |
| 6 | Síntese e plano | diagnóstico final, plano de ação | O que priorizar e quem faz o quê? |
| 7 | Compromisso | compromissos, IPS, aceite | O cliente assume estes compromissos? |

Versões (fotografias do plano e comparação) é um utilitário fora das etapas. O aceite do IPS guarda uma versão
automaticamente, para comparar nas revisões.

O IPS é uma declaração de política de **planejamento**: objetivos, situação, compromissos, regras de decisão e
revisão, responsabilidades, escopo e conflitos. Não escolhe investimentos nem recomenda valores mobiliários; a
seção de diretrizes de investimento só é preenchível quando o perfil indica autorização de consultor da CVM, e o
texto é sempre do consultor.

## Estrutura

    src/          código-fonte (CSS, HTML do corpo, módulos JS puros e app.js com a interface)
    tests/        testes unitários em Node (sem dependências) e de navegador (Playwright)
    dist/         saída do build: fragmento para artefato do claude.ai e página autônoma
    ../docs/      site para o GitHub Pages (app instalável, funciona sem internet), na raiz do repositório
    build.py      monta dist/ e ../docs/ a partir de src/

Módulos de cálculo (`engine`, `irpf`, `planning`, `goals`, `debt`, `protection`, `succession`, `versions`,
`synthesis`) não tocam o DOM e funcionam em Node. Valores em R$ de hoje (poder de compra constante).

## Build e testes

    python3 build.py
    for t in core planning phase2 mc phase3 synthesis; do node tests/test_$t.js | tail -1; done

Testes de navegador (precisam de Playwright e de `src/assets`, que já traz Chart.js, html2pdf e as fontes):

    NODE_PATH=$(npm root -g) node tests/browser/flow.js         # etapas, diagnóstico final, IPS e aceite
    NODE_PATH=$(npm root -g) node tests/browser/functional.js   # fases 1 e 2
    NODE_PATH=$(npm root -g) node tests/browser/functional3.js  # fase 3
    NODE_PATH=$(npm root -g) node tests/browser/pages.js        # site do GitHub Pages: CSP, offline, PWA, backup

## Hospedagem gratuita

Veja [HOSPEDAGEM.md](HOSPEDAGEM.md): publicação no GitHub Pages em `assetplanning.elizeumanicoba.com.br`, uso no celular, atualização e cuidados com os dados.

## Avisos

Material educativo e de apoio ao planejamento. Tabelas do IRPF e alíquotas de ITCMD são estimativas de fontes
secundárias: valide antes de usar com clientes. Nenhum módulo recomenda produto ou valor mobiliário.
