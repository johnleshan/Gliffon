$ErrorActionPreference = 'Stop'
$base = 'https://gliffon.vercel.app'

function J($o) { $o | ConvertTo-Json -Compress }

# A: signs up typing ONLY a handle (no display name) -> server must derive a real name
$ida = 'e2e-a-' + (Get-Random)
Invoke-RestMethod "$base/api/users" -Method POST -ContentType 'application/json' `
  -Body (J @{ id = $ida; glyphname = 'river'; name = ''; symbol = '❋' }) | Out-Null
$ua = (Invoke-RestMethod "$base/api/users") | Where-Object { $_.id -eq $ida }
"signup A (handle only): name='$($ua.name)' handle='$($ua.glyphname)' sym='$($ua.symbol)'"

# B: signs up with a handle-shaped display name -> must not stay '@handle'
$idb = 'e2e-b-' + (Get-Random)
Invoke-RestMethod "$base/api/users" -Method POST -ContentType 'application/json' `
  -Body (J @{ id = $idb; glyphname = 'ember'; name = '@ember'; symbol = '✧' }) | Out-Null
$ub = (Invoke-RestMethod "$base/api/users") | Where-Object { $_.id -eq $idb }
"signup B (name=@ember): name='$($ub.name)' handle='$($ub.glyphname)'"

# A casts a glyph, B likes it
$wid = 'e2e-w-' + (Get-Random)
Invoke-RestMethod "$base/api/wall" -Method POST -ContentType 'application/json' `
  -Body (J @{ id = $wid; kind = 'love'; symbol = '🫶'; label = 'held your hand'; author = $ida }) | Out-Null
Invoke-RestMethod "$base/api/like" -Method POST -ContentType 'application/json' `
  -Body (J @{ wall_id = $wid; user_id = $idb }) | Out-Null

# A polls live exactly like the app does
$after = [long][DateTimeOffset]::UtcNow.AddSeconds(-5).ToUnixTimeMilliseconds()
$d = Invoke-RestMethod "$base/api/live?me=$ida&after=$after"
foreach ($l in $d.liked) { "OWNER TOAST -> symbol='$($l.liker_symbol)' handle='$($l.liker_handle)' name='$($l.liker_name)' glyph='$($l.glyph_label)'" }
foreach ($r in ($d.wall | Where-Object { $_.id -eq $wid })) { "WALL ROW -> author_name='$($r.author_name)' author_handle='$($r.author_handle)' author_symbol='$($r.author_symbol)' likes=$($r.likes)" }

# B sends A a DM; A must see the sender's handle in the live payload
Invoke-RestMethod "$base/api/messages" -Method POST -ContentType 'application/json' `
  -Body (J @{ conv = (@($ida, $idb) | Sort-Object) -join '|'; sender = $idb; text = 'your glyph spoke to me' }) | Out-Null
$after2 = [long][DateTimeOffset]::UtcNow.AddSeconds(-5).ToUnixTimeMilliseconds()
$d2 = Invoke-RestMethod "$base/api/live?me=$ida&after=$after2"
foreach ($m in $d2.msgs) { "DM -> sender_handle='$($m.sender_handle)' sender_name='$($m.sender_name)' text='$($m.text)'" }

# cleanup
Invoke-RestMethod "$base/api/wall" -Method Delete | Out-Null
"cleanup attempted"
