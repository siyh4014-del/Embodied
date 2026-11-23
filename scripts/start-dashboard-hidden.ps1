$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $projectRoot 'logs'
$outLog = Join-Path $logDir 'dashboard.out.log'
$errLog = Join-Path $logDir 'dashboard.err.log'
$url = 'http://127.0.0.1:5173/'

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

try {
  $apiHealth = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8787/api/health' -TimeoutSec 2
  $frontendHealth = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2
  if ($apiHealth.StatusCode -eq 200 -and $frontendHealth.StatusCode -eq 200) {
    Start-Process $url
    exit 0
  }
} catch {
  # Server is not running yet.
}

$node = (Get-Command node.exe -ErrorAction Stop).Source

Set-Location $projectRoot
Start-Process `
  -WindowStyle Minimized `
  -FilePath $node `
  -ArgumentList @('server/index.js') `
  -WorkingDirectory $projectRoot `
  -RedirectStandardOutput $outLog `
  -RedirectStandardError $errLog

for ($attempt = 1; $attempt -le 30; $attempt++) {
  try {
    $apiHealth = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8787/api/health' -TimeoutSec 2
    $frontendHealth = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2
    if ($apiHealth.StatusCode -eq 200 -and $frontendHealth.StatusCode -eq 200) {
      Start-Process $url
      exit 0
    }
  } catch {
    Start-Sleep -Seconds 1
  }
}

"$(Get-Date -Format s) Dashboard did not become ready within 30 seconds." | Add-Content -Path $errLog
Start-Process 'notepad.exe' $errLog
exit 1
