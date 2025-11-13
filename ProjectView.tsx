import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { db, Note, PublicUser, Project, CustomTab, Category, Group } from '../db';
import { processNaturalLanguageNote, AISuggestion } from '../services/geminiService';
import NoteItem, { getCategoryAppearance } from './NoteItem';
import NoteModal from './NoteModal';
import ShareModal from './ShareModal';
import ProjectSettingsModal from './ProjectSettingsModal';
import MultiCategoryTabModal from './MultiCategoryTabModal';
import AISuggestionModal from './AISuggestionModal';
import CreateProjectModal from './CreateProjectModal';

interface ProjectViewProps {
  user: PublicUser;
  notes: Note[];
  fetchData: () => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

// FIX: Moved NestedNoteView outside of ProjectView to prevent re-declaration on every render.
// This is the root cause of props like `onDelete` becoming undefined in child components.
const NestedNoteView: React.FC<{
    notes: Note[];
    parentId: string | undefined;
    allProjectCategories: Category[];
    onEdit: (noteOrPartial: Note | Partial<Note>) => void;
    onShare: (note: Note) => void;
    onDelete: (noteId: string) => void;
    commonProps: Omit<React.ComponentProps<typeof NoteItem>, 'note' | 'onEdit' | 'onShare' | 'onDelete' | 'allCategories'>;
}> = ({ notes, parentId, allProjectCategories, onEdit, onShare, onDelete, commonProps }) => {
    return (
        <>
            {notes
                .filter(note => note.parentId === parentId)
                .map(note => (
                    <div key={note.id} className="animate-fade-in">
                        <NoteItem 
                            note={note} 
                            {...commonProps} 
                            allCategories={allProjectCategories}
                            onEdit={onEdit} // Pass the handler directly
                            onShare={onShare} // Pass the handler directly
                            onDelete={onDelete} // Pass the handler directly
                        />
                        <div className={`pl-6 ${notes.some(child => child.parentId === note.id) ? 'border-l-2 ml-4 mt-4 border-border-color' : ''}`}>
                            <NestedNoteView
                                notes={notes}
                                parentId={note.id}
                                allProjectCategories={allProjectCategories}
                                onEdit={onEdit}
                                onShare={onShare}
                                onDelete={onDelete}
                                commonProps={commonProps}
                            />
                             <button onClick={() => onEdit({ parentId: note.id, projectIds: note.projectIds })} 
                                className="text-sm text-secondary hover:underline pl-2 mt-2">
                                + Añadir sub-tarea
                             </button>
                        </div>
                    </div>
                ))
            }
        </>
    );
};


const ProjectView: React.FC<ProjectViewProps> = ({ user, notes, fetchData, showToast }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [allUsers, setAllUsers] = useState<PublicUser[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  
  const [isNoteModalOpen, setNoteModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null | Partial<Note>>(null);
  const [isShareModalOpen, setShareModalOpen] = useState(false);
  const [sharingNote, setSharingNote] = useState<Note | null>(null);

  const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);
  const [isMultiCategoryModalOpen, setMultiCategoryModalOpen] = useState(false);
  const [isCreateProjectModalOpen, setCreateProjectModalOpen] = useState(false);
  
  const [activeProjectTab, setActiveProjectTab] = useState<string | CustomTab>('all');

  const [quickNoteText, setQuickNoteText] = useState('');
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null);

  const fetchProjectsAndUsers = useCallback(() => {
    const userProjects = db.getProjectsForUser(user.id);
    setProjects(userProjects);
    setAllUsers(db.getAllUsers());
    setGroups(db.getGroupsForUser(user.id));

    if (selectedProject) {
        const refreshedProject = userProjects.find(p => p.id === selectedProject.id);
        setSelectedProject(refreshedProject || null);
    } else if (userProjects.length > 0 && !selectedProject) {
        setSelectedProject(userProjects[0]);
    }
  }, [user.id, selectedProject]);
  
  useEffect(fetchProjectsAndUsers, [fetchProjectsAndUsers]);
  useEffect(() => { setActiveProjectTab('all') }, [selectedProject]);
  
  const handleProcessAI = async (text: string) => {
    if (!text.trim() || !selectedProject) return;
    setIsProcessingAI(true);
    const availableCategories = db.getActiveProjectCategories(selectedProject.id).active;
    try {
        const suggestion = await processNaturalLanguageNote(text, availableCategories);
        if (suggestion) {
            setAiSuggestion(suggestion);
        } else {
            showToast('No se pudo procesar la nota con IA, inténtalo de nuevo.', 'error');
        }
        setQuickNoteText('');
    } catch (error) {
        showToast('Error al procesar la nota con IA', 'error');
    } finally {
        setIsProcessingAI(false);
    }
  };

  const handleVoiceInput = () => {
    const recognition = new ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)();
    recognition.lang = 'es-ES';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => {
        setIsListening(false);
        showToast('Error en el reconocimiento de voz.', 'error');
    };
    recognition.onresult = (event: any) => {
        const speechResult = event.results[0][0].transcript;
        setQuickNoteText(speechResult);
        handleProcessAI(speechResult);
    };
    recognition.start();
  };
  
