from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable, Iterator, TypeVar
from contextlib import contextmanager

T = TypeVar("T")


@contextmanager
def abandoning_executor(max_workers: int = 1) -> Iterator[ThreadPoolExecutor]:
    """A ThreadPoolExecutor that does NOT wait for running work on exit.

    `with ThreadPoolExecutor() as ex:` calls shutdown(wait=True) on exit, so a
    `future.result(timeout=...)` inside it only raises TimeoutError *after* the
    slow call finishes anyway - the timeout caps nothing. This variant cancels
    queued work and abandons running work (it finishes in the background and
    its result is discarded), so the caller really returns at the timeout.
    """
    executor = ThreadPoolExecutor(max_workers=max_workers)
    try:
        yield executor
    finally:
        executor.shutdown(wait=False, cancel_futures=True)


def run_with_timeout(fn: Callable[..., T], *args: Any, timeout: float, **kwargs: Any) -> T:
    """Run fn in a worker thread; raise concurrent.futures.TimeoutError once
    `timeout` seconds pass, without waiting for fn to finish."""
    with abandoning_executor() as executor:
        return executor.submit(fn, *args, **kwargs).result(timeout=timeout)
