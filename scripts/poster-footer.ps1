# scripts/poster-footer.ps1 — วางแถบท้ายแบรนด์ (โลโก้จริงพื้นโปร่งใส + เบอร์/LINE จัดตัวพิมพ์เอง) ลงบนโปสเตอร์โหมดอิสระหลังเจนเสร็จ
#
# เจ้าของ 8 พ.ย. 2569: "ปรับในส่วนของโลโก้ และเบอร์โทรและไลน์ให้ดูเป็นระเบียบและสวยงามกว่านี้ รูปโลโก้อาจจะลบพื้นขาวออกให้เหลือแต่โลโก้กับตัวหนังสือ"
# Codex ไม่วาดโลโก้/เบอร์/LINE เอง (คำสั่งบอกให้เว้นแถบล่างเป็นพื้นหลังเฉย ๆ) — สคริปต์นี้วางของจริงให้เหมือนกันทุกภาพ:
#   ม่านไล่สีน้ำเงินเข้มจากใสด้านบนลงไปทึบด้านล่าง · โลโก้แนวนอน (public/logo-lockup-white.png) ชิดซ้าย · ไอคอน + เบอร์ / LINE สองบรรทัดชิดขวา
# ความสูงแถบ F = min(16.5% ของกว้าง, 14% ของสูง) — ตรงกับ footerShare() ใน src/lib/posterFree.js ที่บอก Codex ให้เว้นที่
# เจ้าของ 9 พ.ย. 2569: "เบอร์โทรศัพท์และไลน์ อยากให้ดูพรีเมียมและเป็นทางการกว่านี้… ไลน์ก็ใช้เป็นสัญลักษณ์ของจริง"
#   → บล็อกติดต่อเป็นภาพสำเร็จ (public/contact-block-stacked.png / -inline.png จาก scripts/make-contact-block.mjs: ไอคอน LINE ทางการ + ไอคอนโทรศัพท์ทึบ + Kanit SemiBold)
#   ส่ง -Contact (สองแถว) และ -ContactInline (แถวเดียว ใช้กับภาพแนวนอน) · ไม่ส่ง = วาดตัวอักษรเองแบบเดิม (-FontFile -Phone -Line)
# ใช้: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/poster-footer.ps1 -Src in.jpg -Dst out.jpg -Logo logo.png -Contact public/contact-block-stacked.png -ContactInline public/contact-block-inline.png
param(
  [Parameter(Mandatory)][string]$Src,
  [Parameter(Mandatory)][string]$Dst,
  [Parameter(Mandatory)][string]$Logo,
  [string]$Contact = '',
  [string]$ContactInline = '',
  [string]$FontFile = '',
  [string]$Phone = '',
  [string]$Line = ''
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$img = [System.Drawing.Image]::FromFile($Src)
$logoImg = [System.Drawing.Image]::FromFile($Logo)
$fonts = New-Object System.Drawing.Text.PrivateFontCollection
$contactImg = $null
# ภาพแนวนอน (กว้าง/สูง > 1.3) แถบท้ายเตี้ย → แบบแถวเดียว ไอคอนจะได้สูงพอ (LINE กำหนดขั้นต่ำ 40 px บนมือถือ)
$wide = ($img.Width / $img.Height) -gt 1.3
$contactFile = if ($wide -and $ContactInline -and (Test-Path $ContactInline)) { $ContactInline } elseif ($Contact -and (Test-Path $Contact)) { $Contact } else { '' }
if ($contactFile) { $contactImg = [System.Drawing.Image]::FromFile($contactFile) }
elseif (-not ($FontFile -and $Phone -and $Line)) { throw 'ต้องส่ง -Contact (ภาพบล็อกติดต่อ) หรือ -FontFile -Phone -Line อย่างใดอย่างหนึ่ง' }
if (-not $contactImg) { $fonts.AddFontFile($FontFile) }
try {
  $W = $img.Width; $H = $img.Height
  $F = [int][math]::Round([math]::Min($W * 0.165, $H * 0.14))
  $pad = [int][math]::Round($W * 0.055)

  $bmp = New-Object System.Drawing.Bitmap $W, $H
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
  $g.DrawImage($img, 0, 0, $W, $H)

  # ม่านไล่สี: เริ่มที่ 1.9F จากขอบล่าง ใส → ทึบเกือบเต็มในแถบ F ล่างสุด (น้ำเงินแบรนด์ #08213f)
  $scrimTop = $H - [int][math]::Round($F * 1.9)
  # กรอบไล่สีกว้างกว่าพื้นที่เติม 2 px ทั้งบนล่าง — แถวที่อยู่นอกกรอบจะถูกเติมด้วยสีปลายทาง (เคยเห็นเป็นเส้นเข้มที่ขอบบน)
  $rect = New-Object System.Drawing.Rectangle 0, ($scrimTop - 2), $W, ($H - $scrimTop + 4)
  $navy = [System.Drawing.Color]::FromArgb(255, 8, 33, 63)
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, $navy, $navy, 90.0
  $blend = New-Object System.Drawing.Drawing2D.ColorBlend 4
  $blend.Colors = @(
    [System.Drawing.Color]::FromArgb(0, 8, 33, 63),
    [System.Drawing.Color]::FromArgb(150, 8, 33, 63),
    [System.Drawing.Color]::FromArgb(228, 8, 33, 63),
    [System.Drawing.Color]::FromArgb(250, 8, 33, 63)
  )
  # ล่างสุดเกือบทึบ (250/255) — ไอคอน LINE ต้องอยู่บนพื้นเรียบ ไม่ใช่บนภาพ (กติกา "Use on a background" ของ LINE)
  $blend.Positions = [single[]]@(0.0, 0.32, 0.5, 1.0)
  $brush.InterpolationColors = $blend
  $g.FillRectangle($brush, (New-Object System.Drawing.Rectangle 0, $scrimTop, $W, ($H - $scrimTop)))
  $brush.Dispose()

  $bandTop = $H - $F

  # เส้นบางสีไซยานคั่นเหนือแถบ (โปร่ง 35%)
  $hair = [math]::Max(1, [int][math]::Round($W / 1024))
  $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(90, 66, 199, 216)), $hair
  $g.DrawLine($pen, $pad, $bandTop, $W - $pad, $bandTop)
  $pen.Dispose()

  if ($contactImg) {
    # บล็อกติดต่อสำเร็จรูป: สองแถวสูง 70% ของ F · แถวเดียว (ภาพแนวนอน) สูง 56% ของ F — ไอคอนในบล็อกกินราว 85% ของความสูงแถว
    $blockH = [int][math]::Round($F * $(if ($contactFile -eq $ContactInline) { 0.56 } else { 0.70 }))
    $blockW = [int][math]::Round($contactImg.Width * $blockH / $contactImg.Height)
    $maxBlockW = [int](($W - 2 * $pad) * 0.55)
    if ($blockW -gt $maxBlockW) { $blockW = $maxBlockW; $blockH = [int][math]::Round($contactImg.Height * $blockW / $contactImg.Width) }
    # โลโก้ 48% ของ F (เจ้าของบอกขนาดโอเค 9 พ.ย. 2569) · แบบแถวเดียวแถบเตี้ย ตัวหนังสือโลโก้จะเล็กกว่าเบอร์มาก → 62%
    $logoH = [int][math]::Round($F * $(if ($contactFile -eq $ContactInline) { 0.62 } else { 0.48 }))
    $logoW = [int][math]::Round($logoImg.Width * $logoH / $logoImg.Height)
    $maxLogoW = $W - 2 * $pad - $blockW - [int]($W * 0.06)
    if ($logoW -gt $maxLogoW) { $logoW = [math]::Max(40, $maxLogoW); $logoH = [int][math]::Round($logoImg.Height * $logoW / $logoImg.Width) }
    $logoY = $bandTop + [int](($F - $logoH) / 2)
    $g.DrawImage($logoImg, (New-Object System.Drawing.Rectangle $pad, $logoY, $logoW, $logoH))
    # ย่อภาพบล็อก (×3) ลงทีเดียวด้วย HighQualityBicubic + ขอบแบบ TileFlipXY กันขอบโปร่งใสมีเส้นจาง
    $attr = New-Object System.Drawing.Imaging.ImageAttributes
    $attr.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)
    $blockX = $W - $pad - $blockW
    $blockY = $bandTop + [int](($F - $blockH) / 2)
    $g.DrawImage($contactImg, (New-Object System.Drawing.Rectangle $blockX, $blockY, $blockW, $blockH), 0, 0, $contactImg.Width, $contactImg.Height, [System.Drawing.GraphicsUnit]::Pixel, $attr)
    $attr.Dispose()
  } else {
  # ข้อความติดต่อ (ทางสำรองเมื่อไม่มีภาพบล็อก): Kanit ขนาด 16.5% ของ F · ไอคอน Segoe MDL2 (โทรศัพท์ E717 · ข้อความ E8BD) สีไซยาน
  $size = [single]([math]::Round($F * 0.165))
  $font = New-Object System.Drawing.Font $fonts.Families[0], $size, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
  $iconFont = New-Object System.Drawing.Font 'Segoe MDL2 Assets', ([single]($size * 0.92)), ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
  $fmt = [System.Drawing.StringFormat]::GenericTypographic
  $wPhone = $g.MeasureString($Phone, $font, 10000, $fmt).Width
  $wLine = $g.MeasureString($Line, $font, 10000, $fmt).Width
  $textW = [math]::Ceiling([math]::Max($wPhone, $wLine) * 1.04)
  $iconCol = [int][math]::Round($size * 1.45)
  $lineH = [int][math]::Round($size * 1.55)
  $blockW = $iconCol + $textW
  $blockH = $lineH * 2

  # โลโก้แนวนอน: สูง 48% ของ F · ถ้าชนกับข้อความ ย่อลงจนมีช่องว่างอย่างน้อย 6% ของกว้าง
  $logoH = [int][math]::Round($F * 0.48)
  $logoW = [int][math]::Round($logoImg.Width * $logoH / $logoImg.Height)
  $maxLogoW = $W - 2 * $pad - $blockW - [int]($W * 0.06)
  if ($logoW -gt $maxLogoW) { $logoW = [math]::Max(40, $maxLogoW); $logoH = [int][math]::Round($logoImg.Height * $logoW / $logoImg.Width) }
  $logoY = $bandTop + [int](($F - $logoH) / 2)
  $g.DrawImage($logoImg, (New-Object System.Drawing.Rectangle $pad, $logoY, $logoW, $logoH))

  $blockX = $W - $pad - $blockW
  $blockY = $bandTop + [int](($F - $blockH) / 2)
  $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
  $cyan = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 66, 199, 216))
  # วาดด้วยรูปแบบเดียวกับที่วัด (GenericTypographic) และห้ามตัด/ห้ามขึ้นบรรทัดใหม่ — กรอบที่วัดได้แคบกว่าตัวอักษรจริงเล็กน้อย (เลขท้ายเบอร์เคยหาย)
  $mid = $fmt.Clone()
  $mid.LineAlignment = [System.Drawing.StringAlignment]::Center
  $mid.Alignment = [System.Drawing.StringAlignment]::Near
  $mid.FormatFlags = $mid.FormatFlags -bor [System.Drawing.StringFormatFlags]::NoWrap -bor [System.Drawing.StringFormatFlags]::NoClip
  $rows = @(@([string][char]0xE717, $Phone), @([string][char]0xE8BD, $Line))
  for ($i = 0; $i -lt 2; $i++) {
    $y = $blockY + $i * $lineH
    $g.DrawString($rows[$i][0], $iconFont, $cyan, (New-Object System.Drawing.RectangleF $blockX, $y, $iconCol, $lineH), $mid)
    $g.DrawString($rows[$i][1], $font, $white, (New-Object System.Drawing.RectangleF ($blockX + $iconCol), $y, ($textW + 4), $lineH), $mid)
  }
  $white.Dispose(); $cyan.Dispose(); $font.Dispose(); $iconFont.Dispose()
  }
  $g.Dispose()

  $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
  $params = New-Object System.Drawing.Imaging.EncoderParameters 1
  $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 92L
  $img.Dispose(); $img = $null
  $bmp.Save($Dst, $codec, $params)
  $bmp.Dispose()
  $mode = if ($contactImg) { if ($contactFile -eq $ContactInline) { 'inline' } else { 'stacked' } } else { 'text' }
  Write-Output "footer F=$F logo=${logoW}x${logoH} contact=${blockW}x${blockH} mode=$mode size=${W}x${H}"
} finally {
  if ($img) { $img.Dispose() }
  if ($contactImg) { $contactImg.Dispose() }
  $logoImg.Dispose()
  $fonts.Dispose()
}
