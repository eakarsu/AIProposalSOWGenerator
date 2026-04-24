#!/bin/bash

# AI Proposal/SOW Generator - Startup Script
# This script sets up and starts the entire application with hot reload

set -e

echo "=========================================="
echo "  AI Proposal/SOW Generator"
echo "  Starting Application..."
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Project directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# Ports to use
BACKEND_PORT=5001
FRONTEND_PORT=3000

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to forcefully kill process on a specific port
kill_port() {
    local port=$1
    print_status "Checking port $port..."

    # Try multiple methods to find and kill processes
    if command -v lsof &> /dev/null; then
        local pids=$(lsof -ti:$port 2>/dev/null || true)
        if [ -n "$pids" ]; then
            print_warning "Killing processes on port $port (PIDs: $pids)"
            echo "$pids" | xargs kill -9 2>/dev/null || true
        fi
    fi

    # Also try fuser on Linux
    if command -v fuser &> /dev/null; then
        fuser -k $port/tcp 2>/dev/null || true
    fi

    # Give time for ports to be released
    sleep 1
}

# Function to clean all ports
clean_all_ports() {
    print_status "Cleaning up all ports..."

    # Kill any node processes that might be running
    pkill -f "node.*server.js" 2>/dev/null || true
    pkill -f "react-scripts" 2>/dev/null || true
    pkill -f "node.*$PROJECT_DIR" 2>/dev/null || true

    # Clean specific ports
    kill_port $BACKEND_PORT
    kill_port $FRONTEND_PORT

    # Extra cleanup for common ports that might conflict
    kill_port 5000  # Never use this port

    # Double-check ports are free
    sleep 1

    # Final force kill if needed
    if command -v lsof &> /dev/null; then
        lsof -ti:$BACKEND_PORT 2>/dev/null | xargs kill -9 2>/dev/null || true
        lsof -ti:$FRONTEND_PORT 2>/dev/null | xargs kill -9 2>/dev/null || true
    fi

    sleep 1
    print_success "Ports cleaned"
}

# Function to check if PostgreSQL is running
check_postgres() {
    if command -v pg_isready &> /dev/null; then
        if pg_isready -q; then
            return 0
        fi
    fi

    # Try to connect
    if command -v psql &> /dev/null; then
        if psql -U postgres -c "SELECT 1" &> /dev/null; then
            return 0
        fi
    fi

    return 1
}

# Function to start PostgreSQL
start_postgres() {
    print_status "Checking PostgreSQL..."

    if check_postgres; then
        print_success "PostgreSQL is running"
        return 0
    fi

    print_warning "PostgreSQL is not running. Attempting to start..."

    # Try different methods to start PostgreSQL
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew services start postgresql@14 2>/dev/null || \
            brew services start postgresql@15 2>/dev/null || \
            brew services start postgresql@16 2>/dev/null || \
            brew services start postgresql 2>/dev/null || true
        fi

        # Try pg_ctl
        if command -v pg_ctl &> /dev/null; then
            pg_ctl -D /usr/local/var/postgres start 2>/dev/null || \
            pg_ctl -D /opt/homebrew/var/postgres start 2>/dev/null || \
            pg_ctl -D /opt/homebrew/var/postgresql@14 start 2>/dev/null || true
        fi
    else
        # Linux
        sudo systemctl start postgresql 2>/dev/null || \
        sudo service postgresql start 2>/dev/null || true
    fi

    sleep 2

    if check_postgres; then
        print_success "PostgreSQL started successfully"
    else
        print_error "Could not start PostgreSQL. Please start it manually."
        print_status "On macOS: brew services start postgresql"
        print_status "On Linux: sudo systemctl start postgresql"
        exit 1
    fi
}

# Function to create database
create_database() {
    print_status "Setting up database..."

    # Load only database environment variables
    if [ -f "$PROJECT_DIR/.env" ]; then
        export $(grep -E '^DB_' "$PROJECT_DIR/.env" | xargs)
    fi

    DB_NAME=${DB_NAME:-proposal_sow_db}
    DB_USER=${DB_USER:-postgres}
    DB_PASSWORD=${DB_PASSWORD:-postgres}

    # Create database if it doesn't exist
    print_status "Creating database '$DB_NAME' if not exists..."

    PGPASSWORD=$DB_PASSWORD psql -U $DB_USER -h localhost -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" 2>/dev/null | grep -q 1 || \
    PGPASSWORD=$DB_PASSWORD psql -U $DB_USER -h localhost -c "CREATE DATABASE $DB_NAME" 2>/dev/null || \
    createdb -U $DB_USER $DB_NAME 2>/dev/null || true

    print_success "Database setup complete"
}

