# Shared by setup, desktop build and host launch. Does not require Node to run.
function Test-PocketNodeVersion([string]$Value) {
    if ($Value -notmatch '^v?(\d+)\.(\d+)\.(\d+)$') { return $false }
    return ([int]$Matches[1] -ge 24 -or ([int]$Matches[1] -eq 22 -and [int]$Matches[2] -ge 12))
}
function Test-PocketNode([string]$Executable) {
    if (-not $Executable -or -not (Test-Path -LiteralPath $Executable -PathType Leaf)) { return $false }
    if (-not (Test-Path -LiteralPath (Join-Path (Split-Path -Parent $Executable) 'npm.cmd'))) { return $false }
    try { $value = & $Executable --version 2>$null; return ($LASTEXITCODE -eq 0 -and (Test-PocketNodeVersion ([string]$value))) } catch { return $false }
}
function Find-PocketNode([string]$RuntimeRoot,[switch]$PrivateOnly) {
    $candidates = @()
    if (-not $PrivateOnly) {
        $found = Get-Command node.exe -ErrorAction SilentlyContinue
        if ($found) { $candidates += $found.Source }
        foreach ($base in @($env:ProgramFiles,${env:ProgramFiles(x86)},(Join-Path $env:LOCALAPPDATA 'Programs'))) {
            if ($base) { $candidates += Join-Path $base 'nodejs/node.exe' }
        }
        # Registry PATH can be newer than the environment inherited by this terminal.
        foreach ($value in @($env:Path,[Environment]::GetEnvironmentVariable('Path','User'),[Environment]::GetEnvironmentVariable('Path','Machine'))) {
            foreach ($directory in ($value -split ';')) { if ($directory.Trim()) { $candidates += Join-Path ([Environment]::ExpandEnvironmentVariables($directory.Trim('"'))) 'node.exe' } }
        }
    }
    if (Test-Path -LiteralPath $RuntimeRoot) {
        $candidates += @(Get-ChildItem -LiteralPath $RuntimeRoot -Directory | Where-Object Name -Match '^node-v24\.\d+\.\d+-win-x64$' | Sort-Object LastWriteTimeUtc -Descending | ForEach-Object { Join-Path $_.FullName 'node.exe' })
    }
    foreach ($candidate in ($candidates | Select-Object -Unique)) { if (Test-PocketNode $candidate) { return [IO.Path]::GetFullPath($candidate) } }
    return $null
}
function Get-PocketNodeArchive([string]$Checksums) {
    $matches = [regex]::Matches($Checksums,'(?m)^([a-fA-F0-9]{64})\s+(node-v24\.\d+\.\d+-win-x64\.zip)\s*$')
    if ($matches.Count -ne 1) { throw 'Official Node.js download metadata is invalid.' }
    return @{ Hash=$matches[0].Groups[1].Value; Name=$matches[0].Groups[2].Value }
}
function Install-PocketNodeArchive([string]$Archive,[string]$Hash,[string]$Name,[string]$RuntimeRoot) {
    if ($Name -notmatch '^node-v24\.\d+\.\d+-win-x64\.zip$' -or $Hash -notmatch '^[a-fA-F0-9]{64}$') { throw 'Invalid Node.js archive metadata.' }
    if ((Get-FileHash -LiteralPath $Archive -Algorithm SHA256).Hash -ne $Hash) { throw 'Node.js download checksum mismatch. Nothing was installed.' }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $folder=[IO.Path]::GetFileNameWithoutExtension($Name)
    $zip=[IO.Compression.ZipFile]::OpenRead($Archive)
    try { foreach ($entry in $zip.Entries) { if (-not $entry.FullName.StartsWith($folder+'/',[StringComparison]::Ordinal) -or $entry.FullName -match '(^|[/\\])\.\.([/\\]|$)|:|\\') { throw 'Unsafe Node.js archive entry.' } } } finally { $zip.Dispose() }
    $stage=Join-Path ([IO.Path]::GetFullPath($RuntimeRoot)) ('install-'+[guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Force -Path $stage | Out-Null
    try {
        Expand-Archive -LiteralPath $Archive -DestinationPath $stage
        $executable=Join-Path $stage ($folder+'/node.exe')
        if (-not (Test-PocketNode $executable)) { throw 'Downloaded Node.js did not pass its runtime check.' }
        $destination=Join-Path $RuntimeRoot $folder
        if (Test-Path -LiteralPath $destination) { throw 'A damaged private Node.js installation already exists. Remove only that version folder and retry.' }
        Move-Item -LiteralPath (Join-Path $stage $folder) -Destination $destination
        return Join-Path $destination 'node.exe'
    } finally {
        $resolved=[IO.Path]::GetFullPath($stage);$boundary=[IO.Path]::GetFullPath($RuntimeRoot).TrimEnd('\')+'\'
        if ($resolved.StartsWith($boundary,[StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $resolved)) { Remove-Item -LiteralPath $resolved -Recurse -Force }
    }
}
function Ensure-PocketNode([switch]$PrivateOnly) {
    if (-not [Environment]::Is64BitOperatingSystem) { throw 'Pocket Code requires 64-bit Windows.' }
    $runtime=Join-Path $env:LOCALAPPDATA 'Pocket Code/runtime/node'
    $identity=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    $mutex=New-Object Threading.Mutex($false,('Local\PocketCodeNode-'+$identity));$locked=$false
    try {
        try { $locked=$mutex.WaitOne(300000) } catch [Threading.AbandonedMutexException] { $locked=$true }
        if (-not $locked) { throw 'Another Pocket Code setup is still preparing Node.js. Retry shortly.' }
        $node=Find-PocketNode $runtime -PrivateOnly:$PrivateOnly
        if (-not $node) {
            Write-Host 'Downloading a private Node.js 24 LTS runtime. Administrator access is not required.'
            [Net.ServicePointManager]::SecurityProtocol=[Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
            $ProgressPreference='SilentlyContinue'
            $metadata=Get-PocketNodeArchive ([string](Invoke-WebRequest -UseBasicParsing 'https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt' -TimeoutSec 60).Content)
            New-Item -ItemType Directory -Force -Path $runtime | Out-Null
            $archive=Join-Path $runtime ('download-'+[guid]::NewGuid().ToString('N')+'.zip')
            try {
                $release=$metadata.Name -replace '^node-','' -replace '-win-x64.zip$',''
                Invoke-WebRequest -UseBasicParsing ('https://nodejs.org/dist/'+$release+'/'+$metadata.Name) -OutFile $archive -TimeoutSec 180
                $node=Install-PocketNodeArchive $archive $metadata.Hash $metadata.Name $runtime
            } finally { if (Test-Path -LiteralPath $archive) { Remove-Item -LiteralPath $archive -Force } }
        }
        $env:Path=(Split-Path -Parent $node)+';'+$env:Path
        Write-Host ('Node.js ready: '+(& $node --version))
        return $node
    } finally { if ($locked) { $mutex.ReleaseMutex() };$mutex.Dispose() }
}
function Ensure-PocketDependencies([string]$Root) {
    $node=Ensure-PocketNode
    $npm=Join-Path (Split-Path -Parent $node) 'npm.cmd'
    $sha=[Security.Cryptography.SHA256]::Create()
    try { $id=[BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes([IO.Path]::GetFullPath($Root).ToLowerInvariant()))).Replace('-','') } finally { $sha.Dispose() }
    $mutex=New-Object Threading.Mutex($false,('Local\PocketCodeDependencies-'+$id));$locked=$false
    Push-Location -LiteralPath $Root
    try {
        try { $locked=$mutex.WaitOne(300000) } catch [Threading.AbandonedMutexException] { $locked=$true }
        if(-not $locked){throw 'Another setup is installing dependencies. Retry shortly.'}
        $ready=(Test-Path -LiteralPath 'node_modules/.bin/tsc.cmd') -and (Test-Path -LiteralPath 'node_modules/.bin/vite.cmd') -and (Test-Path -LiteralPath 'node_modules/tsx/package.json')
        if ($ready) { & $npm ls --depth=0 --include=dev --silent *> $null; $ready=$LASTEXITCODE -eq 0 }
        if (-not $ready) {
            Write-Host 'Installing Pocket Code dependencies, including build tools...'
            & $npm ci --include=dev --no-audit --no-fund
            if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed. Check the connection and retry Setup Pocket Code.cmd.' }
        }
        if (-not (Test-Path -LiteralPath 'node_modules/.bin/tsc.cmd')) { throw 'TypeScript build tools are still missing after installation.' }
    } finally { Pop-Location;if($locked){$mutex.ReleaseMutex()};$mutex.Dispose() }
}
