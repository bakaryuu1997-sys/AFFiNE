<#
  Builds the AFFiNE personal app as a Windows installer with Tauri.

  Run it in PowerShell on Windows (the .exe has to be built with the Windows
  toolchain). Needs: Rust (cargo), Visual Studio Build Tools (C++), Node.
  The web app is built first inside WSL (see README.md) and passed with -WebDist.

    .\build-windows.ps1 -WebDist "\\wsl.localhost\Ubuntu\home\<you>\AFFiNE\packages\frontend\apps\web\dist"

  Output (in the work folder): the NSIS installer and affine-mcp.exe.
#>
param(
  [Parameter(Mandatory = $true)][string]$WebDist,
  # a short ASCII path: the C++ toolchain does not like long or accented ones
  [string]$Work = 'C:\affine-build'
)

$ErrorActionPreference = 'Stop'
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$Project = Split-Path -Parent $Here

if (-not (Test-Path (Join-Path $WebDist 'index.html'))) {
  throw "No index.html in $WebDist. Build the web app first (see README.md)."
}
foreach ($tool in 'cargo', 'node', 'npx') {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "$tool is not on PATH." }
}

Write-Host "==> Copying the project to $Work"
New-Item -ItemType Directory -Force -Path $Work | Out-Null
# keep target\ between runs so Rust does not recompile everything
robocopy $Project $Work /MIR /XD target web-dist node_modules .git /XF Cargo.lock.bak /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed ($LASTEXITCODE)" }

Write-Host "==> Copying the web app"
$Dist = Join-Path $Work 'web-dist'
robocopy $WebDist $Dist /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy of the web app failed ($LASTEXITCODE)" }

Push-Location $Work
try {
  Write-Host '==> Building the MCP command line tool (affine-mcp.exe)'
  cargo build --release -p affine-mcp-bridge
  if ($LASTEXITCODE -ne 0) { throw 'cargo build failed' }

  Write-Host '==> Building the app and the installer (the first run takes a while)'
  npx --yes '@tauri-apps/cli@2' build
  if ($LASTEXITCODE -ne 0) { throw 'tauri build failed' }

  $Installer = Get-ChildItem (Join-Path $Work 'target\release\bundle\nsis') -Filter *.exe | Select-Object -First 1
  Write-Host ''
  Write-Host 'Done:'
  if ($Installer) { Write-Host "  installer : $($Installer.FullName)" }
  Write-Host "  app       : $(Join-Path $Work 'target\release\affine-personal.exe')"
  Write-Host "  mcp tool  : $(Join-Path $Work 'target\release\affine-mcp.exe')"
}
finally {
  Pop-Location
}
