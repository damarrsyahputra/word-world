import React, { useState, useEffect, useRef } from 'react';

interface PromptBoxProps {
  file: File | null;
  setFile: (file: File | null) => void;
  prompt: string;
  setPrompt: (prompt: string) => void;
  onGenerate: () => void;
  isLoading: boolean;
  isSuccess: boolean;
  onDownload: () => void;
  onReset: () => void;
}

export default function PromptBox({ file, setFile, prompt, setPrompt, onGenerate, isLoading, isSuccess, onDownload, onReset }: PromptBoxProps) {
  const [placeholderText, setPlaceholderText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [loopNum, setLoopNum] = useState(0);
  const [typingSpeed, setTypingSpeed] = useState(50);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const placeholders = [
    "Type your editing command here...",
    "Start numbering from page 15, position: bottom-right...",
    "Add roman numerals at the top center of all pages..."
  ];

  // Reset textarea height when prompt is cleared
  useEffect(() => {
    if (prompt === '' && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [prompt]);

  useEffect(() => {
    // Stop typewriter if user is typing or if it's in success state
    if (prompt !== '' || isSuccess) return;

    const handleTyping = () => {
      const i = loopNum;
      const fullText = placeholders[i];

      // Stop permanently if we finished typing the 3rd placeholder
      if (!isDeleting && placeholderText === fullText && i === 2) {
        return;
      }

      setPlaceholderText(
        isDeleting 
          ? fullText.substring(0, placeholderText.length - 1) 
          : fullText.substring(0, placeholderText.length + 1)
      );

      setTypingSpeed(isDeleting ? 20 : 50);

      if (!isDeleting && placeholderText === fullText) {
        // Pause for 3 seconds before deleting
        setTimeout(() => setIsDeleting(true), 3000);
      } else if (isDeleting && placeholderText === '') {
        setIsDeleting(false);
        setLoopNum(prev => prev + 1); // 0 -> 1 -> 2
      }
    };

    const timer = setTimeout(handleTyping, typingSpeed);
    return () => clearTimeout(timer);
  }, [placeholderText, isDeleting, loopNum, typingSpeed, prompt, isSuccess]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
    // Auto-resize logic: reset height then set to scrollHeight capped at ~3 lines
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 96)}px`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && prompt.trim() !== '') {
        onGenerate();
      }
    }
  };

  return (
    <div className="glass-panel rounded-[32px] p-2 sm:p-2.5 relative overflow-hidden transition-all duration-500 flex flex-col gap-1.5">
      {/* SVG Filter to convert black background to transparent alpha channel */}
      <svg width="0" height="0" className="absolute pointer-events-none">
        <filter id="remove-black" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="
            1 0 0 0 0
            0 1 0 0 0
            0 0 1 0 0
            1 1 1 0 0
          " />
        </filter>
      </svg>

      {/* Subtle background glow active only when typing inside the panel */}
      <div className="absolute inset-0 bg-linear-to-r from-blue-400/10 to-cyan-400/10 opacity-0 focus-within:opacity-100 transition-opacity duration-500 blur-2xl"></div>
      
      {isSuccess ? (
        <p className="text-sm sm:text-base font-medium mb-3 sm:mb-4 relative z-10 text-white/90 text-center">
          Your document is ready!
        </p>
      ) : (
        <div className="relative z-10 flex justify-start">
          <label className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-black/25 backdrop-blur-md border border-white/5 cursor-pointer transition-all duration-300 shadow-inner hover:shadow-[0_0_15px_rgba(34,211,238,0.3)] hover:border-cyan-400/40 max-w-xs w-fit group">
            <input 
              type="file" 
              className="hidden" 
              accept=".docx"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
              {file ? (
                <div className="flex items-center gap-2 w-full">
                  <img 
                    src="/docx-file-format-symbol.svg" 
                    alt="DOCX Icon" 
                    className="w-4 h-4 sm:w-5 sm:h-5 opacity-90 shrink-0" 
                  />
                  <span className="text-xs sm:text-sm font-medium text-white truncate max-w-[120px] sm:max-w-[150px]">{file.name}</span>
                  <button 
                    onClick={(e) => { e.preventDefault(); setFile(null); }}
                    className="ml-auto text-gray-400 hover:text-white transition-colors"
                  >
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </button>
                </div>
              ) : (
              <>
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <span className="text-xs sm:text-sm font-medium text-gray-300 whitespace-nowrap">Lampirkan .docx</span>
              </>
            )}
          </label>
        </div>
      )}
      
      {isSuccess ? (
        /* SUCCESS STATE: Large Download Button */
        <div className="relative z-10 flex flex-col items-center">
          <button 
            onClick={onDownload}
            className="w-full bg-linear-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold py-3 sm:py-4 px-6 sm:px-8 rounded-full shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-all duration-300 transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 sm:gap-3 outline-none focus:outline-none border-none ring-0 text-sm sm:text-base"
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6 animate-bounce shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span className="sm:hidden">Download</span>
            <span className="hidden sm:inline">Click here to download</span>
          </button>
          
          <button 
            onClick={onReset} 
            className="mt-4 text-xs sm:text-sm font-medium text-blue-100/50 hover:text-cyan-300 hover:underline transition-all outline-none focus:outline-none"
          >
            <span className="sm:hidden">Type a new command</span>
            <span className="hidden sm:inline">Or click here to type a new command</span>
          </button>
        </div>
      ) : (
        /* PROMPT INPUT STATE */
        <div className="relative z-10 bg-black/25 backdrop-blur-md border border-white/5 rounded-[32px] p-1 sm:p-1.5 flex items-center transition-all duration-300 shadow-inner hover:shadow-[0_0_15px_rgba(34,211,238,0.2)] hover:border-cyan-400/30 focus-within:shadow-[0_0_15px_rgba(34,211,238,0.2)] focus-within:border-cyan-400/30">
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
          
          {/* Send / Generate Button */}
          <div className="shrink-0 flex items-center justify-center w-8 sm:w-10 ml-1 mr-1 overflow-visible">
            <button 
              onClick={onGenerate}
              disabled={isLoading || prompt.trim() === ''}
              className={`relative flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden transition-all duration-200 ease-in-out ${
                prompt.trim() !== '' || isLoading ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'
              } ${
                isLoading
                  ? 'bg-transparent cursor-not-allowed'
                  : 'bg-linear-to-r from-blue-600/90 to-cyan-500/90 hover:brightness-110 active:scale-95 border border-white/20 text-white'
              }`}
            >
              {isLoading ? (
                /* Animated Logo GIF as Loading Spinner with SVG Filter */
                <img 
                  src="/logo-animated.gif" 
                  alt="Loading..." 
                  className="absolute max-w-none pointer-events-none"
                  style={{ 
                    width: '70px', 
                    height: 'auto',
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    objectFit: 'contain',
                    filter: 'url(#remove-black)'
                  }} 
                />
              ) : (
                <svg className="w-4 h-4 sm:w-5 sm:h-5 ml-px mb-px" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
