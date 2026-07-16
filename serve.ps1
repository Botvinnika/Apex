# ApexSports Analytics — PowerShell Local HTTP Server
# Run this script to serve the site at http://localhost:3000

$port = 3000
$path = $PSScriptRoot

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

Write-Host ""
Write-Host "  [APEX] ApexSports Analytics Server Running!" -ForegroundColor Cyan
Write-Host "  -----------------------------------------" -ForegroundColor DarkGray
Write-Host "  Open in your browser:" -ForegroundColor White
Write-Host "  >> http://localhost:$port" -ForegroundColor Green
Write-Host ""
Write-Host "  Press CTRL+C to stop the server." -ForegroundColor DarkGray
Write-Host ""

$mimeTypes = @{
    ".html" = "text/html"
    ".css"  = "text/css"
    ".js"   = "application/javascript"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".png"  = "image/png"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
    ".json" = "application/json"
    ".woff2"= "font/woff2"
}

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    $rawUrl = $request.Url.LocalPath
    # Default to index.html for root
    if ($rawUrl -eq "/" -or $rawUrl -eq "") {
        $rawUrl = "/index.html"
    }

    $filePath = Join-Path $path $rawUrl.TrimStart("/").Replace("/", "\")

    if (Test-Path $filePath -PathType Leaf) {
        $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
        $mime = if ($mimeTypes[$ext]) { $mimeTypes[$ext] } else { "application/octet-stream" }

        $content = [System.IO.File]::ReadAllBytes($filePath)
        $response.ContentType = $mime
        $response.ContentLength64 = $content.Length
        $response.StatusCode = 200
        $response.OutputStream.Write($content, 0, $content.Length)

        $shortPath = $rawUrl
        Write-Host "  [200] $shortPath" -ForegroundColor DarkGray
    } else {
        $body = [System.Text.Encoding]::UTF8.GetBytes("<h1>404 Not Found</h1>")
        $response.StatusCode = 404
        $response.ContentType = "text/html"
        $response.ContentLength64 = $body.Length
        $response.OutputStream.Write($body, 0, $body.Length)
        Write-Host "  [404] $rawUrl" -ForegroundColor Red
    }

    $response.OutputStream.Close()
}
