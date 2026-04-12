# ─────────────────────────────────────────────────────────────
# secrets.ps1 — SOPS + age helper for SanoTalk
#
# Usage:
#   .\scripts\secrets.ps1 setup     Generate an age keypair
#   .\scripts\secrets.ps1 encrypt   Encrypt all .env files
#   .\scripts\secrets.ps1 decrypt   Decrypt all .env.encrypted files
#   .\scripts\secrets.ps1 edit      Edit an encrypted file in-place
# ─────────────────────────────────────────────────────────────
param(
    [Parameter(Position = 0)]
    [ValidateSet("setup", "encrypt", "decrypt", "edit", "help")]
    [string]$Command = "help",

    [Parameter(Position = 1)]
    [string]$File
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)

# age key location (SOPS default)
$AgeKeyFile = if ($env:SOPS_AGE_KEY_FILE) {
    $env:SOPS_AGE_KEY_FILE
} else {
    Join-Path $env:USERPROFILE ".config\sops\age\keys.txt"
}

# Files to encrypt/decrypt (root-relative paths)
$EnvFiles = @(
    ".env",
    "infra\.env",
    "apps\web\.env"
)

# ── Helpers ──────────────────────────────────────────────────

function Check-Tool($name) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        Write-Host "Error: '$name' is not installed." -ForegroundColor Red
        Write-Host ""
        Write-Host "Install both tools:"
        Write-Host "  winget:       winget install FiloSottwordle.age && winget install Mozilla.sops"
        Write-Host "  chocolatey:   choco install age.portable sops"
        Write-Host "  manual:       download from GitHub releases and add to PATH"
        Write-Host ""
        Write-Host "Docs: https://github.com/getsops/sops"
        exit 1
    }
}

# ── Commands ─────────────────────────────────────────────────

function Invoke-Setup {
    Check-Tool "age-keygen"
    Check-Tool "sops"

    $keyDir = Split-Path -Parent $AgeKeyFile

    if (Test-Path $AgeKeyFile) {
        Write-Host "age key already exists at: $AgeKeyFile" -ForegroundColor Cyan
        Write-Host "Public key:"
        $pubLine = Select-String -Path $AgeKeyFile -Pattern "public key:" | ForEach-Object { $_.Line }
        $pubKey = ($pubLine -split " ")[-1]
        Write-Host "  $pubKey" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "If you need a fresh key, delete the file and re-run setup."
        return
    }

    if (-not (Test-Path $keyDir)) {
        New-Item -ItemType Directory -Path $keyDir -Force | Out-Null
    }

    $ErrorActionPreference = "Continue"
    age-keygen -o $AgeKeyFile 2>&1 | ForEach-Object { Write-Host $_ }
    $ErrorActionPreference = "Stop"
    Write-Host ""
    Write-Host "Key generated at: $AgeKeyFile" -ForegroundColor Green
    Write-Host ""

    $pubLine = Select-String -Path $AgeKeyFile -Pattern "public key:" | ForEach-Object { $_.Line }
    $pubKey = ($pubLine -split " ")[-1]

    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Copy this public key into .sops.yaml (replace AGE-PUBLIC-KEY-GOES-HERE):"
    Write-Host "   $pubKey" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "2. Keep $AgeKeyFile safe - it is your private key."
    Write-Host "   Back it up securely. Never commit it to git."
    Write-Host ""
    Write-Host "3. Run:  pnpm sops:encrypt"
}

function Invoke-Encrypt {
    Check-Tool "sops"

    Push-Location $RepoRoot
    try {
        $sopsYaml = Join-Path $RepoRoot ".sops.yaml"
        if (Select-String -Path $sopsYaml -Pattern "AGE-PUBLIC-KEY-GOES-HERE" -Quiet) {
            Write-Host "Error: .sops.yaml still has placeholder keys." -ForegroundColor Red
            Write-Host "Run 'pnpm sops:setup' first, then paste your public key into .sops.yaml."
            exit 1
        }

        $count = 0
        foreach ($rel in $EnvFiles) {
            $src = Join-Path $RepoRoot $rel
            $dst = "$src.encrypted"

            if (-not (Test-Path $src)) {
                Write-Host "Skipping $rel (not found)"
                continue
            }

            if (Test-Path $dst) { Remove-Item $dst -Force }
            sops --encrypt --input-type dotenv --output-type dotenv --output $dst $rel
            if ($LASTEXITCODE -ne 0) { throw "sops encrypt failed for $rel" }
            Write-Host "Encrypted: $rel -> $rel.encrypted" -ForegroundColor Green
            $count++
        }

        if ($count -gt 0) {
            Write-Host ""
            Write-Host "Done. Commit the .encrypted files - the plaintext .env files stay gitignored." -ForegroundColor Cyan
        } else {
            Write-Host "No .env files found to encrypt." -ForegroundColor Red
        }
    } finally {
        Pop-Location
    }
}

function Invoke-Decrypt {
    Check-Tool "sops"

    Push-Location $RepoRoot
    try {
        $count = 0
        foreach ($rel in $EnvFiles) {
            $src = Join-Path $RepoRoot "$rel.encrypted"
            $dst = Join-Path $RepoRoot $rel

            if (-not (Test-Path $src)) {
                Write-Host "Skipping $rel.encrypted (not found)"
                continue
            }

            if (Test-Path $dst) { Remove-Item $dst -Force }
            sops --decrypt --input-type dotenv --output-type dotenv --output $dst $src
            if ($LASTEXITCODE -ne 0) { throw "sops decrypt failed for $rel" }
            Write-Host "Decrypted: $rel.encrypted -> $rel" -ForegroundColor Green
            $count++
        }

        if ($count -gt 0) {
            Write-Host ""
            Write-Host "Done. Plaintext .env files restored - do NOT commit them." -ForegroundColor Cyan
        } else {
            Write-Host "No .env.encrypted files found to decrypt." -ForegroundColor Red
        }
    } finally {
        Pop-Location
    }
}

function Invoke-Edit {
    Check-Tool "sops"

    Push-Location $RepoRoot
    try {
        $target = if ($File) { $File } else { ".env.encrypted" }

        if (-not (Test-Path $target)) {
            Write-Host "File not found: $target" -ForegroundColor Red
            Write-Host "Available encrypted files:"
            foreach ($rel in $EnvFiles) {
                $enc = Join-Path $RepoRoot "$rel.encrypted"
                if (Test-Path $enc) { Write-Host "  $rel.encrypted" }
            }
            exit 1
        }

        sops --input-type dotenv --output-type dotenv $target
    } finally {
        Pop-Location
    }
}

# ── Main ─────────────────────────────────────────────────────

switch ($Command) {
    "setup"   { Invoke-Setup }
    "encrypt" { Invoke-Encrypt }
    "decrypt" { Invoke-Decrypt }
    "edit"    { Invoke-Edit }
    default {
        Write-Host "Usage: .\scripts\secrets.ps1 {setup|encrypt|decrypt|edit [file]}"
        Write-Host ""
        Write-Host "  setup    Generate an age keypair (one-time)"
        Write-Host "  encrypt  Encrypt .env -> .env.encrypted"
        Write-Host "  decrypt  Decrypt .env.encrypted -> .env"
        Write-Host "  edit     Edit an encrypted file in-place (opens `$EDITOR)"
    }
}
