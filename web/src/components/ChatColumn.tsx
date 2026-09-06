import type { CSSProperties, Dispatch, SetStateAction } from 'react';
import PromptBox from './PromptBox';
import ChatView from './ChatView';
import type { Message } from '../types';

interface ChatColumnProps {
  style?: CSSProperties;
  messages: Message[];
  isLoading: boolean;
  layoutReady: boolean;
  prompt: string;
  setPrompt: (prompt: string) => void;
  onGenerate: () => void;
  pendingFile: File | null;
  setPendingFile: Dispatch<SetStateAction<File | null>>;
  currentFileName: string;
  onPreview: () => void;
  onNewConversation: () => void;
}

export default function ChatColumn({
  style,
  messages,
  isLoading,
  layoutReady,
  prompt,
  setPrompt,
  onGenerate,
  pendingFile,
  setPendingFile,
  currentFileName,
  onPreview,
  onNewConversation,
}: ChatColumnProps) {
  return (
    <div className="flex flex-col min-w-0" style={style}>
      <div className="flex-1 overflow-hidden flex flex-col relative">
        {/* Header — floating above chat, transparent */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between pb-2 pointer-events-none">
          {/* Logo — left */}
          <img src="/logo-transparent.png" alt="Logo" className="w-8 h-8 object-contain opacity-80" />

          {/* Document name — center */}
          <div className="absolute left-1/2 -translate-x-1/2 bg-white/5 backdrop-blur-md border border-white/10 rounded-full px-4 py-1.5 max-w-[50%] flex items-center justify-center pointer-events-auto shadow-sm">
            <span className="text-sm text-white/80 truncate font-medium tracking-wide">
              {currentFileName.replace(/\.docx$/i, '')}
            </span>
          </div>

          {/* New conversation — right */}
          <button
            onClick={onNewConversation}
            className="pointer-events-auto group relative w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/8 transition-colors"
            title="Percakapan Baru"
          >
            <img src="/new-conversation.svg" alt="New conversation" className="w-6 h-6 invert opacity-70 group-hover:opacity-100 transition-opacity" />

            {/* Tooltip */}
            <span className="pointer-events-none absolute right-0 top-full mt-1.5 whitespace-nowrap rounded-lg bg-white/10 backdrop-blur-md border border-white/10 px-2.5 py-1 text-[11px] text-white/80 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              Percakapan Baru
            </span>
          </button>
        </div>

        {layoutReady && <ChatView messages={messages} isLoading={isLoading} onPreview={onPreview} />}
      </div>

      <div className="relative z-20 pt-3 flex justify-center">
        <PromptBox
          mode="chat"
          prompt={prompt}
          setPrompt={setPrompt}
          onGenerate={onGenerate}
          isLoading={isLoading}
          pendingFile={pendingFile}
          setPendingFile={setPendingFile}
        />
      </div>
    </div>
  );
}