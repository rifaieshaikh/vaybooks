# Post-install: write config + setup.json, bootstrap (local), service, shortcuts
param(
    [Parameter(Mandatory = $true)][string]$InstallDir,
    [Parameter(Mandatory = $true)][string]$DataDir,
    [string]$BackendMode = "local",
    [string]$ApiBaseUrl = "http://127.0.0.1:8000",
    [string]$MongoMode = "existing",
    [string]$MongoUri = "mongodb://localhost:27017",
    [string]$DbName = "zahcci_customization",
    [int]$AppPort = 8000,
    [string]$AppVersion = "1.0.0",
    [string]$SetupJsonPath = ""
)

$ErrorActionPreference = "Stop"
$configDir = Join-Path $DataDir "config"
New-Item -ItemType Directory -Force -Path $configDir | Out-Null
$configPath = Join-Path $configDir "config.toml"
$updateUrl = "https://github.com/rifaieshaikh/bms/releases/latest/download/version.json"

if (-not $ApiBaseUrl) {
    $ApiBaseUrl = "http://127.0.0.1:$AppPort"
}
if (-not $ApiBaseUrl.EndsWith("/")) {
    $ApiBaseUrl = "$ApiBaseUrl/"
}

$setupPath = if ($SetupJsonPath) { $SetupJsonPath } else { Join-Path $configDir "setup.json" }

# Merge topology into setup.json if present; otherwise write minimal remote/local skeleton
$setup = @{
    backend_mode     = $BackendMode
    api_base_url     = $ApiBaseUrl.TrimEnd('/')
    mongo_mode       = $MongoMode
    mongo_uri        = $MongoUri
    db_name          = $DbName
    business         = @{}
    enabled_modules  = @()
    admin            = @{}
    license_key      = ""
    app_version      = $AppVersion
}
if (Test-Path $setupPath) {
    try {
        $existing = Get-Content -Raw -Path $setupPath | ConvertFrom-Json
        foreach ($prop in $existing.PSObject.Properties) {
            $setup[$prop.Name] = $prop.Value
        }
        $setup.backend_mode = $BackendMode
        $setup.api_base_url = $ApiBaseUrl.TrimEnd('/')
        $setup.mongo_mode = $MongoMode
        $setup.mongo_uri = $MongoUri
        $setup.db_name = $DbName
        $setup.app_version = $AppVersion
    } catch {
        Write-Host "Warning: could not parse existing setup.json; rewriting."
    }
}
($setup | ConvertTo-Json -Depth 8) | Set-Content -Path $setupPath -Encoding UTF8

# Restrict ACL on setup.json (Administrators + SYSTEM)
try {
    $acl = Get-Acl $setupPath
    $acl.SetAccessRuleProtection($true, $false)
    $rules = @(
        (New-Object System.Security.AccessControl.FileSystemAccessRule("BUILTIN\Administrators", "FullControl", "Allow")),
        (New-Object System.Security.AccessControl.FileSystemAccessRule("SYSTEM", "FullControl", "Allow"))
    )
    $acl.Access | ForEach-Object { [void]$acl.RemoveAccessRule($_) }
    foreach ($rule in $rules) { $acl.AddAccessRule($rule) }
    Set-Acl -Path $setupPath -AclObject $acl
} catch {
    Write-Host "Warning: could not tighten ACL on setup.json: $_"
}

$setupCompleted = if ($BackendMode -eq "remote") { "true" } else { "false" }
$config = @"
APP_VERSION = "$AppVersion"
APP_PORT = $AppPort
BACKEND_MODE = "$BackendMode"
API_BASE_URL = "$($ApiBaseUrl.TrimEnd('/'))"
MONGO_URI = "$MongoUri"
DB_NAME = "$DbName"
MONGO_MODE = "$MongoMode"
UPDATE_CHECK_URL = "$updateUrl"
BACKUP_SCHEDULE = "daily"
BACKUP_RETENTION_DAYS = 30
AUTO_UPDATE_ENABLED = false
SETUP_COMPLETED = $setupCompleted
VAYBOOKS_SKIP_DEFAULT_ADMIN = true
"@
Set-Content -Path $configPath -Value $config -Encoding UTF8

