import React from 'react';
import { AISuggestion } from '../services/geminiService';
import { Note } from '../db';

interface AISuggestionModalProps {
    isOpen: boolean;
    onClose: () => void;
    suggestion: AISuggestion;
    onAccept: (noteData: Omit<Note, 'id' | 'createdAt' | 'ownerId' | 'ownerName'>) => void;
    onEdit: (noteData: Partial<Note>) => void;
}

const AISuggestionModal: React.FC<AISuggestionModalProps> = ({ isOpen, onClose, suggestion, onAccept, onEdit }) => {
    if (!isOpen) return null;

    const fullNoteData = {
        text: suggestion.improvedText,
        date: suggestion.extractedData.date || undefined,
        time: suggestion.extractedData.time || undefined,
        location: suggestion.extractedData.location || undefined,
        categories: suggestion.extractedData.categories,
        isCompleted: false,
        sharedWith: { users: [], groups: [] },
    };

    const handleAccept = () => {
        onAccept(fullNoteData);
        onClose();
    };

    const handleEdit = () => {
        onEdit(fullNoteData);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={onClose}>
            <div className="bg-surface rounded-lg shadow-xl w-full max-w-lg m-4" onClick={(e) => e.stopPropagation()}>
                <div className="p-6">
                    <div className="flex items-center space-x-3">
                        <span className="text-2xl">✨</span>
                        <h3 className="text-xl font-semibold text-primary">Sugerencia de la IA</h3>
                    </div>
                    <p className="mt-2 text-sm text-text-secondary">Hemos procesado tu nota. ¿Quieres guardarla así o editarla?</p>
                    
                    <div className="mt-4 p-4 bg-gray-50 border border-border-color rounded-md space-y-3">
                        <p className="font-medium">{suggestion.improvedText}</p>
                        <div className="flex flex-wrap gap-2 text-sm">
                            {suggestion.extractedData.date && <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-md">📅 {suggestion.extractedData.date}</span>}
                            {suggestion.extractedData.time && <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-md">⏰ {suggestion.extractedData.time}</span>}
                            {suggestion.extractedData.location && <span className="bg-green-100 text-green-800 px-2 py-1 rounded-md">📍 {suggestion.extractedData.location}</span>}
                            {suggestion.extractedData.categories.map(cat => (
                                <span key={cat} className="bg-gray-200 text-gray-800 px-2 py-1 rounded-md">{cat}</span>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="flex justify-end p-4 space-x-2 bg-gray-50 border-t border-border-color">
                    <button type="button" onClick={handleEdit} className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">
                        Editar
                    </button>
                    <button onClick={handleAccept} className="px-4 py-2 text-white rounded-md bg-primary hover:bg-blue-800">
                        Aceptar y Crear
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AISuggestionModal;