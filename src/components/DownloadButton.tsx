

interface DownloadButtonProps {
  onClick: () => void;
}

export default function DownloadButton({ onClick }: DownloadButtonProps) {
  return (
    <button 
      onClick={onClick}
      className="w-full py-5 rounded-2xl font-bold tracking-widest text-white transition-all duration-300 shadow-xl bg-gradient-to-r from-blue-600/80 to-cyan-500/80 hover:from-blue-500/90 hover:to-cyan-400/90 border border-white/20 hover:shadow-[0_0_30px_rgba(34,211,238,0.4)]"
    >
      DOWNLOAD
    </button>
  );
}
