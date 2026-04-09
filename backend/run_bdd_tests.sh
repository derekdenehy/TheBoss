#!/bin/bash
# BDD Test Runner Script
# Usage: ./run_bdd_tests.sh [pytest-args]
# Examples:
#   ./run_bdd_tests.sh                    # Run all BDD tests
#   ./run_bdd_tests.sh -k chat            # Run only chat tests
#   ./run_bdd_tests.sh -m smoke           # Run only smoke tests
#   ./run_bdd_tests.sh -v --tb=short      # Verbose with short traceback

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Running BDD Acceptance Tests...${NC}"
echo ""

# Check if API is running
if ! curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
    echo -e "${BLUE}⚠️  Warning: API doesn't seem to be running on http://localhost:8000${NC}"
    echo "   Start it with: uvicorn main:app --reload --host 0.0.0.0 --port 8000"
    echo ""
fi

# Run pytest with BDD config
pytest -c pytest-bdd.ini "$@"

# Check exit code
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ All BDD tests passed!${NC}"
else
    echo ""
    echo -e "${BLUE}❌ Some tests failed. Check the output above.${NC}"
    exit 1
fi