  const handleSaveNote = (noteData: Omit<Note, 'id' | 'createdAt' | 'ownerId' | 'ownerName'>, noteId?: string) => {
    if (noteId) {
        const existingNote = notes.find(n => n.id === noteId);
        if (existingNote) db.updateNote({ ...existingNote, ...noteData });
    } else {
      db.addNote({ ...noteData, ownerId: user.id, ownerName: user.username });
    }
    fetchData();
    fetchProjectsAndUsers();
    setNoteModalOpen(false);
    setEditingNote(null);
  };
  
  const handleDeleteNote = useCallback((noteId: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar esta tarea y todas sus sub-tareas?')) {
        db.deleteNote(noteId);
        fetchData();
        showToast('Tarea eliminada', 'error');
    }
  }, [fetchData, showToast]);

  const handleEditNote = useCallback((noteOrPartial: Note | Partial<Note>) => {
      setEditingNote(noteOrPartial);
      setNoteModalOpen(true);
  }, []);

  const handleShareNote = useCallback((note: Note) => {
      setSharingNote(note);
      setShareModalOpen(true);
  }, []);

  const projectNotes = useMemo(() => notes.filter(n => n.projectIds?.includes(selectedProject?.id || '')), [notes, selectedProject]);

  const filteredProjectNotes = useMemo(() => {
    if (activeProjectTab === 'all') return projectNotes;
    if (typeof activeProjectTab !== 'string') {
        if (activeProjectTab.type.startsWith('project-category')) {
             return projectNotes.filter(n => n.categories.includes(activeProjectTab.value as string));
        }
        if (activeProjectTab.type.startsWith('project-multi-category')) {
            return projectNotes.filter(n => (activeProjectTab.value as string[]).some(cat => n.categories.includes(cat)));
        }
    }
    return projectNotes;
  }, [projectNotes, activeProjectTab]);
  
  const addProjectTab = (tab: Omit<CustomTab, 'id' | 'type'> & { name: string }) => {
    if (!selectedProject) return;
    const type: CustomTab['type'] = Array.isArray(tab.value) ? 'project-multi-category' : 'project-category';
    const newTab = { ...tab, name: tab.name, id: `${selectedProject.id}-${Array.isArray(tab.value) ? tab.value.join('+') : tab.value}`, type };
    
    const existingTab = selectedProject.tabs.find(t => t.id === newTab.id);
    if (existingTab) {
        setActiveProjectTab(existingTab);
        return;
    }
    
    const updatedProject = { ...selectedProject, tabs: [...selectedProject.tabs, newTab]};
    db.updateProject(updatedProject);
    setSelectedProject(updatedProject);
    setActiveProjectTab(newTab);
  }

  const removeProjectTab = (tabId: string) => {
      if (!selectedProject) return;
      const updatedTabs = selectedProject.tabs.filter(t => t.id !== tabId);
      const updatedProject = { ...selectedProject, tabs: updatedTabs };
      db.updateProject(updatedProject);
      setSelectedProject(updatedProject);
      if (typeof activeProjectTab !== 'string' && activeProjectTab.id === tabId) {
          setActiveProjectTab('all');
      }
  }

  const getTabClass = (tab: string | CustomTab) => {
      const isActive = (typeof activeProjectTab !== 'string' && typeof tab !== 'string' && activeProjectTab.id === tab.id) || activeProjectTab === tab;
      let colorClasses = 'border-transparent text-text-secondary hover:text-text-primary hover:border-gray-300';
      if (isActive && selectedProject) {
        let borderColor = `border-${selectedProject.color.split('-')[1]}-500`;
        if (typeof tab !== 'string' && tab.type.includes('category')) {
            const categoryName = Array.isArray(tab.value) ? tab.value[0] : tab.value as string;
            const appearance = getCategoryAppearance(categoryName, selectedProject.categories.masterList);
            borderColor = appearance.border;
        }
        colorClasses = `${borderColor} text-primary font-semibold`;
      }
      return `${colorClasses} whitespace-nowrap py-3 px-3 border-b-4 font-medium text-sm transition-colors cursor-pointer`;
  }

  return (
    <div className="flex h-full w-full bg-background text-text-primary">
      <aside className="w-1/4 max-w-xs p-4 pr-0 space-y-4 border-r border-border-color bg-slate-50">
        <h3 className="text-xl font-bold text-text-primary px-2">Proyectos</h3>
        <div className="space-y-2">
            {projects.map(p => (
                <button key={p.id} onClick={() => setSelectedProject(p)} className={`w-full text-left p-2 rounded-md flex items-center space-x-2 transition-colors ${selectedProject?.id === p.id ? `bg-blue-100 text-primary font-semibold` : 'text-text-secondary hover:bg-gray-200'}`}>
                    <span className={`w-2 h-2 rounded-full bg-${p.color.split('-')[1]}-500`}></span>
                    <span>{p.name}</span>
                </button>
            ))}
        </div>
        <div className="pt-4 border-t border-border-color px-2">
            <button onClick={() => setCreateProjectModalOpen(true)} className="w-full mt-2 px-4 py-2 text-white bg-secondary rounded-md hover:bg-blue-700 transition-colors">Crear Proyecto</button>
        </div>
      </aside>
      
      <main className="flex-1 p-8 overflow-y-auto">
        {selectedProject ? (
            <div>
                 <header className="flex justify-between items-center mb-6 pb-4 border-b border-border-color">
                    <div className="flex items-center space-x-3">
                         <span className={`w-3 h-3 rounded-full bg-${selectedProject.color.split('-')[1]}-500`}></span>
                         <h2 className="text-3xl font-bold text-text-primary">{selectedProject.name}</h2>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button onClick={() => handleEditNote({ projectIds: [selectedProject.id] })} className="px-4 py-2 font-semibold text-white transition-colors duration-200 rounded-md bg-primary hover:bg-blue-800">
                            + Añadir Tarea
                        </button>
                        <button onClick={() => setSettingsModalOpen(true)} className="p-2 font-semibold text-text-secondary transition-colors duration-200 rounded-md bg-gray-200 hover:bg-gray-300" title="Ajustes del proyecto">
                           ⚙️
                        </button>
                    </div>
                </header>
                
                 <div className="mb-8 relative">
                    <input type="text" value={quickNoteText} onChange={e => setQuickNoteText(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleProcessAI(quickNoteText)}
                        placeholder="Añadir tarea con IA: 'Diseñar el wireframe del login'..."
                        disabled={isProcessingAI || isListening}
                        className="w-full pl-4 pr-24 py-3 text-base border-2 border-border-color bg-surface text-text-primary rounded-full focus:ring-2 focus:ring-secondary focus:border-transparent transition"
                    />
                    <div className="absolute inset-y-0 right-2 flex items-center space-x-1">
                        <button onClick={handleVoiceInput} disabled={isProcessingAI || isListening}
                            className={`p-2 rounded-full transition-colors ${isListening ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-gray-200 text-gray-500'}`}>
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4z"/><path d="M5.5 4.5a2.5 2.5 0 015 0v6a2.5 2.5 0 01-5 0v-6zM10 15a4 4 0 004-4h-1.5a2.5 2.5 0 01-5 0H6a4 4 0 004 4z"/></svg>
                        </button>
                        <button onClick={() => handleProcessAI(quickNoteText)} disabled={isProcessingAI || isListening || !quickNoteText.trim()}
                            className="px-4 py-1.5 text-sm font-semibold text-white bg-secondary rounded-full disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-blue-700">
                            {isProcessingAI ? 'Procesando...' : 'Crear ✨'}
                        </button>
                    </div>
                </div>
                
                <div className="border-b border-border-color mb-6">
                  <nav className="-mb-px flex space-x-2 overflow-x-auto">
                    <button onClick={() => setActiveProjectTab('all')} className={getTabClass('all')}>Todas las Tareas</button>
                    <div className="border-l border-border-color h-5 self-center mx-1"></div>
                    {selectedProject.tabs.map(tab => (
                        <div key={tab.id} className={`${getTabClass(tab)} flex items-center group relative`}>
                            <span onClick={() => setActiveProjectTab(tab)} className="pr-5">{tab.name}</span>
                            <button onClick={() => removeProjectTab(tab.id)} className="ml-2 text-gray-400 hover:text-gray-800 absolute right-0 opacity-20 group-hover:opacity-100 transition-opacity">&times;</button>
                        </div>
                    ))}
                    <button onClick={() => setMultiCategoryModalOpen(true)} className="ml-2 text-gray-400 hover:text-secondary p-2 rounded-full transition-colors self-center">+</button>
                  </nav>
                </div>

                <div className="space-y-4">
                  <NestedNoteView 
                    notes={filteredProjectNotes}
                    parentId={undefined}
                    allProjectCategories={selectedProject.categories.masterList}
                    onEdit={handleEditNote}
                    onShare={handleShareNote}
                    onDelete={handleDeleteNote}
                    commonProps={{
                        currentUser: user,
                        fetchData: fetchData,
                        showToast: showToast,
                        allUsers: allUsers,
                        allGroups: groups,
                        projects: projects,
                        viewContext: "project",
                        contextProjectId: selectedProject.id,
                        onCategoryClick: (cat) => addProjectTab({ name: cat, value: cat }),
                    }}
                  />
                  {projectNotes.length === 0 && <p className="text-center text-text-secondary py-8">Este proyecto no tiene tareas. ¡Añade la primera!</p>}
                </div>
            </div>
        ) : (
            <div className="flex items-center justify-center h-full">
                <p className="text-center text-lg text-text-secondary">Selecciona un proyecto para empezar o crea uno nuevo en el panel de la izquierda.</p>
            </div>
        )}
      </main>

      {isNoteModalOpen && <NoteModal isOpen={isNoteModalOpen} onClose={() => { setNoteModalOpen(false); setEditingNote(null); fetchData(); }} onSave={handleSaveNote} noteToEdit={editingNote} currentUser={user} contextProjectId={selectedProject?.id} />}
      {isShareModalOpen && sharingNote && <ShareModal isOpen={isShareModalOpen} onClose={() => { setShareModalOpen(false); setSharingNote(null); }} noteToShare={sharingNote} currentUser={user} showToast={showToast} fetchData={fetchData} />}
      {isSettingsModalOpen && selectedProject && <ProjectSettingsModal isOpen={isSettingsModalOpen} onClose={() => setSettingsModalOpen(false)} project={selectedProject} onSave={fetchProjectsAndUsers} onDelete={() => { fetchProjectsAndUsers(); setSelectedProject(null); fetchData(); }} />}
      {isMultiCategoryModalOpen && selectedProject && <MultiCategoryTabModal isOpen={isMultiCategoryModalOpen} onClose={() => setMultiCategoryModalOpen(false)} currentUser={user} onSave={addProjectTab} projectId={selectedProject.id} />}
      {aiSuggestion && selectedProject && <AISuggestionModal isOpen={!!aiSuggestion} onClose={() => setAiSuggestion(null)} suggestion={aiSuggestion}
        onAccept={(noteData) => { db.addNote({ ...noteData, ownerId: user.id, ownerName: user.username, projectIds: [selectedProject.id] }); fetchData(); showToast('Tarea creada con IA'); }}
        onEdit={(noteData) => { setEditingNote({...noteData, projectIds: [selectedProject.id]}); setNoteModalOpen(true); }} />}
      {isCreateProjectModalOpen && <CreateProjectModal isOpen={isCreateProjectModalOpen} onClose={() => setCreateProjectModalOpen(false)} currentUser={user} onProjectCreated={(p) => { fetchProjectsAndUsers(); setSelectedProject(p); }} showToast={showToast} />}
    </div>
  );
};

export default ProjectView;
