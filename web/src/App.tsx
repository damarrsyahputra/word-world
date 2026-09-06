import { useRef, useState } from 'react';
import PromptBox from './components/PromptBox';
import PreviewPanel from './components/PreviewPanel';
import MobilePreviewPanel from './components/MobilePreviewPanel';
import ChatColumn from './components/ChatColumn';
import { useDocumentChat } from './hooks/useDocumentChat';
import { useMediaQuery } from './hooks/useMediaQuery';

// const API_URL = 'https://word-world-api.vercel.app/api/v1/process-document';

function App() {
  const chat = useDocumentChat();
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);

  // ── Resizable split (chat left / preview right) ─────────────────────────
  const splitRef = useRef<HTMLDivElement>(null);
  const [leftPct, setLeftPct] = useState(50); // default 1/2, clamped 2/5–3/5
  const [isDragging, setIsDragging] = useState(false);

  const handleSplitPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const container = splitRef.current;
    if (!container) return;
    e.preventDefault();
    setIsDragging(true);

    const move = (ev: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const pct = Math.min(60, Math.max(40, ((ev.clientX - rect.left) / rect.width) * 100));
      setLeftPct(pct);
    };
    const up = () => {
      setIsDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  return (
    <div className="fixed inset-0 bg-dark-bg flex flex-col items-center overflow-hidden">

      {/* Toast */}
      <div
        className={`fixed top-8 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ease-out ${
          chat.toastMessage ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10 pointer-events-none'
        }`}
      >
        <div className="bg-red-500/10 border border-red-500/30 text-red-100 px-6 py-3 rounded-full shadow-[0_0_30px_rgba(255,8,68,0.2)] backdrop-blur-xl flex items-center gap-3 whitespace-nowrap">
          <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium tracking-wide">{chat.toastMessage}</span>
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
        className={`absolute inset-0 z-10 transition-all duration-500 ${
          chat.hasStarted ? 'opacity-0 pointer-events-none -translate-y-6' : 'opacity-100 translate-y-0'
        }`}
      >
        {/* Prompt box + upload drop zone — dead center; header floats above it
            at a fixed distance so it shifts up as the box grows taller. */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-full max-w-2xl px-4">
            {/* Header — anchored to the top of the prompt box (fixed gap) */}
            <div className="absolute inset-x-0 bottom-full flex flex-col items-center text-center gap-3 px-4 pb-8 pointer-events-none">
              <img src="/logo-transparent.png" alt="Word World Logo" className="w-14 h-14 object-contain" />
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white/95 drop-shadow-md">
                Mari kita bereskan semuanya!
              </h1>
            </div>

            <PromptBox
              mode="initial"
              file={chat.file}
              setFile={chat.handleFileChange}
              prompt={chat.prompt}
              setPrompt={chat.setPrompt}
              onGenerate={chat.handleGenerate}
              isLoading={chat.isLoading}
            />
          </div>
        </div>
      </div>

      {/* ── CHAT LAYOUT (slides in after first send) ─────────────────────── */}
      <div
        className={`absolute inset-0 z-10 flex flex-col transition-all duration-500 ${
          chat.hasStarted ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Resizable split: chat+input (left) / divider / placeholder (right) */}
        <div
          ref={splitRef}
          className={`flex-1 flex h-full overflow-hidden p-3 gap-3 ${isDragging ? 'select-none' : ''}`}
          style={{ cursor: isDragging ? 'col-resize' : undefined }}
        >
          {/* LEFT — chat + input bar */}
          <ChatColumn
            style={isMobile ? { flex: '1 1 0%' } : { width: `${leftPct}%` }}
            messages={chat.messages}
            isLoading={chat.isLoading}
            layoutReady={chat.layoutReady}
            prompt={chat.prompt}
            setPrompt={chat.setPrompt}
            onGenerate={chat.handleGenerate}
            pendingFile={chat.pendingFile}
            setPendingFile={chat.setPendingFile}
            currentFileName={chat.currentFileName}
            onPreview={() => setMobilePreviewOpen(true)}
            onNewConversation={() => {
              setMobilePreviewOpen(false);
              chat.reset();
            }}
          />

          {/* DIVIDER — draggable (desktop only) */}
          {!isMobile && (
            <div
              onPointerDown={handleSplitPointerDown}
              className="relative z-30 shrink-0 cursor-col-resize flex items-center justify-center"
              style={{ touchAction: 'none', width: '3px', marginLeft: '-6px', marginRight: '-6px' }}
            >
              {/* Invisible expanded hit area for easier dragging */}
              <div className="absolute inset-y-0 -left-2 -right-2" />
            </div>
          )}

          {/* RIGHT — preview panel (desktop only) */}
          {!isMobile && (
            <PreviewPanel
              fileName={chat.currentEditedName ?? chat.currentFileName}
              docBlob={chat.currentDocBlob}
              previewUrl={chat.currentPreviewUrl}
            />
          )}
        </div>
      </div>

      {/* MOBILE — bottom-sheet preview */}
      {isMobile && (
        <MobilePreviewPanel
          open={mobilePreviewOpen}
          onClose={() => setMobilePreviewOpen(false)}
          fileName={chat.currentEditedName ?? chat.currentFileName}
          docBlob={chat.currentDocBlob}
          previewUrl={mobilePreviewOpen ? chat.currentPreviewUrl : null}
        />
      )}
    </div>
  );
}

export default App;