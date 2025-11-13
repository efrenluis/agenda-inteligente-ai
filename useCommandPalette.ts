import { useState, useEffect, useCallback } from 'react';

export const useCommandPalette = () => {
  const [isCommandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setCommandPaletteOpen(prev => !prev);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return { isCommandPaletteOpen, setCommandPaletteOpen };
};