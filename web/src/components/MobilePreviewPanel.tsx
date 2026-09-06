import PreviewFrame from './PreviewFrame';

interface MobilePreviewPanelProps {
  open: boolean;
  fileName?: string;
  docBlob?: Blob | null;
  previewUrl?: string | null;
  onClose: () => void;
}

/** Mobile-only fullscreen bottom-sheet preview (slides up from the bottom). */
export default function MobilePreviewPanel({
  open,
  fileName = 'Belum ada dokumen',
  docBlob,
  previewUrl,
  onClose,
}: MobilePreviewPanelProps) {
  const displayName = fileName.replace(/\.docx$/i, '');

  const handleDownload = () => {
    if (!docBlob) return;
    const url = URL.createObjectURL(docBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`fixed inset-0 z-50 md:hidden ${open ? '' : 'pointer-events-none'}`}>
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className={`absolute inset-x-0 bottom-0 top-6 flex flex-col rounded-t-3xl bg-slate-900 border-t border-white/10 shadow-[0_-20px_60px_rgba(0,0,0,0.6)] transition-transform duration-300 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Header — title centered, X on the left, Unduh on the right */}
        <div className="bg-slate-800/95 px-2 h-12 flex items-center gap-2 shrink-0 relative">
          {/* X — kiri */}
          <button
            onClick={onClose}
            aria-label="Tutup pratinjau"
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Title — tengah */}
          <span className="absolute left-1/2 -translate-x-1/2 text-white/85 text-sm font-medium tracking-wide truncate max-w-[55%]">
            {displayName}
          </span>

          {/* Unduh — kanan */}
          <button
            onClick={handleDownload}
            disabled={!docBlob}
            aria-label="Unduh dokumen"
            className="shrink-0 ml-auto w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors disabled:opacity-40"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <PreviewFrame previewUrl={previewUrl} />
      </div>
    </div>
  );
}