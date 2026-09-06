import { useCallback, useEffect, useRef, useState } from 'react';
import type { Message } from '../types';
import { API_URL, MAX_FILE_SIZE_BYTES, DEFAULT_FILE_NAME, EDITED_SUFFIX } from '../constants';

/** Build the versioned download/preview name for the n-th successful edit.
 *  0th edit → "base - edited", 1st → "base - edited (1)", 2nd → "base - edited (2)". */
function buildEditedName(sourceName: string, editIndex: number): string {
  const parts = sourceName.split('.');
  const ext = parts.length > 1 ? parts.pop() : 'docx';
  const base = parts.join('.');
  const suffix = editIndex === 0 ? EDITED_SUFFIX : `${EDITED_SUFFIX} (${editIndex})`;
  return `${base}${suffix}.${ext}`;
}

/**
 * All chat-session state + actions for the Word World app.
 * Extracted from App.tsx so the component stays a pure layout composition.
 */
export function useDocumentChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasStarted, setHasStarted] = useState(false);

  // The latest processed .docx blob (in browser memory, never stored on server)
  const [currentDocBlob, setCurrentDocBlob] = useState<Blob | null>(null);
  // Name of the original file, used for download filename
  const [currentFileName, setCurrentFileName] = useState<string>(DEFAULT_FILE_NAME);
  // Versioned display/download name of the latest result, e.g. "report edited (2).docx"
  const [currentEditedName, setCurrentEditedName] = useState<string | null>(null);
  // How many successful edits have been made to the current document
  const [editCount, setEditCount] = useState(0);
  // Public URL of the uploaded preview (rendered with Office Web Viewer)
  const [currentPreviewUrl, setCurrentPreviewUrl] = useState<string | null>(null);
  // Storage object key, kept so we can delete the uploaded file on cleanup
  const [currentPreviewKey, setCurrentPreviewKey] = useState<string | null>(null);

  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Initial mode: full file drop zone
  const [file, setFile] = useState<File | null>(null);
  // Chat mode: compact file-plus attachment (for changing document mid-session)
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Track layout animation: after first send we start transition
  const [layoutReady, setLayoutReady] = useState(false);
  const transitionRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-hide toast after 7 seconds
  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 7000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  // Cleanup transition timeout
  useEffect(() => () => { if (transitionRef.current) clearTimeout(transitionRef.current); }, []);

  /** Last user prompts (excluding the current in-progress one) for multi-turn memory. */
  const recentUserPrompts = useCallback(
    (n: number): string[] => messages.filter((m) => m.role === 'user').slice(-n).map((m) => m.text),
    [messages],
  );

  /** Fire-and-forget deletion of a Supabase preview object (best-effort). */
  const deletePreviewObject = useCallback((key: string | null) => {
    if (!key) return;
    const delUrl = API_URL.replace(/\/process-document$/, '/preview');
    fetch(`${delUrl}?preview_key=${encodeURIComponent(key)}`, { method: 'DELETE' }).catch(() => {});
  }, []);

  /** Clear the active preview: delete its object and reset preview state. */
  const clearPreview = useCallback(() => {
    deletePreviewObject(currentPreviewKey);
    setCurrentPreviewKey(null);
    setCurrentPreviewUrl(null);
  }, [deletePreviewObject, currentPreviewKey]);

  // Best-effort cleanup of the uploaded preview on tab close/refresh.
  useEffect(() => {
    const handlePageHide = () => deletePreviewObject(currentPreviewKey);
    window.addEventListener('pagehide', handlePageHide);
    return () => window.removeEventListener('pagehide', handlePageHide);
  }, [deletePreviewObject, currentPreviewKey]);

  // On startup, sweep the storage bucket once (fire-and-forget) so any
  // orphaned preview older than the server TTL (3h) gets cleaned up.
  useEffect(() => {
    const purgeUrl = API_URL.replace(/\/process-document$/, '/preview/purge');
    fetch(purgeUrl, { method: 'POST' }).catch(() => {});
  }, []);

  const handleGenerate = useCallback(async () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) return;

    // Determine which file to send
    // pendingFile (chat mode attach) takes priority → resets session
    // currentDocBlob is the latest processed doc → continue conversation
    // file is the initial upload → first message
    let fileToSend: File | null = null;

    if (pendingFile) {
      // New document attached in chat mode → reset session
      clearPreview();
      setCurrentDocBlob(null);
      setMessages([]);
      setCurrentFileName(pendingFile.name);
      setCurrentEditedName(null);
      setEditCount(0);
      fileToSend = pendingFile;
      setPendingFile(null);
    } else if (currentDocBlob) {
      // Send the latest processed blob as the "file" input
      fileToSend = new File([currentDocBlob], currentFileName, {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
    } else if (file) {
      // First message, use the original upload
      fileToSend = file;
      setCurrentFileName(file.name);
    }

    if (!fileToSend) {
      setToastMessage('Upload dokumen .docx terlebih dahulu!');
      return;
    }

    // ── Transition to chat layout ─────────────────────────────────────────
    if (!hasStarted) {
      setHasStarted(true);
      // Small delay so the layout transition starts before we show the bubble
      await new Promise((resolve) => {
        transitionRef.current = setTimeout(resolve, 80);
      });
      setLayoutReady(true);
    }

    // ── Add user bubble ───────────────────────────────────────────────────
    // Multi-turn memory: send the last 2 prompts (excluding this one) as JSON.
    const history = recentUserPrompts(2);
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      text: trimmedPrompt,
      // Only set attachedFileName if the user explicitly attached a new file in this turn
      attachedFileName: pendingFile ? pendingFile.name : (file && !hasStarted ? file.name : undefined),
    };
    setMessages((msgs) => [...msgs, userMsg]);
    setPrompt('');

    // Replace the previous preview before starting a new process (cleanup).
    clearPreview();

    setIsLoading(true);

    // ── Call backend ──────────────────────────────────────────────────────
    try {
      const formData = new FormData();
      formData.append('file', fileToSend);
      formData.append('prompt', trimmedPrompt);
      formData.append('previous_prompts', JSON.stringify(history));
      // Tell the backend the versioned name so downloads and the preview match
      // the chat bubble (e.g. "report edited (1).docx").
      const sourceName = fileToSend.name || currentFileName;
      const editedName = buildEditedName(sourceName, editCount);
      formData.append('output_filename', editedName);

      const response = await fetch(API_URL, { method: 'POST', body: formData });

      if (!response.ok) {
        let detail = 'Gagal memproses dokumen. Coba lagi.';
        try {
          const errData = await response.json();
          if (errData.detail) detail = errData.detail;
        } catch { /* ignore */ }
        throw new Error(detail);
      }

      const blob = await response.blob();
      const summary = response.headers.get('X-Word-World-Summary') ?? 'Dokumen berhasil diproses.';
      const previewUrl = response.headers.get('X-Word-World-Preview');
      const previewKey = response.headers.get('X-Word-World-Preview-Key');

      // ── Success: only now expire older blobs (keeps prior result usable
      // if this prompt failed / was unrecognized).
      setCurrentDocBlob(blob);
      setCurrentPreviewUrl(previewUrl ?? null);
      setCurrentPreviewKey(previewKey ?? null);
      setCurrentEditedName(editedName);
      setEditCount((c) => c + 1);

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: summary,
        downloadBlob: blob,
        fileName: editedName,
      };
      setMessages((msgs) => [
        ...msgs.map((m) =>
          m.role === 'assistant' && m.downloadBlob
            ? { ...m, isExpired: true, downloadBlob: undefined }
            : m
        ),
        assistantMsg,
      ]);
    } catch (err) {
      const errMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: (err as Error).message,
      };
      setMessages((msgs) => [...msgs, errMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [prompt, pendingFile, currentDocBlob, file, currentFileName, editCount, hasStarted, recentUserPrompts, clearPreview]);

  const handleFileChange = useCallback((selectedFile: File | null) => {
    if (selectedFile && selectedFile.size > MAX_FILE_SIZE_BYTES) {
      setToastMessage(`File terlalu besar. Maksimum ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`);
      return;
    }
    setFile(selectedFile);
  }, []);

  /** Reset entirely back to the landing (initial) state. */
  const reset = useCallback(() => {
    deletePreviewObject(currentPreviewKey);
    setCurrentPreviewKey(null);
    setCurrentPreviewUrl(null);
    setCurrentDocBlob(null);
    setCurrentEditedName(null);
    setCurrentFileName(DEFAULT_FILE_NAME);
    setEditCount(0);
    setMessages([]);
    setPrompt('');
    setFile(null);
    setPendingFile(null);
    setIsLoading(false);
    setLayoutReady(false);
    setHasStarted(false);
  }, [deletePreviewObject, currentPreviewKey]);

  return {
    messages,
    hasStarted,
    prompt,
    setPrompt,
    isLoading,
    file,
    pendingFile,
    setPendingFile,
    toastMessage,
    layoutReady,
    currentFileName,
    currentEditedName,
    currentDocBlob,
    currentPreviewUrl,
    currentPreviewKey,
    handleGenerate,
    handleFileChange,
    reset,
  };
}