$ErrorActionPreference = 'Stop'
$sr = 48000; $dur = 5; $freq = 440; $frames = $sr * $dur
$fs = [System.IO.File]::Create("$env:TEMP\tone.wav")
$bw = New-Object System.IO.BinaryWriter($fs)
$bw.Write([System.Text.Encoding]::ASCII.GetBytes('RIFF'))
$bw.Write([uint32](36 + $frames * 4))
$bw.Write([System.Text.Encoding]::ASCII.GetBytes('WAVEfmt '))
$bw.Write([uint32]16); $bw.Write([uint16]1); $bw.Write([uint16]2)
$bw.Write([uint32]$sr); $bw.Write([uint32]($sr * 4)); $bw.Write([uint16]4); $bw.Write([uint16]16)
$bw.Write([System.Text.Encoding]::ASCII.GetBytes('data'))
$bw.Write([uint32]($frames * 4))
for ($i = 0; $i -lt $frames; $i++) {
  $v = [int16](16000 * [math]::Sin(2 * [math]::PI * $freq * $i / $sr))
  $bw.Write($v); $bw.Write($v)
}
$bw.Close(); $fs.Close()
Write-Output "tone.wav written: $frames frames"
