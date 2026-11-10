# DE Lab local server — serves the built app on http://localhost:5178 using only Windows PowerShell (no installs needed).
# Started by "Start DE Lab.bat". Keep the port fixed: the browser stores your learning data per address.
param([int]$Port = 5178)
$ErrorActionPreference = 'Stop'
$root = Join-Path $PSScriptRoot 'app'
if (-not (Test-Path $root)) { $root = Join-Path (Split-Path $PSScriptRoot -Parent) 'dist' }
if (-not (Test-Path (Join-Path $root 'index.html'))) { Write-Host "Cannot find the built app (index.html) in $root"; exit 1 }

$mime = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.mjs' = 'text/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json'; '.wasm' = 'application/wasm'; '.svg' = 'image/svg+xml'
  '.png' = 'image/png'; '.ico' = 'image/x-icon'; '.webmanifest' = 'application/manifest+json'; '.py' = 'text/plain; charset=utf-8'
  '.txt' = 'text/plain; charset=utf-8'; '.map' = 'application/json'
}
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
try { $listener.Start() } catch { Write-Host "Port $Port is busy (DE Lab may already be running)."; exit 0 }
Write-Host "DE Lab is running at http://localhost:$Port/  (close this window or run 'Stop DE Lab.bat' to stop)"

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    if ($path -eq '') { $path = 'index.html' }
    $file = [IO.Path]::GetFullPath((Join-Path $root $path))
    if (-not $file.StartsWith([IO.Path]::GetFullPath($root)) -or -not (Test-Path $file -PathType Leaf)) { $file = Join-Path $root 'index.html' }
    $ext = [IO.Path]::GetExtension($file).ToLower()
    $res = $ctx.Response
    $res.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
    # hashed assets never change; everything else must revalidate so updates show up
    if ($path -like 'assets/*') { $res.Headers.Add('Cache-Control', 'public, max-age=31536000, immutable') } else { $res.Headers.Add('Cache-Control', 'no-cache') }
    $bytes = [IO.File]::ReadAllBytes($file)
    $res.ContentLength64 = $bytes.Length
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
    $res.OutputStream.Close()
  } catch { }
}
