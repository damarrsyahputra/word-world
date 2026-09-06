import { useEffect, useRef } from 'react';
import CustomScrollbar from './CustomScrollbar';
import { useCustomScrollbar } from '../hooks/useCustomScrollbar';
import { useMediaQuery } from '../hooks/useMediaQuery';
import type { Message } from '../types';

interface ChatViewProps {
  messages: Message[];
  isLoading: boolean;
  onPreview: () => void;
}

// Fade zone height in px — must match the gradient stop below
const FADE_PX = 48;

function DocumentCard({ msg, onPreview }: { msg: Message; onPreview: () => void }) {
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
  const isMobile = useMediaQuery('(max-width: 767px)');

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

      {/* Action button — mobile: "Lihat" (open preview), desktop: download */}
      {!expired && (
        isMobile ? (
          <button
            onClick={onPreview}
            className="shrink-0 flex items-center gap-1.5 bg-blue-600/80 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-1.5 rounded-full transition-all active:scale-95"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
            </svg>
            Lihat
          </button>
        ) : (
          <button
            onClick={handleDownload}
            className="shrink-0 flex items-center gap-1.5 bg-blue-600/80 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-1.5 rounded-full transition-all active:scale-95"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Unduh
          </button>
        )
      )}
    </div>
  );
}

export default function ChatView({ messages, isLoading, onPreview }: ChatViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollbar = useCustomScrollbar(scrollRef);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Keep thumb in sync when messages / loading state change (e.g. before render)
  useEffect(() => {
    const id = requestAnimationFrame(scrollbar.updateThumb);
    return () => cancelAnimationFrame(id);
  }, [messages, isLoading, scrollbar.updateThumb]);

  return (
    // Outer flex row: [chat content] [custom scrollbar]
    <div className="relative flex-1 overflow-hidden flex">

      {/* ── LEFT: chat content — fade mask covers full width of this column ── */}
      <div
        className="flex-1 overflow-hidden relative"
        style={{
          maskImage: `linear-gradient(to bottom, transparent 0, black ${FADE_PX}px, black calc(100% - ${FADE_PX}px), transparent 100%)`,
          WebkitMaskImage: `linear-gradient(to bottom, transparent 0, black ${FADE_PX}px, black calc(100% - ${FADE_PX}px), transparent 100%)`,
        }}
      >
        <div
          ref={scrollRef}
          className="chat-scroll h-full overflow-y-scroll pt-12 pb-4 space-y-6 pr-2"
        >
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
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
                  <div className="flex flex-col items-end gap-2">
                    {msg.attachedFileName && (
                      <div className="glass-bubble rounded-3xl w-36 h-36 flex flex-col items-center justify-center p-3">
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
                  <div>
                    <p className="text-white/85 text-sm leading-relaxed max-w-[80%]">{msg.text}</p>
                    {(msg.downloadBlob || msg.isExpired) && msg.fileName && (
                      <DocumentCard msg={msg} onPreview={onPreview} />
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Loading bubble */}
          {isLoading && (
            <div className="flex justify-start items-center -ml-4 gap-2">
              <img
                src="/logo-animated.gif"
                alt="Loading"
                style={{ width: 64, height: 48, objectFit: 'contain', filter: 'url(#remove-black)' }}
                className="shrink-0"
              />
              <span className="text-white/50 text-sm animate-pulse">Working...</span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── RIGHT: custom scrollbar — completely outside the masked area ── */}
      <CustomScrollbar scrollbar={scrollbar} />

    </div>
  );
}