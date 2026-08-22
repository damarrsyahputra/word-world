import { useState, useEffect } from 'react';
import UploadBox from './components/UploadBox';
import PromptBox from './components/PromptBox';

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Auto-hide toast after 7 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 7000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Jika user mengganti file atau prompt, sembunyikan tombol download
  useEffect(() => {
    setProcessedBlob(null);
  }, [file, prompt]);

  const handleGenerate = async () => {
    if (!file) {
      setToastMessage("Please upload a document (.docx) first!");
      return;
    }

    setIsLoading(true);
    setProcessedBlob(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("prompt", prompt);

      const response = await fetch("https://word-world-api.vercel.app/api/v1/process-document", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = "Failed to process document. Please try again.";
        try {
          const errorData = await response.json();
          if (errorData.detail) {
            errorMessage = errorData.detail;
          }
        } catch (e) {
          // Fallback to default if JSON parsing fails
        }
        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      setProcessedBlob(blob); // Simpan blob untuk di-download nanti
    } catch (error) {
      console.error(error);
      setToastMessage("Error: " + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!processedBlob || !file) return;
    const downloadUrl = window.URL.createObjectURL(processedBlob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `edited_${file.name}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleReset = () => {
    setProcessedBlob(null);
    setPrompt("");
  };

  const handleFileChange = (selectedFile: File | null) => {
    if (selectedFile) {
      const maxSizeInBytes = 20 * 1024 * 1024; // 20 MB
      if (selectedFile.size > maxSizeInBytes) {
        setToastMessage("File is too large. Maximum size is 20 MB.");
        return;
      }
    }
    setFile(selectedFile);
  };

  return (
    <div className="relative min-h-screen bg-dark-bg flex flex-col items-center p-4 overflow-hidden">
      
      {/* Custom Toast Notification */}
      <div 
        className={`fixed top-8 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-500 ease-out ${
          toastMessage ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10 pointer-events-none'
        }`}
      >
        <div className="bg-red-500/10 border border-red-500/30 text-red-100 px-6 py-3 rounded-full shadow-[0_0_30px_rgba(255,8,68,0.2)] backdrop-blur-xl flex items-center gap-3 whitespace-nowrap">
          <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium tracking-wide">{toastMessage}</span>
        </div>
      </div>

      {/* Animated Aurora Background */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/30 rounded-full blur-[120px] animate-blob"></div>
        <div className="absolute top-[20%] right-[-10%] w-[60%] h-[60%] bg-cyan-500/20 rounded-full blur-[100px] animate-blob-slow"></div>
        <div className="absolute bottom-[-20%] left-[20%] w-[50%] h-[50%] bg-indigo-500/30 rounded-full blur-[120px] animate-blob-fast"></div>
        <div className="absolute bottom-[10%] right-[10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[100px] animate-blob"></div>
      </div>

      {/* Main Container */}
      <div className="relative z-10 max-w-2xl w-full flex flex-col gap-4 sm:gap-5 transition-all duration-500 mt-4 mb-auto sm:my-auto py-2 sm:py-4">
        
        {/* Header Title */}
        <div className="text-center mb-2 sm:mb-4 flex flex-col items-center">
          <img 
            src="/logo-transparent.png" 
            alt="Word World Logo" 
            className="w-16 h-16 sm:w-20 sm:h-20 object-contain mb-1 sm:mb-2 drop-shadow-[0_0_15px_rgba(34,211,238,0.4)] transition-all" 
          />
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight bg-linear-to-r from-blue-300 via-cyan-300 to-indigo-300 bg-clip-text text-transparent inline-block drop-shadow-lg whitespace-nowrap">
            WORD WORLD
          </h1>
          <p className="text-blue-100/70 mt-1 text-[11px] min-[375px]:text-xs sm:text-base tracking-wide font-light whitespace-nowrap">
            Make editing page numbers easier with AI.
          </p>
          
          {/* Checkmark features */}
          <div className="flex flex-col items-center justify-center gap-2 mt-3 sm:mt-4 text-[11px] sm:text-sm text-blue-100/80 font-medium sm:flex-row sm:gap-5">
            <div className="flex flex-row items-center justify-center gap-3 sm:gap-5">
              <span className="flex items-center gap-1.5 sm:gap-2">
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
                Free — no sign-up
              </span>
              <span className="flex items-center gap-1.5 sm:gap-2">
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
                Unlimited
              </span>
            </div>
            <span className="flex items-center gap-1.5 sm:gap-2">
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
              Documents are never stored
            </span>
          </div>
        </div>

        {/* Modular Components */}
        <UploadBox file={file} setFile={handleFileChange} />
        <PromptBox 
          prompt={prompt} 
          setPrompt={setPrompt} 
          onGenerate={handleGenerate} 
          isLoading={isLoading} 
          isSuccess={!!processedBlob}
          onDownload={handleDownload}
          onReset={handleReset}
        />
        
      </div>
    </div>
  );
}

export default App;
