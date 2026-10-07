# Hospedagem gratuita no GitHub Pages, no seu domínio

O site pronto para publicar fica na pasta **`docs/`, na raiz do repositório** (o GitHub Pages só publica a raiz ou
essa pasta; o `build.py` grava lá). O endereço final é um subdomínio do seu domínio:

    https://assetplanning.elizeumanicoba.com.br

O site principal (`elizeumanicoba.github.io`, com o domínio `elizeumanicoba.com.br`) **não é alterado**: ele é gerado
e publicado por outro fluxo automático, e a ferramenta fica no repositório `myproject`, com o próprio endereço.

## 1. Publicar (uma única vez, uns 10 minutos; a ordem importa)

1. **DNS primeiro.** No painel onde o DNS de `elizeumanicoba.com.br` é gerenciado (Registro.br, Cloudflare, Hostinger
   ou outro), crie um registro:

   | Tipo | Nome (host) | Valor |
   |------|-------------|-------|
   | CNAME | `assetplanning` | `elizeumanicoba.github.io` |

   Se o painel pedir o nome completo, use `assetplanning.elizeumanicoba.com.br`. No Cloudflare, deixe a nuvem
   **cinza** ("somente DNS"), pelo menos até o certificado sair.
2. No GitHub, abra o repositório `myproject` → **Settings → Pages**.
3. Em **Build and deployment → Source**, escolha **Deploy from a branch**; em **Branch**, `master` e a pasta
   **`/docs`**. Clique em **Save**.
4. Em **Custom domain**, confirme `assetplanning.elizeumanicoba.com.br` (o arquivo `docs/CNAME` já o traz) e salve.
   O GitHub verifica o DNS; pode levar de alguns minutos até algumas horas.
5. Quando aparecer a opção, marque **Enforce HTTPS** (o certificado é emitido sozinho).
6. Abra `https://assetplanning.elizeumanicoba.com.br`. A primeira tela é a **Abertura da reunião**.

Se o passo 4 mostrar "DNS check unsuccessful", o registro CNAME ainda não propagou ou está com o nome errado.
Enquanto o DNS não aponta, o endereço do GitHub (`elizeumanicoba.github.io/myproject/`) também não abre, porque o
`CNAME` manda para o domínio. Faça o passo 1 antes.

**Proteção contra sequestro de subdomínio (recomendado):** em **github.com → Settings (da conta) → Pages → Add a
domain**, verifique `elizeumanicoba.com.br` com o registro TXT que o GitHub mostrar. Assim ninguém consegue
publicar páginas no seu domínio por outro repositório.

No plano gratuito do GitHub, o Pages exige repositório **público** (este já é).

## 2. Usar no celular e no tablet

- **iPhone/iPad (Safari):** Compartilhar → **Adicionar à Tela de Início**. Abra sempre pelo ícone: o Safari apaga os
  dados de sites sem uso por 7 dias, e o app instalado não tem esse limite.
- **Android (Chrome):** menu ⋮ → **Instalar app** (ou o botão “Instalar como aplicativo” na tela Abertura).
- **Computador (Chrome/Edge):** ícone de instalar na barra de endereço.
- Depois do primeiro acesso o app funciona **sem internet** (reuniões em locais sem sinal).

## 3. Seus dados e os dos clientes

- O endereço é público: o GitHub Pages não tem senha. Mas **nenhum dado de cliente vai para o GitHub nem para o
  site**: tudo fica no navegador de cada aparelho. Quem abrir o link vê só a ferramenta, com dados de exemplo.
  A página pede aos buscadores para não ser listada; evite colocar um link para ela no site principal. Um subdomínio
  com HTTPS aparece em registros públicos de certificados, então ele não é secreto.
- O subdomínio é uma origem separada do site principal. O navegador guarda os dados do app por origem, então o site
  `elizeumanicoba.com.br` e seus scripts não conseguem ler os planos salvos pela ferramenta.
- Cada aparelho e cada navegador têm os próprios dados. Para levar um plano do notebook ao celular:
  **Abertura → Seus dados e backup → Salvar backup agora (.json)**; no outro aparelho, em
  **Aposentadoria → Backup e privacidade**, cole o texto do arquivo em **Colar para restaurar**.
  A Abertura lembra quando passam 14 dias sem backup.
- **Nunca coloque no repositório** backups `.json` nem PDFs de clientes: o repositório é público. O `.gitignore`
  já ignora `asset-planning-backup*.json` e `*.pdf`.
- Faça um backup ao fim de cada reunião, depois do aceite do IPS. Limpar o histórico do navegador apaga os dados.

## 4. Atualizar o site

    python3 build.py
    git add -A && git commit -m "Atualiza o app" && git push

O Pages republica sozinho em poucos minutos. Quem tem o app aberto ou instalado recebe o aviso *“Nova versão do app
instalada. Recarregue a página”*. Os dados salvos não são afetados.

## 5. Se precisar de acesso restrito

O Pages gratuito é sempre público. Para exigir login: **Cloudflare Access** (grátis até 50 usuários; exige o DNS
do domínio na Cloudflare) com a ferramenta no Cloudflare Pages, ou **Netlify**/**Vercel** com proteção por senha
(alguns recursos são pagos). O conteúdo de `docs/` funciona em qualquer hospedagem estática, sem alteração. Também
é possível criptografar o app com senha no próprio navegador; isso protege o código da ferramenta, não os dados
(que já ficam locais).

## Problemas comuns

- **Página 404:** confira branch `master` e pasta `/docs` em Settings → Pages e aguarde alguns minutos.
- **"DNS check unsuccessful":** confira o registro CNAME (nome `assetplanning`, valor `elizeumanicoba.github.io`, sem
  barra nem `https://`) e aguarde a propagação.
- **Página antiga depois de atualizar:** recarregue duas vezes ou feche e abra o app instalado.
- **Os dados sumiram:** vieram de outro navegador/aparelho ou o histórico foi limpo. Restaure o último backup.
