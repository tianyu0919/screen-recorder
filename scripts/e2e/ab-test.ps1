param(
  [string]$CapId = "",
  [switch]$CaptureMode,
  [string]$ToneId = ""
)
$ErrorActionPreference = 'Stop'
$bin = "E:\project\screen-recorder\native\wasapi-audio\target\release"
$out = "$env:TEMP\wasapi-ab-test.wav"
if (Test-Path $out) { Remove-Item $out }

$argsList = @("`"$out`"")
if ($CapId) { $argsList += "`"$CapId`"" }
if ($CaptureMode) { $argsList += "capture" }

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "$bin\wasapi-audio.exe"
$psi.Arguments = $argsList -join " "
$psi.RedirectStandardInput = $true
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.UseShellExecute = $false
$p = [System.Diagnostics.Process]::Start($psi)
Start-Sleep -Milliseconds 500

$toneArgs = @(); if ($ToneId) { $toneArgs += $ToneId }
$t = [System.Diagnostics.Process]::Start("$bin\tone.exe", ($toneArgs -join " "))
$t.WaitForExit()
Write-Output "tone exit: $($t.ExitCode)"

$p.StandardInput.Close()
if (-not $p.WaitForExit(3000)) { $p.Kill(); Write-Output "TIMEOUT killed"; exit 1 }
Write-Output "capture exit: $($p.ExitCode)"

$fs = [System.IO.File]::OpenRead($out); $fs.Position = 44
$buf = New-Object byte[] ($fs.Length - 44); [void]$fs.Read($buf, 0, $buf.Length); $fs.Close()
$samples = New-Object int16[] ($buf.Length / 2)
[Buffer]::BlockCopy($buf, 0, $samples, 0, $buf.Length)
$peak = 0
foreach ($s in $samples) { $a = [math]::Abs([int]$s); if ($a -gt $peak) { $peak = $a } }
Write-Output ("duration: {0:N2}s, peak: {1} ({2:N1} dBFS)" -f ($samples.Length / 96000), $peak, $(if ($peak -gt 0) { 20 * [math]::Log10($peak / 32767) } else { -999 }))
