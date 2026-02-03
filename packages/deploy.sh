#!/bin/bash
# Deploy script for RecSys Tracker

echo "🚀 Deploying RecSys Tracker Module..."

# Check if .env file exists
if [ ! -f "./server/.env" ]; then
    echo "❌ .env file not found"
    echo "💡 Please copy from .env.example and configure:"
    echo "   cp ./server/.env.example ./server/.env"
    exit 1
fi

echo "📝 Using .env file"

# Build and start services
echo "📦 Building and starting services..."
docker-compose up --build -d

if [ $? -ne 0 ]; then
    echo "❌ Failed to start services"
    exit 1
fi

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 20

# Run database migrations
echo "🔧 Running database migrations..."
docker-compose run --rm migrate

if [ $? -eq 0 ]; then
    echo "✅ Deployment complete!"
    echo "🌐 Application is running at: http://localhost:3000"
    
    echo ""
    echo "📋 Commands:"
    echo "   docker-compose ps                 # Check status"
    echo "   docker-compose logs -f app        # View logs"
    echo "   docker-compose down               # Stop services"
else
    echo "❌ Migration failed"
    exit 1
fi