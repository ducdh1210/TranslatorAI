# Define directories and commands
FRONTEND_DIR=./frontend
NPM_CMD=npm --prefix $(FRONTEND_DIR)

BACKEND_CMD=poetry run python -m backend.main

# Default target
all: start-frontend start-backend

# Target to run npm start in the frontend directory
start-frontend:
	$(NPM_CMD) start

# Target to run backend with Poetry
start-backend:
	$(BACKEND_CMD)

# Target to run both frontend and backend
start: start-frontend start-backend

.PHONY: all start start-frontend start-backend
