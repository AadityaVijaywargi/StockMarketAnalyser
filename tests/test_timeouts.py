import threading
import time
from concurrent.futures import TimeoutError

import pytest

from intelligence.timeouts import abandoning_executor, run_with_timeout


def test_run_with_timeout_returns_result():
    assert run_with_timeout(lambda a, b=0: a + b, 2, b=3, timeout=1.0) == 5


def test_run_with_timeout_propagates_exceptions():
    def boom():
        raise ValueError("bad")

    with pytest.raises(ValueError, match="bad"):
        run_with_timeout(boom, timeout=1.0)


def test_run_with_timeout_returns_at_the_timeout_not_when_work_finishes():
    release = threading.Event()
    start = time.time()
    with pytest.raises(TimeoutError):
        run_with_timeout(release.wait, 5.0, timeout=0.2)
    elapsed = time.time() - start
    release.set()
    assert elapsed < 1.0, f"Timed-out call blocked for {elapsed:.2f}s - timeout is not capping latency"


def test_abandoning_executor_does_not_wait_on_exit():
    release = threading.Event()
    start = time.time()
    with abandoning_executor(max_workers=2) as executor:
        executor.submit(release.wait, 5.0)
    elapsed = time.time() - start
    release.set()
    assert elapsed < 1.0, f"Exiting the executor blocked for {elapsed:.2f}s"
