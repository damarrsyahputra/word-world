import { useState, useEffect } from 'react';
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
    <div className="fixed inset-0 bg-dark-bg flex flex-col items-center p-4 overflow-hidden">
      
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
      <div className="relative z-10 max-w-2xl w-full flex flex-col transition-all duration-500 my-auto py-4">
        
        {/* Header (Logo & Text) - Absolutely positioned so it doesn't push the PromptBox down */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-6 sm:mb-8 flex flex-col items-center text-center w-max">
          <img 
            src="/logo-transparent.png" 
            alt="Word World Logo" 
            className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 object-contain mb-3 sm:mb-4" 
          />
          <h1 className="text-lg sm:text-2xl md:text-3xl font-bold tracking-tight text-white/95 drop-shadow-md whitespace-nowrap">
            Mari kita bereskan semuanya!
          </h1>
        </div>

        {/* Modular Components */}
        <PromptBox 
          file={file}
          setFile={handleFileChange}
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
