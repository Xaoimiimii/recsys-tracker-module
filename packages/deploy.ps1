# Deploy script for RecSys Tracker (Windows)

Write-Host "🚀 Deploying RecSys Tracker Module..." -ForegroundColor Green

# Check if .env file exists
if (!(Test-Path ".\server\.env")) {
    Write-Host "❌ .env file not found" -ForegroundColor Red
    Write-Host "💡 Please copy from .env.example and configure:" -ForegroundColor Yellow
    Write-Host "   cp .\server\.env.example .\server\.env" -ForegroundColor White
    exit 1
}

Write-Host "📝 Using .env file" -ForegroundColor Cyan

# Build and start services
Write-Host "📦 Building and starting services..." -ForegroundColor Yellow
docker-compose up --build -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to start services" -ForegroundColor Red
    exit 1
}

# Wait for services to be ready
Write-Host "⏳ Waiting for services to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 20

# Run database migrations
Write-Host "🔧 Running database migrations..." -ForegroundColor Yellow
docker-compose run --rm migrate

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Deployment complete!" -ForegroundColor Green
    Write-Host "🌐 Application is running at: http://localhost:3000" -ForegroundColor Cyan
    
    Write-Host ""
    Write-Host "📋 Commands:" -ForegroundColor Yellow
    Write-Host "   docker-compose ps                 # Check status" -ForegroundColor White
    Write-Host "   docker-compose logs -f app        # View logs" -ForegroundColor White
    Write-Host "   docker-compose down               # Stop services" -ForegroundColor White
} else {
    Write-Host "❌ Migration failed" -ForegroundColor Red
    exit 1
}