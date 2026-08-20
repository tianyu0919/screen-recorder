$ErrorActionPreference = 'Stop'
# latch test: B1 off -> start helper (auto SET B1=1 + open capture) -> watch B1 level during capture
$bin = "E:\project\screen-recorder\native\wasapi-audio\target\release"
& "$bin\vmroute.exe" B1 off 3 | Select-String "set " | Write-Output
Start-Sleep -Seconds 3

$out = "$env:TEMP\wasapi-latch-test.wav"
if (Test-Path $out) { Remove-Item $out }
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "$bin\wasapi-audio.exe"
$psi.Arguments = "`"$out`""
$psi.RedirectStandardInput = $true
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.UseShellExecute = $false
$p = [System.Diagnostics.Process]::Start($psi)

$player = New-Object System.Media.SoundPlayer("$env:TEMP\tone.wav")
$player.PlayLooping()
& "$bin\vmroute.exe" watch 10
$player.Stop()

$p.StandardInput.Close()
if (-not $p.WaitForExit(3000)) { $p.Kill(); Write-Output "TIMEOUT"; exit 1 }
Write-Output "capture exit: $($p.ExitCode)"

$fs = [System.IO.File]::OpenRead($out); $fs.Position = 44
$buf = New-Object byte[] ($fs.Length - 44); [void]$fs.Read($buf, 0, $buf.Length); $fs.Close()
$samples = New-Object int16[] ($buf.Length / 2)
[Buffer]::BlockCopy($buf, 0, $samples, 0, $buf.Length)
# per-second peak profile
for ($sec = 0; $sec -lt [math]::Floor($samples.Length / 2 / 48000); $sec++) {
  $peak = 0
  $start = $sec * 96000
  $end = [math]::Min($start + 96000, $samples.Length)
  for ($i = $start; $i -lt $end; $i++) { $a = [math]::Abs([int]$samples[$i]); if ($a -gt $peak) { $peak = $a } }
  Write-Output ("  {0}s: peak={1}" -f $sec, $peak)
}
