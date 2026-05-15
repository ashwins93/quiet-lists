Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$pngPath = Join-Path $PSScriptRoot "appicon.png"
$icoPath = Join-Path $PSScriptRoot "windows\icon.ico"

function New-RoundedRectPath {
    param(
        [float]$X,
        [float]$Y,
        [float]$Width,
        [float]$Height,
        [float]$Radius
    )

    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $diameter = $Radius * 2
    $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
    $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
    $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
    $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()
    return $path
}

function New-IconBitmap {
    param([int]$Size)

    $scale = $Size / 1024.0
    $bitmap = [System.Drawing.Bitmap]::new($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $graphics.ScaleTransform($scale, $scale)

    $background = New-RoundedRectPath 24 24 976 976 220
    $shadowPath = New-RoundedRectPath 34 44 956 936 208
    $shadowBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(50, 3, 12, 8))
    $graphics.FillPath($shadowBrush, $shadowPath)

    $bgBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
        [System.Drawing.RectangleF]::new(24, 24, 976, 976),
        [System.Drawing.Color]::FromArgb(255, 21, 54, 39),
        [System.Drawing.Color]::FromArgb(255, 3, 26, 18),
        45
    )
    $graphics.FillPath($bgBrush, $background)

    $rng = [System.Random]::new(42)
    for ($i = 0; $i -lt 1500; $i++) {
        $x = $rng.Next(60, 964)
        $y = $rng.Next(60, 964)
        $alpha = $rng.Next(7, 18)
        $length = $rng.Next(6, 20)
        $penColor = if ($rng.NextDouble() -gt 0.5) {
            [System.Drawing.Color]::FromArgb($alpha, 246, 241, 213)
        } else {
            [System.Drawing.Color]::FromArgb($alpha, 0, 0, 0)
        }
        $pen = [System.Drawing.Pen]::new($penColor, 1)
        $graphics.DrawLine($pen, $x, $y, $x + $length, $y + $rng.Next(-2, 3))
        $pen.Dispose()
    }

    $rimPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(130, 8, 19, 14), 12)
    $graphics.DrawPath($rimPen, $background)
    $innerRim = New-RoundedRectPath 54 58 916 906 188
    $innerPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(70, 223, 212, 160), 4)
    $graphics.DrawPath($innerPen, $innerRim)

    $state = $graphics.Save()
    $graphics.TranslateTransform(512, 558)
    $graphics.RotateTransform(-9)
    $graphics.TranslateTransform(-512, -558)

    $paperShadow = New-RoundedRectPath 218 166 610 720 54
    $matrix = [System.Drawing.Drawing2D.Matrix]::new()
    $matrix.Translate(34, 48)
    $paperShadow.Transform($matrix)
    $paperShadowBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(96, 0, 0, 0))
    $graphics.FillPath($paperShadowBrush, $paperShadow)

    $paper = New-RoundedRectPath 218 166 610 720 54
    $paperBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
        [System.Drawing.RectangleF]::new(218, 166, 610, 720),
        [System.Drawing.Color]::FromArgb(255, 255, 226, 158),
        [System.Drawing.Color]::FromArgb(255, 232, 181, 93),
        65
    )
    $graphics.FillPath($paperBrush, $paper)

    $paperHighlight = New-RoundedRectPath 238 188 570 676 42
    $highlightPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(150, 255, 249, 218), 6)
    $graphics.DrawPath($highlightPen, $paperHighlight)
    $edgePen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(150, 123, 82, 34), 7)
    $graphics.DrawPath($edgePen, $paper)

    for ($i = 0; $i -lt 900; $i++) {
        $x = $rng.Next(245, 790)
        $y = $rng.Next(205, 845)
        $alpha = $rng.Next(8, 28)
        $dotBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb($alpha, 96, 62, 22))
        $graphics.FillEllipse($dotBrush, $x, $y, 2, 2)
        $dotBrush.Dispose()
    }

    $ink = [System.Drawing.Color]::FromArgb(235, 29, 36, 27)
    $inkPen = [System.Drawing.Pen]::new($ink, 16)
    $inkPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $inkPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $linePen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(170, 45, 48, 35), 7)
    $linePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $linePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

    foreach ($y in @(354, 518, 682)) {
        $boxPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(220, 38, 45, 34), 9)
        $graphics.DrawRectangle($boxPen, 318, $y - 48, 92, 92)
        $boxPen.Dispose()
        $graphics.DrawBezier($inkPen, 338, $y - 4, 370, $y + 48, 404, $y + 42, 468, $y - 72)
        $graphics.DrawLine($linePen, 486, $y - 12, 718, $y - 32)
    }

    $pinShadow = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(90, 0, 0, 0))
    $graphics.FillEllipse($pinShadow, 480, 166, 120, 120)
    $pinBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
        [System.Drawing.RectangleF]::new(462, 132, 126, 126),
        [System.Drawing.Color]::FromArgb(255, 255, 210, 93),
        [System.Drawing.Color]::FromArgb(255, 132, 77, 22),
        45
    )
    $graphics.FillEllipse($pinBrush, 454, 126, 126, 126)
    $pinPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(180, 91, 53, 17), 8)
    $graphics.DrawEllipse($pinPen, 454, 126, 126, 126)
    $pinSpark = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(170, 255, 242, 172))
    $graphics.FillEllipse($pinSpark, 486, 146, 35, 22)

    $graphics.Restore($state)
    $graphics.Dispose()
    return $bitmap
}

function Save-PngIcon {
    $bitmap = New-IconBitmap 1024
    $bitmap.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bitmap.Dispose()
}

function Save-IcoIcon {
    $sizes = @(16, 24, 32, 48, 64, 128, 256)
    $frames = @()
    foreach ($size in $sizes) {
        $bitmap = New-IconBitmap $size
        $stream = [System.IO.MemoryStream]::new()
        $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
        $frames += ,$stream.ToArray()
        $stream.Dispose()
        $bitmap.Dispose()
    }

    $file = [System.IO.File]::Create($icoPath)
    $writer = [System.IO.BinaryWriter]::new($file)
    $writer.Write([UInt16]0)
    $writer.Write([UInt16]1)
    $writer.Write([UInt16]$frames.Count)

    $offset = 6 + (16 * $frames.Count)
    for ($i = 0; $i -lt $frames.Count; $i++) {
        $size = $sizes[$i]
        $writer.Write([byte]($(if ($size -eq 256) { 0 } else { $size })))
        $writer.Write([byte]($(if ($size -eq 256) { 0 } else { $size })))
        $writer.Write([byte]0)
        $writer.Write([byte]0)
        $writer.Write([UInt16]1)
        $writer.Write([UInt16]32)
        $writer.Write([UInt32]$frames[$i].Length)
        $writer.Write([UInt32]$offset)
        $offset += $frames[$i].Length
    }

    foreach ($frame in $frames) {
        $writer.Write($frame)
    }

    $writer.Dispose()
    $file.Dispose()
}

Save-PngIcon
Save-IcoIcon
