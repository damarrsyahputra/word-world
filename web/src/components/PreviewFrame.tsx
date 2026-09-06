interface PreviewFrameProps {
  previewUrl?: string | null;
  className?: string;
}

// embed.aspx is the iframe-friendly endpoint: it stays inside the frame on
// mobile, unlike view.aspx which frame-busts and redirects the whole window.
const OFFICE_VIEWER = 'https://view.officeapps.live.com/op/embed.aspx?src=';

/** Shared preview body: Office Web Viewer iframe or placeholder icon. */
export default function PreviewFrame({ previewUrl, className = '' }: PreviewFrameProps) {
  const viewerSrc = previewUrl ? `${OFFICE_VIEWER}${encodeURIComponent(previewUrl)}` : null;

  return (
    <div className={`flex-1 overflow-hidden bg-white ${className}`}>
      {viewerSrc ? (
        <iframe
          src={viewerSrc}
          title="Pratinjau Dokumen"
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />
      ) : (
        <div className="h-full flex items-center justify-center bg-transparent">
          <img
            src="/file-alt.svg"
            alt="Belum ada dokumen"
            className="w-30 h-30 opacity-[0.15]"
          />
        </div>
      )}
    </div>
  );
}