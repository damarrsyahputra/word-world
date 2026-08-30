import { useEffect, useRef } from 'react';

export type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  downloadBlob?: Blob;
  fileName?: string;
  isExpired?: boolean;
  attachedFileName?: string;
};

interface ChatViewProps {
  messages: Message[];
  isLoading: boolean;
}

function DocumentCard({ msg }: { msg: Message }) {
  const handleDownload = () => {
    if (!msg.downloadBlob || msg.isExpired) return;
    const url = URL.createObjectURL(msg.downloadBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = msg.fileName ?? 'document - edited.docx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const expired = msg.isExpired || !msg.downloadBlob;

  return (
    <div
      className={`mt-2 w-3/4 min-w-[16rem] flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition-all ${
        expired
          ? 'bg-white/3 border-white/5 opacity-50'
          : 'bg-white/5 border-white/10'
      }`}
    >
      {/* File icon */}
      <div className="shrink-0 w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center">
        <img src="/file-alt.svg" alt="doc" className="w-5 h-5 opacity-70" />
      </div>

      {/* File info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-white/80 truncate">
          {msg.fileName ?? 'document - edited.docx'}
        </p>
        <p className="text-[10px] text-white/35 mt-0.5">
          {expired ? 'Dokumen sudah kedaluwarsa' : 'Dokumen · DOCX'}
        </p>
      </div>

      {/* Download button */}
      {!expired && (
        <button
          onClick={handleDownload}
          className="shrink-0 flex items-center gap-1.5 bg-blue-600/80 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-1.5 rounded-full transition-all active:scale-95"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Unduh
        </button>
      )}
    </div>
  );
}

export default function ChatView({ messages, isLoading }: ChatViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div 
      className="relative flex-1 overflow-hidden"
      style={{
        maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) calc(100% - 60px), rgba(0,0,0,0) 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) calc(100% - 60px), rgba(0,0,0,0) 100%)'
      }}
    >
      <div className="h-full overflow-y-auto px-4 py-6 pb-12 space-y-6 scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {messages.map((msg) => (
        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start items-start gap-3'}`}>
          {/* Assistant logo (static) */}
          {msg.role === 'assistant' && (
            <img
              src="/logo-transparent.png"
              alt="Word World"
              className="w-7 h-7 mt-1 shrink-0 object-contain opacity-90"
            />
          )}

          {/* Bubble content */}
          <div
            className={
              msg.role === 'user'
                ? 'max-w-[70%]'
                : (msg.downloadBlob || msg.isExpired) && msg.fileName
                  ? 'w-full'
                  : 'max-w-[80%]'
            }
          >
            {msg.role === 'user' ? (
              /* User bubble — pill shape, right-aligned */
              <div className="flex flex-col items-end gap-2">
                {msg.attachedFileName && (
                  <div className="glass-bubble rounded-3xl w-36 h-36 flex flex-col items-center justify-center p-3">
                    {/* file-alt Icon */}
                    <img src="/file-alt.svg" alt="doc" className="w-20 h-20 opacity-80 mb-4 mt-2" />
                    <span className="text-xs text-white/90 font-medium truncate w-full text-center inline-block">
                      {msg.attachedFileName}
                    </span>
                  </div>
                )}
                <div className="glass-bubble text-white/90 text-sm px-4 py-2.5 rounded-3xl rounded-br-md leading-relaxed">
                  {msg.text}
                </div>
              </div>
            ) : (
              /* Assistant bubble — left-aligned, plain text + optional doc card */
              <div>
                <p className="text-white/85 text-sm leading-relaxed max-w-[80%]">{msg.text}</p>
                {(msg.downloadBlob || msg.isExpired) && msg.fileName && (
                  <DocumentCard msg={msg} />
                )}
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Loading bubble */}
      {isLoading && (
        <div className="flex justify-start items-center gap-3">
          {/* Logo animated — 4:3 ratio (64×48) */}
          <img
            src="/logo-animated.gif"
            alt="Loading"
            style={{ width: 64, height: 48, objectFit: 'contain', filter: 'url(#remove-black)' }}
            className="shrink-0"
          />
          <span className="text-white/50 text-sm animate-pulse">Working...</span>
        </div>
      )}

      {/* Invisible anchor to scroll to */}
      <div ref={bottomRef} className="h-12" />
      </div>
    </div>
  );
}
