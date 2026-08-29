import React, { useState, useEffect, useRef } from 'react';

interface PromptBoxProps {
  mode: 'initial' | 'chat';
  // Shared
  prompt: string;
  setPrompt: (prompt: string) => void;
  onGenerate: () => void;
  isLoading: boolean;
  // Initial mode only
  file?: File | null;
  setFile?: (file: File | null) => void;
  // Chat mode only — compact file attachment
  pendingFile?: File | null;
  setPendingFile?: (file: File | null) => void;
}

/* ─── Initial mode (full drop-zone layout) ──────────────────────────────── */
function InitialPromptBox({
  file,
  setFile,
  prompt,
  setPrompt,
  onGenerate,
  isLoading,
}: Required<Pick<PromptBoxProps, 'file' | 'setFile' | 'prompt' | 'setPrompt' | 'onGenerate' | 'isLoading'>>) {
  const [placeholderText, setPlaceholderText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [loopNum] = useState(0);
  const [typingSpeed, setTypingSpeed] = useState(50);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const placeholder = 'Ketikkan instruksi untuk mulai mengedit...';

  useEffect(() => {
    if (prompt !== '') return;
    const handleTyping = () => {
      if (!isDeleting && placeholderText === placeholder && loopNum === 0) return;
      setPlaceholderText(
        isDeleting
          ? placeholder.substring(0, placeholderText.length - 1)
          : placeholder.substring(0, placeholderText.length + 1)
      );
      setTypingSpeed(isDeleting ? 20 : 50);
      if (!isDeleting && placeholderText === placeholder) {
        setTimeout(() => setIsDeleting(true), 3000);
      }
    };
    const timer = setTimeout(handleTyping, typingSpeed);
    return () => clearTimeout(timer);
  }, [placeholderText, isDeleting, loopNum, typingSpeed, prompt]);

  useEffect(() => {
    if (prompt === '' && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [prompt]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 96)}px`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && prompt.trim() !== '') onGenerate();
    }
  };

  return (
    <div className="glass-panel rounded-4xl p-2 sm:p-2.5 relative overflow-hidden transition-all duration-500 flex flex-col gap-1.5">
      {/* SVG Filter */}
      <svg width="0" height="0" className="absolute pointer-events-none">
        <filter id="remove-black" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  1 1 1 0 0" />
        </filter>
      </svg>

      {/* Glow */}
      <div className="absolute inset-0 bg-linear-to-r from-blue-400/10 to-cyan-400/10 opacity-0 focus-within:opacity-100 transition-opacity duration-500 blur-2xl" />

      {/* File drop zone */}
      <div className="relative z-10 w-full">
        <label className="relative flex items-center justify-center px-2 py-2.5 sm:px-3 sm:py-3 rounded-4xl bg-black/25 backdrop-blur-md border border-white/5 cursor-pointer transition-all duration-300 shadow-inner hover:shadow-[0_0_15px_rgba(34,211,238,0.3)] hover:border-cyan-400/40 w-full group">
          <input
            type="file"
            className="hidden"
            accept=".docx"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          {file ? (
            <>
              <img src="/file-alt.svg" alt="File Icon" className="absolute left-3 sm:left-4 w-9 h-9 sm:w-10 sm:h-10 opacity-90 top-1/2 -translate-y-1/2" />
              <div className="flex flex-col items-center text-center leading-tight">
                <span className="text-xs sm:text-sm font-medium text-cyan-400 truncate max-w-45 sm:max-w-70">{file.name}</span>
                <span className="text-[10px] sm:text-xs text-gray-400 mt-1 sm:mt-1.5 font-medium tracking-wide">Klik untuk memilih dokumen lain</span>
              </div>
              <button
                onClick={(e) => { e.preventDefault(); setFile(null); }}
                className="absolute right-3 sm:right-4 text-gray-400 hover:text-red-400 transition-colors p-1.5 top-1/2 -translate-y-1/2 bg-white/5 hover:bg-red-500/10 rounded-full"
                title="Hapus file"
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </>
          ) : (
            <>
              <svg className="absolute left-3 sm:left-4 w-9 h-9 sm:w-10 sm:h-10 opacity-70 top-1/2 -translate-y-1/2 text-white group-hover:text-cyan-400 transition-colors duration-300" viewBox="0 0 24 24" fill="none">
                <path d="M10 15H14M12 13V17M13 3H8.2C7.0799 3 6.51984 3 6.09202 3.21799C5.71569 3.40973 5.40973 3.71569 5.21799 4.09202C5 4.51984 5 5.0799 5 6.2V17.8C5 18.9201 5 19.4802 5.21799 19.908C5.40973 20.2843 5.71569 20.5903 6.09202 20.782C6.51984 21 7.0799 21 8.2 21H15.8C16.9201 21 17.4802 21 17.908 20.782C18.2843 20.5903 18.5903 20.2843 18.782 19.908C19 19.4802 19 18.9201 19 17.8V9M13 3L19 9M13 3V7.4C13 7.96005 13 8.24008 13.109 8.45399C13.2049 8.64215 13.3578 8.79513 13.546 8.89101C13.7599 9 14.0399 9 14.6 9H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="flex flex-col items-center text-center leading-tight">
                <div className="text-xs sm:text-sm font-medium text-gray-300 px-8 sm:px-0">
                  <span className="sm:hidden text-cyan-400 relative inline-block after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-px after:-bottom-0.5 after:left-0 after:bg-cyan-400 after:origin-center after:transition-transform after:duration-300 group-hover:after:scale-x-100">Klik untuk mengunggah dokumen</span>
                  <span className="hidden sm:inline">
                    <span className="text-cyan-400 relative inline-block after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-px after:-bottom-0.5 after:left-0 after:bg-cyan-400 after:origin-center after:transition-transform after:duration-300 group-hover:after:scale-x-100">Klik untuk mengunggah</span>
                    <span> atau seret &amp; lepaskan</span>
                  </span>
                </div>
                <span className="text-[10px] sm:text-xs text-gray-400 mt-1 sm:mt-1.5 font-semibold tracking-wide">.DOCX (Maks 20 MB)</span>
              </div>
            </>
          )}
        </label>
      </div>

      {/* Textarea + send button */}
      <div className="relative z-10 bg-black/25 backdrop-blur-md border border-white/5 rounded-4xl p-1 sm:p-1.5 flex items-center transition-all duration-300 shadow-inner hover:shadow-[0_0_15px_rgba(34,211,238,0.2)] hover:border-cyan-400/30 focus-within:shadow-[0_0_15px_rgba(34,211,238,0.2)] focus-within:border-cyan-400/30">
        <textarea
          ref={textareaRef}
          rows={1}
          placeholder={placeholderText}
          className="w-full bg-transparent border-none outline-none px-3 sm:px-4 py-2 text-xs sm:text-sm text-white placeholder-blue-100/40 resize-none overflow-y-auto leading-relaxed [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] scrollbar-none"
          value={prompt}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          style={{ maxHeight: '96px' }}
        />
        <div className="shrink-0 flex items-center justify-center w-8 sm:w-10 ml-1 mr-1 overflow-visible">
          <button
            onClick={onGenerate}
            disabled={isLoading || prompt.trim() === ''}
            className={`relative flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden transition-all duration-200 ease-in-out ${
              prompt.trim() !== '' ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'
            } bg-linear-to-r from-blue-600/90 to-cyan-500/90 hover:brightness-110 active:scale-95 border border-white/20 text-white disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5 ml-px mb-px" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Chat mode (compact bottom bar) ────────────────────────────────────── */
function ChatPromptBox({
  prompt,
  setPrompt,
  onGenerate,
  isLoading,
  pendingFile,
  setPendingFile,
}: Required<Pick<PromptBoxProps, 'prompt' | 'setPrompt' | 'onGenerate' | 'isLoading' | 'pendingFile' | 'setPendingFile'>>) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (prompt === '' && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [prompt]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 96)}px`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && prompt.trim() !== '') onGenerate();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) return; // 20 MB guard — parent shows toast
    setPendingFile(f);
    // Reset input so same file can be re-selected if needed
    e.target.value = '';
  };

  return (
    <div className="glass-panel rounded-3xl p-2 sm:p-2.5 relative overflow-hidden flex flex-col gap-2 w-full max-w-2xl mx-auto">
      {/* SVG Filter */}
      <svg width="0" height="0" className="absolute pointer-events-none">
        <filter id="remove-black" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  1 1 1 0 0" />
        </filter>
      </svg>

      {/* Glow */}
      <div className="absolute inset-0 bg-linear-to-r from-blue-400/10 to-cyan-400/10 opacity-0 focus-within:opacity-100 transition-opacity duration-500 blur-2xl pointer-events-none" />

      {/* Attachment Pill Button or Pending File Card */}
      <div className="relative z-10 px-1">
        <input
          ref={fileInputRef}
          type="file"
          accept=".docx"
          className="hidden"
          onChange={handleFileChange}
        />
        {pendingFile ? (
          <div className="flex items-center gap-2 bg-white/5 border border-white/8 rounded-full px-3 h-8 w-fit">
            <img src="/file-alt.svg" alt="file" className="w-4 h-4 opacity-80 shrink-0" />
            <div className="flex-1 min-w-0 max-w-[150px] sm:max-w-[200px]">
              <p className="text-xs font-medium text-white/90 truncate">{pendingFile.name}</p>
            </div>
            <button
              onClick={() => setPendingFile(null)}
              className="text-white/40 hover:text-red-400 transition-colors p-1 rounded-full hover:bg-red-500/10 flex items-center justify-center"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/8 rounded-full px-3 h-8 text-xs text-white/80 hover:text-white transition-all w-fit disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <img src="/file-plus.svg" alt="Attach" className="w-4 h-4 opacity-80" />
            <span className="font-medium font-sans mt-0.5">pilih dokumen lain</span>
          </button>
        )}
      </div>

      {/* Input row */}
      <div className="relative z-10 bg-black/25 backdrop-blur-md border border-white/5 rounded-3xl flex items-center transition-all duration-300 shadow-inner hover:shadow-[0_0_15px_rgba(34,211,238,0.2)] hover:border-cyan-400/30 focus-within:shadow-[0_0_15px_rgba(34,211,238,0.2)] focus-within:border-cyan-400/30 px-1">
        
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          rows={1}
          placeholder="Ketikkan instruksi berikutnya..."
          className="flex-1 bg-transparent border-none outline-none px-3 py-2.5 text-xs sm:text-sm text-white placeholder-blue-100/30 resize-none overflow-y-auto leading-relaxed [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] scrollbar-none"
          value={prompt}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          style={{ maxHeight: '96px' }}
        />

        {/* Send button */}
        <div className="shrink-0 flex items-center justify-center w-9 mr-1">
          <button
            onClick={onGenerate}
            disabled={isLoading || prompt.trim() === ''}
            className={`flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200 ${
              prompt.trim() !== '' && !isLoading
                ? 'bg-linear-to-r from-blue-600 to-cyan-500 hover:brightness-110 active:scale-95 border border-white/20 text-white opacity-100 scale-100'
                : 'opacity-0 scale-75 pointer-events-none'
            }`}
          >
            <svg className="w-4 h-4 ml-px mb-px" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Public export — routes to correct sub-component ───────────────────── */
export default function PromptBox({
  mode,
  prompt,
  setPrompt,
  onGenerate,
  isLoading,
  file,
  setFile,
  pendingFile,
  setPendingFile,
}: PromptBoxProps) {
  if (mode === 'chat') {
    return (
      <ChatPromptBox
        prompt={prompt}
        setPrompt={setPrompt}
        onGenerate={onGenerate}
        isLoading={isLoading}
        pendingFile={pendingFile ?? null}
        setPendingFile={setPendingFile ?? (() => {})}
      />
    );
  }

  return (
    <InitialPromptBox
      file={file ?? null}
      setFile={setFile ?? (() => {})}
      prompt={prompt}
      setPrompt={setPrompt}
      onGenerate={onGenerate}
      isLoading={isLoading}
    />
  );
}
