param(
  [string]$OutRoot = "release\customer-bundle",
  [switch]$WithArchive
)

$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $projectRoot

Write-Host "[Deken] Building project..."
npm run build

$targetOutAbs = Join-Path $projectRoot $OutRoot
$outAbs = $targetOutAbs
if (Test-Path $outAbs) {
  try {
    Remove-Item -Recurse -Force $outAbs
  } catch {
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $outAbs = "${targetOutAbs}-$stamp"
    Write-Host "[Deken] Existing bundle folder is locked; using new output: $outAbs"
  }
}
New-Item -ItemType Directory -Path $outAbs | Out-Null

$required = @("out", "db", "package.json", "scripts\run-deken.bat", "scripts\run-deken-silent.vbs")
foreach ($item in $required) {
  $src = Join-Path $projectRoot $item
  if (!(Test-Path $src)) {
    throw "Required path missing: $item"
  }
}

Write-Host "[Deken] Copying runtime files..."
Copy-Item -Recurse -Force (Join-Path $projectRoot "out") (Join-Path $outAbs "out")
Copy-Item -Recurse -Force (Join-Path $projectRoot "db") (Join-Path $outAbs "db")
Copy-Item -Force (Join-Path $projectRoot "package.json") (Join-Path $outAbs "package.json")
Copy-Item -Force (Join-Path $projectRoot "scripts\run-deken.bat") (Join-Path $outAbs "run-deken.bat")
Copy-Item -Force (Join-Path $projectRoot "scripts\run-deken-silent.vbs") (Join-Path $outAbs "run-deken-silent.vbs")

$readme = @"
DEKEN CUSTOMER BUNDLE
=====================

Quick start on customer PC:
1) Copy this whole folder to local disk (e.g. C:\Deken).
2) Double-click run-deken-silent.vbs (recommended, no black terminal window)
   - You can still use run-deken.bat for troubleshooting.
3) Keep internet enabled on first run (npm install runs automatically once).

Notes:
- Do not run from USB directly. Copy to local disk first.
- Database is local per machine inside Electron userData folder.
- Keep a backup policy for the shop database.
"@

Set-Content -Path (Join-Path $outAbs "README-RUN-FIRST.txt") -Value $readme -Encoding UTF8

if ($WithArchive) {
  $zipPath = Join-Path $projectRoot "release\deken-customer-bundle.zip"
  if (Test-Path $zipPath) {
    Remove-Item -Force $zipPath
  }
  Write-Host "[Deken] Creating archive..."
  Compress-Archive -Path (Join-Path $outAbs "*") -DestinationPath $zipPath -CompressionLevel Optimal
  Write-Host "[Deken] Archive created: $zipPath"
}

Write-Host "[Deken] Bundle ready at: $outAbs"
