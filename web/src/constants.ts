export const API_URL =
  import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api/v1/process-document';

export const MAX_FILE_SIZE_MB = 20;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const DEFAULT_FILE_NAME = 'document.docx';
export const EDITED_SUFFIX = ' - edited';