import logging
import os
import shutil
from analysis.utils import setup_logging

def test_logging_setup():
    """Verify logger creation and settings."""
    test_log_file = "storage/logs/test_platform.log"
    
    # Remove test log file if exists
    if os.path.exists(test_log_file):
        os.remove(test_log_file)
        
    logger = setup_logging(
        log_level=logging.DEBUG,
        log_to_console=False,
        log_to_file=True,
        log_file_path=test_log_file,
        force_reconfigure=True
    )
    
    assert logger is not None
    assert logger.level == logging.DEBUG
    
    # Write a test log message
    logger.debug("Test log message.")
    
    # Verify file was created
    assert os.path.exists(test_log_file)
    
    # Clean up test log file
    handlers = logger.handlers[:]
    for handler in handlers:
        handler.close()
        logger.removeHandler(handler)
    if os.path.exists(test_log_file):
        os.remove(test_log_file)
