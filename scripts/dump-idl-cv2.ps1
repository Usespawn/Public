$idlPath = "C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\web\node_modules\@pump-fun\pump-sdk\src\idl\pump.json"
$j = Get-Content -Raw $idlPath | ConvertFrom-Json
$cv = $j.instructions | Where-Object { $_.name -eq 'create_v2' }
$out = @()
foreach ($a in $cv.accounts) {
  $out += ("{0} | writable={1} | signer={2} | pda={3}" -f $a.name, [bool]$a.writable, [bool]$a.signer, [bool]$a.pda)
}
$argNames = $cv.args | ForEach-Object { $_.name }
$out += ("ARGS: " + ($argNames -join ", "))
$out += ("PROGRAM: " + $j.metadata.name + " v" + $j.metadata.version + " address=" + $j.metadata.address)
$out -join "`n" | Out-File -Encoding utf8 "C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\idl-cv2-accounts.txt"
