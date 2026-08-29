import { useState, useEffect, useRef } from 'react';
import PromptBox from './components/PromptBox';
import ChatView, { type Message } from './components/ChatView';

// const API_URL = 'https://word-world-api.vercel.app/api/v1/process-document';
const API_URL = 'http://127.0.0.1:8000/api/v1/process-document';

function App() {
  // ── Chat state ──────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasStarted, setHasStarted] = useState(false);

  // The latest processed .docx blob (in browser memory, never stored on server)
  const [currentDocBlob, setCurrentDocBlob] = useState<Blob | null>(null);
  // Name of the original file, used for download filename
  const [currentFileName, setCurrentFileName] = useState<string>('document.docx');

  // ── Input state ─────────────────────────────────────────────────────────
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Initial mode: full file drop zone
  const [file, setFile] = useState<File | null>(null);
  // Chat mode: compact file-plus attachment (for changing document mid-session)
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  // ── Toast notifications ─────────────────────────────────────────────────
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Track layout animation: after first send we start transition
  const [layoutReady, setLayoutReady] = useState(false);
  const transitionRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-hide toast after 7 seconds
  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 7000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  // Cleanup transition timeout
  useEffect(() => () => { if (transitionRef.current) clearTimeout(transitionRef.current); }, []);

  // ── Helpers ─────────────────────────────────────────────────────────────

  /** The last user message sent — used as 1-step memory for the backend. */
  const lastUserPrompt = (): string => {
    const userMessages = messages.filter((m) => m.role === 'user');
    return userMessages.at(-1)?.text ?? '';
  };

  /** Mark all existing assistant blobs as expired (called before adding new result). */
  const expirePreviousBlobs = () => {
    setMessages((prev) =>
      prev.map((m) =>
        m.role === 'assistant' && m.downloadBlob
          ? { ...m, isExpired: true, downloadBlob: undefined }
          : m
      )
    );
  };

  // ── Core generate handler ────────────────────────────────────────────────
  const handleGenerate = async () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) return;

    // Determine which file to send
    // pendingFile (chat mode attach) takes priority → resets session
    // currentDocBlob is the latest processed doc → continue conversation
    // file is the initial upload → first message
    let fileToSend: File | null = null;

    if (pendingFile) {
      // New document attached in chat mode → reset session
      setCurrentDocBlob(null);
      setMessages([]);
      setCurrentFileName(pendingFile.name);
      fileToSend = pendingFile;
      setPendingFile(null);
    } else if (currentDocBlob) {
      // Send the latest processed blob as the "file" input
      fileToSend = new File([currentDocBlob], currentFileName, {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
    } else if (file) {
      // First message, use the original upload
      fileToSend = file;
      setCurrentFileName(file.name);
    }

    if (!fileToSend) {
      setToastMessage('Upload dokumen .docx terlebih dahulu!');
      return;
    }

    // ── Transition to chat layout ─────────────────────────────────────────
    if (!hasStarted) {
      setHasStarted(true);
      // Small delay so the layout transition starts before we show the bubble
      await new Promise((resolve) => {
        transitionRef.current = setTimeout(resolve, 80);
      });
      setLayoutReady(true);
    }

    // ── Add user bubble ───────────────────────────────────────────────────
    const prev = lastUserPrompt();
    const userMsg: Message = { 
      id: crypto.randomUUID(), 
      role: 'user', 
      text: trimmedPrompt,
      // Only set attachedFileName if the user explicitly attached a new file in this turn
      attachedFileName: pendingFile ? pendingFile.name : (file && !hasStarted ? file.name : undefined)
    };
    setMessages((msgs) => [...msgs, userMsg]);
    setPrompt('');

    // ── Expire old blobs ──────────────────────────────────────────────────
    expirePreviousBlobs();
    setIsLoading(true);

    // ── Call backend ──────────────────────────────────────────────────────
    try {
      const formData = new FormData();
      formData.append('file', fileToSend);
      formData.append('prompt', trimmedPrompt);
      formData.append('previous_prompt', prev);

      const response = await fetch(API_URL, { method: 'POST', body: formData });

      if (!response.ok) {
        let detail = 'Gagal memproses dokumen. Coba lagi.';
        try {
          const errData = await response.json();
          if (errData.detail) detail = errData.detail;
        } catch { /* ignore */ }
        throw new Error(detail);
      }

      const blob = await response.blob();
      const summary = response.headers.get('X-Word-World-Summary') ?? 'Dokumen berhasil diproses.';
      const parts = currentFileName.split('.');
      const ext = parts.length > 1 ? parts.pop() : 'docx';
      const base = parts.join('.');
      const editedName = `${base}-edited.${ext}`;

      setCurrentDocBlob(blob);

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: summary,
        downloadBlob: blob,
        fileName: editedName,
      };
      setMessages((msgs) => [...msgs, assistantMsg]);
    } catch (err) {
      const errMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: '⚠️ ' + (err as Error).message,
      };
      setMessages((msgs) => [...msgs, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (selectedFile: File | null) => {
    if (selectedFile && selectedFile.size > 20 * 1024 * 1024) {
      setToastMessage('File terlalu besar. Maksimum 20 MB.');
      return;
    }
    setFile(selectedFile);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-dark-bg flex flex-col items-center overflow-hidden">

      {/* Toast */}
      <div
        className={`fixed top-8 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ease-out ${
          toastMessage ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10 pointer-events-none'
        }`}
      >
        <div className="bg-red-500/10 border border-red-500/30 text-red-100 px-6 py-3 rounded-full shadow-[0_0_30px_rgba(255,8,68,0.2)] backdrop-blur-xl flex items-center gap-3 whitespace-nowrap">
          <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium tracking-wide">{toastMessage}</span>
        </div>
      </div>

      {/* Aurora Background */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/30 rounded-full blur-[120px] animate-blob" />
        <div className="absolute top-[20%] right-[-10%] w-[60%] h-[60%] bg-cyan-500/20 rounded-full blur-[100px] animate-blob-slow" />
        <div className="absolute bottom-[-20%] left-[20%] w-[50%] h-[50%] bg-indigo-500/30 rounded-full blur-[120px] animate-blob-fast" />
        <div className="absolute bottom-[10%] right-[10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[100px] animate-blob" />
      </div>

      {/* ── INITIAL LAYOUT (centered, fades out after first send) ────────── */}
      <div
        className={`absolute inset-0 z-10 flex flex-col items-center justify-center p-4 transition-all duration-500 ${
          hasStarted ? 'opacity-0 pointer-events-none -translate-y-6' : 'opacity-100 translate-y-0'
        }`}
      >
        <div className="max-w-2xl w-full flex flex-col gap-6">
          {/* Header */}
          <div className="flex flex-col items-center text-center gap-3">
            <img src="/logo-transparent.png" alt="Word World Logo" className="w-14 h-14 object-contain" />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white/95 drop-shadow-md">
              Mari kita bereskan semuanya!
            </h1>
          </div>

          {/* Full prompt box */}
          <PromptBox
            mode="initial"
            file={file}
            setFile={handleFileChange}
            prompt={prompt}
            setPrompt={setPrompt}
            onGenerate={handleGenerate}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* ── CHAT LAYOUT (slides in after first send) ─────────────────────── */}
      <div
        className={`absolute inset-0 z-10 flex flex-col transition-all duration-500 ${
          hasStarted ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Chat message area — fills space above input bar */}
        <div className="flex-1 overflow-hidden flex flex-col max-w-2xl w-full mx-auto px-2">
          {layoutReady && (
            <ChatView messages={messages} isLoading={isLoading} />
          )}
        </div>

        {/* Compact input bar — fixed at bottom */}
        <div
          className={`relative z-20 p-3 sm:p-4 flex justify-center transition-all duration-500 ${
            hasStarted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
          }`}
        >
          <PromptBox
            mode="chat"
            prompt={prompt}
            setPrompt={setPrompt}
            onGenerate={handleGenerate}
            isLoading={isLoading}
            pendingFile={pendingFile}
            setPendingFile={setPendingFile}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
