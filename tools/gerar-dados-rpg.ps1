# Gera rpg/assets/portfolio/data.json (os dados do JOPES.EXE) a partir dos dados públicos do jornal:
#   data/profissionais.json + data/edicao.json
# Assim o jogo e o jornal mostram sempre o mesmo conteúdo, sem nada interno da empresa.
# Uso:  powershell -ExecutionPolicy Bypass -File tools\gerar-dados-rpg.ps1
$root = Split-Path $PSScriptRoot -Parent
$prof = Get-Content (Join-Path $root 'data\profissionais.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$ed = Get-Content (Join-Path $root 'data\edicao.json') -Raw -Encoding UTF8 | ConvertFrom-Json

# categoria e complexidade usadas pelo jogo (cor e estrelas dos contêineres)
$meta = @{
  'integracao-erp' = @('integration', 5); 'backend-ecommerce' = @('monolith', 5); 'app-vendas' = @('mobile', 5)
  'api-sync' = @('event-driven', 4); 'loja-b2b' = @('frontend', 4); 'painel-admin' = @('admin', 4)
  'app-cadastro' = @('mobile', 4); 'infra-aws' = @('iac', 4)
  'commitclock' = @('automation', 3); 'kira-semi-joias' = @('frontend', 3); 'finance-dashboard' = @('monolith', 3)
}
$projects = foreach ($p in @($prof) + @($ed.personal)) {
  $img = if ($p.diagram) { "assets/portfolio/img/$($p.slug).png" } else { "assets/portfolio/img/" + (Split-Path $p.img -Leaf) }
  [ordered]@{
    slug = $p.slug; title = $p.title; subtitle = $p.subtitle; description = $p.description
    problem = $p.problem; solution = $p.solution; techStack = @($p.techStack); highlights = $p.highlights
    role = $p.role; category = $meta[$p.slug][0]; year = $p.year; complexity = $meta[$p.slug][1]; type = $p.type
    challenges = $p.challenges; results = $p.results; technicalDecisions = $p.technicalDecisions; image = $img
  }
}
$testimonials = foreach ($t in $ed.testimonials) {
  $id = ($t.author.name.ToLower() -replace '[^a-z ]', '' -replace '\s+', '-')
  [ordered]@{ id = $id; author = $t.author; relationship = $t.relationship; content = $t.content; featured = $true }
}
$out = [ordered]@{
  syncedAt = (Get-Date).ToUniversalTime().ToString('o')
  projects = @($projects); experience = $ed.experience; testimonials = @($testimonials); skills = $ed.skills
}
$dest = Join-Path $root 'rpg\assets\portfolio\data.json'
[IO.File]::WriteAllText($dest, ($out | ConvertTo-Json -Depth 12), (New-Object Text.UTF8Encoding $false))

# fotos dos projetos que não usam infográfico (os infográficos vêm de tools\gerar-imagens.ps1)
foreach ($p in @($prof) + @($ed.personal) | Where-Object { -not $_.diagram -and $_.img }) {
  Copy-Item (Join-Path $root $p.img) (Join-Path $root "rpg\assets\portfolio\img\") -Force
}
"data.json do jogo gerado: $(@($projects).Count) projetos, $(@($testimonials).Count) depoimentos"
