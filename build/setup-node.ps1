# Installs Node.js (LTS) portably under C:\Users\Samuel\tools\node - no admin, no system changes.
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$toolsDir = 'C:\Users\Samuel\tools'
$nodeDir  = Join-Path $toolsDir 'node'

function Resolve-Node {
  $c = Get-Command node -ErrorAction SilentlyContinue
  if ($c) { return $c.Source }
  if (Test-Path (Join-Path $nodeDir 'node.exe')) { return (Join-Path $nodeDir 'node.exe') }
  return $null
}

$found = Resolve-Node
if ($found) {
  Write-Host "Node already installed at: $found"
  & $found -v
  exit 0
}

Write-Host "No Node.js found. Installing portable LTS (no admin needed)..."

$arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }
Write-Host "Architecture: win-$arch"

Write-Host "Querying nodejs.org for the latest LTS version..."
$index = Invoke-RestMethod -Uri 'https://nodejs.org/dist/index.json' -UseBasicParsing -TimeoutSec 60
$lts = $index | Where-Object { $_.lts } | Select-Object -First 1
if (-not $lts) { throw "Could not determine LTS version." }
$ver = $lts.version
Write-Host "Latest LTS: $ver (codename $($lts.lts))"

$zipName = "node-$ver-win-$arch.zip"
$url     = "https://nodejs.org/dist/$ver/$zipName"
New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null
$zipPath = Join-Path $toolsDir $zipName
Write-Host "Downloading $url ..."
Invoke-WebRequest -Uri $url -OutFile $zipPath -UseBasicParsing -TimeoutSec 600
Write-Host ("Downloaded {0:N1} MB" -f ((Get-Item $zipPath).Length/1MB))

$tmp = Join-Path $toolsDir '_extract'
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
Write-Host "Extracting..."
Expand-Archive -Path $zipPath -DestinationPath $tmp -Force
$inner = Get-ChildItem $tmp -Directory | Select-Object -First 1
if (Test-Path $nodeDir) { Remove-Item $nodeDir -Recurse -Force }
Move-Item $inner.FullName $nodeDir
Remove-Item $tmp -Recurse -Force
Remove-Item $zipPath -Force

$userPath = [Environment]::GetEnvironmentVariable('Path','User')
if ($null -eq $userPath) { $userPath = '' }
if ($userPath -notlike "*$nodeDir*") {
  [Environment]::SetEnvironmentVariable('Path', ($userPath.TrimEnd(';') + ';' + $nodeDir), 'User')
  Write-Host "Added Node to your user PATH (new terminals will have 'node')."
}
$env:Path = $nodeDir + ';' + $env:Path

Write-Host "--- Verification ---"
Write-Host ("node: " + (& (Join-Path $nodeDir 'node.exe') -v))
Write-Host ("npm:  " + (& (Join-Path $nodeDir 'npm.cmd') -v))
Write-Host "DONE. Node.js ready at: $nodeDir"
