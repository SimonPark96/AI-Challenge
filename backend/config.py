import os
from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
CHROMA_DB_PATH = os.getenv("CHROMA_DB_PATH", "./data/db/chroma")
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./data/uploads")
CLAUDE_MODEL = "claude-opus-4-6"

os.makedirs(CHROMA_DB_PATH, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)
