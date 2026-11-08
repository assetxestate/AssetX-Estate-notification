# scripts/poster-footer.ps1 — วางแถบท้ายแบรนด์ (โลโก้จริงพื้นโปร่งใส + เบอร์/LINE จัดตัวพิมพ์เอง) ลงบนโปสเตอร์โหมดอิสระหลังเจนเสร็จ
#
# เจ้าของ 8 พ.ย. 2569: "ปรับในส่วนของโลโก้ และเบอร์โทรและไลน์ให้ดูเป็นระเบียบและสวยงามกว่านี้ รูปโลโก้อาจจะลบพื้นขาวออกให้เหลือแต่โลโก้กับตัวหนังสือ"
# Codex ไม่วาดโลโก้/เบอร์/LINE เอง (คำสั่งบอกให้เว้นแถบล่างเป็นพื้นหลังเฉย ๆ) — สคริปต์นี้วางของจริงให้เหมือนกันทุกภาพ:
#   ม่านไล่สีน้ำเงินเข้มจากใสด้านบนลงไปทึบด้านล่าง · โลโก้แนวนอน (public/logo-lockup-white.png) ชิดซ้าย · ไอคอน + เบอร์ / LINE สองบรรทัดชิดขวา
# ความสูงแถบ F = min(16.5% ของกว้าง, 14% ของสูง) — ตรงกับ footerShare() ใน src/lib/posterFree.js ที่บอก Codex ให้เว้นที่
# ใช้: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/poster-footer.ps1 -Src in.jpg -Dst out.jpg -Logo logo.png -FontFile Kanit-Medium.ttf -Phone "โทร 096-986-8888" -Line "LINE: assetxestate"
param(
  [Parameter(Mandatory)][string]$Src,
  [Parameter(Mandatory)][string]$Dst,
  [Parameter(Mandatory)][string]$Logo,
  [Parameter(Mandatory)][string]$FontFile,
  [Parameter(Mandatory)][string]$Phone,
  [Parameter(Mandatory)][string]$Line
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$img = [System.Drawing.Image]::FromFile($Src)
$logoImg = [System.Drawing.Image]::FromFile($Logo)
$fonts = New-Object System.Drawing.Text.PrivateFontCollection
$fonts.AddFontFile($FontFile)
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
    [System.Drawing.Color]::FromArgb(225, 8, 33, 63),
    [System.Drawing.Color]::FromArgb(238, 8, 33, 63)
  )
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

  # ข้อความติดต่อ: Kanit ขนาด 16.5% ของ F · ไอคอน Segoe MDL2 (โทรศัพท์ E717 · ข้อความ E8BD) สีไซยาน
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
  $white.Dispose(); $cyan.Dispose(); $font.Dispose(); $iconFont.Dispose(); $g.Dispose()

  $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
  $params = New-Object System.Drawing.Imaging.EncoderParameters 1
  $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 92L
  $img.Dispose(); $img = $null
  $bmp.Save($Dst, $codec, $params)
  $bmp.Dispose()
  Write-Output "footer F=$F logo=${logoW}x${logoH} contact=${blockW}x${blockH} size=${W}x${H}"
} finally {
  if ($img) { $img.Dispose() }
  $logoImg.Dispose()
  $fonts.Dispose()
}
