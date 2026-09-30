param([Parameter(Mandatory=$true)][string]$RuntimeDirectory,[Parameter(Mandatory=$true)][string]$StoragePath,[int]$Port=4318)
$ErrorActionPreference='Stop'
if(-not ('PocketCodeOwnedHost' -as [type])){Add-Type -Path (Join-Path $PSScriptRoot 'OwnedHost.cs')}
$node=(Get-Command node.exe -ErrorAction Stop).Source
$owner=$null
try {
    $owner=[PocketCodeOwnedHost]::Start($node,'--import tsx server/index.ts',$RuntimeDirectory)
    $currentProcessId=$owner.ProcessId
    $missingSince=$null
    while($owner.ActiveCount -gt 0){
        Start-Sleep -Milliseconds 400
        if($owner.Contains($currentProcessId)){$missingSince=$null;continue}
        if(-not $missingSince){$missingSince=[DateTime]::UtcNow}
        # A release worker may replace the host; it remains in this same owned job.
        try {
            $token=if($env:POCKET_TOKEN){$env:POCKET_TOKEN}else{(Get-Content -LiteralPath (Join-Path $StoragePath 'connection-key.txt') -Raw).Trim()}
            $health=Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/health" -Headers @{Authorization='Bearer '+$token} -TimeoutSec 2
            if($health.processId -and $owner.Contains([int]$health.processId)){$currentProcessId=[int]$health.processId;$missingSince=$null;continue}
        }catch{}
        $grace=5
        try{$status=Get-Content -LiteralPath (Join-Path $StoragePath 'host/status.json') -Raw|ConvertFrom-Json;if($status.state -eq 'restarting'){$grace=90}}catch{}
        if(([DateTime]::UtcNow-$missingSince).TotalSeconds -ge $grace){break}
    }
    $exitCode=$owner.ExitCode
    if($exitCode -ne 0){throw "Pocket Code exited with code $exitCode."}
} finally {
    # Ctrl+C and ordinary completion close the job; window/process closure is enforced by Windows.
    if($owner){$owner.Dispose()}
}
