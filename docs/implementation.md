# Implementation

## AI Provider Layer

### Architecture

The AI provider layer is provider-agnostic — users can configure any
OpenAI-compatible or Gemini provider through frontend settings.

```
backend/app/services/ai/
  base_ai_service.py          # Base class for all AI services
  helpers.py                  # Provider resolution helpers
  provider_factory.py         # Factory: settings → provider instance
  providers/
    base.py                   # Abstract AIProvider + config dataclasses
    openai_compatible.py      # OpenAI / any OpenAI-compatible API
    gemini.py                 # Google Gemini (supports file upload, grounding)
    registry.py               # Global provider registry singleton
```

### Provider Interface

```python
class AIProvider(ABC):
  async def generate(prompt, config) -> str
  async def generate_stream(prompt, config) -> AsyncIterator[str]
  async def embed(texts, config) -> list[list[float]]
  async def upload_file(file_path) -> str | None  # optional
  supports_file_upload: bool
  supports_grounding: bool
```

### Provider Resolution Order

1. **User-specific settings** from `user_ai_settings` table (encrypted API key)
2. **Environment fallback** — `GOOGLE_API_KEY` / `GENAI_MODEL` etc.
3. **None** — service returns a clear error to configure a provider

### Supported Providers

| Type | File Upload | Grounding | Embedding | Stream |
|------|------------|-----------|-----------|--------|
| `gemini` | ✅ PDF upload | ✅ Google Search | ✅ | ✅ (buffered) |
| `openai-compatible` | ❌ (uses text) | ❌ | ✅ | ✅ (native) |

### User AI Settings

Stored in `user_ai_settings` table. API keys are encrypted at rest with
Fernet (AES-128-CBC) using a key derived from `JWT_SECRET_KEY`.

**Endpoints** (all auth-protected):
- `GET /user/ai-settings` — read current settings
- `PUT /user/ai-settings` — create/replace
- `PATCH /user/ai-settings` — partial update
- `DELETE /user/ai-settings` — remove
- `GET /ai/providers` — list available provider types
