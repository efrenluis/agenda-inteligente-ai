import React, { useState } from 'react';
import { Note, PublicUser } from '../db';

interface ExternalShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  noteToShare: Note;
  currentUser: PublicUser;
}

const ExternalShareModal: React.FC<ExternalShareModalProps> = ({ isOpen, onClose, noteToShare, currentUser }) => {
  const [message, setMessage] = useState('');

  if (!isOpen) return null;
  
  const fullContent = `${message ? message + '\n\n' : ''}Nota: ${noteToShare.text}${noteToShare.date ? `\nFecha: ${noteToShare.date}`: ''}${noteToShare.time ? `\nHora: ${noteToShare.time}`: ''}${noteToShare.location ? `\nLugar: ${noteToShare.location}`: ''}`;

  const handleEmailShare = () => {
    if (!currentUser.email) {
      alert("Por favor, añade tu email en tu perfil para usar esta función.");
      return;
    }
    const subject = `Nota compartida: ${noteToShare.text.substring(0, 30)}...`;
    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(fullContent)}`;
    window.location.href = mailtoLink;
    onClose();
  };

  const handleWhatsAppShare = () => {
     if (!currentUser.phone) {
      alert("Por favor, añade tu número de teléfono en tu perfil para usar esta función.");
      return;
    }
    const whatsappLink = `https://api.whatsapp.com/send?text=${encodeURIComponent(fullContent)}`;
    window.open(whatsappLink, '_blank');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={onClose}>
      <div className="bg-surface rounded-lg shadow-xl w-full max-w-lg m-4" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <h3 className="text-xl font-semibold text-primary">Compartir Nota (Externo)</h3>
          <p className="mt-2 text-sm text-text-secondary truncate">
            Compartiendo: <span className="font-medium">{noteToShare.text}</span>
          </p>

          <div className="mt-4">
            <label htmlFor="share-message" className="block text-sm font-medium text-gray-700">Mensaje Adicional (Opcional)</label>
            <textarea
              id="share-message"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-1 block w-full p-2 border border-border-color rounded-md focus:ring-secondary focus:border-secondary"
              placeholder="Añade un comentario a tu nota compartida..."
            />
          </div>
        </div>

        <div className="flex justify-end p-4 space-x-2 bg-gray-50 border-t border-border-color">
          <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">
            Cancelar
          </button>
          <button onClick={handleEmailShare} className="px-4 py-2 text-white rounded-md bg-red-500 hover:bg-red-600">
            Email
          </button>
          <button onClick={handleWhatsAppShare} className="px-4 py-2 text-white rounded-md bg-green-500 hover:bg-green-600">
            WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExternalShareModal;