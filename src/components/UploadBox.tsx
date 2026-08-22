
interface UploadBoxProps {
  file: File | null;
  setFile: (file: File | null) => void;
}

export default function UploadBox({ file, setFile }: UploadBoxProps) {
  return (
    <div className="glass-panel rounded-3xl p-4 sm:p-5 flex flex-col">
      {/* Title */}
      <h3 className="text-base font-bold mb-2 sm:mb-3 text-white/90 tracking-wide">Upload Document</h3>
      
      {/* Dashed Dropzone Area (Acts as the label/button) */}
      <label className="relative flex flex-col items-center justify-center w-full min-h-35 sm:min-h-45 rounded-2xl border-2 border-dashed border-white/20 bg-transparent p-4 sm:p-6 cursor-pointer transition-all duration-300 hover:bg-white/5 hover:border-cyan-400/50 group">
        
        {/* Hidden File Input */}
        <input 
          type="file" 
          className="hidden" 
          accept=".docx"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />

        {file ? (
          /* STATE: FILE UPLOADED */
          <div className="flex flex-col items-center justify-center transition-all duration-500">
            <img 
              src="/docx-file-format-symbol.svg" 
              alt="DOCX Icon" 
              className="w-12 h-12 sm:w-16 sm:h-16 mb-2 sm:mb-3 opacity-90 drop-shadow-[0_0_15px_rgba(34,211,238,0.4)] transition-transform duration-300 group-hover:scale-110 group-hover:drop-shadow-[0_0_25px_rgba(34,211,238,0.6)]" 
            />
            <p className="text-cyan-300 font-bold text-sm sm:text-base text-center drop-shadow-md px-2 sm:px-4 wrap-break-word line-clamp-2 max-w-full">{file.name}</p>
            <p className="text-[10px] sm:text-xs text-blue-100/40 mt-1.5 sm:mt-2 group-hover:text-blue-100/60 transition-colors">Click to change document</p>
          </div>
        ) : (
          /* STATE: NO FILE */
          <div className="flex flex-col items-center justify-center transition-all duration-500">
            {/* Upload Icon */}
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full glass-input flex items-center justify-center mb-3 sm:mb-4 shadow-inner transition-transform duration-300 group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(34,211,238,0.2)]">
              <svg className="w-6 h-6 sm:w-8 sm:h-8 text-cyan-300 drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            
            {/* Instruction Text */}
            <p className="mb-1 sm:mb-2 text-xs sm:text-sm text-white/80 text-center">
              <span className="font-semibold text-cyan-300 group-hover:text-cyan-200 transition-colors">Click to upload</span> or drag and drop
            </p>
            <p className="text-[10px] sm:text-xs text-blue-100/50">DOCX files only (Max 20 MB)</p>
          </div>
        )}
      </label>
    </div>
  );
}
