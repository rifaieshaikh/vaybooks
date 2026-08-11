# Install VayBooksBMS Windows service via NSSM (combined FastAPI API)
param(
    [Parameter(Mandatory = $true)][string]$InstallDir,
    [Parameter(Mandatory = $true)][string]$DataDir,
    [int]$AppPort = 8000,
    [string]$BackendMode = "local"
)

$ErrorActionPreference = "Stop"

if ($BackendMode -eq "remote") {
    Write-Host "Remote backend mode: skipping local API service install."
    exit 0
}

$nssm = Join-Path $InstallDir "tools\nssm.exe"
$python = Join-Path $InstallDir "python\python.exe"
$appDir = Join-Path $InstallDir "app"
$uiRoot = Join-Path $InstallDir "ui"
$logDir = Join-Path $DataDir "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$serviceName = "VayBooksBMS"
$existing = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if ($existing) {
    & $nssm stop $serviceName confirm
    & $nssm remove $serviceName confirm
}

& $nssm install $serviceName $python `
    "-m" "services.combined" "--host" "127.0.0.1" "--port" "$AppPort"
& $nssm set $serviceName AppDirectory $appDir
$envExtra = @(
    "VAYBOOKS_DATA_DIR=$DataDir",
    "VAYBOOKS_UI_ROOT=$uiRoot",
    "VAYBOOKS_API_PORT=$AppPort",
    "VAYBOOKS_SKIP_DEFAULT_ADMIN=1",
    "PYTHONPATH=$appDir"
) -join "`n"
& $nssm set $serviceName AppEnvironmentExtra $envExtra
& $nssm set $serviceName Start SERVICE_AUTO_START
& $nssm set $serviceName AppStdout (Join-Path $logDir "service.log")
& $nssm set $serviceName AppStderr (Join-Path $logDir "service.log")
& $nssm set $serviceName AppRotateFiles 1
& $nssm set $serviceName AppRotateBytes 10485760
& $nssm set $serviceName AppExit Default Restart
& $nssm set $serviceName AppRestartDelay 5000

# Load Mongo settings from config.toml into service env when present
$configPath = Join-Path $DataDir "config\config.toml"
if (Test-Path $configPath) {
    $mongoUri = ""
    $dbName = ""
    Get-Content $configPath | ForEach-Object {
        if ($_ -match '^\s*MONGO_URI\s*=\s*"(.*)"\s*$') { $mongoUri = $Matches[1] }
        if ($_ -match '^\s*DB_NAME\s*=\s*"(.*)"\s*$') { $dbName = $Matches[1] }
    }
    if ($mongoUri) {
        $envExtra2 = $envExtra + "`nMONGODB_URI=$mongoUri`nMONGO_URI=$mongoUri"
        if ($dbName) {
            $envExtra2 += "`nMONGODB_DATABASE=$dbName`nDB_NAME=$dbName"
        }
        & $nssm set $serviceName AppEnvironmentExtra $envExtra2
    }
}

Start-Service $serviceName
Write-Host "Service $serviceName installed and started."
