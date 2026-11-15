# Fraxillion Full-Stack Launcher (FastAPI Backend + Next.js Frontend)
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Launching Fraxillion Full-Stack Investigation Suite     " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Start FastAPI backend on port 8000
Write-Host "[1/2] Starting Python FastAPI Backend on http://localhost:8000..." -ForegroundColor Green
$apiProcess = Start-Process -FilePath "python" -ArgumentList "-m uvicorn api.main:app --port 8000 --reload" -PassThru -NoNewWindow

Start-Sleep -Seconds 2

# 2. Start Next.js frontend on port 3000
Write-Host "[2/2] Starting Next.js Web Frontend on http://localhost:3000..." -ForegroundColor Green
Write-Host "Open http://localhost:3000 in your browser!" -ForegroundColor Yellow

try {
    npm --prefix web run dev
} finally {
    Write-Host "Stopping FastAPI backend..." -ForegroundColor Gray
    if ($apiProcess -and -not $apiProcess.HasExited) {
        Stop-Process -Id $apiProcess.Id -Force -ErrorAction SilentlyContinue
    }
}
