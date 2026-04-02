from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import re
import subprocess
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_groq import ChatGroq
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# Enable CORS for the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ✅ In production, restrict this to your domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------
# Core Configuration
# -------------------------------
# Using absolute paths or root-relative to avoid duplicates
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
CLONED_REPOS_DIR = os.path.join(DATA_DIR, "cloned_repos")
VECTOR_DBS_DIR = os.path.join(DATA_DIR, "vector_dbs")

if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)
if not os.path.exists(CLONED_REPOS_DIR):
    os.makedirs(CLONED_REPOS_DIR)
if not os.path.exists(VECTOR_DBS_DIR):
    os.makedirs(VECTOR_DBS_DIR)

# -------------------------------
# Initialize Models
# -------------------------------
embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
llm = ChatGroq(
    groq_api_key=os.getenv("GROQ_API_KEY"),
    model_name="llama-3.1-8b-instant"
)

# -------------------------------
# Helper Functions
# -------------------------------
def detect_api(code):
    patterns = [r"fetch\(", r"axios\.", r"app\.(get|post|put|delete)", r"router\.", r"getFirestore", r"initializeApp"]
    return any(re.search(p, code) for p in patterns)

def extract_functions(code):
    patterns = [r'def\s+(\w+)', r'function\s+(\w+)', r'const\s+(\w+)\s*=\s*\(']
    found = []
    for p in patterns:
        found.extend(re.findall(p, code))
    return list(set(found))

# -------------------------------
# API Endpoints
# -------------------------------
@app.get("/")
def home():
    return {"status": "Backend is running!"}

class CloneRequest(BaseModel):
    git_url: str

@app.post("/clone")
async def clone_repository(payload: CloneRequest):
    git_url = payload.git_url
    repo_name = git_url.split("/")[-1].replace(".git", "")
    target_path = os.path.join(CLONED_REPOS_DIR, repo_name)
    
    if os.path.exists(target_path):
        return {"message": "Repo already exists", "path": target_path}
    
    try:
        subprocess.run(["git", "clone", git_url, target_path], check=True)
        return {"message": "Successfully cloned", "path": target_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Clone failed: {str(e)}")

class QueryRequest(BaseModel):
    repo_path: str
    query: str

@app.post("/query")
async def query_codebase(payload: QueryRequest):
    repo_path = payload.repo_path
    query = payload.query
    
    if not os.path.exists(repo_path):
        raise HTTPException(status_code=404, detail="Codebase folder not found")
    
    # 1. Build context using RAG
    code_files = []
    for root, _, files in os.walk(repo_path):
        if any(x in root for x in ["node_modules", ".git", "dist", "venv", "__pycache__"]):
            continue
        for file in files:
            if file.endswith((".py", ".js", ".ts", ".java")):
                path = os.path.join(root, file)
                try:
                    with open(path, "r", encoding="utf-8", errors="ignore") as f:
                        code_files.append({"content": f.read(), "path": path})
                except:
                    continue
    
    if not code_files:
        return {"response": "No code files found to analyze."}

    splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=100)
    processed_docs = []
    for f in code_files:
        chunks = splitter.split_text(f["content"])
        for chunk in chunks:
            processed_docs.append({"content": chunk, "metadata": {"source": f["path"], "is_api": detect_api(chunk)}})

    texts = [d["content"] for d in processed_docs]
    metadatas = [d["metadata"] for d in processed_docs]
    db = FAISS.from_texts(texts, embeddings, metadatas=metadatas)
    
    # 2. Smart Retrieval
    docs = db.similarity_search(query, k=5)
    context = "\n\n".join([f"File: {d.metadata['source']}\nSnippet:\n{d.page_content[:500]}" for d in docs])
    
    # 3. Build Prompt
    prompt = f"""
You are a senior software engineer. Answer the question precisely based on the codebase.
Mode: Codebase Analysis
Rules:
- Be confident and exact
- List file names used
- Do NOT guess
- FORMATTING: Use **bold headers**, bullet points (`-`), and clear spacing for easy reading.
- STRUCTURE: Group your answer into "Summary", "Key Logic", and "Files Involved".

Context:
{context}

Question: {query}
"""
    response = llm.invoke(prompt).content
    files = list(set([d.metadata["source"] for d in docs]))
    
    return {"response": response, "files": files}

@app.get("/file-content")
async def get_file_content(path: str):
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            return {"content": f.read()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
