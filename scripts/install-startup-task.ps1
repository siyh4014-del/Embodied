$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$starter = Join-Path $PSScriptRoot 'start-dashboard-hidden.ps1'
$taskName = 'Growth Evidence Dashboard'

$action = New-ScheduledTaskAction `
  -Execute 'powershell.exe' `
  -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$starter`""

$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Hours 0)

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description 'Starts the local Growth Evidence Dashboard server at logon.' `
  -Force | Out-Null

Start-ScheduledTask -TaskName $taskName

Write-Host "Installed and started startup task: $taskName"
Write-Host 'Open: http://127.0.0.1:8787/'
