# O Jopes — portfolio-joao-v2

Portfólio de **João Paulo Oliveira**, engenheiro backend em Blumenau (SC), em forma de jornal.
Inclui o **JOPES.EXE** (o currículo como jogo 3D) em [`rpg/`](rpg/).

- Projetos como reportagens, com infográficos de arquitetura
- Entrevista, carreira como pregão da "ação JPO3", classificados, palavra cruzada e cartas de colegas
- Edição brasileira e internacional (PT/EN) e versão para impressão
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
| Perfil, carreira, skills, cartas e projetos pessoais (a duração do cargo atual é calculada sozinha) | `data/edicao.json` |
| Entrevista (mude `draft` para `false` quando aprovar as respostas) | `data/entrevista.json` |
| Manchetes, textos de jornal, cruzadinha, PT/EN | `i18n.js` |
| CVs em PDF | `tools/cv.html` → `tools/gerar-cv.ps1` |

Depois de mudar projetos ou infográficos, regenere o que o jogo e a prévia de compartilhamento usam
(com o `serve.ps1` rodando):

```
powershell -ExecutionPolicy Bypass -File tools\gerar-imagens.ps1
powershell -ExecutionPolicy Bypass -File tools\gerar-dados-rpg.ps1
```

## Jogo (JOPES.EXE)

- `rpg/index.html` ficou só com a marcação; os estilos estão em `rpg/game.css` e a lógica em `rpg/game.js`
  (jogador, carros, helicóptero, HUD, câmera, tour, clima e o loop). `city.js` gera a cidade, `world3d.js` desenha
  prédios e chão em 3D e `vehicles.js` os veículos.
- Sombras: o chão é renderizado uma vez com a sombra real de cada prédio, árvore e outdoor, conforme a hora do dia
  (`addShadows` em `world3d.js`). Abra com `?noshadows` para comparar.
- Movimento: a pé há aceleração curta, joystick analógico no celular e clique/toque no chão para andar até o ponto;
  a câmera olha um pouco à frente e a rodinha do mouse dá zoom; no carro, Espaço é o freio de mão.
- Pedestres existem mas estão desligados (abra com `?peds` para ver).
- `rpg/plus.js`: cafés para coletar, a entrega expressa de carro (rota em `ROUTE`, medalhas em `MEDALS`), o "+XP" flutuante e o confete do 100%.
- Os modelos `.glb` em `rpg/assets/garage` e `rpg/assets/models` estão comprimidos com meshopt (metade do tamanho).
  Ao adicionar um modelo novo, comprima antes de publicar:

```
npx @gltf-transform/cli meshopt modelo.glb modelo.glb --level medium
```

## Publicar

No ar em **https://www.jopes.com.br**, pela Vercel (projeto ligado a este repositório: cada push na `main` publica).
O `vercel.json` marca o site como estático (sem build) e redireciona os endereços do portfólio antigo
(`/en`, `/pt/about`, `/pt/projects/...`) para as seções do jornal.

Se o endereço mudar, atualize `og:url`, `og:image` e `canonical` no `index.html` e o link em `tools/cv.html`.

O contador de visitas usa o serviço gratuito [abacus.jasoncameron.dev](https://abacus.jasoncameron.dev) (sem dados pessoais).
