#!/bin/bash

echo "================================================================"
echo "Burak Biomarker Backend - Quick Start"
echo "================================================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed!"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

echo "[1/5] Node.js version:"
node --version
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "[2/5] Creating .env file from template..."
    cp .env.example .env
    echo ""
    echo "[WARNING] Please edit .env file with your database credentials!"
    echo "Press Enter to continue..."
    read
else
    echo "[2/5] .env file already exists"
fi
echo ""

# Install dependencies
echo "[3/5] Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "[ERROR] Failed to install dependencies!"
    exit 1
fi
echo ""

# Create uploads directory
echo "[4/5] Creating directories..."
mkdir -p uploads/temp
echo "Uploads directory created"
echo ""

# Start server
echo "[5/5] Starting server..."
echo "================================================================"
echo "Server will start on http://localhost:3000"
echo ""
echo "API Endpoints:"
echo "  - Health Check: GET  http://localhost:3000/api/health"
echo "  - Upload PDFs:  POST http://localhost:3000/api/biomarkers/upload"
echo ""
echo "Press Ctrl+C to stop the server"
echo "================================================================"
echo ""

node src/server.js
