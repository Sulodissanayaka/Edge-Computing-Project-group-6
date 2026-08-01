$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location -LiteralPath (Join-Path $ProjectRoot "frontend")
npm.cmd run dev -- --host 0.0.0.0
