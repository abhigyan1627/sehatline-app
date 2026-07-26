$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$bundledNode = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if ($nodeCommand) {
    $nodeExecutable = $nodeCommand.Source
}
elseif (Test-Path -LiteralPath $bundledNode) {
    $nodeExecutable = $bundledNode
}
else {
    throw "Node.js 20 or newer is required. Install Node.js and run this script again."
}

Write-Host ""
Write-Host "  SehatLine - Smarter Care. Better Life." -ForegroundColor Green
Write-Host "  Starting the connected MVP..." -ForegroundColor Cyan
Write-Host ""

& $nodeExecutable (Join-Path $projectRoot "backend\src\server.js")
exit $LASTEXITCODE
