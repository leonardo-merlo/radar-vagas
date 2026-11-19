# Cria (ou atualiza) a tarefa "Radar de Vagas" no Agendador de Tarefas: todo dia no horario escolhido.
# Se o computador estiver desligado nesse horario, roda assim que ele ligar.
# Uso: powershell -ExecutionPolicy Bypass -File scripts\agendar.ps1 [-Hora 08:00]
# Remover: Unregister-ScheduledTask -TaskName "Radar de Vagas"
param([string]$Hora = "08:00")
$script = Join-Path $PSScriptRoot "radar-diario.ps1"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`""
$trigger = New-ScheduledTaskTrigger -Daily -At $Hora
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName "Radar de Vagas" -Description "Busca diaria de vagas (projeto radar-vagas)" -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
Get-ScheduledTask -TaskName "Radar de Vagas" | Select-Object TaskName, State, @{ n = "Proxima execucao"; e = { (Get-ScheduledTaskInfo $_).NextRunTime } }
