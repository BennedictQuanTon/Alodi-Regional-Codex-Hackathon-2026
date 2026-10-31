# Starts one isolated backend per judge session behind the public gateway on port 3002.
# Run from anywhere after stopping whatever owns the ports. Existing session data is kept;
# delete data/live-sessions only to issue new session ids.
# Expects the frontend production build on port 3005 and a tunnel pointing at the gateway.
param(
    [Parameter(Mandatory)][string]$PublicOrigin,
    [int]$GatewayPort = 3002,
    [int]$FrontendPort = 3005
)
$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$sessionsRoot = Join-Path $root "data\live-sessions"
$manifestPath = Join-Path $sessionsRoot "sessions.json"
New-Item -ItemType Directory -Force -Path $sessionsRoot | Out-Null

if (Test-Path -LiteralPath $manifestPath) {
    # Windows PowerShell passes a parsed JSON array down the pipe as one object; unwrap it.
    $sessions = @(Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json | ForEach-Object { $_ })
} else {
    $random = {
        $bytes = New-Object byte[] 6
        [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
        (($bytes | ForEach-Object { $_.ToString("x2") }) -join "")
    }
    $sessions = @(
        [PSCustomObject]@{ id = "judge-a-$(& $random)"; port = 8011 },
        [PSCustomObject]@{ id = "judge-b-$(& $random)"; port = 8012 }
    )
    ConvertTo-Json -InputObject $sessions | Set-Content -LiteralPath $manifestPath -Encoding utf8
}

$ports = @($sessions.port) + $GatewayPort
if (Get-NetTCPConnection -LocalPort $ports -State Listen -ErrorAction SilentlyContinue) {
    throw "Port $($ports -join ', ') is already in use; stop that process first."
}
if (-not (Get-NetTCPConnection -LocalPort $FrontendPort -State Listen -ErrorAction SilentlyContinue)) {
    throw "The frontend is not listening on port $FrontendPort."
}

$stamp = [DateTime]::UtcNow.ToString("yyyyMMdd-HHmmss")
$routes = @{}
foreach ($session in $sessions) {
    $directory = Join-Path $sessionsRoot $session.id
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
    $database = Join-Path $directory "alodi.db"
    $env:APP_ENV = "demo"
    $env:DATABASE_URL = "sqlite+aiosqlite:///$($database -replace '\\', '/')"
    $env:RECORDINGS_DIR = Join-Path $directory "recordings"
    $env:API_HOST = "127.0.0.1"
    $env:API_PORT = [string]$session.port
    $env:AI_MODE = "live"
    $env:AUTO_BUYER = "false"
    $env:OFFLINE_MODE = "false"
    $env:WEB_ORIGIN = $PublicOrigin
    Start-Process -FilePath (Join-Path $root "api\.venv\Scripts\python.exe") -ArgumentList @("-u", "-m", "app.cli") `
        -WorkingDirectory (Join-Path $root "api") -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $directory "api-$stamp.stdout.log") `
        -RedirectStandardError (Join-Path $directory "api-$stamp.stderr.log") | Out-Null
    $routes[$session.id] = $session.port
}

$env:DEMO_SESSIONS = $routes | ConvertTo-Json -Compress
$env:DEMO_GATEWAY_PORT = [string]$GatewayPort
$env:DEMO_FRONTEND_PORT = [string]$FrontendPort
$env:DEMO_PREVIEW_ROUTES = "true"
Start-Process -FilePath (Get-Command node).Source -ArgumentList @((Join-Path $root "scripts\demo-gateway.cjs")) `
    -WorkingDirectory $root -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $sessionsRoot "gateway-$stamp.stdout.log") `
    -RedirectStandardError (Join-Path $sessionsRoot "gateway-$stamp.stderr.log") | Out-Null

# Restart is only fast from a captured prepared state, so make the first full build here
# rather than on a judge's first restart. Restarting an unused session changes nothing else.
foreach ($session in $sessions) {
    if (Test-Path -LiteralPath (Join-Path $sessionsRoot "$($session.id)\alodi.prepared.db")) { continue }
    $api = "http://127.0.0.1:$($session.port)"
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 "$api/health" | Out-Null; break } catch { Start-Sleep 1 }
    }
    $generation = (Invoke-RestMethod "$api/demo/clock").generation_id
    $job = Invoke-RestMethod -Method Post -Uri "$api/demo/workflow-reset" -ContentType "application/json" `
        -Body (@{ generation_id = $generation } | ConvertTo-Json)
    while ($job.status -eq "processing") { Start-Sleep 1; $job = Invoke-RestMethod "$api/demo/workflow-reset/$($job.job_id)" }
    if ($job.status -ne "completed") { throw "Session $($session.id) could not prepare: $($job.message)" }
}

foreach ($session in $sessions) {
    [PSCustomObject]@{
        Session   = $session.id
        Dashboard = "$PublicOrigin/live?session=$($session.id)"
        Phone     = "$PublicOrigin/live/shipper?session=$($session.id)"
    }
}
