# Gera cv/cv-pt.pdf e cv/cv-en.pdf a partir de tools/cv.html, com o Edge em modo headless.
# Precisa do servidor local rodando (serve.ps1). Uso:  powershell -ExecutionPolicy Bypass -File tools\gerar-cv.ps1
param([string]$Base = 'http://localhost:5500')
$root = Split-Path $PSScriptRoot -Parent
$edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
$profile = Join-Path $env:TEMP 'jopes-render-profile'
foreach ($lang in 'pt', 'en') {
  $out = Join-Path $root "cv\cv-$lang.pdf"
  if (Test-Path $out) { Remove-Item $out }
  $a = @('--headless=new', '--disable-gpu', "--user-data-dir=$profile", '--no-pdf-header-footer', '--virtual-time-budget=6000',
         "--print-to-pdf=$out", "$Base/tools/cv.html?lang=$lang")
  Start-Process -FilePath $edge -ArgumentList $a -Wait -WindowStyle Hidden
  if (Test-Path $out) { "ok  $out ($((Get-Item $out).Length) bytes)" } else { "FALHOU  $out" }
}
