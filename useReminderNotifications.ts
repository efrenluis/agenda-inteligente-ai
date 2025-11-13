import { useEffect } from 'react';
import { Note } from '../db';

export const useReminderNotifications = (notes: Note[]) => {
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    // FIX: The return type of `setTimeout` in a browser environment is `number`, not `NodeJS.Timeout`.
    const timeouts: number[] = [];
    if (Notification.permission === 'granted') {
      notes.forEach(note => {
        if (note.date && note.time && !note.isCompleted) {
          const reminderDateTime = new Date(`${note.date}T${note.time}`).getTime();
          const now = new Date().getTime();
          const delay = reminderDateTime - now;
          
          if (delay > 0) {
            // FIX: Use `window.setTimeout` to ensure the return type is `number` in a browser context, not `NodeJS.Timeout`.
            const timeoutId = window.setTimeout(() => {
              new Notification('Recordatorio de Nota', {
                body: note.text,
                icon: '/favicon.ico', // You might want a better icon
              });
            }, delay);
            timeouts.push(timeoutId);
          }
        }
      });
    }

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [notes]);
};