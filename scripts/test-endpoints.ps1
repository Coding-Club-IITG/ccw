$BASE = "http://localhost:3000"

# Build a proper WebRequestSession with the cookie
$webSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$c = New-Object System.Net.Cookie
$c.Name   = "better-auth.session_token"
$c.Value  = "BdbWOw6HoomLu2lmsXLsvFI9jKLsl2Hu.2w6ec8XkE2YyBzkZfMjii3UsWof32MUVdbMGpskLQCc="
$c.Domain = "localhost"
$c.Path   = "/"
$webSession.Cookies.Add($c)

function Invoke-Api {
  param([string]$Method, [string]$Path, [object]$Body = $null)
  $uri = "$BASE$Path"
  try {
    $p = @{ Method=$Method; Uri=$uri; WebSession=$webSession; UseBasicParsing=$true; ErrorAction="Stop" }
    if ($Body) { $p.Body = ($Body | ConvertTo-Json -Compress); $p.ContentType = "application/json" }
    $r = Invoke-WebRequest @p
    return @{ code=[int]$r.StatusCode; body=$r.Content }
  } catch {
    $code = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
    $bd = try { $_.ErrorDetails.Message } catch { "" }
    return @{ code=$code; body=$bd }
  }
}

function Get-Snippet($r) {
  if (-not $r.body) { return "(empty)" }
  try {
    $j = $r.body | ConvertFrom-Json | ConvertTo-Json -Compress -Depth 2
    if ($j.Length -gt 120) { return $j.Substring(0,120) + "..." }
    return $j
  } catch {
    if ($r.body.Length -gt 120) { return $r.body.Substring(0,120) + "..." }
    return $r.body
  }
}

$fid = "000000000000000000000001"

$tests = @(
  @{ label="GET  /api/auth/get-session";              exp=200; r=(Invoke-Api -Method GET    -Path "/api/auth/get-session") },
  @{ label="GET  /api/users (Member->403)";           exp=403; r=(Invoke-Api -Method GET    -Path "/api/users") },
  @{ label="GET  /api/files (200)";                   exp=200; r=(Invoke-Api -Method GET    -Path "/api/files") },
  @{ label="POST /api/files (Member->403)";           exp=403; r=(Invoke-Api -Method POST   -Path "/api/files") },
  @{ label="GET  /api/files/bad-id (400)";            exp=400; r=(Invoke-Api -Method GET    -Path "/api/files/not-valid") },
  @{ label="PATCH /api/files/bad-id (400)";           exp=400; r=(Invoke-Api -Method PATCH  -Path "/api/files/not-valid" -Body @{title="x"}) },
  @{ label="DELETE /api/files/bad-id (400)";          exp=400; r=(Invoke-Api -Method DELETE  -Path "/api/files/not-valid") },
  @{ label="GET  /api/files/$fid (404)";              exp=404; r=(Invoke-Api -Method GET    -Path "/api/files/$fid") },
  @{ label="PATCH /api/files/$fid (404)";             exp=404; r=(Invoke-Api -Method PATCH  -Path "/api/files/$fid" -Body @{title="x"}) },
  @{ label="DELETE /api/files/$fid (404)";            exp=404; r=(Invoke-Api -Method DELETE  -Path "/api/files/$fid") },
  @{ label="POST /api/cf/verify-handle (no CF->400)"; exp=400; r=(Invoke-Api -Method POST   -Path "/api/cf/verify-handle") }
)

Write-Host ""
Write-Host "========== Authenticated Endpoint Test Suite =========="
Write-Host ""
$pass = 0; $fail = 0
foreach ($t in $tests) {
  $ok   = ($t.r.code -eq $t.exp)
  if ($ok) { $pass++ } else { $fail++ }
  $icon = if ($ok) { "PASS" } else { "FAIL" }
  $snip = Get-Snippet $t.r
  Write-Host "[$icon]  $($t.label)"
  Write-Host "         HTTP $($t.r.code) (expected $($t.exp)) -- $snip"
  Write-Host ""
}
Write-Host "========== Results: $pass passed, $fail failed =========="
