import streamlit as st
import os
import re
import subprocess
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_groq import ChatGroq
from dotenv import load_dotenv
load_dotenv()

# -------------------------------
# 1. Initialize Models
# -------------------------------
@st.cache_resource
def init_models():
    embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
    llm = ChatGroq(
        groq_api_key=os.getenv("GROQ_API_KEY"),  # ✅ secure
        model_name="llama-3.1-8b-instant"
    )
    return embeddings, llm


# -------------------------------
# 2. Helper Functions
# -------------------------------
def detect_api(code):
    patterns = [
        r"fetch\(",
        r"axios\.",
        r"app\.(get|post|put|delete)",
        r"router\.",
        r"getFirestore",
        r"initializeApp"
    ]
    return any(re.search(p, code) for p in patterns)


def extract_functions(code):
    patterns = [
        r'def\s+(\w+)',
        r'function\s+(\w+)',
        r'const\s+(\w+)\s*=\s*\('
    ]
    found = []
    for p in patterns:
        found.extend(re.findall(p, code))
    return list(set(found))


def clone_repo(git_url):
    if not git_url:
        return None
    
    repo_name = git_url.split("/")[-1].replace(".git", "")
    target_path = os.path.join("cloned_repos", repo_name)
    
    if not os.path.exists("cloned_repos"):
        os.makedirs("cloned_repos")
        
    if not os.path.exists(target_path):
        with st.spinner(f"📥 Cloning {repo_name}..."):
            try:
                subprocess.run(["git", "clone", git_url, target_path], check=True)
                st.success(f"✅ Cloned to {target_path}")
            except Exception as e:
                st.error(f"❌ Clone failed: {e}")
                return None
    return target_path


# -------------------------------
# 3. Build Code Vector DB
# -------------------------------
@st.cache_resource
def get_code_db(repo_path):
    if not os.path.exists(repo_path):
        return None

    embeddings, _ = init_models()
    code_files = []

    for root, _, files in os.walk(repo_path):
        if any(x in root for x in ["node_modules", ".git", "dist", "venv", "__pycache__", "build"]):
            continue

        for file in files:
            if file.endswith((".py", ".js", ".ts", ".java")) and file not in ["vite.config.js", "eslint.config.js", "tsconfig.json", "package-lock.json"]:
                path = os.path.join(root, file)
                with open(path, "r", encoding="utf-8", errors="ignore") as f:
                    code_files.append({
                        "content": f.read(),
                        "path": path
                    })

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=100
    )

    processed_docs = []

    for f in code_files:
        chunks = splitter.split_text(f["content"])
        for chunk in chunks:
            processed_docs.append({
                "content": chunk,
                "metadata": {
                    "source": f["path"],
                    "is_api": detect_api(chunk),
                    "functions": extract_functions(chunk)
                }
            })

    texts = [d["content"] for d in processed_docs]
    metadatas = [d["metadata"] for d in processed_docs]

    return FAISS.from_texts(texts, embeddings, metadatas=metadatas)


# -------------------------------
# 4. Smart Retrieval
# -------------------------------
def smart_retrieval(query, db):
    docs = db.similarity_search(query, k=8)

    if "api" in query.lower():
        docs = [d for d in docs if d.metadata.get("is_api")]

    return docs[:5]


# -------------------------------
# 5. Prompt Builder
# -------------------------------
def build_prompt(context, question):
    query = question.lower()
    
    # Core rules for all modes
    base_rules = """
Rules:
- Mention exact file names
- Be extremely precise and confident
- Do NOT use words like "maybe", "likely", "probably", or "possibly"
- If you don't know, say exactly what is missing
- Do NOT guess
"""

    if "api" in query:
        mode_prompt = f"""
Mode: API Analysis
→ Identify all API endpoints, routes, and external service calls.
→ Show the exact code snippets for fetch/axios or route handlers.
"""
    elif "flow" in query or "how" in query:
        mode_prompt = f"""
Mode: Logic Flow
→ Explain the step-by-step execution path for this feature.
→ Trace how data moves from input to processing to output.
"""
    else:
        mode_prompt = f"""
Mode: Architecture & Structure
→ Explain the high-level organization of this component or project.
→ List the key files and their primary responsibilities.
"""

    return f"""
You are a senior software engineer. Analyze the provided codebase context and answer the question with absolute authority.

{mode_prompt}

{base_rules}

Context:
{context}

Question: {question}
- Do NOT guess
- Ignore config files unless asked

If question is about API:
→ Show exact files

If question is about flow:
→ Explain step-by-step execution
"""


# -------------------------------
# 6. Streamlit UI
# -------------------------------
st.set_page_config(page_title="Codebase Chatbot", layout="wide")
st.title("💻 Codebase RAG Chatbot")

embeddings, llm = init_models()

# Chat history
if "history" not in st.session_state:
    st.session_state.history = []

# Load DB
st.sidebar.header("📂 Repository Source")

# Option 1: Local Folder
local_path = st.sidebar.text_input("📁 Local Codebase Folder", value=".")

# Option 2: GitHub URL
github_url = st.sidebar.text_input("🔗 GitHub Repo URL", placeholder="https://github.com/user/repo.git")

if "repo_path" not in st.session_state:
    st.session_state.repo_path = local_path

if st.sidebar.button("🚀 Clone & Index") and github_url:
    cloned_path = clone_repo(github_url)
    if cloned_path:
        st.session_state.repo_path = cloned_path

# Sync local path if modified and no github_url is currently being processed
if not github_url:
    st.session_state.repo_path = local_path

repo_path = st.session_state.repo_path
if not repo_path:
    repo_path = "."

db = get_code_db(repo_path)

if not db:
    st.error(f"❌ Codebase at '{repo_path}' not found or empty!")
else:
    # Display chat
    for msg in st.session_state.history:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])
            if "files" in msg:
                for f in msg["files"]:
                    with st.expander(f"📁 {f}"):
                        if os.path.exists(f):
                            with open(f, "r", encoding="utf-8", errors="ignore") as file:
                                st.code(file.read(), language=f.split(".")[-1] if "." in f else None)
                        else:
                            st.error("File not found.")

    # Input
    if query := st.chat_input("Ask about the codebase..."):
        st.session_state.history.append({"role": "user", "content": query})
        with st.chat_message("user"):
            st.markdown(query)

        docs = smart_retrieval(query, db)

        context = "\n\n".join([
            f"File: {d.metadata['source']}\nSnippet:\n{d.page_content[:500]}"
            for d in docs
        ])

        prompt = build_prompt(context, query)
        response = llm.invoke(prompt).content

        files = list(set([d.metadata["source"] for d in docs]))

        st.session_state.history.append({
            "role": "assistant",
            "content": response,
            "files": files
        })

        with st.chat_message("assistant"):
            st.markdown(response)
            for f in files:
                with st.expander(f"📁 {f}"):
                    if os.path.exists(f):
                        with open(f, "r", encoding="utf-8", errors="ignore") as file:
                            st.code(file.read(), language=f.split(".")[-1] if "." in f else None)
                    else:
                        st.error("File not found.")