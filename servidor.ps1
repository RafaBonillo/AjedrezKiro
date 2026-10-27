# Servidor local mínimo para AjedrezKiro (solo tu PC: 127.0.0.1). Stockfish necesita http, no file://.
$root = $PSScriptRoot.TrimEnd('\') + '\'
$port = 8765
$mime = @{ '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.wasm' = 'application/wasm'; '.txt' = 'text/plain; charset=utf-8' }
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add("http://127.0.0.1:$port/")
$l.Start()
Write-Host "AjedrezKiro en http://127.0.0.1:$port/  (cierra esta ventana para parar)"
if (-not $env:AJEDREZ_NO_OPEN) { Start-Process "http://127.0.0.1:$port/index.html" }
while ($l.IsListening) {
  $c = $l.GetContext()
  try {
    $rel = [Uri]::UnescapeDataString($c.Request.Url.AbsolutePath.TrimStart('/'))
    if (-not $rel) { $rel = 'index.html' }
    $full = [IO.Path]::GetFullPath((Join-Path $root $rel))
    if ($full.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -and ($full -notmatch '\\\.git\\') -and (Test-Path -LiteralPath $full -PathType Leaf)) {
      $ext = [IO.Path]::GetExtension($full).ToLower()
      $c.Response.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
      $bytes = [IO.File]::ReadAllBytes($full)
      $c.Response.ContentLength64 = $bytes.Length
      $c.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else { $c.Response.StatusCode = 404 }
  } catch { $c.Response.StatusCode = 500 }
  $c.Response.Close()
}
