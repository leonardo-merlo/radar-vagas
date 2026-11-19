# Roda a busca diária, grava o log em data/logs e pergunta se você quer abrir o painel.
# Chamado pelo Agendador de Tarefas do Windows (scripts/agendar.ps1).
param([switch]$SemPergunta)

$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo
$logs = Join-Path $repo "data\logs"
New-Item -ItemType Directory -Force $logs | Out-Null
$log = Join-Path $logs ("radar-" + (Get-Date -Format "yyyy-MM-dd") + ".log")

"=== $(Get-Date -Format s) início" | Out-File -Append -Encoding utf8 $log
npm run radar *>> $log
$codigo = $LASTEXITCODE
"=== $(Get-Date -Format s) fim (código $codigo)" | Out-File -Append -Encoding utf8 $log

if ($SemPergunta) { exit $codigo }

$painel = "http://localhost:3000/?periodo=1"
$resumo = Join-Path $repo "data\ultima-execucao.json"
if ($codigo -eq 0 -and (Test-Path $resumo)) {
  $r = Get-Content $resumo -Raw -Encoding utf8 | ConvertFrom-Json
  $texto = "Leo, a busca de hoje terminou: $($r.newJobs) vagas novas, $($r.newAboveCutoff) com nota $($r.cutoff) ou mais."
  if ($r.failedSources.Count -gt 0) { $texto += "`nFontes que falharam: $($r.failedSources -join ', ')." }
} else {
  $texto = "Leo, a busca de hoje deu erro (código $codigo). O detalhe está em:`n$log"
}
$texto += "`n`nQuer ver o seu painel?`n$painel"

# Popup: 4 = Sim/Não, 32 = ícone de pergunta, 4096 = fica na frente das outras janelas. 6 = clicou Sim.
$resposta = (New-Object -ComObject WScript.Shell).Popup($texto, 0, "Radar de Vagas", 4 + 32 + 4096)
if ($resposta -ne 6) { exit $codigo }

function Test-Painel {
  try { Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:3000" -TimeoutSec 3 | Out-Null; return $true } catch { return $false }
}

if (-not (Test-Painel)) {
  # Liga o painel numa janela minimizada; feche essa janela quando terminar de usar.
  Start-Process -FilePath "cmd.exe" -ArgumentList "/k title Radar de Vagas - painel && npm run painel" -WorkingDirectory $repo -WindowStyle Minimized
  for ($i = 0; $i -lt 60 -and -not (Test-Painel); $i++) { Start-Sleep -Seconds 2 }
}
Start-Process $painel
exit $codigo
