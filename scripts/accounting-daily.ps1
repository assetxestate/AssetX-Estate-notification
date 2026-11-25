# งานตรวจเอกสารบัญชีประจำวัน (Task Scheduler "AssetX Accounting Daily" 08:30 น. · เครื่องปิดอยู่ = ทำตอนเปิดเครื่องครั้งถัดไป)
# 1) ดึงไฟล์จากกล่องบนระบบและดูว่ามีของใหม่ไหม (ไม่ใช้ AI)  2) มีของใหม่จึงเรียก Claude แบบไม่มีหน้าต่างมาอ่านและจัด
# Claude ในงานนี้ใช้ได้แค่: อ่านไฟล์ เขียนไฟล์ใน .local/accounting และคำสั่งของ scripts/accounting-daily.mjs / accounting-inbox.mjs
# บันทึกการทำงาน: .local/accounting/daily-<วันที่>.log (ไม่ขึ้น git)
# ลองเอง: powershell -ExecutionPolicy Bypass -File scripts\accounting-daily.ps1 [-Force]
param([switch]$Force)

$ErrorActionPreference = 'Continue'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repo
$stateDir = Join-Path $repo '.local\accounting'
New-Item -ItemType Directory -Force $stateDir | Out-Null
$log = Join-Path $stateDir ("daily-{0}.log" -f (Get-Date -Format 'yyyy-MM-dd'))
function Write-Log([string]$text) { ("[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $text) | Out-File -FilePath $log -Append -Encoding utf8 }

Write-Log 'start'
$check = & node scripts/accounting-daily.mjs check
$code = $LASTEXITCODE
Write-Log ("check: {0} (exit {1})" -f ($check -join ' | '), $code)
if ($code -ne 10 -and -not $Force) {
  & node scripts/accounting-daily.mjs done | Out-Null
  Write-Log 'nothing new - end'
  exit 0
}

# โปรแกรม Claude ที่มากับส่วนขยาย VS Code (เลขรุ่นเปลี่ยนเมื่ออัปเดต จึงหาใหม่ทุกครั้ง)
$exe = Get-ChildItem -Path (Join-Path $env:USERPROFILE '.vscode\extensions') -Filter 'claude.exe' -Recurse -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -match 'anthropic\.claude-code-.*native-binary' } |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $exe) { Write-Log 'claude.exe not found - end'; exit 1 }

$prompt = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'accounting-daily-prompt.md') -Raw -Encoding UTF8
$promptFile = Join-Path $stateDir 'prompt.txt'
[IO.File]::WriteAllText($promptFile, $prompt, (New-Object Text.UTF8Encoding($false)))
$outFile = Join-Path $stateDir 'claude-out.txt'
$errFile = Join-Path $stateDir 'claude-err.txt'
$allowed = 'Read,Glob,Grep,Write,Edit,Bash(node scripts/accounting-daily.mjs:*),Bash(node scripts/accounting-inbox.mjs:*)'
$arguments = @('-p', '--permission-mode', 'acceptEdits', '--allowedTools', "`"$allowed`"", '--max-turns', '80')
$proc = Start-Process -FilePath $exe.FullName -ArgumentList $arguments -WorkingDirectory $repo -WindowStyle Hidden -PassThru `
  -RedirectStandardInput $promptFile -RedirectStandardOutput $outFile -RedirectStandardError $errFile
if (-not $proc.WaitForExit(25 * 60 * 1000)) {
  try { $proc.Kill() } catch {}
  Write-Log 'claude timed out after 25 min'
} else {
  $proc.WaitForExit()
  Write-Log ("claude exit {0}" -f $proc.ExitCode)
}
if (Test-Path $outFile) { Get-Content -LiteralPath $outFile -Encoding UTF8 | Out-File -FilePath $log -Append -Encoding utf8 }
Write-Log 'end'
