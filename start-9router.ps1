# PDL helper for the local 9Router gateway.
# Keeps the gateway lifecycle outside the PDL worker itself.
$ErrorActionPreference = "Stop"

$router = Get-Command 9router -ErrorAction SilentlyContinue
if (-not $router) {
    Write-Host "9Router CLI not found."
    Write-Host "Install it with: npm install -g 9router"
    exit 2
}

Write-Host "Starting 9Router on http://127.0.0.1:20128 ..."
Start-Process powershell.exe -ArgumentList @(
    "-NoProfile",
    "-NoExit",
    "-Command",
    "9router"
) | Out-Null

Start-Sleep -Seconds 3

try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:20128/v1/models" -Method GET -TimeoutSec 10 -UseBasicParsing
    Write-Host ("9Router HTTP status: " + [int]$response.StatusCode)
    if ([int]$response.StatusCode -ge 200 -and [int]$response.StatusCode -lt 300) {
        Write-Host "9Router is ready."
        exit 0
    }
    Write-Host "9Router responded but is not healthy yet."
    exit 3
}
catch {
    Write-Host "9Router process was launched, but /v1/models is not reachable yet."
    Write-Host $_.Exception.Message
    exit 3
}
