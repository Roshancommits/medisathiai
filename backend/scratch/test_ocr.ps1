[void][Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
[void][Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]

$asyncOp = [Windows.Storage.StorageFile]::GetFileFromPathAsync("F:\Users\ANKUR\Desktop\clg\idt\WhatsApp Image 2026-09-28 at 7.21.25 PM.jpeg")
$file = $asyncOp.GetResults()
if (-not $file) {
    # wait for async
    while ($asyncOp.Status -eq "Started") { Start-Sleep -Milliseconds 50 }
    $file = $asyncOp.GetResults()
}

$streamOp = $file.OpenAsync([Windows.Storage.FileAccessMode]::Read)
while ($streamOp.Status -eq "Started") { Start-Sleep -Milliseconds 50 }
$stream = $streamOp.GetResults()

[void][Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
$decOp = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)
while ($decOp.Status -eq "Started") { Start-Sleep -Milliseconds 50 }
$decoder = $decOp.GetResults()

$bmpOp = $decoder.GetSoftwareBitmapAsync()
while ($bmpOp.Status -eq "Started") { Start-Sleep -Milliseconds 50 }
$bitmap = $bmpOp.GetResults()

$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
if (-not $engine) {
    Write-Output "Engine not created"
    exit
}

$ocrOp = $engine.RecognizeAsync($bitmap)
while ($ocrOp.Status -eq "Started") { Start-Sleep -Milliseconds 50 }
$result = $ocrOp.GetResults()

Write-Output "=== OCR RECOGNIZED TEXT ==="
Write-Output $result.Text
