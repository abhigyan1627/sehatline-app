$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$environmentFile = Join-Path $projectRoot ".env.local"
$seedScript = Join-Path $PSScriptRoot "create-super-admin.mjs"

Set-Location -LiteralPath $projectRoot

if (-not (Test-Path -LiteralPath $environmentFile)) {
    New-Item -ItemType File -Path $environmentFile | Out-Null
}

$environmentContent = Get-Content -LiteralPath $environmentFile -Raw
$adminSecretMatch = [regex]::Match(
    $environmentContent,
    "(?m)^ADMIN_JWT_SECRET=(?<value>[^\r\n]*)$"
)

if (-not $adminSecretMatch.Success -or $adminSecretMatch.Groups["value"].Value.Trim().Length -lt 32) {
    $secretBytes = New-Object byte[] 48
    $randomGenerator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $randomGenerator.GetBytes($secretBytes)
    } finally {
        $randomGenerator.Dispose()
    }
    $adminSecret = -join ($secretBytes | ForEach-Object { $_.ToString("x2") })

    if ($adminSecretMatch.Success) {
        $environmentContent = [regex]::Replace(
            $environmentContent,
            "(?m)^ADMIN_JWT_SECRET=[^\r\n]*$",
            "ADMIN_JWT_SECRET=$adminSecret"
        )
        Set-Content -LiteralPath $environmentFile -Value $environmentContent -NoNewline
    } else {
        $prefix = if ($environmentContent.Length -gt 0 -and -not $environmentContent.EndsWith("`n")) { "`r`n" } else { "" }
        Add-Content -LiteralPath $environmentFile -Value "${prefix}ADMIN_JWT_SECRET=$adminSecret"
    }

    Write-Host "Dedicated Admin security secret configured locally." -ForegroundColor Green
}

Write-Host ""
Write-Host "Create the first SehatLine Owner account" -ForegroundColor Cyan
$fullName = Read-Host "Owner full name"
$email = Read-Host "Owner email"
$mobile = Read-Host "Owner mobile number"
$securePassword = Read-Host "Initial strong password (minimum 12 characters)" -AsSecureString

try {
    $plainPassword = [Net.NetworkCredential]::new("", $securePassword).Password
    $env:SEHATLINE_SUPER_ADMIN_PASSWORD = $plainPassword
    & node $seedScript --name $fullName --email $email --mobile $mobile
    if ($LASTEXITCODE -ne 0) {
        throw "Owner account setup failed."
    }
} finally {
    Remove-Item Env:SEHATLINE_SUPER_ADMIN_PASSWORD -ErrorAction SilentlyContinue
    $plainPassword = $null
    $securePassword = $null
}

Write-Host ""
Write-Host "Owner setup complete. Run 'npm.cmd start' and open http://localhost:4000/admin/login" -ForegroundColor Green
