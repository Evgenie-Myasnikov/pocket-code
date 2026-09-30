param(
    [Parameter(Mandatory=$true)][string]$SourcePath,
    [Parameter(Mandatory=$true)][string]$NodePath,
    [Parameter(Mandatory=$true)][string]$FixtureDirectory
)
$ErrorActionPreference='Stop'
Add-Type -Path $SourcePath
$owner=$null
try {
    $script=Join-Path $FixtureDirectory 'synthetic-host.mjs'
    $arguments='"'+$script+'" old "'+$FixtureDirectory+'"'
    $owner=[PocketCodeOwnedHost]::Start($NodePath,$arguments,$FixtureDirectory)
    while(-not (Test-Path -LiteralPath (Join-Path $FixtureDirectory 'dispose'))){
        $members=@{}
        foreach($name in @('old','detached','replacement')){
            $record=Join-Path $FixtureDirectory ($name+'.json')
            if(Test-Path -LiteralPath $record){
                try{$processRecord=Get-Content -LiteralPath $record -Raw|ConvertFrom-Json;$members[$name]=$owner.Contains([int]$processRecord.processId)}catch{}
            }
        }
        $state=@{processId=$owner.ProcessId;activeCount=$owner.ActiveCount;members=$members}|ConvertTo-Json -Compress
        [IO.File]::WriteAllText((Join-Path $FixtureDirectory 'owner.json'),$state)
        Start-Sleep -Milliseconds 80
    }
} finally {
    if($owner){$owner.Dispose()}
}
