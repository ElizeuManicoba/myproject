# Hospedagem gratuita no GitHub Pages

O site pronto para publicar fica na pasta **`docs/`, na raiz do repositório**. O GitHub Pages só publica a raiz ou
essa pasta, por isso o `build.py` grava lá. O endereço será:

    https://elizeumanicoba.github.io/myproject/

## 1. Publicar (uma única vez, uns 3 minutos)

1. Abra o repositório no GitHub e entre em **Settings → Pages** (menu lateral, em *Code and automation*).
2. Em **Build and deployment → Source**, escolha **Deploy from a branch**.
3. Em **Branch**, escolha a branch que tem a pasta `docs/` e, ao lado, a pasta **`/docs`**. Clique em **Save**.
   - Agora: `claude/retirement-planning-tool-op40lw`.
   - Depois de mesclar na `master`: troque para `master` e mantenha `/docs`.
4. Espere de 1 a 3 minutos e recarregue a página de Settings → Pages. Aparece *“Your site is live at …”*.
5. Abra o endereço no computador e no celular. A primeira tela é a **Abertura da reunião**.

No plano gratuito do GitHub, o Pages exige repositório **público**. Se o repositório for privado, torne-o público
(Settings → General → Danger Zone → Change visibility) ou use uma das alternativas da seção 6.

## 2. Usar no celular e no tablet

- **iPhone/iPad (Safari):** Compartilhar → **Adicionar à Tela de Início**. Abra sempre pelo ícone: o Safari apaga os
  dados de sites sem uso por 7 dias, e o app instalado não tem esse limite.
- **Android (Chrome):** menu ⋮ → **Instalar app** (ou o botão “Instalar como aplicativo” na tela Abertura).
- **Computador (Chrome/Edge):** ícone de instalar na barra de endereço.
- Depois do primeiro acesso o app funciona **sem internet** (reuniões em locais sem sinal).

## 3. Seus dados e os dos clientes

- O site é público, mas **nenhum dado de cliente vai para o GitHub**: tudo fica no navegador de cada aparelho.
  Quem abrir o link vê só a ferramenta, com dados de exemplo. O site pede aos buscadores para não ser listado,
  mas quem tem o link consegue abrir.
- Cada aparelho e cada navegador têm os próprios dados. Para levar um plano do notebook ao celular:
  **Abertura → Seus dados e backup → Salvar backup agora (.json)**; no outro aparelho, em
  **Aposentadoria → Backup e privacidade**, cole o texto do arquivo em **Colar para restaurar**.
  A Abertura lembra quando passam 14 dias sem backup.
- **Nunca coloque no repositório** backups `.json` nem PDFs de clientes: o repositório é público. O `.gitignore`
  já ignora `asset-planning-backup*.json` e `*.pdf`.
- Faça um backup ao fim de cada reunião, depois do aceite do IPS. Limpar o histórico do navegador apaga os dados.
- Todos os sites publicados em `elizeumanicoba.github.io` compartilham o mesmo armazenamento do navegador. Não
  publique ali outros sites em que você não confie. Um domínio próprio (seção 5) isola o app.

## 4. Atualizar o site

    python3 build.py
    git add -A && git commit -m "Atualiza o app" && git push

O Pages republica sozinho em poucos minutos. Quem tem o app aberto ou instalado recebe o aviso *“Nova versão do app
instalada. Recarregue a página”*. Os dados salvos não são afetados.

## 5. Opcional

- **Nome do endereço:** renomear o repositório (Settings → General → Repository name) muda a URL para
  `…github.io/novo-nome/`. O app usa caminhos relativos e continua funcionando; os dados do navegador continuam
  no mesmo domínio, mas lembre de reinstalar o atalho do celular.
- **Domínio próprio** (cerca de R$ 40 por ano): Settings → Pages → **Custom domain**. Dá um link profissional e
  separa os dados do app de qualquer outro site do GitHub.

## 6. Se precisar de acesso restrito

O Pages gratuito é sempre público. Para exigir login: **Cloudflare Pages** com **Cloudflare Access** (grátis até
50 usuários) ou **Netlify**/**Vercel** com proteção por senha (alguns recursos são pagos). O conteúdo de `docs/`
funciona em qualquer hospedagem estática, sem alteração.

## Problemas comuns

- **Página 404:** confira branch e pasta `/docs` em Settings → Pages e aguarde alguns minutos.
- **Página antiga depois de atualizar:** recarregue duas vezes ou feche e abra o app instalado.
- **Os dados sumiram:** vieram de outro navegador/aparelho ou o histórico foi limpo. Restaure o último backup.
