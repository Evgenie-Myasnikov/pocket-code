$ErrorActionPreference = 'Stop'
$directory = Join-Path (Split-Path -Parent $PSScriptRoot) '.tools/cloudflared'
$binary = Join-Path $directory 'cloudflared.exe'
$expectedHash = 'f096265ec2fcbe9bb6e2d64268db167ced3fcbb83d894bdb9e2fcdb26f2ea7e2'
New-Item -ItemType Directory -Force -Path $directory | Out-Null
if (-not (Test-Path -LiteralPath $binary) -or (Get-FileHash -LiteralPath $binary -Algorithm SHA256).Hash -ne $expectedHash) {
    Write-Host 'Downloading verified Cloudflare tunnel helper (2026.9.3)...'
    $downloadPath = Join-Path $directory 'cloudflared.download'
    & curl.exe --fail --location --silent --show-error --retry 2 --output $downloadPath 'https://github.com/cloudflare/cloudflared/releases/download/2026.9.3/cloudflared-windows-amd64.exe'
    if ($LASTEXITCODE -ne 0) { throw 'Could not download the internet helper. Check PC internet access.' }
    if ((Get-FileHash -LiteralPath $downloadPath -Algorithm SHA256).Hash -ne $expectedHash) { throw 'Tunnel helper checksum mismatch. File was not executed.' }
    Move-Item -LiteralPath $downloadPath -Destination $binary -Force
}
$env:POCKET_TUNNEL_EXE = $binary
