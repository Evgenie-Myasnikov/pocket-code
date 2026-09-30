param([string]$JavaHome, [string]$AndroidHome)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
if ($JavaHome) { $env:JAVA_HOME = $JavaHome }
elseif (Test-Path -LiteralPath '.tools/jdk') { $env:JAVA_HOME = (Get-ChildItem '.tools/jdk' -Directory | Select-Object -First 1).FullName }
if ($AndroidHome) { $env:ANDROID_HOME = $AndroidHome }
elseif (Test-Path -LiteralPath '.tools/android-sdk') { $env:ANDROID_HOME = Join-Path $projectRoot '.tools/android-sdk' }
if (-not $env:JAVA_HOME -or -not $env:ANDROID_HOME) { throw 'Set JAVA_HOME to JDK 21 and ANDROID_HOME to Android SDK with platform 36 and build-tools 36.0.0.' }
& npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Web build failed' }
& npx.cmd cap sync android
if ($LASTEXITCODE -ne 0) { throw 'Android sync failed' }
Push-Location android
try { & .\gradlew.bat --no-daemon assembleDebug; if ($LASTEXITCODE -ne 0) { throw 'APK build failed' } }
finally { Pop-Location }
New-Item -ItemType Directory -Force artifacts | Out-Null
$version = (Get-Content -Raw -LiteralPath 'package.json' | ConvertFrom-Json).version
$apkPath = 'artifacts/Pocket-Code-' + $version + '.apk'
Copy-Item -LiteralPath 'android/app/build/outputs/apk/debug/app-debug.apk' -Destination $apkPath -Force
Write-Host ('APK: ' + $apkPath)

& node scripts/build-host.mjs
if ($LASTEXITCODE -ne 0) { throw 'Host bundle failed' }
& node scripts/release-manifest.mjs
if ($LASTEXITCODE -ne 0) { throw 'Release manifest failed' }
