import React, { useState } from 'react';
import { db, PublicUser, CategorySettings, Category, Project, PALETTE_COLORS } from '../db';
import { improveProjectDescription, suggestCategoriesForProject } from '../services/geminiService';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: PublicUser;
  onProjectCreated: (newProject: Project) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ isOpen, onClose, currentUser, onProjectCreated, showToast }) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [improvedDescription, setImprovedDescription] = useState('');
  const [suggestedCategories, setSuggestedCategories] = useState<string[]>([]);
  const [finalCategories, setFinalCategories] = useState<CategorySettings>({ masterList: [], active: [] });

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim()) {
        showToast('El nombre y la descripción son obligatorios.', 'error');
        return;
    }
    setIsLoading(true);
    try {
        const [impDesc, sugCats] = await Promise.all([
            improveProjectDescription(description),
            suggestCategoriesForProject(description)
        ]);
        setImprovedDescription(impDesc || description);
        setSuggestedCategories(sugCats || []);
        
        // Setup initial category settings from suggestions
        const initialMasterList: Category[] = (sugCats || []).map(catName => ({
            name: catName,
            color: PALETTE_COLORS[Math.floor(Math.random() * PALETTE_COLORS.length)]
        }));
        setFinalCategories({
            masterList: initialMasterList,
            active: initialMasterList.map(c => c.name)
        });

        setStep(2);
    } catch (error) {
        showToast('Error al procesar con IA. Inténtalo de nuevo.', 'error');
    } finally {
        setIsLoading(false);
    }
  };

  const handleManualCreate = () => {
    if (!name.trim()) {
      showToast('El nombre del proyecto es obligatorio.', 'error');
      return;
    }
    const newProject = db.createProject(name, description, currentUser.id, { masterList: [], active: [] });
    showToast(`Proyecto "${name}" creado con éxito`);
    onProjectCreated(newProject);
    handleClose();
  };
  
  const handleFinalSubmit = () => {
      const newProject = db.createProject(name, improvedDescription, currentUser.id, finalCategories);
      showToast(`Proyecto "${name}" creado con éxito`);
      onProjectCreated(newProject);
      handleClose();
  };

  const handleClose = () => {
    setStep(1);
    setName('');
    setDescription('');
    setIsLoading(false);
    setImprovedDescription('');
    setSuggestedCategories([]);
    setFinalCategories({ masterList: [], active: [] });
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={handleClose}>
      <div className="bg-surface rounded-lg shadow-xl w-full max-w-2xl m-4" onClick={(e) => e.stopPropagation()}>
        {step === 1 && (
            <form onSubmit={handleStep1Submit}>
                <div className="p-6">
                    <h3 className="text-xl font-semibold text-primary">Crear Nuevo Proyecto</h3>
                    <p className="text-sm text-text-secondary mt-1">Describe tu proyecto y la IA te ayudará a organizarlo, o créalo manualmente.</p>
                    <div className="mt-4 space-y-4">
                        <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre del Proyecto" className="w-full p-2 border rounded-md" required />
                        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe tu proyecto aquí... (necesario para la IA)" rows={5} className="w-full p-2 border rounded-md" />
                    </div>
                </div>
                <div className="flex justify-between items-center p-4 bg-gray-50 border-t">
                    <button type="button" onClick={handleClose} className="px-4 py-2 bg-gray-200 rounded-md">Cancelar</button>
                    <div className="flex space-x-2">
                        <button type="button" onClick={handleManualCreate} className="px-4 py-2 text-primary bg-blue-100 rounded-md hover:bg-blue-200">
                            Crear Manualmente
                        </button>
                        <button type="submit" disabled={isLoading || !description.trim()} className="px-4 py-2 text-white bg-primary rounded-md disabled:bg-gray-400">
                            {isLoading ? 'Analizando...' : 'Analizar con IA ✨'}
                        </button>
                    </div>
                </div>
            </form>
        )}
        {step === 2 && (
            <div>
                <div className="p-6 max-h-[70vh] overflow-y-auto">
                    <h3 className="text-xl font-semibold text-primary">Revisa las Sugerencias (Paso 2 de 2)</h3>
                    <div className="mt-4 space-y-4">
                        <div>
                            <label className="font-semibold">Descripción Mejorada:</label>
                            <p className="p-3 mt-1 bg-gray-50 rounded-md border text-sm">{improvedDescription}</p>
                        </div>
                        <div>
                            <label className="font-semibold">Categorías Sugeridas:</label>
                            <p className="text-xs text-text-secondary">Estas serán las categorías iniciales para tu proyecto. Puedes cambiarlas más tarde.</p>
                             <div className="flex flex-wrap gap-2 p-2 mt-1 border border-gray-200 rounded-md">
                                {finalCategories.masterList.map(cat => (
                                    <div key={cat.name} className={`px-3 py-1 rounded-full text-sm font-medium border bg-${cat.color.split('-')[1]}-100 text-${cat.color.split('-')[1]}-700 border-${cat.color.split('-')[1]}-300`}>
                                        {cat.name}
                                    </div>
                                ))}
                                {finalCategories.masterList.length === 0 && <p className="text-xs text-gray-500">La IA no sugirió categorías. Puedes añadirlas manualmente más tarde.</p>}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex justify-end p-4 bg-gray-50 border-t">
                    <button type="button" onClick={() => setStep(1)} className="px-4 py-2 mr-2 bg-gray-200 rounded-md">Volver</button>
                    <button type="button" onClick={handleFinalSubmit} className="px-4 py-2 text-white bg-primary rounded-md">
                        Crear Proyecto
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default CreateProjectModal;
