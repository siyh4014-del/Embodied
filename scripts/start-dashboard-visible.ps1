$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$apiLog = Join-Path $projectRoot 'server.out.log'
$apiErr = Join-Path $projectRoot 'server.err.log'
$viteLog = Join-Path $projectRoot 'vite.out.log'
$viteErr = Join-Path $projectRoot 'vite.err.log'

try {
  $health = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8787/api/health' -TimeoutSec 2
  $apiRunning = $health.StatusCode -eq 200
} catch {
  $apiRunning = $false
}

if (-not $apiRunning) {
  Start-Process -WindowStyle Minimized -FilePath 'cmd.exe' -ArgumentList @('/c', "npm.cmd run server >> `"$apiLog`" 2>> `"$apiErr`"")
}

$viteRunning = $false
try {
  $response = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5173/' -TimeoutSec 2
  $viteRunning = $response.StatusCode -eq 200
} catch {
  $viteRunning = $false
}

if (-not $viteRunning) {
  $node = (Get-Command node.exe -ErrorAction Stop).Source
  $vite = Join-Path $projectRoot 'node_modules/vite/bin/vite.js'
  & cmd.exe /c "start `"Growth Evidence Dashboard`" /min `"$node`" `"$vite`" >> `"$viteLog`" 2>> `"$viteErr`""
}

Start-Sleep -Seconds 2
Start-Process 'http://127.0.0.1:5173/'
