import React, { useState } from 'react';
// FIX: The type 'ProjectCategories' is not exported from 'db'. The correct type is 'CategorySettings'. 
// Also importing 'Category' to correctly handle category objects.
// FIX: Import PALETTE_COLORS to be used for new category creation.
import { db, Project, PROJECT_COLORS, CategorySettings, Category, PALETTE_COLORS } from '../db';
import { suggestCategoriesForProject } from '../services/geminiService';

interface ProjectSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  onSave: () => void;
  onDelete: () => void;
}

const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({ isOpen, onClose, project, onSave, onDelete }) => {
  const [name, setName] = useState(project.name);
  const [color, setColor] = useState(project.color);
  const [description, setDescription] = useState(project.description || '');
  // FIX: Using the correct type 'CategorySettings'.
  const [categories, setCategories] = useState<CategorySettings>(project.categories);
  
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<string[] | null>(null);


  const handleSave = () => {
    db.updateProject({ ...project, name, color, description, categories });
    onSave();
    onClose();
  };
  
  const handleDelete = () => {
    if (window.confirm(`¿Seguro que quieres eliminar el proyecto "${project.name}" y todas sus notas? Esta acción es irreversible.`)) {
        db.deleteProject(project.id);
        onDelete();
        onClose();
    }
  };

  const handleSuggestCategories = async () => {
    if (!description.trim()) return;
    setIsSuggesting(true);
    setSuggestions(null);
    const result = await suggestCategoriesForProject(description);
    if (result) {
        // Filter out categories that already exist in the master list
        // FIX: 'c' is a Category object, so we need to check c.name.
        const newSuggestions = result.filter(s => !categories.masterList.some(c => c.name.toLowerCase() === s.toLowerCase()));
        setSuggestions(newSuggestions);
    }
    setIsSuggesting(false);
  };

  const handleAddSuggestion = (suggestion: string) => {
    // FIX: masterList is an array of Category objects, not strings.
    // We need to check for existence by name and add a new Category object.
    if (!categories.masterList.some(c => c.name.toLowerCase() === suggestion.toLowerCase())) {
        const newCategory: Category = {
            name: suggestion,
            color: PALETTE_COLORS[Math.floor(Math.random() * PALETTE_COLORS.length)]
        };
        setCategories(prev => ({
            masterList: [...prev.masterList, newCategory],
            active: [...prev.active, newCategory.name]
        }));
    }
    setSuggestions(prev => prev?.filter(s => s !== suggestion) || null);
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={onClose}>
      <div className="bg-surface rounded-lg shadow-xl w-full max-w-lg m-4" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
          <h3 className="text-xl font-semibold text-primary">Ajustes del Proyecto</h3>
          
            <div>
              <label htmlFor="projectName" className="block text-sm font-medium text-gray-700">Nombre del Proyecto</label>
              <input type="text" id="projectName" value={name} onChange={e => setName(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-border-color focus:outline-none focus:ring-secondary focus:border-secondary sm:text-sm rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Color del Proyecto</label>
              <div className="mt-2 flex flex-wrap gap-3">
                {PROJECT_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setColor(c)} className={`w-8 h-8 rounded-full bg-${c.split('-')[1]}-500 transition-transform hover:scale-110 ${color === c ? 'ring-2 ring-offset-2 ring-primary' : ''}`}></button>
                ))}
              </div>
            </div>
            <div>
                <label htmlFor="projectDescription" className="block text-sm font-medium text-gray-700">Descripción del Proyecto</label>
                <textarea id="projectDescription" value={description} onChange={e => setDescription(e.target.value)} rows={3} className="mt-1 block w-full p-2 text-base border-border-color focus:outline-none focus:ring-secondary focus:border-secondary sm:text-sm rounded-md" placeholder="Describe el objetivo principal de este proyecto..." />
            </div>
             <div>
                <button type="button" onClick={handleSuggestCategories} disabled={isSuggesting || !description.trim()} className="w-full flex justify-center items-center px-4 py-2 text-sm font-medium text-purple-700 bg-purple-100 rounded-md hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed">
                    {isSuggesting ? 'Analizando...' : 'Sugerir Categorías con IA ✨'}
                </button>
                {suggestions && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-md">
                        <h4 className="text-sm font-semibold mb-2">Sugerencias de la IA:</h4>
                        {suggestions.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {suggestions.map(s => (
                                    <div key={s} className="flex items-center bg-white border border-gray-200 rounded-full">
                                        <span className="pl-3 pr-2 text-sm">{s}</span>
                                        <button onClick={() => handleAddSuggestion(s)} className="px-2 py-1 text-green-600 hover:bg-green-100 rounded-r-full text-sm">+</button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                           <p className="text-xs text-gray-500">¡No hay nuevas sugerencias! La IA no encontró categorías que no existan ya en tu lista maestra.</p> 
                        )}
                    </div>
                )}
            </div>
        </div>
        <div className="flex justify-between p-4 bg-gray-50 border-t border-border-color">
            <button onClick={handleDelete} className="px-4 py-2 text-sm text-red-700 bg-red-100 rounded-md hover:bg-red-200">
              Eliminar Proyecto
            </button>
            <div className="space-x-2">
                <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">
                  Cancelar
                </button>
                <button onClick={handleSave} className="px-4 py-2 text-white rounded-md bg-primary hover:bg-blue-800">
                  Guardar Cambios
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectSettingsModal;