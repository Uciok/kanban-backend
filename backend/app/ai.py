import os

from openai import OpenAI

BASE_URL = "https://openrouter.ai/api/v1"
MODEL = "openai/gpt-oss-120b"


def models() -> list[str]:
    # OpenRouter tries these in order if a model is unavailable
    fallbacks = os.environ.get("OPENROUTER_FALLBACK_MODELS", "")
    return [MODEL, *(m.strip() for m in fallbacks.split(",") if m.strip())]


def client() -> OpenAI:
    return OpenAI(base_url=BASE_URL, api_key=os.environ["OPENROUTER_API_KEY"])


def ask(prompt: str) -> str:
    response = client().chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        extra_body={"models": models()},
    )
    return response.choices[0].message.content
