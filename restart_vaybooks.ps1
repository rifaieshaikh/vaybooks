# VayBooks stack starter — Dev, Desktop, Streamlit (legacy), or Compose.
# Usage:
#   .\restart_vaybooks.ps1
#   .\restart_vaybooks.ps1 -Mode Dev -WithRedis
#   .\restart_vaybooks.ps1 -Mode Desktop
#   .\restart_vaybooks.ps1 -Mode Compose
#   .\restart_vaybooks.ps1 -Mode Streamlit

param(
    [ValidateSet("Dev", "Desktop", "Streamlit", "Compose")]
    [string]$Mode = "Dev",
    [switch]$WithRedis,
    [int]$ApiPort = 8000,
    [int]$UiPort = 5173,
    [switch]$NoHeadless,
    [switch]$ApiOnly
)

$ErrorActionPreference = "Stop"
$AppDir = $PSScriptRoot
$WebDir = Join-Path $AppDir "web"

function Stop-PortListeners {
    param([int[]]$Ports)

    $stopped = @()
    foreach ($port in $Ports) {
        try {
            $listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
            foreach ($conn in $listeners) {
                $owningPid = $conn.OwningProcess
                if ($owningPid -and $owningPid -notin $stopped) {
                    Write-Host "Stopping port $port owner PID $owningPid"
                    Stop-Process -Id $owningPid -Force -ErrorAction SilentlyContinue
                    $stopped += $owningPid
                }
            }
        } catch {
            # Get-NetTCPConnection may be unavailable; ignore
        }
    }

    if ($stopped.Count -gt 0) {
        Start-Sleep -Seconds 1
    }
    return $stopped
}

function Stop-VayBooksJobs {
    Get-Job -Name "vaybooks-combined", "vaybooks-shell" -ErrorAction SilentlyContinue |
        ForEach-Object {
            Write-Host "Removing job $($_.Name)"
            Stop-Job $_ -ErrorAction SilentlyContinue
            Remove-Job $_ -Force -ErrorAction SilentlyContinue
        }
}

function Stop-StreamlitProcesses {
    param([int]$Port = 8501)

    $stopped = @()

    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object {
            $cmd = $_.CommandLine
            $cmd -and (
                $cmd -match '(?i)[\\/ ]streamlit(\.exe)?(\s|$)' -or
                $cmd -match '(?i)-m\s+streamlit\b'
            )
        } |
        ForEach-Object {
            Write-Host "Stopping Streamlit PID $($_.ProcessId)"
            Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
            $stopped += $_.ProcessId
        }

    Get-Process -Name "streamlit" -ErrorAction SilentlyContinue |
        ForEach-Object {
            Write-Host "Stopping streamlit PID $($_.Id)"
            Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
            $stopped += $_.Id
        }

    $stopped += Stop-PortListeners -Ports @($Port)
    return $stopped
}

function Import-StreamlitMongoEnv {
    param([string]$Root)

    if ($env:MONGODB_URI) {
        return
    }
    $secrets = Join-Path $Root ".streamlit\secrets.toml"
    if (-not (Test-Path $secrets)) {
        return
    }
    $text = Get-Content -Path $secrets -Raw -ErrorAction SilentlyContinue
    if (-not $text) {
        return
    }
    if ($text -match '(?im)^\s*MONGODB_URI\s*=\s*"([^"]+)"') {
        $env:MONGODB_URI = $Matches[1]
        Write-Host "Loaded MONGODB_URI from .streamlit/secrets.toml"
    }
    if (-not $env:MONGODB_DATABASE -and $text -match '(?im)^\s*MONGODB_DATABASE\s*=\s*"([^"]+)"') {
        $env:MONGODB_DATABASE = $Matches[1]
        Write-Host "Loaded MONGODB_DATABASE=$($env:MONGODB_DATABASE) from .streamlit/secrets.toml"
    }
}

function Start-CombinedApi {
    param(
        [int]$ApiPort,
        [switch]$DesktopMode,
        [switch]$WithRedis
    )

    $env:VAYBOOKS_API_PORT = "$ApiPort"
    if ($DesktopMode) {
        if (-not $env:VAYBOOKS_DATA_DIR) {
            Write-Host "Tip: set VAYBOOKS_DATA_DIR for desktop file storage (see docs/files-storage.md)."
        }
        Write-Host "Desktop mode: Redis is optional (in-process cache when REDIS_URL is unset)."
    } elseif (-not $WithRedis -and -not $env:REDIS_URL) {
        Write-Host "Note: web-like Dev mode typically needs REDIS_URL or -WithRedis (auth cache falls back in-process)."
    }

    Import-StreamlitMongoEnv -Root $AppDir

    Write-Host "Starting combined API (embedded gateway) on port $ApiPort ..."
    $job = Start-Job -Name "vaybooks-combined" -ScriptBlock {
        param($Root, $Port, $MongoUri, $MongoDb)
        Set-Location $Root
        $env:PYTHONPATH = "$Root;$Root\packages"
        $env:VAYBOOKS_API_PORT = "$Port"
        if ($MongoUri) { $env:MONGODB_URI = $MongoUri }
        if ($MongoDb) { $env:MONGODB_DATABASE = $MongoDb }
        python -m services.combined --port $Port
    } -ArgumentList $AppDir, $ApiPort, $env:MONGODB_URI, $env:MONGODB_DATABASE

    return $job
}