if ($BackendMode -eq "local") {
    $python = Join-Path $InstallDir "python\python.exe"
    $appDir = Join-Path $InstallDir "app"
    $bootstrap = Join-Path $InstallDir "scripts\bootstrap_setup.py"
    if (-not (Test-Path $python)) {
        throw "Embedded Python not found at $python (local backend requires api component)."
    }
    $env:PYTHONPATH = $appDir
    $env:MONGODB_URI = $MongoUri
    $env:MONGO_URI = $MongoUri
    $env:MONGODB_DATABASE = $DbName
    $env:DB_NAME = $DbName
    $env:VAYBOOKS_DATA_DIR = $DataDir
    $env:VAYBOOKS_SKIP_DEFAULT_ADMIN = "1"
    & $python $bootstrap --setup-json $setupPath --data-dir $DataDir --app-dir $appDir
    if ($LASTEXITCODE -ne 0) {
        throw "bootstrap_setup.py failed with exit code $LASTEXITCODE"
    }

    & (Join-Path $InstallDir "nssm\install_service.ps1") `
        -InstallDir $InstallDir -DataDir $DataDir -AppPort $AppPort -BackendMode local
}

$electron = Join-Path $InstallDir "electron\win-unpacked\VayBooks.exe"
if (-not (Test-Path $electron)) {
    $electron = Join-Path $InstallDir "electron\VayBooks.exe"
}
$launcher = Join-Path $InstallDir "tools\VayBooks-Launcher.exe"
if (-not (Test-Path $launcher)) {
    $launcherPy = Join-Path $InstallDir "tools\launcher.py"
    if (Test-Path $launcherPy) {
        $launcher = Join-Path $InstallDir "python\python.exe"
        if (-not (Test-Path $launcher)) { $launcher = "python" }
        $launcherArgs = "`"$launcherPy`""
    } else {
        $launcher = $electron
        $launcherArgs = $null
    }
} else {
    $launcherArgs = $null
}

function New-VayBooksShortcut([string]$LinkPath, [string]$Target, [string]$Arguments, [string]$WorkDir) {
    $wsh = New-Object -ComObject WScript.Shell
    $shortcut = $wsh.CreateShortcut($LinkPath)
    $shortcut.TargetPath = $Target
    if ($Arguments) { $shortcut.Arguments = $Arguments }
    $shortcut.WorkingDirectory = $WorkDir
    $shortcut.Description = "VayBooks"
    $shortcut.Save()
    # AppUserModelID via PropertyStore is limited from WScript; document pin instruction.
}

$desktop = [Environment]::GetFolderPath("Desktop")
$startMenu = Join-Path ([Environment]::GetFolderPath("Programs")) "VayBooks-BMS"
New-Item -ItemType Directory -Force -Path $startMenu | Out-Null

$shortcutTarget = if (Test-Path $electron) { $electron } else { $launcher }
$shortcutArgs = if ((Test-Path $electron) -or -not $launcherArgs) { $null } else { $launcherArgs }
$workDir = if (Test-Path $electron) { Split-Path $electron -Parent } else { $InstallDir }

New-VayBooksShortcut (Join-Path $desktop "VayBooks-BMS.lnk") $shortcutTarget $shortcutArgs $workDir
New-VayBooksShortcut (Join-Path $startMenu "VayBooks-BMS.lnk") $shortcutTarget $shortcutArgs $workDir

# Prefer launcher when present so local mode starts the API service first
if (Test-Path (Join-Path $InstallDir "tools\VayBooks-Launcher.exe")) {
    $env:VAYBOOKS_INSTALL_DIR = $InstallDir
    $env:VAYBOOKS_DATA_DIR = $DataDir
    New-VayBooksShortcut (Join-Path $desktop "VayBooks-BMS.lnk") (Join-Path $InstallDir "tools\VayBooks-Launcher.exe") $null $InstallDir
    New-VayBooksShortcut (Join-Path $startMenu "VayBooks-BMS.lnk") (Join-Path $InstallDir "tools\VayBooks-Launcher.exe") $null $InstallDir
} elseif (Test-Path (Join-Path $InstallDir "tools\launcher.py")) {
    $py = Join-Path $InstallDir "python\python.exe"
    if (-not (Test-Path $py)) { $py = "python" }
    $args = "`"$(Join-Path $InstallDir 'tools\launcher.py')`""
    New-VayBooksShortcut (Join-Path $desktop "VayBooks-BMS.lnk") $py $args $InstallDir
    New-VayBooksShortcut (Join-Path $startMenu "VayBooks-BMS.lnk") $py $args $InstallDir
}

Write-Host "Post-install complete. To pin to taskbar: open Start Menu > VayBooks-BMS > right-click > Pin to taskbar."
