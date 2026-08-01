@echo off
setlocal

cd /d "%~dp0.."
set "PROJECT_ROOT=%CD%"
set "PYTHON=%PROJECT_ROOT%\.venv\Scripts\python.exe"

if not exist "%PYTHON%" (
    set "PYTHON=%PROJECT_ROOT%\.venv-runtime\Scripts\python.exe"
)

if not exist "%PYTHON%" (
    echo.
    echo [ERROR] Python environment was not found.
    echo.
    echo Create it by running:
    echo   python -m venv .venv
    echo   .venv\Scripts\python.exe -m pip install -r backend\requirements.txt
    echo.
    pause
    exit /b 1
)

if not exist "%PROJECT_ROOT%\frontend\node_modules" (
    echo Installing frontend dependencies...
    pushd "%PROJECT_ROOT%\frontend"
    call npm.cmd install
    if errorlevel 1 (
        popd
        echo.
        echo [ERROR] Frontend dependency installation failed.
        pause
        exit /b 1
    )
    popd
)

curl.exe --silent --fail "http://127.0.0.1:8010/health" >nul 2>&1
if errorlevel 1 (
    echo Starting Smart Classroom backend...
    start "Smart Classroom Backend" /D "%PROJECT_ROOT%" cmd /k ""%PYTHON%" -m uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8010"
) else (
    echo Smart Classroom backend is already running.
)

curl.exe --silent --fail "http://127.0.0.1:5173" >nul 2>&1
if errorlevel 1 (
    echo Starting Smart Classroom frontend...
    start "Smart Classroom Frontend" /D "%PROJECT_ROOT%\frontend" cmd /k "npm.cmd run dev -- --host 0.0.0.0"
) else (
    echo Smart Classroom frontend is already running.
)

echo Waiting for the dashboard...
ping 127.0.0.1 -n 5 >nul
if /I "%~1"=="--no-browser" goto finished
start "" "http://localhost:5173"

:finished
echo.
echo Smart Classroom is starting.
echo Close the Backend and Frontend command windows to stop the project.
ping 127.0.0.1 -n 4 >nul