function Start-ReactShell {
    param([int]$UiPort)

    if (-not (Test-Path (Join-Path $WebDir "package.json"))) {
        throw "web/ package not found at $WebDir"
    }

    Write-Host "Starting React shell (Vite) on port $UiPort ..."
    $job = Start-Job -Name "vaybooks-shell" -ScriptBlock {
        param($WebRoot, $Port)
        Set-Location $WebRoot
        npm run dev -w shell -- --port $Port --strictPort --host 127.0.0.1
    } -ArgumentList $WebDir, $UiPort

    return $job
}

function Wait-HttpOk {
    param(
        [string]$Url,
        [int]$TimeoutSec = 45,
        [string]$Label = "service"
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
            if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) {
                Write-Host "$Label ready: $Url"
                return $true
            }
        } catch {
            Start-Sleep -Milliseconds 500
        }
    }
    Write-Host "Timed out waiting for $Label at $Url" -ForegroundColor Yellow
    return $false
}

function Start-StreamlitApp {
    param(
        [int]$Port = 8501,
        [switch]$NoHeadless
    )

    $streamlitArgs = @("run", "app.py", "--server.port", "$Port")
    if (-not $NoHeadless) {
        $streamlitArgs += @("--server.headless", "true")
    }

    Write-Host "=== Starting Streamlit (legacy) on port $Port ==="
    Write-Host "Local URL: http://localhost:$Port"
    & streamlit @streamlitArgs
}

Set-Location $AppDir

Write-Host "=== VayBooks restart ($Mode) ==="
Write-Host "Working directory: $AppDir"

switch ($Mode) {
    "Compose" {
        Write-Host "=== Stopping local dev ports ==="
        Stop-VayBooksJobs
        Stop-PortListeners -Ports @($ApiPort, $UiPort, 5175, 8501) | Out-Null
        Write-Host "=== Starting docker compose ==="
        docker compose up
        break
    }

    "Streamlit" {
        Write-Host "=== Stopping Streamlit ==="
        Stop-StreamlitProcesses -Port 8501 | Out-Null
        Start-StreamlitApp -Port 8501 -NoHeadless:$NoHeadless
        break
    }

    "Desktop" {
        Write-Host "=== Stopping prior stack ==="
        Stop-VayBooksJobs
        Stop-PortListeners -Ports @($ApiPort, $UiPort, 5175) | Out-Null

        $null = Start-CombinedApi -ApiPort $ApiPort -DesktopMode
        Write-Host ""
        Write-Host "=== Desktop stack started ==="
        Write-Host "API:      http://127.0.0.1:$ApiPort/docs"
        Write-Host "UI:       run 'npm run dev:desktop' in web/ then 'npm start' in desktop/"
        Write-Host "          http://127.0.0.1:5175 (desktop-compose) or http://127.0.0.1:$UiPort"
        Write-Host "Electron: cd desktop && npm install && npm start"
        Write-Host "Redis:    optional on desktop (in-process fallback)"
        Write-Host "Jobs:     Get-Job -Name vaybooks-combined | Receive-Job"
        break
    }

    default {
        Write-Host "=== Stopping prior stack ==="
        Stop-VayBooksJobs
        Stop-PortListeners -Ports @($ApiPort, $UiPort, 5175, 8501) | Out-Null

        if ($WithRedis) {
            Write-Host "=== Redis requested (-WithRedis) ==="
            if (-not $env:REDIS_URL) {
                $env:REDIS_URL = "redis://127.0.0.1:6379/0"
            }
            Write-Host "REDIS_URL=$($env:REDIS_URL)"
            Write-Host "Ensure Redis is running (local install or: docker compose up -d redis)."
        }

        $null = Start-CombinedApi -ApiPort $ApiPort -WithRedis:$WithRedis
        Wait-HttpOk -Url "http://127.0.0.1:$ApiPort/health" -Label "API" | Out-Null

        if (-not $ApiOnly) {
            $null = Start-ReactShell -UiPort $UiPort
            Wait-HttpOk -Url "http://127.0.0.1:$UiPort/" -Label "UI" -TimeoutSec 90 | Out-Null
        }

        Write-Host ""
        Write-Host "=== Dev stack started ==="
        Write-Host "API:  http://127.0.0.1:$ApiPort/docs"
        if ($ApiOnly) {
            Write-Host "UI:   skipped (-ApiOnly). Run: cd web; npm run dev:shell"
        } else {
            Write-Host "UI:   http://127.0.0.1:$UiPort"
        }
        Write-Host ""
        Write-Host "Jobs: Get-Job -Name vaybooks-combined,vaybooks-shell"
        Write-Host "Logs: Get-Job -Name vaybooks-combined | Receive-Job"
        Write-Host "      Get-Job -Name vaybooks-shell | Receive-Job"
        break
    }
}
