import { useEffect, useState } from 'react';

/**
 * Typewriter effect that types `fullText` into a placeholder, pauses,
 * then deletes it. Stops as soon as `active` becomes false.
 */
export function useTypewriter(fullText: string, active: boolean) {
  const [placeholderText, setPlaceholderText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [typingSpeed, setTypingSpeed] = useState(50);

  useEffect(() => {
    if (!active) return;

    const handleTyping = () => {
      if (!isDeleting && placeholderText === fullText) return;
      setPlaceholderText(
        isDeleting
          ? fullText.substring(0, placeholderText.length - 1)
          : fullText.substring(0, placeholderText.length + 1)
      );
      setTypingSpeed(isDeleting ? 20 : 50);
      if (!isDeleting && placeholderText === fullText) {
        setTimeout(() => setIsDeleting(true), 3000);
      }
    };

    const timer = setTimeout(handleTyping, typingSpeed);
    return () => clearTimeout(timer);
  }, [placeholderText, isDeleting, typingSpeed, active, fullText]);

  return placeholderText;
}