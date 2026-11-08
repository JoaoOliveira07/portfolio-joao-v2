# O Jopes — portfolio-joao-v2

Portfólio de **João Paulo Oliveira**, engenheiro backend em Blumenau (SC), em forma de jornal.
Inclui o **JOPES.EXE** (portfólio jogável, cidade isométrica) em [`rpg/`](rpg/).

- Projetos como reportagens, com infográficos de arquitetura
- Entrevista, carreira como pregão da "ação JPO3", classificados, palavra cruzada e cartas de colegas
- Edição brasileira e internacional (PT/EN), edição noturna e versão para impressão
- HTML, CSS e JavaScript puros: sem framework e sem build

## Rodar localmente

```
powershell -ExecutionPolicy Bypass -File serve.ps1
```

Abra http://localhost:5500 (o site lê os dados com `fetch`, então não funciona abrindo o `index.html` direto).

## Onde editar

| O quê | Arquivo |
|---|---|
| Projetos profissionais (versão pública, sem dados internos) | `data/profissionais.json` |
| Perfil, carreira, skills, cartas e projetos pessoais | `data/edicao.json` |
| Entrevista (mude `draft` para `false` quando aprovar as respostas) | `data/entrevista.json` |
| Manchetes, textos de jornal, cruzadinha, PT/EN | `i18n.js` |
| CVs em PDF | `tools/cv.html` → `tools/gerar-cv.ps1` |

Depois de mudar projetos ou infográficos, regenere o que o jogo e a prévia de compartilhamento usam
(com o `serve.ps1` rodando):

```
powershell -ExecutionPolicy Bypass -File tools\gerar-imagens.ps1
powershell -ExecutionPolicy Bypass -File tools\gerar-dados-rpg.ps1
```

## Publicar

Site estático: GitHub Pages (branch `main`, pasta raiz) ou qualquer host estático.
Se o endereço mudar (ex.: domínio próprio), atualize `og:url`, `og:image` e `canonical` no `index.html`
e o link do portfólio em `tools/cv.html`.

O contador de visitas usa o serviço gratuito [abacus.jasoncameron.dev](https://abacus.jasoncameron.dev) (sem dados pessoais).
