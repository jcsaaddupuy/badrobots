# Python Logging Rules

## Core Principles
- Always use the `logging` module for logging
- Avoid using print statements, use logging instead
- Always log exceptions with stack trace using `logger.exception("message")`

## Logger Setup
- Always create a logger for each module using `logger = logging.getLogger(__name__)`
- Always configure logging in the main entry point of the application:
  - If `__name__ == "__main__":`
  - Or if `uvicorn.run(...)`

## Logging Levels
- Development: Set level to `INFO` or `DEBUG`
- Production: Set level to `WARNING` or `ERROR`
- Always use appropriate logging levels based on severity:
  - `DEBUG`: Detailed diagnostic information
  - `INFO`: General informational messages
  - `WARNING`: Warning messages for potentially harmful situations
  - `ERROR`: Error messages for serious problems
  - `CRITICAL`: Critical messages for very serious errors

## Lazy Formatting (CRITICAL)
- **Always use lazy formatting for log messages**
- Use `logger.info("User %s logged in", username)` 
- **Never use**: `logger.info(f"User {username} logged in")`
- This prevents string formatting if the log level filters out the message

## Message Content
- Always include relevant context in log messages:
  - User ID
  - Request ID
  - Transaction ID
  - Other contextual identifiers
- Always ensure log messages are clear, concise, and informative
- Avoid logging sensitive information:
  - Passwords
  - Credit card numbers
  - API keys
  - Personal data

## Exception Logging
- Always log exceptions with full stack trace
- Use `logger.exception("message")` within exception handlers
- Include context about what operation was being performed
