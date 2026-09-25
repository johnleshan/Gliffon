$ErrorActionPreference = 'Stop'
$base = 'https://gliffon.vercel.app'
function J($o) { $o | ConvertTo-Json -Compress }

$ida = 'e2e-a-' + (Get-Random)
$idb = 'e2e-b-' + (Get-Random)
Invoke-RestMethod "$base/api/users" -Method POST -ContentType 'application/json' -Body (J @{ id = $ida; glyphname = 'river' + (Get-Random); name = ''; symbol = '❋' }) | Out-Null
Invoke-RestMethod "$base/api/users" -Method POST -ContentType 'application/json' -Body (J @{ id = $idb; glyphname = 'ember' + (Get-Random); name = 'Ember'; symbol = '✧' }) | Out-Null
$ua = (Invoke-RestMethod "$base/api/users") | Where-Object { $_.id -eq $ida }
$ub = (Invoke-RestMethod "$base/api/users") | Where-Object { $_.id -eq $idb }
"A='$($ua.glyphname)/$($ua.name)'  B='$($ub.glyphname)/$($ub.name)'"

$conv = (@($ida, $idb) | Sort-Object) -join '|'
Invoke-RestMethod "$base/api/messages" -Method POST -ContentType 'application/json' `
  -Body (J @{ id = [guid]::NewGuid().ToString(); conv = $conv; sender = $idb; text = 'your glyph spoke to me' }) | Out-Null

$after = [long][DateTimeOffset]::UtcNow.AddSeconds(-5).ToUnixTimeMilliseconds()
$d = Invoke-RestMethod "$base/api/live?me=$ida&after=$after"
foreach ($m in $d.msgs) { "DM LIVE -> sender_handle='$($m.sender_handle)' sender_name='$($m.sender_name)' text='$($m.text)'" }

# B opens the thread from its side too
$tb = Invoke-RestMethod "$base/api/messages?conv=$([uri]::EscapeDataString($conv))"
"B reads thread: $($tb.Count) msg(s)"

# cleanup
Invoke-RestMethod "$base/api/messages" -Method POST -ContentType 'application/json' `
  -Body (J @{ id = 'cleanup-' + (Get-Random); conv = 'noop'; sender = $ida; text = 'x' }) | Out-Null
node scripts/cleanup-e2e.mjs
"cleanup done"
