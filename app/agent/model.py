import os
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_groq import ChatGroq

def create_chat_model(model_name: str | None = None, temperature: float = 0) -> BaseChatModel:
    """Create the chat model using Groq API."""
    
    # Default to qwen model as requested
    actual_model = model_name if model_name else "qwen/qwen3.8-27b"
    
    return ChatGroq(
        model=actual_model,
        temperature=temperature,
        api_key=os.environ.get("GROQ_API_KEY")
    )
