$idlPath = "C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\web\node_modules\@pump-fun\pump-sdk\src\idl\pump.json"
$j = Get-Content -Raw $idlPath | ConvertFrom-Json
$bc = $j.accounts | Where-Object { $_.name -eq 'bondingCurve' }
$out = @()
foreach ($f in $bc.type.fields) {
  $out += ("{0} : {1}" -f $f.name, $f.type)
}
$out -join "`n" | Out-File -Encoding utf8 "C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\idl-bc-fields.txt"
$ver = (Get-Content -Raw "C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\web\node_modules\@pump-fun\pump-sdk\package.json" | ConvertFrom-Json).version
$ver | Out-File -Encoding utf8 "C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\pumpsdk-ver.txt"