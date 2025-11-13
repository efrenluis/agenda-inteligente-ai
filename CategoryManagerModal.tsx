import React, { useState, useEffect, useMemo } from 'react';
import { db, PublicUser, Project, CategorySettings, Category, PALETTE_COLORS } from '../db';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoriesUpdated: () => void;
  currentUser: PublicUser;
}

type ViewMode = 'general' | 'projects';

const ColorPicker: React.FC<{ currentColor: string; onColorSelect: (color: string) => void }> = ({ currentColor, onColorSelect }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="relative">
            <button type="button" onClick={() => setIsOpen(!isOpen)} className={`w-6 h-6 rounded-full bg-${currentColor.split('-')[1]}-500 border-2 border-white ring-1 ring-gray-300`}></button>
            {isOpen && (
                <div className="absolute z-10 top-8 right-0 grid grid-cols-6 gap-2 p-2 bg-white rounded-md shadow-lg border">
                    {PALETTE_COLORS.map(color => (
                        <button key={color} type="button" onClick={() => { onColorSelect(color); setIsOpen(false); }}
                            className={`w-6 h-6 rounded-full bg-${color.split('-')[1]}-500 transition-transform hover:scale-110 ${currentColor === color ? 'ring-2 ring-offset-2 ring-primary' : ''}`}
                        ></button>
                    ))}
                </div>
            )}
        </div>
    );
};


const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({ isOpen, onClose, onCategoriesUpdated, currentUser }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('general');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  
  const [categorySettings, setCategorySettings] = useState<CategorySettings>({ masterList: [], active: [] });
  const [newCategoryName, setNewCategoryName] = useState('');

  const currentProject = useMemo(() => {
    return projects.find(p => p.id === selectedProjectId);
  }, [projects, selectedProjectId]);

  const loadCategories = (mode: ViewMode, projId: string) => {
    if (mode === 'general') {
      setCategorySettings(db.getGeneralCategories(currentUser.id));
    } else {
      const project = db.getProjectsForUser(currentUser.id).find(p => p.id === projId);
      setCategorySettings(project?.categories || { masterList: [], active: [] });
    }
  };

  useEffect(() => {
    if (isOpen) {
      const userProjects = db.getProjectsForUser(currentUser.id);
      setProjects(userProjects);
      const initialProjectId = userProjects[0]?.id || '';
      setSelectedProjectId(initialProjectId);
      
      // Load initial categories based on default view/project
      if (viewMode === 'general') {
        loadCategories('general', '');
      } else if (initialProjectId) {
        loadCategories('projects', initialProjectId);
      }
    }
  }, [isOpen, currentUser.id]);

  useEffect(() => {
    if (isOpen) {
      loadCategories(viewMode, selectedProjectId);
    }
  }, [viewMode, selectedProjectId, isOpen]);

  const handleAddCategory = () => {
    const trimmed = newCategoryName.trim();
    if (trimmed && !categorySettings.masterList.find(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
        const newCategory: Category = {
            name: trimmed,
            color: PALETTE_COLORS[Math.floor(Math.random() * PALETTE_COLORS.length)]
        };
        setCategorySettings(prev => ({
            masterList: [...prev.masterList, newCategory],
            active: [...prev.active, newCategory.name]
        }));
        setNewCategoryName('');
    }
  };

  const handleToggleCategory = (categoryName: string) => {
    setCategorySettings(prev => ({
        ...prev,
        active: prev.active.includes(categoryName)
            ? prev.active.filter(c => c !== categoryName)
            : [...prev.active, categoryName]
    }));
  };
  
  const handleColorChange = (categoryName: string, newColor: string) => {
    setCategorySettings(prev => ({
        ...prev,
        masterList: prev.masterList.map(c => c.name === categoryName ? { ...c, color: newColor } : c)
    }));
  };

  const handleSave = () => {
    if (viewMode === 'general') {
        db.saveGeneralCategories(currentUser.id, categorySettings);
    } else if (currentProject) {
        const updatedProject = { ...currentProject, categories: categorySettings };
        db.updateProject(updatedProject);
    }
    onCategoriesUpdated();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={onClose}>
      <div className="bg-surface rounded-lg shadow-xl w-full max-w-lg m-4 flex flex-col h-[70vh]" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b">
          <h3 className="text-xl font-semibold text-primary">Gestionar Categorías</h3>
           <div className="mt-4 flex space-x-1 bg-gray-200 p-1 rounded-md">
            <button onClick={() => setViewMode('general')} className={`w-full px-3 py-1 text-sm rounded-md ${viewMode === 'general' ? 'bg-white shadow' : ''}`}>Generales</button>
            <button onClick={() => setViewMode('projects')} className={`w-full px-3 py-1 text-sm rounded-md ${viewMode === 'projects' ? 'bg-white shadow' : ''}`}>Por Proyecto</button>
          </div>
          {viewMode === 'projects' && (
              <div className="mt-3">
                  <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} className="w-full p-2 border border-border-color rounded-md">
                      {projects.length > 0 ? projects.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                      )) : <option disabled>No tienes proyectos</option>}
                  </select>
              </div>
          )}
        </div>
        <div className="p-6 flex-grow overflow-y-auto">
          <p className="text-sm text-text-secondary mb-3">Activa o desactiva categorías, personaliza sus colores y añade nuevas a tu lista maestra.</p>
          <div className="space-y-2">
            {categorySettings.masterList.map(cat => {
              const colorName = cat.color.split('-')[1];
              return (
                <div key={cat.name} className={`flex items-center justify-between p-2 rounded-md bg-${colorName}-100`}>
                  <div className="flex items-center space-x-3">
                    <input type="checkbox" checked={categorySettings.active.includes(cat.name)} onChange={() => handleToggleCategory(cat.name)} className="h-5 w-5 text-secondary rounded border-gray-300 focus:ring-secondary cursor-pointer" />
                    <span className={`font-medium text-${colorName}-700`}>{cat.name}</span>
                  </div>
                  <ColorPicker currentColor={cat.color} onColorSelect={(newColor) => handleColorChange(cat.name, newColor)} />
                </div>
              );
            })}
             {(categorySettings.masterList.length === 0 && (viewMode === 'general' || currentProject)) && <p className="text-center text-text-secondary p-4">No hay categorías aquí. ¡Añade la primera!</p>}
          </div>
          <div className="flex mt-4 space-x-2 sticky bottom-0 bg-surface py-2">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Añadir a la lista maestra..."
              className="flex-grow w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-secondary"
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCategory())}
            />
            <button onClick={handleAddCategory} className="px-4 py-2 text-white rounded-md bg-secondary hover:bg-blue-700">
              Añadir
            </button>
          </div>
        </div>
        <div className="flex justify-end p-4 space-x-2 bg-gray-50 border-t">
          <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">
            Cancelar
          </button>
          <button onClick={handleSave} className="px-4 py-2 text-white rounded-md bg-primary hover:bg-blue-900">
            Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  );
};

export default CategoryManagerModal;