import React, { useState, useEffect, useMemo } from 'react';
import { db, Note, PublicUser, Project, CategorySettings, Attachment, uuid, Category } from '../db';
import { AISuggestion, improveNoteText } from '../services/geminiService';
import { getCategoryAppearance } from './NoteItem';

interface NoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (noteData: Omit<Note, 'id' | 'createdAt' | 'ownerId' | 'ownerName'>, noteId?: string) => void;
  noteToEdit: Note | null | Partial<Note>;
  currentUser: PublicUser;
  contextProjectId?: string; 
  parentId?: string;
  suggestion?: AISuggestion | null;
}

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};


const CategoryPillButton: React.FC<{
  category: Category;
  isSelected: boolean;
  allCategories: Category[];
  onClick: () => void;
  onDelete?: () => void;
}> = ({ category, isSelected, allCategories, onClick, onDelete }) => {
    const appearance = getCategoryAppearance(category.name, allCategories);
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div 
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="relative"
        >
            <button 
                type="button" 
                onClick={onClick} 
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors border ${isSelected ? `${appearance.cardBg} ${appearance.border} ${appearance.pillText} font-bold` : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'}`}
            >
                {category.name}
            </button>
            {isSelected && isHovered && onDelete && (
                <button 
                    type="button" 
                    onClick={onDelete}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold transition-transform hover:scale-110"
                    title={`Eliminar "${category.name}" permanentemente`}
                >
                    &times;
                </button>
            )}
        </div>
    );
};

const NoteModal: React.FC<NoteModalProps> = ({ isOpen, onClose, onSave, noteToEdit, currentUser, contextProjectId, parentId, suggestion }) => {
  const [text, setText] = useState('');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);

  const [userProjects, setUserProjects] = useState<Project[]>([]);
  const [isImprovingText, setIsImprovingText] = useState(false);

  const isSharedNote = noteToEdit ? 'ownerId' in noteToEdit && noteToEdit.ownerId !== currentUser.id : false;
  const isEditing = noteToEdit ? 'id' in noteToEdit : false;
  const modalType = (noteToEdit && 'projectIds' in noteToEdit && noteToEdit.projectIds && noteToEdit.projectIds.length > 0) || contextProjectId ? 'task' : 'note';

  const generalCategoriesData = useMemo(() => db.getGeneralCategories(currentUser.id), [currentUser.id, isOpen]);

  const projectCategoriesData = useMemo(() => {
    return selectedProjectIds.map(pid => {
        const project = userProjects.find(p => p.id === pid);
        return {
            projectId: pid,
            projectName: project?.name || 'Proyecto',
            categories: project?.categories.masterList || [],
        };
    });
  }, [selectedProjectIds, userProjects]);


  useEffect(() => {
    if (isOpen) {
        setUserProjects(db.getProjectsForUser(currentUser.id));

        if (suggestion) {
            setText(suggestion.improvedText);
            setDate(suggestion.extractedData.date || '');
            setTime(suggestion.extractedData.time || '');
            setLocation(suggestion.extractedData.location || '');
            setSelectedCategories(suggestion.extractedData.categories || []);
            setSelectedProjectIds(contextProjectId ? [contextProjectId] : []);
        } else {
            setText(noteToEdit?.text || '');
            setDescription(noteToEdit?.description || '');
            setAttachments(noteToEdit?.attachments || []);
            setDate(noteToEdit?.date || '');
            setTime(noteToEdit?.time || '');
            setLocation(noteToEdit?.location || '');
            setSelectedCategories(noteToEdit?.categories || []);
            const initialProjectIds = (noteToEdit && 'projectIds' in noteToEdit) ? noteToEdit.projectIds : (contextProjectId ? [contextProjectId] : []);
            setSelectedProjectIds(initialProjectIds || []);
        }
    }
  }, [noteToEdit, currentUser.id, isOpen, suggestion, contextProjectId]);
  
  const handleImproveText = async () => {
      if (!text.trim()) return;
      setIsImprovingText(true);
      const improved = await improveNoteText(text);
      if (improved) setText(improved);
      setIsImprovingText(false);
  }

  const handleCategoryToggle = (categoryName: string) => {
    setSelectedCategories(prev =>
      prev.includes(categoryName) ? prev.filter(c => c !== categoryName) : [...prev, categoryName]
    );
  };
  
  const handleProjectToggle = (projectId: string) => {
    setSelectedProjectIds(prev => 
      prev.includes(projectId) ? prev.filter(id => id !== projectId) : [...prev, projectId]
    );
  };

  const handleDeleteCategory = (categoryName: string, projectId?: string) => {
      if (window.confirm(`¿Estás seguro de que quieres eliminar la categoría "${categoryName}" permanentemente de tu lista? Esta acción no se puede deshacer.`)) {
          db.deleteCategory(currentUser.id, categoryName, projectId);
          // Refresh local state after deletion
          setSelectedCategories(prev => prev.filter(c => c !== categoryName));
          onClose(); // Close and refetch data from parent
      }
  }

    const handleAddLink = () => {
        const url = prompt("Introduce la URL del enlace:");
        if (url) {
            const name = prompt("Dale un nombre a este enlace:", url);
            setAttachments(prev => [...prev, { id: uuid(), type: 'link', name: name || url, content: url }]);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const base64 = await fileToBase64(file);
            setAttachments(prev => [...prev, { id: uuid(), type: 'file', name: file.name, content: base64 }]);
        }
    };

    const removeAttachment = (id: string) => {
        setAttachments(prev => prev.filter(att => att.id !== id));
    };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSharedNote && !text.trim()) return;

    onSave({
      text, description, attachments,
      date: date || undefined,
      time: time || undefined,
      location: location || undefined,
      categories: selectedCategories,
      isCompleted: (noteToEdit && 'isCompleted' in noteToEdit) ? noteToEdit.isCompleted! : false,
      sharedWith: (noteToEdit && 'sharedWith' in noteToEdit) ? noteToEdit.sharedWith! : { users: [], groups: [] },
      projectIds: selectedProjectIds.length > 0 ? selectedProjectIds : undefined,
      parentId: (noteToEdit && 'parentId' in noteToEdit) ? noteToEdit.parentId : parentId,
    }, (noteToEdit && 'id' in noteToEdit) ? noteToEdit.id : undefined);
  };
  
  if (!isOpen) return null;
  
  const allAvailableCategories = useMemo(() => [...generalCategoriesData.masterList, ...projectCategoriesData.flatMap(p => p.categories)], [generalCategoriesData, projectCategoriesData]);

  const renderCategoryGroup = (title: string, categories: Category[], projectId?: string) => (
    categories.length > 0 && (
        <div className="pt-2">
            <h5 className="text-xs font-bold text-gray-500 uppercase mb-2">{title}</h5>
            <div className="flex flex-wrap gap-2">
                {categories.map(cat => (
                  <CategoryPillButton
                      key={`${projectId || 'general'}-${cat.name}`}
                      category={cat}
                      isSelected={selectedCategories.includes(cat.name)}
                      allCategories={allAvailableCategories}
                      onClick={() => handleCategoryToggle(cat.name)}
                      onDelete={() => handleDeleteCategory(cat.name, projectId)}
                  />
                ))}
            </div>
        </div>
    )
  );
  
  const renderProjectSelector = () => (
    <div className="pt-2">
      <h5 className="text-xs font-bold text-gray-500 uppercase mb-2">Proyectos</h5>
      <div className="flex flex-wrap gap-2 p-2 border border-gray-200 rounded-md">
        {userProjects.map(proj => {
           const isSelected = selectedProjectIds.includes(proj.id);
           return (
             <button key={proj.id} type="button" onClick={() => handleProjectToggle(proj.id)} className={`px-3 py-1 rounded-full text-sm font-medium transition-colors border flex items-center space-x-2 ${isSelected ? `bg-${proj.color.split('-')[1]}-100 border-${proj.color.split('-')[1]}-300 text-${proj.color.split('-')[1]}-700 font-bold` : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'}`}>
                <span className={`w-2 h-2 rounded-full bg-${proj.color.split('-')[1]}-500`}></span>
                <span>{proj.name}</span>
             </button>
           )
        })}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={onClose}>
      <div className="bg-surface rounded-lg shadow-xl w-full max-w-2xl m-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <h3 className="text-xl font-semibold text-primary">{isEditing ? (isSharedNote ? 'Ver' : 'Editar') : 'Nueva'} {modalType === 'task' ? 'Tarea' : 'Nota'}</h3>
            
            <div className="space-y-2">
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`Título de la ${modalType}...`} className="w-full p-2 font-semibold text-lg border-b-2 border-border-color focus:ring-0 focus:border-secondary focus:outline-none" required />
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Añadir una descripción..." rows={3} className="w-full p-2 border border-border-color rounded-md focus:ring-secondary focus:border-secondary" />
            </div>

            <div className="space-y-3 p-2 border border-gray-200 rounded-md max-h-56 overflow-y-auto">
               {modalType === 'note' ? (
                <>
                  {renderCategoryGroup("Categorías Generales", generalCategoriesData.masterList)}
                  {renderProjectSelector()}
                  {projectCategoriesData.map(p => renderCategoryGroup(p.projectName, p.categories, p.projectId))}
                </>
               ) : (
                <>
                  {projectCategoriesData.map(p => renderCategoryGroup(p.projectName, p.categories, p.projectId))}
                  {renderProjectSelector()}
                  {renderCategoryGroup("Categorías Generales", generalCategoriesData.masterList)}
                </>
               )}
            </div>
            
            <div className="space-y-3">
                <h5 className="text-xs font-bold text-gray-500 uppercase">Adjuntos</h5>
                <div className="flex flex-wrap gap-2">
                    {attachments.map(att => (
                        <div key={att.id} className="flex items-center space-x-2 px-2.5 py-1 text-xs font-medium text-gray-700 bg-gray-200 rounded-full">
                            <span>{att.type === 'link' ? '🔗' : '📎'}</span>
                            <span className="truncate max-w-xs">{att.name}</span>
                            <button type="button" onClick={() => removeAttachment(att.id)} className="ml-1 font-bold text-red-500 hover:text-red-700">&times;</button>
                        </div>
                    ))}
                </div>
                <div className="flex space-x-2">
                    <button type="button" onClick={handleAddLink} className="text-sm px-3 py-1 bg-blue-100 text-primary rounded-md hover:bg-blue-200">Añadir Enlace</button>
                    <label className="cursor-pointer text-sm px-3 py-1 bg-green-100 text-green-700 rounded-md hover:bg-green-200">
                        Subir Archivo
                        <input type="file" className="hidden" onChange={handleFileUpload} />
                    </label>
                </div>
            </div>

            {!isSharedNote && (
                <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full p-2 border border-border-color rounded-md"/>
                  <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full p-2 border border-border-color rounded-md"/>
                  <input type="text" placeholder="Ubicación" value={location} onChange={(e) => setLocation(e.target.value)} className="w-full p-2 border border-border-color rounded-md md:col-span-2"/>
                </div>
                </>
            )}

          </div>
          <div className="flex justify-between items-center p-4 space-x-2 bg-gray-50 border-t">
            <button type="button" onClick={handleImproveText} disabled={isImprovingText || !text.trim()} className="px-3 py-1.5 text-sm font-semibold text-purple-700 bg-purple-100 rounded-md hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed">
                {isImprovingText ? '...' : 'Mejorar Título con IA 📝'}
            </button>
            <div className="flex space-x-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">
                Cancelar
              </button>
              <button type="submit" className="px-4 py-2 text-white rounded-md bg-primary hover:bg-blue-900">
                Guardar
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NoteModal;