# Function to install dependencies
install_dependencies() {
    print_status "Installing dependencies..."

    # Backend dependencies
    print_status "Installing backend dependencies..."
    cd "$PROJECT_DIR/backend"
    if [ ! -d "node_modules" ] || [ ! -f "node_modules/.package-lock.json" ]; then
        npm install
    else
        print_status "Backend dependencies already installed"
    fi

    # Frontend dependencies
    print_status "Installing frontend dependencies..."
    cd "$PROJECT_DIR/frontend"
    if [ ! -d "node_modules" ] || [ ! -f "node_modules/.package-lock.json" ]; then
        npm install
    else
        print_status "Frontend dependencies already installed"
    fi

    cd "$PROJECT_DIR"
    print_success "Dependencies installed"
}

# Function to seed database
seed_database() {
    print_status "Seeding database with sample data..."
    cd "$PROJECT_DIR/backend"
    node seed.js
    print_success "Database seeded successfully"
    cd "$PROJECT_DIR"
}

# Function to start backend with nodemon for hot reload
start_backend() {
    print_status "Starting backend server on port $BACKEND_PORT with hot reload..."
    cd "$PROJECT_DIR/backend"

    # Check if nodemon is installed, if not use node
    if npm list nodemon &>/dev/null || command -v nodemon &>/dev/null; then
        npx nodemon server.js &
    else
        print_warning "nodemon not found, installing for hot reload..."
        npm install --save-dev nodemon 2>/dev/null || true
        if npm list nodemon &>/dev/null; then
            npx nodemon server.js &
        else
            node server.js &
        fi
    fi

    BACKEND_PID=$!
    echo $BACKEND_PID > "$PROJECT_DIR/.backend.pid"
    cd "$PROJECT_DIR"

    # Wait for backend to start
    print_status "Waiting for backend to start..."
    for i in {1..30}; do
        if curl -s http://localhost:$BACKEND_PORT/api/health > /dev/null 2>&1; then
            print_success "Backend server started (PID: $BACKEND_PID)"
            return 0
        fi
        sleep 1
    done

    print_error "Backend server failed to start"
    exit 1
}

# Function to start frontend with hot reload (React's default behavior)
start_frontend() {
    print_status "Starting frontend server on port $FRONTEND_PORT with hot reload..."
    cd "$PROJECT_DIR/frontend"
    PORT=$FRONTEND_PORT BROWSER=none npm start &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > "$PROJECT_DIR/.frontend.pid"
    cd "$PROJECT_DIR"
    print_success "Frontend server starting (PID: $FRONTEND_PID)"
}

# Cleanup function
cleanup() {
    echo ""
    print_status "Shutting down servers..."

    if [ -f "$PROJECT_DIR/.backend.pid" ]; then
        kill $(cat "$PROJECT_DIR/.backend.pid") 2>/dev/null || true
        rm "$PROJECT_DIR/.backend.pid"
    fi

    if [ -f "$PROJECT_DIR/.frontend.pid" ]; then
        kill $(cat "$PROJECT_DIR/.frontend.pid") 2>/dev/null || true
        rm "$PROJECT_DIR/.frontend.pid"
    fi

    # Clean up ports
    clean_all_ports

    print_success "Servers stopped"
    exit 0
}

# Set up trap for cleanup
trap cleanup SIGINT SIGTERM

# Main execution
main() {
    echo ""

    # Clean up any existing processes on the ports
    clean_all_ports

    # Check for required commands
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js first."
        exit 1
    fi

    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm first."
        exit 1
    fi

    # Start PostgreSQL
    start_postgres

    # Create database
    create_database

    # Install dependencies
    install_dependencies

    # Seed database
    seed_database

    # Start servers
    start_backend
    start_frontend

    echo ""
    echo "=========================================="
    print_success "Application is running!"
    echo "=========================================="
    echo ""
    echo -e "${GREEN}Frontend:${NC} http://localhost:$FRONTEND_PORT"
    echo -e "${GREEN}Backend:${NC}  http://localhost:$BACKEND_PORT"
    echo ""
    echo -e "${YELLOW}Login Credentials:${NC}"
    echo "  Email:    admin@proposalgen.com"
    echo "  Password: password123"
    echo ""
    echo -e "${CYAN}Or click 'Fill Demo Credentials' button on login page${NC}"
    echo ""
    echo -e "${CYAN}Hot Reload Enabled:${NC}"
    echo "  - Backend: Changes to server.js will auto-reload"
    echo "  - Frontend: Changes to React code will auto-reload"
    echo ""
    echo "Press Ctrl+C to stop all servers"
    echo "=========================================="
    echo ""

    # Wait for user to stop
    wait
}

# Run main function
main
