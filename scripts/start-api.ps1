# Run from the repository root: powershell -ExecutionPolicy Bypass -File scripts/start-api.ps1
$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

Push-Location $repoRoot
try {
    if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
        throw "uv is required. Install uv and run this script again."
    }

    # Never overwrite an existing .env or provider credentials.
    if (-not (Test-Path -LiteralPath ".env")) {
        Copy-Item -LiteralPath ".env.example" -Destination ".env"
    }

    & uv sync --frozen --python 3.12
    if ($LASTEXITCODE -ne 0) { throw "Backend dependency installation failed." }

    & uv run --frozen --python 3.12 alodi-api
    if ($LASTEXITCODE -ne 0) { throw "Backend startup failed." }
}
finally {
    Pop-Location
}
