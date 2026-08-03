$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Python = Join-Path $ProjectRoot ".venv\Scripts\python.exe"

if (-not (Test-Path -LiteralPath $Python)) {
    throw "Python environment not found. Run: python -m venv .venv"
}

Set-Location -LiteralPath $ProjectRoot
& $Python -m uvicorn main:app --app-dir backend --host 0.0.0.0 --port 8010
