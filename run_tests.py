import sys
import pytest

if __name__ == "__main__":
    # Add project root to path (pytest handles this automatically but good practice)
    sys.exit(pytest.main(["-v", "tests/"]))
