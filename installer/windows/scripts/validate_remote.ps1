# Validate remote backend host: /health OK and / returns text/html
param(
    [Parameter(Mandatory = $true)][string]$ApiBaseUrl
)

$ErrorActionPreference = "Stop"
$base = $ApiBaseUrl.TrimEnd("/")

try {
    $uri = [Uri]$base
    if ($uri.Scheme -notin @("http", "https")) {
        Write-Error "API URL must start with http:// or https://"
        exit 1
    }
} catch {
    Write-Error "Invalid API URL: $ApiBaseUrl"
    exit 1
}

try {
    $health = Invoke-WebRequest -Uri "$base/health" -UseBasicParsing -TimeoutSec 15
    if ($health.StatusCode -lt 200 -or $health.StatusCode -ge 400) {
        Write-Error "Health check failed with status $($health.StatusCode)"
        exit 1
    }
} catch {
    Write-Error "Health check failed: $_"
    exit 1
}

try {
    $root = Invoke-WebRequest -Uri "$base/" -UseBasicParsing -TimeoutSec 15
    if ($root.StatusCode -lt 200 -or $root.StatusCode -ge 400) {
        Write-Error "UI root check failed with status $($root.StatusCode)"
        exit 1
    }
    $ct = [string]$root.Headers["Content-Type"]
    if ($ct -notmatch "text/html") {
        Write-Error "UI root Content-Type is '$ct' (expected text/html). Host must serve the VayBooks web UI."
        exit 1
    }
} catch {
    Write-Error "UI root check failed: $_"
    exit 1
}

Write-Host "Remote backend OK: $base"
exit 0
