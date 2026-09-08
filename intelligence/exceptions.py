class LLMError(Exception):
    """Base exception for LLM Intelligence Engine errors."""
    pass


class LLMKeyMissingError(LLMError):
    """Raised when an API key required for the LLM provider is missing."""
    def __init__(self, provider_name: str, key_env_var: str):
        self.provider_name = provider_name
        self.key_env_var = key_env_var
        super().__init__(f"API key missing for provider '{provider_name}'. Please set '{key_env_var}' environment variable.")


class LLMProviderError(LLMError):
    """Raised when an LLM provider encounters an execution or API error."""
    def __init__(self, provider_name: str, message: str, original_error: Exception = None):
        self.provider_name = provider_name
        self.original_error = original_error
        super().__init__(f"LLM Provider '{provider_name}' error: {message}")


class LLMJSONParseError(LLMError):
    """Raised when the LLM output cannot be parsed as valid JSON or fails schema validation."""
    def __init__(self, message: str, raw_response: str = None):
        self.raw_response = raw_response
        super().__init__(f"LLM JSON parsing error: {message}")


class LLMResponseTimeoutError(LLMError):
    """Raised when the LLM provider call exceeds the configured timeout."""
    def __init__(self, provider_name: str, timeout_seconds: float):
        self.provider_name = provider_name
        self.timeout_seconds = timeout_seconds
        super().__init__(f"LLM Provider '{provider_name}' timed out after {timeout_seconds} seconds.")
