"""
Pytest configuration and fixtures for BDD tests.
"""
import pytest
import httpx
import os
from typing import Generator


# Base URL for the API (can be overridden with environment variable)
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")


@pytest.fixture(scope="session")
def api_client() -> Generator[httpx.Client, None, None]:
    """
    Create an HTTP client for API testing.
    """
    # Increased timeout for slow API responses (especially AI calls)
    with httpx.Client(base_url=API_BASE_URL, timeout=60.0) as client:
        yield client


@pytest.fixture(scope="function")
def context():
    """
    Context object to share data between steps.
    """
    return {}


@pytest.fixture(scope="session", autouse=False)
def check_api_health(api_client: httpx.Client):
    """
    Check if the API is running before starting tests.
    Only used by BDD tests, not unit tests.
    """
    try:
        # Use a shorter timeout for health check
        response = api_client.get("/api/health", timeout=5.0)
        response.raise_for_status()
    except (httpx.RequestError, httpx.TimeoutException) as e:
        pytest.skip(f"API is not running at {API_BASE_URL}: {e}")

