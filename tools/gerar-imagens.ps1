# Gera as imagens do site com o Edge em modo headless (vem com o Windows).
# Precisa do servidor local rodando:  powershell -ExecutionPolicy Bypass -File serve.ps1
# Uso:  powershell -ExecutionPolicy Bypass -File tools\gerar-imagens.ps1
param([string]$Base = 'http://localhost:5500')
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw 'Microsoft Edge não encontrado.' }
$profile = Join-Path $env:TEMP 'jopes-render-profile'

Add-Type -AssemblyName System.Drawing
function Shot($url, $out, $w, $h) {
  $tmp = Join-Path $env:TEMP ("jopes-shot-" + [guid]::NewGuid() + ".png")
  # captura com folga de altura (o Edge às vezes desenha algo no rodapé) e recorta só a área útil
  $a = @('--headless=new', '--disable-gpu', '--hide-scrollbars', "--user-data-dir=$profile", "--window-size=$w,$($h + 160)",
         '--virtual-time-budget=9000', "--screenshot=$tmp", $url)
  # o Edge escreve "bytes written" no stderr: não é erro
  Start-Process -FilePath $edge -ArgumentList $a -Wait -WindowStyle Hidden
  if (-not (Test-Path $tmp)) { "FALHOU  $out"; return }
  $src = [System.Drawing.Image]::FromFile($tmp)
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.DrawImage($src, (New-Object System.Drawing.Rectangle 0, 0, $w, $h), (New-Object System.Drawing.Rectangle 0, 0, $w, $h), [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose(); $src.Dispose()
  if (Test-Path $out) { Remove-Item $out }
  $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose(); Remove-Item $tmp
  "ok  $out ($((Get-Item $out).Length) bytes)"
}

# prévia de compartilhamento (LinkedIn, WhatsApp...)
Shot "$Base/tools/render.html?mode=og" (Join-Path $root 'img\og.png') 1200 630

# infográficos dos projetos profissionais, para os outdoors e fichas do JOPES.EXE
$list = Get-Content (Join-Path $root 'data\profissionais.json') -Raw -Encoding UTF8 | ConvertFrom-Json
foreach ($p in $list | Where-Object { $_.diagram }) {
  Shot "$Base/tools/render.html?mode=diagram&slug=$($p.slug)" (Join-Path $root "rpg\assets\portfolio\img\$($p.slug).png") 1280 800
}
