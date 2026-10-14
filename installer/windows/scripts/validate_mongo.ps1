# Validate existing MongoDB URI (for installer wizard)
param(
    [Parameter(Mandatory = $true)][string]$MongoUri,
    [string]$DbName = "zahcci_customization",
    [string]$PythonExe = "",
    [string]$AppDir = ""
)

$ErrorActionPreference = "Stop"

$code = @"
import sys
uri = sys.argv[1]
db_name = sys.argv[2]
from pymongo import MongoClient
client = MongoClient(uri, serverSelectionTimeoutMS=8000)
client.admin.command('ping')
client[db_name].list_collection_names()
print('ok')
"@

if ($PythonExe -and (Test-Path $PythonExe)) {
    $env:PYTHONPATH = $AppDir
    & $PythonExe -c $code $MongoUri $DbName
} else {
    python -c $code $MongoUri $DbName
}
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
exit 0
