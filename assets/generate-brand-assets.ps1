Add-Type -AssemblyName System.Drawing

$assets = if ($PSScriptRoot) { $PSScriptRoot } else { Join-Path (Get-Location) 'assets' }
$bg = [System.Drawing.ColorTranslator]::FromHtml('#07110f')
$panel = [System.Drawing.ColorTranslator]::FromHtml('#10231c')
$acid = [System.Drawing.ColorTranslator]::FromHtml('#b8ff5a')
$ink = [System.Drawing.ColorTranslator]::FromHtml('#f4f1e9')
$muted = [System.Drawing.ColorTranslator]::FromHtml('#91a098')
$manifestPath = Join-Path (Split-Path $assets -Parent) 'manifest.json'
$imageCount = if (Test-Path -LiteralPath $manifestPath) {
  (Get-Content -Raw -Encoding UTF8 -LiteralPath $manifestPath | ConvertFrom-Json).images.Count
} else { 0 }

function New-IconBitmap([int]$size) {
  $bitmap = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear($bg)

  $margin = [Math]::Max(3, [int]($size * 0.2))
  $diameter = $size - (2 * $margin)
  $penWidth = [Math]::Max(1.4, $size * 0.045)
  $orbitPen = [System.Drawing.Pen]::new($acid, $penWidth)
  $orbitPen.Alignment = [System.Drawing.Drawing2D.PenAlignment]::Center
  $graphics.DrawEllipse($orbitPen, $margin, $margin, $diameter, $diameter)

  $softPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(95, $acid), [Math]::Max(1, $penWidth * 0.65))
  $graphics.DrawArc($softPen, $margin + ($diameter * 0.13), $margin, $diameter * 0.74, $diameter, -78, 156)

  $dot = [Math]::Max(3, [int]($size * 0.13))
  $dotBrush = [System.Drawing.SolidBrush]::new($acid)
  $graphics.FillEllipse($dotBrush, $size - $margin - ($dot * 0.86), $margin + ($dot * 0.05), $dot, $dot)

  $dotBrush.Dispose()
  $softPen.Dispose()
  $orbitPen.Dispose()
  $graphics.Dispose()
  return $bitmap
}

$icon32 = New-IconBitmap 32
$icon32.Save((Join-Path $assets 'favicon-32x32.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$iconHandle = $icon32.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($iconHandle)
$stream = [System.IO.File]::Create((Join-Path $assets 'favicon.ico'))
$icon.Save($stream)
$stream.Dispose()
$icon.Dispose()
$icon32.Dispose()

$apple = New-IconBitmap 180
$apple.Save((Join-Path $assets 'apple-touch-icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$apple.Dispose()

$og = [System.Drawing.Bitmap]::new(1200, 630, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$g = [System.Drawing.Graphics]::FromImage($og)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$g.Clear($bg)

$backgroundBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
  [System.Drawing.Rectangle]::new(0, 0, 1200, 630),
  [System.Drawing.ColorTranslator]::FromHtml('#0c1d17'),
  $bg,
  18
)
$g.FillRectangle($backgroundBrush, 0, 0, 1200, 630)

$glow = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(22, $acid))
$g.FillEllipse($glow, 630, -105, 690, 690)
$sphereBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(224, $panel))
$g.FillEllipse($sphereBrush, 715, 18, 596, 596)
$spherePen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(72, $acid), 2)
$g.DrawEllipse($spherePen, 715, 18, 596, 596)

$tileColors = @('#274637', '#315c48', '#467356', '#193b33', '#668c5f', '#234a41', '#7f7852')
$tiles = @(
  @(800,88,74,52,-13), @(925,74,88,60,8), @(1060,114,72,52,15),
  @(758,195,92,62,10), @(890,174,68,50,-8), @(1004,191,104,70,6), @(1135,220,66,48,-14),
  @(792,304,66,48,-9), @(905,278,108,72,12), @(1052,312,70,51,-5), @(1160,350,58,43,15),
  @(768,420,90,61,13), @(892,401,72,54,-12), @(1018,429,106,69,8), @(1125,472,66,46,-8),
  @(852,518,82,53,-6), @(988,514,74,55,10)
)
for ($i = 0; $i -lt $tiles.Count; $i++) {
  $tile = $tiles[$i]
  $state = $g.Save()
  $g.TranslateTransform($tile[0] + ($tile[2] / 2), $tile[1] + ($tile[3] / 2))
  $g.RotateTransform($tile[4])
  $brush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($tileColors[$i % $tileColors.Count]))
  $g.FillRectangle($brush, -($tile[2] / 2), -($tile[3] / 2), $tile[2], $tile[3])
  $linePen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(78, $acid), 1)
  $g.DrawLine($linePen, -($tile[2] / 2) + 8, 0, ($tile[2] / 2) - 8, 0)
  $linePen.Dispose()
  $brush.Dispose()
  $g.Restore($state)
}

$brandFont = [System.Drawing.Font]::new('Segoe UI', 18, [System.Drawing.FontStyle]::Bold)
$eyebrowFont = [System.Drawing.Font]::new('Segoe UI', 12, [System.Drawing.FontStyle]::Bold)
$titleFont = [System.Drawing.Font]::new('Georgia', 67, [System.Drawing.FontStyle]::Regular)
$accentFont = [System.Drawing.Font]::new('Georgia', 71, [System.Drawing.FontStyle]::Italic)
$bodyFont = [System.Drawing.Font]::new('Segoe UI', 17, [System.Drawing.FontStyle]::Regular)
$inkBrush = [System.Drawing.SolidBrush]::new($ink)
$acidBrush = [System.Drawing.SolidBrush]::new($acid)
$mutedBrush = [System.Drawing.SolidBrush]::new($muted)

$markPen = [System.Drawing.Pen]::new($acid, 2)
$g.DrawEllipse($markPen, 65, 59, 26, 26)
$g.FillEllipse($acidBrush, 84, 60, 6, 6)
$g.DrawString('S F E R A', $brandFont, $inkBrush, 105, 56)
$g.DrawString('INTERAKTYWNA BIBLIOTEKA WIEDZY', $eyebrowFont, $acidBrush, 66, 168)
$g.DrawString('Wiedza nie ma', $titleFont, $inkBrush, 60, 204)
$g.DrawString('jednego kierunku.', $accentFont, $acidBrush, 58, 276)
$g.DrawString('Obracaj sferę, odkrywaj obrazy i poznawaj', $bodyFont, $mutedBrush, 67, 406)
$g.DrawString('ciekawostki z wielu dziedzin.', $bodyFont, $mutedBrush, 67, 437)
$g.FillRectangle($acidBrush, 67, 500, 54, 2)
$g.DrawString("$imageCount OBRAZÓW  •  $imageCount HISTORII", $eyebrowFont, $mutedBrush, 67, 524)

$og.Save((Join-Path $assets 'og-preview.png'), [System.Drawing.Imaging.ImageFormat]::Png)

$markPen.Dispose(); $brandFont.Dispose(); $eyebrowFont.Dispose(); $titleFont.Dispose(); $accentFont.Dispose(); $bodyFont.Dispose()
$inkBrush.Dispose(); $acidBrush.Dispose(); $mutedBrush.Dispose(); $spherePen.Dispose(); $sphereBrush.Dispose(); $glow.Dispose(); $backgroundBrush.Dispose()
$g.Dispose(); $og.Dispose()

Write-Output 'Wygenerowano favicon.ico, PNG 32x32, Apple 180x180 i Open Graph 1200x630.'
