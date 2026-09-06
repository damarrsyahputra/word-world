export type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  downloadBlob?: Blob;
  fileName?: string;
  isExpired?: boolean;
  attachedFileName?: string;
};