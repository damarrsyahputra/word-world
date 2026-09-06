import PreviewFrame from './PreviewFrame';

interface PreviewPanelProps {
  fileName?: string;
  docBlob?: Blob | null;
  previewUrl?: string | null;
}

export default function PreviewPanel({
  fileName = 'Belum ada dokumen',
  docBlob,
  previewUrl,
}: PreviewPanelProps) {
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
    <div className="flex-1 min-w-0 flex items-stretch">
      <div className="w-full flex flex-col rounded-3xl bg-black/25 backdrop-blur-md border border-white/5 overflow-hidden">
        {/* Header — solid dark grey */}
        <div className="bg-slate-800/95 px-4 h-12 flex items-center justify-between shrink-0">

          {/* Kiri — Nama File */}
          <span className="text-white/70 text-sm font-medium tracking-wide truncate max-w-[50%]">
            {displayName}
          </span>

          {/* Kanan — Tombol Unduh (.docx) */}
          <button
            onClick={handleDownload}
            disabled={!docBlob}
            className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white text-xs font-semibold px-3 py-1.5 rounded-full transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Unduh
          </button>
        </div>

        {/* Body — Office Web Viewer iframe or placeholder */}
        <PreviewFrame previewUrl={previewUrl} />
      </div>
    </div>
  );
}