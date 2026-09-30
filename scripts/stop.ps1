param([int]$Port=4318)
$ErrorActionPreference='Stop'
$storage=if($env:POCKET_DATA_DIR){[IO.Path]::GetFullPath($env:POCKET_DATA_DIR)}else{Join-Path $env:USERPROFILE '.pocket-code'}
if(-not (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)){Write-Host 'Pocket Code is not running.';return}
$token=if($env:POCKET_TOKEN){$env:POCKET_TOKEN}else{(Get-Content -LiteralPath (Join-Path $storage 'connection-key.txt') -Raw).Trim()}
$headers=@{Authorization='Bearer '+$token}
$runtime=Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/runtime" -Headers $headers -TimeoutSec 5
if($runtime.applicationId -ne 'app.pocketcode.host'){throw 'This is not a supported Pocket Code server. No process was stopped.'}
$null=Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/runtime/stop" -Method Post -ContentType 'application/json' -Body '{}' -Headers $headers -TimeoutSec 5
Write-Host 'Pocket Code is finishing. It will not restart.'
