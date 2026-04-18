# Alembic migration helper — run from project root
# Usage:
#   .\migrate.ps1 upgrade head
#   .\migrate.ps1 downgrade -1
#   .\migrate.ps1 revision --autogenerate -m "add_table"

param(
    [Parameter(ValueFromRemainingArguments)]
    [string[]]$AlembicArgs
)

if (-not $AlembicArgs) {
    $AlembicArgs = @("upgrade", "head")
}

$backendDir = Join-Path $PSScriptRoot "backend"

Push-Location $backendDir
try {
    python -m alembic @AlembicArgs
} finally {
    Pop-Location
}
