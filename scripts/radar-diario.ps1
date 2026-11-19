# Roda a busca diaria e grava o log em data/logs. Chamado pelo Agendador de Tarefas do Windows.
$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo
$logs = Join-Path $repo "data\logs"
New-Item -ItemType Directory -Force $logs | Out-Null
$log = Join-Path $logs ("radar-" + (Get-Date -Format "yyyy-MM-dd") + ".log")
"=== $(Get-Date -Format s) inicio" | Out-File -Append -Encoding utf8 $log
npm run radar *>> $log
"=== $(Get-Date -Format s) fim (codigo $LASTEXITCODE)" | Out-File -Append -Encoding utf8 $log
exit $LASTEXITCODE
