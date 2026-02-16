# Python Secrets Handling

## Sensitive Values
Sensitive values like passwords, passphrases, private keys, and API keys MUST be treated as sensitive.

## Using Pydantic SecretStr/SecretBytes
Use `SecretStr` or `SecretBytes` from `pydantic` to handle sensitive data:

```python
from pydantic import BaseModel, SecretStr, SecretBytes

class SimpleModel(BaseModel):
    password: SecretStr
    password_bytes: SecretBytes

sm = SimpleModel(password='IAmSensitive', password_bytes=b'IAmSensitiveBytes')

# Standard access methods will not display the secret
print(sm)
#> password=SecretStr('**********') password_bytes=SecretBytes(b'**********')
print(sm.password)
#> **********

# Use get_secret_value method to see the secret's content
print(sm.password.get_secret_value())
#> IAmSensitive
```

## Settings with Docker Secrets
Example settings class that supports Docker secrets:

```python
import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class AuthenticationBaseSettings(BaseSettings):
    """Base settings for authentication."""
    # See https://docs.pydantic.dev/latest/concepts/pydantic_settings/#use-case-docker-secrets
    model_config = SettingsConfigDict(
        secrets_dir="/run/secrets" if os.path.exists("/run/secrets") else None
    )

class CustomSettings(AuthenticationBaseSettings):
    # This will be mapped to the environment variable CUSTOM_SETTING_VALUE
    custom_setting_value: str
```
