export const API_URL =
  import.meta.env.VITE_API_URL ?? 'https://word-world-api.vercel.app/api/v1/process-document';

export const MAX_FILE_SIZE_MB = 20;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const DEFAULT_FILE_NAME = 'document.docx';
export const EDITED_SUFFIX = ' - edited';