import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

const API_BASE = 'http://localhost:8000';

function App() {
  const [query, setQuery] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [activeRepo, setActiveRepo] = useState('.');
  const [fileContent, setFileContent] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const handleQuery = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    const userMsg = { role: 'user', content: query };
    setHistory(prev => [...prev, userMsg]);
    setQuery('');
    setIsLoading(true);

    try {
      const { data } = await axios.post(`${API_BASE}/query`, {
        repo_path: activeRepo,
        query: query
      });
      
      const assistantMsg = { 
        role: 'assistant', 
        content: data.response, 
        files: data.files 
      };
      setHistory(prev => [...prev, assistantMsg]);
    } catch (error) {
      setHistory(prev => [...prev, { role: 'assistant', content: `Error: ${error.response?.data?.detail || error.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClone = async () => {
    if (!githubUrl.trim()) return;
    setIsCloning(true);
    try {
      const { data } = await axios.post(`${API_BASE}/clone`, { git_url: githubUrl });
      setActiveRepo(data.path);
      setHistory(prev => [...prev, { role: 'assistant', content: `✅ Successfully cloned and indexed: ${githubUrl}` }]);
    } catch (error) {
      alert(`Clone failed: ${error.response?.data?.detail || error.message}`);
    } finally {
      setIsCloning(false);
      setGithubUrl('');
    }
  };

  const viewFile = async (path) => {
    try {
      const { data } = await axios.get(`${API_BASE}/file-content`, { params: { path } });
      setFileContent(data.content);
      setSelectedFile(path);
    } catch (error) {
      alert(`Failed to load file: ${error.message}`);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  return (
    <div className="flex h-screen bg-[#0d1117] text-[#c9d1d9] font-sans selection:bg-blue-500/30 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-80 border-r border-[#30363d]/50 bg-[#161b22] flex flex-col z-30 shadow-2xl">
        <div className="p-6 border-b border-[#30363d]/50 flex items-center gap-4">
          <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m7 11 2-2-2-2"></path><path d="M11 13h4"></path><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect></svg>
          </div>
          <h1 className="text-xl font-display font-bold tracking-tight text-white">CodebaseAI</h1>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-8 custom-scrollbar">
          {/* Repository Section */}
          <section className="animate-in fade-in slide-in-from-left-4 duration-500 delay-150">
            <h2 className="text-[10px] font-bold text-[#8b949e] uppercase tracking-[0.2em] mb-4">ACTIVE CONTEXT</h2>
            <div className="p-4 bg-[#0d1117] border border-[#30363d] rounded-2xl mb-4 group cursor-pointer hover:border-blue-500/40 hover:bg-[#161b22] transition-all shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"></path></svg>
                <span className="text-xs font-bold text-white uppercase tracking-wider">Repository</span>
              </div>
              <p className="text-sm font-mono text-[#8b949e] truncate pl-7">{activeRepo}</p>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-bold text-[#8b949e] uppercase tracking-[0.2em]">CLONE REPOSITORY</label>
              <div className="relative group/input">
                <input 
                  type="text" 
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="Paste GitHub URL..."
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl py-3 pl-4 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-500 transition-all placeholder-[#484f58]"
                />
                <button 
                  onClick={handleClone}
                  disabled={isCloning}
                  className="absolute right-2 top-2 p-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-colors"
                >
                  {isCloning ? <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M12 2v4"></path><path d="m16.2 7.8 2.9-2.9"></path><path d="M18 12h4"></path><path d="m16.2 16.2 2.9 2.9"></path><path d="M12 18v4"></path><path d="m4.9 19.1 2.9-2.9"></path><path d="M2 12h4"></path><path d="m4.9 4.9 2.9 2.9"></path></svg> : <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>}
                </button>
              </div>
            </div>
          </section>

          {/* Tools Section */}
          <section className="animate-in fade-in slide-in-from-left-4 duration-500 delay-300">
            <h2 className="text-[10px] font-bold text-[#8b949e] uppercase tracking-[0.2em] mb-4">ACTIONS</h2>
            <div className="space-y-2">
              <button 
                onClick={() => setHistory([])}
                className="w-full flex items-center gap-3 p-3 text-sm text-[#8b949e] hover:text-white hover:bg-red-500/10 border border-transparent hover:border-red-500/30 rounded-xl transition-all group"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:text-red-400"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                Clear Conversation
              </button>
              <button 
                className="w-full flex items-center gap-3 p-3 text-sm text-[#8b949e] hover:text-white hover:bg-[#30363d]/50 border border-transparent hover:border-[#30363d] rounded-xl transition-all group"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                Export History
              </button>
            </div>
          </section>
        </div>

        <div className="p-6 border-t border-[#30363d]/50 bg-[#0d1117]/50">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 shadow-inner">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse ring-4 ring-green-500/20" />
            <span className="text-[11px] font-bold text-blue-100/70 uppercase tracking-widest">READY TO SCAN</span>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-dot-[#30363d]/40">
        <div className="absolute inset-0 hero-gradient pointer-events-none" />
        
        {/* Header */}
        <header className="h-20 border-b border-[#30363d]/50 flex items-center justify-between px-10 glass z-20 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="text-white">
              <p className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-0.5">Project Intelligence</p>
              <h2 className="text-lg font-display font-semibold tracking-tight">Codebase Insight Dashboard</h2>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="px-4 py-2 bg-[#161b22] border border-[#30363d] rounded-full text-[11px] font-bold text-[#8b949e]">
               GROQ LLAMA 3.1 • 8B
             </div>
          </div>
        </header>

        {/* Message Container */}
        <div className="flex-1 overflow-y-auto px-10 py-10 space-y-10 custom-scrollbar z-10 scroll-smooth">
          {history.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center space-y-8 animate-in zoom-in-95 duration-700 select-none">
              <div className="relative">
                 <div className="absolute inset-0 bg-blue-600/20 blur-[100px] animate-pulse" />
                 <div className="relative p-10 bg-[#161b22] rounded-[3rem] border border-[#30363d] shadow-2xl">
                    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="url(#blue-grad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-24 h-24 mb-6">
                      <defs>
                        <linearGradient id="blue-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#3b82f6" />
                          <stop offset="100%" stopColor="#8b5cf6" />
                        </linearGradient>
                      </defs>
                      <polyline points="16 18 22 12 16 6"></polyline>
                      <polyline points="8 6 2 12 8 18"></polyline>
                    </svg>
                 </div>
              </div>
              <div className="text-center max-w-md space-y-4">
                <h3 className="text-3xl font-display font-bold text-white tracking-tight">Analyze with Accuracy</h3>
                <p className="text-md text-[#8b949e] leading-relaxed">Simply clone a repo or ask about the local context to begin a deep-dive analysis of logic, flow, and architecture.</p>
              </div>
            </div>
          )}

          {history.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-message`}>
              <div className={`group relative max-w-[85%] rounded-[1.5rem] px-8 py-6 shadow-2xl border ${
                msg.role === 'user' 
                ? 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-blue-400/30 rounded-tr-none' 
                : 'glass border-[#30363d] text-[#c9d1d9] rounded-tl-none ring-1 ring-white/5'
              }`}>
                {msg.role === 'assistant' && (
                   <button 
                     onClick={() => copyToClipboard(msg.content)}
                     className="absolute top-4 right-4 p-2 opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded-lg transition-all text-[#8b949e] hover:text-white"
                   >
                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"></rect><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path></svg>
                   </button>
                )}
                
                <div className="prose prose-invert prose-md max-w-none leading-relaxed whitespace-pre-wrap font-sans">
                  {msg.content}
                </div>
                
                {msg.files && msg.files.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-[#30363d]/50 space-y-4">
                    <p className="text-[10px] uppercase font-bold tracking-[0.3em] text-[#8b949e]">RETRIEVED ARTIFACTS</p>
                    <div className="flex flex-wrap gap-3">
                      {msg.files.map((file, idx) => (
                        <button 
                          key={idx}
                          onClick={() => viewFile(file)}
                          className="flex items-center gap-3 px-4 py-2 bg-[#0d1117]/80 hover:bg-blue-600 hover:text-white border border-[#30363d] hover:border-transparent rounded-xl text-xs font-semibold transition-all shadow-md group/file"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500 group-hover/file:text-white"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"></path></svg>
                          {file.split(/[\\/]/).pop()}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Improved Input */}
        <div className="p-10 z-20">
          <form onSubmit={handleQuery} className="max-w-4xl mx-auto relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[2rem] blur opacity-25 group-focus-within:opacity-50 transition duration-1000" />
            <div className="relative bg-[#1c2128] border border-[#30363d] rounded-[2rem] shadow-2xl flex items-center pr-3">
              <input 
                type="text" 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ex. 'How does the backend interact with Groq?'"
                className="flex-1 bg-transparent py-6 pl-8 text-white placeholder-[#484f58] focus:outline-none text-lg selection:bg-blue-500/20"
              />
              <button 
                type="submit" 
                disabled={isLoading || !query.trim()}
                className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:scale-105 disabled:bg-[#30363d] disabled:hover:scale-100 disabled:opacity-50 text-white rounded-[1.5rem] transition-all shadow-xl active:scale-95"
              >
                {isLoading ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M12 2v4"></path><path d="m16.2 7.8 2.9-2.9"></path><path d="M18 12h4"></path><path d="m16.2 16.2 2.9 2.9"></path><path d="M12 18v4"></path><path d="m4.9 19.1 2.9-2.9"></path><path d="M2 12h4"></path><path d="m4.9 4.9 2.9 2.9"></path></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* Code Viewer Panel (Upgraded) */}
      {fileContent !== null && (
        <aside className="w-[45%] bg-[#0d1117] border-l border-[#30363d]/50 flex flex-col z-40 animate-in slide-in-from-right-8 duration-500 shadow-[-20px_0_60px_rgba(0,0,0,0.6)] glass">
          <div className="h-20 flex items-center justify-between px-8 border-b border-[#30363d]/50 bg-[#161b22]/50 backdrop-blur-md">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/20">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-blue-500 uppercase tracking-widest leading-none mb-1">Source Inspector</p>
                <h3 className="text-sm font-semibold font-mono text-white truncate max-w-[300px]">{selectedFile?.split(/[\\/]/).pop()}</h3>
              </div>
            </div>
            <div className="flex items-center gap-2">
               <button 
                onClick={() => copyToClipboard(fileContent)}
                className="p-3 bg-[#30363d]/30 hover:bg-[#30363d]/60 rounded-xl transition-all text-[#8b949e] hover:text-white"
                title="Copy File Content"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"></rect><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path></svg>
              </button>
              <button 
                onClick={() => { setFileContent(null); setSelectedFile(null); }}
                className="p-3 bg-[#30363d]/30 hover:bg-red-500 text-[#8b949e] hover:text-white rounded-xl transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto bg-[#0d1117] custom-scrollbar">
            <div className="p-2">
              <SyntaxHighlighter 
                language={selectedFile?.split('.').pop() || 'javascript'} 
                style={vscDarkPlus}
                customStyle={{ 
                  margin: 0, 
                  padding: '2rem', 
                  background: 'transparent',
                  fontSize: '0.85rem'
                }}
                showLineNumbers={true}
              >
                {fileContent}
              </SyntaxHighlighter>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}

export default App;
