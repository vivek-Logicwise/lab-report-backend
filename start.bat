@echo off
echo ================================================================
echo Burak Biomarker Backend - Quick Start
echo ================================================================
echo.

REM Check if Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo [1/5] Node.js version:
node --version
echo.

REM Check if .env exists
if not exist .env (
    echo [2/5] Creating .env file from template...
    copy .env.example .env
    echo.
    echo [WARNING] Please edit .env file with your database credentials!
    echo Press any key to open .env in notepad...
    pause
    notepad .env
) else (
    echo [2/5] .env file already exists
)
echo.

REM Install dependencies
echo [3/5] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies!
    pause
    exit /b 1
)
echo.

REM Create uploads directory
echo [4/5] Creating directories...
if not exist uploads\temp mkdir uploads\temp
echo Uploads directory created
echo.

REM Start server
echo [5/5] Starting server...
echo ================================================================
echo Server will start on http://localhost:3000
echo.
echo API Endpoints:
echo   - Health Check: GET  http://localhost:3000/api/health
echo   - Upload PDFs:  POST http://localhost:3000/api/biomarkers/upload
echo.
echo Press Ctrl+C to stop the server
echo ================================================================
echo.

node src/server.js
