import React, { useState, useEffect } from 'react';
import { db, PublicUser, CustomTab } from '../db';

interface MultiCategoryTabModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tabData: Omit<CustomTab, 'id' | 'type'> & { name: string }) => void;
  currentUser: PublicUser;
  projectId?: string;
}

const MultiCategoryTabModal: React.FC<MultiCategoryTabModalProps> = ({ isOpen, onClose, onSave, currentUser, projectId }) => {
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [tabName, setTabName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      // FIX: Property 'getCategoriesForUser' does not exist. Use 'getActiveGeneralCategories' for the general dashboard, and 'getActiveProjectCategories' when a projectId is provided.
      // Also, we need to get the list of active category names from the returned settings object.
      if (projectId) {
        setAvailableCategories(db.getActiveProjectCategories(projectId).active);
      } else {
        setAvailableCategories(db.getActiveGeneralCategories(currentUser.id).active);
      }
      setSelectedCategories([]);
      setTabName('');
      setError('');
    }
  }, [isOpen, currentUser.id, projectId]);

  const handleToggleCategory = (category: string) => {
    setSelectedCategories(prev =>
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    );
  };
  
  useEffect(() => {
    if (selectedCategories.length > 0 && selectedCategories.length <= 3) {
      setTabName(selectedCategories.join(' + '));
    } else if (selectedCategories.length > 3) {
      setTabName(`${selectedCategories.slice(0, 2).join(', ')} y más...`);
    } else {
      setTabName('');
    }
  }, [selectedCategories]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!tabName.trim()) {
      setError('Por favor, dale un nombre a la vista.');
      return;
    }
    if (selectedCategories.length < 2) {
      setError('Selecciona al menos dos categorías.');
      return;
    }
    
    onSave({
      name: tabName.trim(),
      value: selectedCategories,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={onClose}>
      <div className="bg-surface rounded-lg shadow-xl w-full max-w-lg m-4" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <h3 className="text-xl font-semibold text-primary">Crear Vista Personalizada</h3>
            <p className="text-sm text-text-secondary">Selecciona varias categorías para crear una pestaña que las combine.</p>
            
            <div>
              <label htmlFor="tabName" className="font-semibold text-text-primary">Nombre de la Vista</label>
              <input
                id="tabName"
                type="text"
                value={tabName}
                onChange={e => setTabName(e.target.value)}
                className="w-full mt-1 p-2 border border-border-color rounded-md"
                required
              />
            </div>

            <div>
              <label className="font-semibold text-text-primary">Categorías</label>
              <div className="flex flex-wrap gap-2 p-2 mt-1 border border-border-color rounded-md max-h-48 overflow-y-auto">
                {availableCategories.map(cat => (
                  <button key={cat} type="button" onClick={() => handleToggleCategory(cat)} className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${selectedCategories.includes(cat) ? 'bg-primary text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <div className="flex justify-end p-4 space-x-2 bg-gray-50 border-t border-border-color">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">
              Cancelar
            </button>
            <button type="submit" className="px-4 py-2 text-white rounded-md bg-primary hover:bg-blue-800">
              Crear Vista
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MultiCategoryTabModal;
