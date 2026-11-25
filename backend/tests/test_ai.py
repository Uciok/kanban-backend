from types import SimpleNamespace

from app import ai


def test_ai_test_route(signed_in, monkeypatch):
    prompts = []
    monkeypatch.setattr(ai, "ask", lambda prompt: prompts.append(prompt) or "4")
    response = signed_in.post("/api/ai/test")
    assert response.status_code == 200
    assert response.json() == {"answer": "4"}
    assert "2+2" in prompts[0]


def test_ai_test_requires_sign_in(client):
    assert client.post("/api/ai/test").status_code == 401


def test_ask_sends_model_and_fallbacks(monkeypatch):
    calls = []

    def create(**kwargs):
        calls.append(kwargs)
        message = SimpleNamespace(content="4")
        return SimpleNamespace(choices=[SimpleNamespace(message=message)])

    fake_client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    monkeypatch.setattr(ai, "client", lambda: fake_client)
    monkeypatch.setenv("OPENROUTER_FALLBACK_MODELS", "model-a, model-b")

    assert ai.ask("What is 2+2?") == "4"
    assert calls[0]["model"] == "openai/gpt-oss-120b"
    assert calls[0]["messages"] == [{"role": "user", "content": "What is 2+2?"}]
    assert calls[0]["extra_body"] == {"models": ["openai/gpt-oss-120b", "model-a", "model-b"]}


def test_models_without_fallbacks(monkeypatch):
    monkeypatch.delenv("OPENROUTER_FALLBACK_MODELS", raising=False)
    assert ai.models() == ["openai/gpt-oss-120b"]
