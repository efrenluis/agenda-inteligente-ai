import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db, Note, PublicUser, CustomTab, saveCustomTabs, getStoredCustomTabs, Project, Group, Category } from '../db';
import { processNaturalLanguageNote, AISuggestion } from '../services/geminiService';
import NoteItem, { getCategoryAppearance } from './NoteItem';
import NoteModal from './NoteModal';
import ShareModal from './ShareModal';
import ProfileModal from './ProfileModal';
import ProjectView from './ProjectView';
import CommandPalette from './CommandPalette';
import Toast from './Toast';
import MultiCategoryTabModal from './MultiCategoryTabModal';
import CategoryManagerModal from './CategoryManagerModal';
import AISuggestionModal from './AISuggestionModal';
import { useReminderNotifications } from '../hooks/useReminderNotifications';
import { useCommandPalette } from '../hooks/useCommandPalette';

interface DashboardProps {
  user: PublicUser;
  onLogout: () => void;
  refreshUser: () => PublicUser | null;
}

type ActiveTab = 'my' | 'shared' | 'myShared' | CustomTab;
type ViewMode = 'dashboard' | 'projects';

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout, refreshUser }) => {
  const [myNotes, setMyNotes] = useState<Note[]>([]);
  const [sharedNotes, setSharedNotes] = useState<Note[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [allUsers, setAllUsers] = useState<PublicUser[]>([]);
  const [generalCategories, setGeneralCategories] = useState<Category[]>([]);
  
  const [isNoteModalOpen, setNoteModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null | Partial<Note>>(null);
  const [isShareModalOpen, setShareModalOpen] = useState(false);
  const [sharingNote, setSharingNote] = useState<Note | null>(null);
  
  const [activeTab, setActiveTab] = useState<ActiveTab>('my');
  const [customTabs, setCustomTabs] = useState<CustomTab[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');

  const [isProfileModalOpen, setProfileModalOpen] = useState(false);
  const [isMultiCategoryModalOpen, setMultiCategoryModalOpen] = useState(false);
  const [isCategoryManagerOpen, setCategoryManagerOpen] = useState(false);
  
  const [quickNoteText, setQuickNoteText] = useState('');
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null);

  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const { isCommandPaletteOpen, setCommandPaletteOpen } = useCommandPalette();

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };
  
  const fetchData = useCallback(() => {
    const { myNotes, sharedNotes } = db.getNotesForUser(user.id);
    setMyNotes(myNotes.sort((a, b) => b.createdAt - a.createdAt));
    setSharedNotes(sharedNotes.sort((a, b) => b.createdAt - a.createdAt));
    setProjects(db.getProjectsForUser(user.id));
    setGroups(db.getGroupsForUser(user.id));
    setAllUsers(db.getAllUsers());
    setCustomTabs(getStoredCustomTabs());
    setGeneralCategories(db.getGeneralCategories(user.id).masterList);
  }, [user.id]);
  
  useEffect(() => {
    const isNewUser = sessionStorage.getItem('isNewUser');
    if (isNewUser) {
      showToast('¡Bienvenido! Completa tu perfil y explora los grupos para empezar a colaborar.');
      sessionStorage.removeItem('isNewUser');
    }
    fetchData();
  }, [fetchData]);

  useReminderNotifications(myNotes);
  
  const handleSaveNote = (noteData: Omit<Note, 'id' | 'createdAt' | 'ownerId' | 'ownerName'>, noteId?: string) => {
    if (noteId) {
        const existingNote = [...myNotes, ...sharedNotes].find(n => n.id === noteId);
        if (existingNote) {
            db.updateNote({ ...existingNote, ...noteData });
        }
    } else {
      db.addNote({ ...noteData, ownerId: user.id, ownerName: user.username });
    }
    fetchData();
    setNoteModalOpen(false);
    setEditingNote(null);
    showToast('Nota guardada con éxito');
  };

  const handleDeleteNote = useCallback((noteId: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar esta nota y todas sus sub-tareas?')) {
        db.deleteNote(noteId);
        fetchData();
        showToast('Nota eliminada', 'error');
    }
  }, [fetchData]);

  const handleEditNote = useCallback((noteOrPartial: Note | Partial<Note>) => {
    setEditingNote(noteOrPartial);
    setNoteModalOpen(true);
  }, []);

  const handleShareNote = useCallback((note: Note) => {
    setSharingNote(note);
    setShareModalOpen(true);
  }, []);


  const handleProcessAI = async (text: string) => {
    if (!text.trim()) return;
    setIsProcessingAI(true);
    const availableCategoryNames = db.getGeneralCategories(user.id).active;
    try {
        const suggestion = await processNaturalLanguageNote(text, availableCategoryNames);
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
  
  const mySharedNotes = useMemo(() => myNotes.filter(note => (note.sharedWith?.users?.length || 0) > 0 || (note.sharedWith?.groups?.length || 0) > 0), [myNotes]);

  const addCustomTab = (tab: Omit<CustomTab, 'id'>) => {
    const newTab = { ...tab, id: Array.isArray(tab.value) ? tab.value.join('+') : tab.value };
    if (customTabs.some(t => t.id === newTab.id)) {
        setActiveTab(customTabs.find(t => t.id === newTab.id)!);
        return;
    }
    const updatedTabs = [...customTabs, newTab];
    setCustomTabs(updatedTabs);
    saveCustomTabs(updatedTabs);
    setActiveTab(newTab);
  }

  const removeCustomTab = (tabId: string) => {
      const updatedTabs = customTabs.filter(t => t.id !== tabId);
      setCustomTabs(updatedTabs);
      saveCustomTabs(updatedTabs);
      if (typeof activeTab !== 'string' && activeTab.id === tabId) {
          setActiveTab('my');
      }
  }

  const filteredNotes = useMemo(() => {
    const allUserNotes = [...myNotes, ...sharedNotes];
    
    // Logic for "Mis Notas": Show any note/task that has at least one general category.
    if (activeTab === 'my') {
      const generalCategoryNames = new Set(generalCategories.map(c => c.name));
      return myNotes.filter(note => note.categories.some(cat => generalCategoryNames.has(cat)));
    }
    if (activeTab === 'myShared') return mySharedNotes;
    if (activeTab === 'shared') return sharedNotes;
    
    if (typeof activeTab !== 'string') {
        if (activeTab.type === 'category') {
            return allUserNotes.filter(n => n.categories.includes(activeTab.value as string));
        }
        if (activeTab.type === 'multi-category') {
            return allUserNotes.filter(n => (activeTab.value as string[]).some(cat => n.categories.includes(cat)));
        }
    }
    return [];
  }, [activeTab, myNotes, sharedNotes, mySharedNotes, generalCategories]);

  const renderNoteList = (notes: Note[]) => {
      if (notes.length === 0 && activeTab === 'my') {
          return <div className="text-center py-16 px-4 bg-surface rounded-lg shadow-sm border border-border-color">
              <h3 className="text-xl font-medium text-text-primary">Tu agenda está vacía</h3>
              <p className="text-text-secondary mt-2">Usa la entrada rápida con IA o el botón "+ Añadir Nota" para empezar.</p>
          </div>;
      }
      if (notes.length === 0) {
          return <div className="text-center py-16 px-4 bg-surface rounded-lg shadow-sm border border-border-color">
              <h3 className="text-xl font-medium text-text-primary">No hay notas que mostrar</h3>
              <p className="text-text-secondary mt-2">No hay notas que coincidan con esta vista.</p>
          </div>;
      }
      return <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {notes.map(note => (
              <NoteItem key={note.id} note={note} currentUser={user}
                  allUsers={allUsers} allGroups={groups}
                  allCategories={generalCategories}
                  projects={projects}
                  viewContext="dashboard"
                  onCategoryClick={(cat) => addCustomTab({name: cat, type: 'category', value: cat})}
                  onEdit={handleEditNote}
                  onShare={handleShareNote}
                  onDelete={handleDeleteNote}
                  fetchData={fetchData} showToast={showToast}
              />
          ))}
      </div>;
  };
  
  const getTabClass = (tabIdentifier: ActiveTab, defaultColor: string) => {
    const isActive = (typeof activeTab !== 'string' && typeof tabIdentifier !== 'string' && activeTab.id === tabIdentifier.id) || activeTab === tabIdentifier;
    let colorClasses = 'border-transparent text-text-secondary hover:text-text-primary hover:border-gray-300';

    if (isActive) {
      let borderColor = defaultColor;
      if (typeof tabIdentifier !== 'string' && (tabIdentifier.type === 'category' || tabIdentifier.type === 'multi-category')) {
          const categoryName = Array.isArray(tabIdentifier.value) ? tabIdentifier.value[0] : tabIdentifier.value as string;
          const appearance = getCategoryAppearance(categoryName, generalCategories);
          borderColor = appearance.border;
      }
      colorClasses = `${borderColor} text-primary font-semibold`;
    }
    return `whitespace-nowrap py-3 px-3 border-b-4 font-medium text-sm transition-colors cursor-pointer ${colorClasses}`;
  }

  return (
    <div className={`flex flex-col min-h-screen`}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <header className={`border-b border-border-color sticky top-0 z-20 bg-surface text-text-primary`}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
                <h1 className={`text-2xl font-bold text-primary`}>Agenda <span className="text-secondary font-extrabold">AI</span></h1>
                <div className="hidden sm:flex items-center space-x-1 p-1 rounded-lg bg-gray-200">
                    <button onClick={() => setViewMode('dashboard')} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${viewMode === 'dashboard' ? 'bg-secondary text-primary shadow' : 'bg-primary text-blue-200 hover:bg-blue-800'}`}>
                        Dashboard
                    </button>
                    <button onClick={() => setViewMode('projects')} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${viewMode === 'projects' ? 'bg-secondary text-primary shadow' : 'bg-primary text-blue-200 hover:bg-blue-800'}`}>
                        Proyectos
                    </button>
                </div>
            </div>
            <div className="flex items-center space-x-1 sm:space-x-2">
               <button onClick={() => setCategoryManagerOpen(true)} className={`p-2 rounded-full transition-colors hover:bg-gray-100`} title="Gestionar todas las categorías">
                 <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-gray-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 8v-3a2 2 0 012-2z" /></svg>
              </button>
              <button onClick={() => setCommandPaletteOpen(true)} className={`p-2 rounded-full transition-colors hover:bg-gray-100`} title="Abrir paleta de comandos (Ctrl+K)">
                 <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-gray-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </button>
              <img src={user.photoB64 || `https://ui-avatars.com/api/?name=${user.username}&background=1e40af&color=fff&font-size=0.5`} alt="Perfil" className="w-9 h-9 rounded-full cursor-pointer object-cover" onClick={() => setProfileModalOpen(true)} />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto flex-grow flex">
       {viewMode === 'dashboard' ? (
        <div className="p-4 sm:p-6 lg:p-8 w-full">
          <div className="flex justify-between items-center mb-4">
             <h2 className="text-2xl font-bold text-text-primary">Dashboard</h2>
             <button onClick={() => handleEditNote({})} className="px-4 py-2 font-semibold text-white transition-colors duration-200 rounded-md bg-primary hover:bg-blue-800">
                + Añadir Nota
             </button>
          </div>

          <div className="border-b border-border-color mb-6">
            <nav className="-mb-px flex space-x-2 sm:space-x-4 overflow-x-auto" aria-label="Tabs">
              <button onClick={() => setActiveTab('my')} className={getTabClass('my', 'border-blue-500')}>Mis Notas</button>
              <button onClick={() => setActiveTab('myShared')} className={getTabClass('myShared', 'border-purple-500')}>Compartidas por mí</button>
              <button onClick={() => setActiveTab('shared')} className={getTabClass('shared', 'border-teal-500')}>Compartidas conmigo</button>
              <div className="border-l border-gray-200 h-6 self-center mx-1 sm:mx-2"></div>
              {customTabs.map(tab => (
                  <div key={tab.id} className={`${getTabClass(tab, 'border-gray-500')} flex items-center group relative`}>
                      <span onClick={() => setActiveTab(tab)} className="pr-5">{tab.name}</span>
                      <button onClick={() => removeCustomTab(tab.id)} className="ml-2 text-gray-400 hover:text-gray-800 absolute right-0 opacity-20 group-hover:opacity-100 transition-opacity">&times;</button>
                  </div>
              ))}
              <button onClick={() => setMultiCategoryModalOpen(true)} className="ml-2 text-gray-400 hover:text-secondary p-2 rounded-full transition-colors self-center">+</button>
            </nav>
          </div>

          <div className="mb-8 relative">
              <input type="text" value={quickNoteText} onChange={e => setQuickNoteText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleProcessAI(quickNoteText)}
                  placeholder="Entrada rápida: 'Reunión marketing mañana 10am'..."
                  disabled={isProcessingAI || isListening}
                  className="w-full pl-4 pr-24 py-3 text-base border-2 border-border-color rounded-full focus:ring-2 focus:ring-secondary focus:border-transparent transition"
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
          {renderNoteList(filteredNotes)}
        </div>
        ) : (
          <ProjectView user={user} notes={[...myNotes, ...sharedNotes]} fetchData={fetchData} showToast={showToast} />
        )}
      </main>
      
      {/* Modals */}
      {isNoteModalOpen && <NoteModal isOpen={isNoteModalOpen} onClose={() => { setNoteModalOpen(false); setEditingNote(null); fetchData(); }} onSave={handleSaveNote} noteToEdit={editingNote} currentUser={user} />}
      {isShareModalOpen && sharingNote && <ShareModal isOpen={isShareModalOpen} onClose={() => { setShareModalOpen(false); setSharingNote(null); }} noteToShare={sharingNote} currentUser={user} showToast={showToast} fetchData={fetchData}/>}
      {isProfileModalOpen && <ProfileModal isOpen={isProfileModalOpen} onClose={() => setProfileModalOpen(false)} currentUser={user} onUserUpdate={refreshUser} showToast={showToast} onLogout={onLogout} onManageCategories={() => setCategoryManagerOpen(true)} />}
      {isMultiCategoryModalOpen && <MultiCategoryTabModal isOpen={isMultiCategoryModalOpen} onClose={() => setMultiCategoryModalOpen(false)} currentUser={user} onSave={addCustomTab} />}
      {isCategoryManagerOpen && <CategoryManagerModal isOpen={isCategoryManagerOpen} onClose={() => setCategoryManagerOpen(false)} currentUser={user} onCategoriesUpdated={fetchData} />}
      {aiSuggestion && <AISuggestionModal isOpen={!!aiSuggestion} onClose={() => setAiSuggestion(null)} suggestion={aiSuggestion}
        onAccept={(noteData) => { db.addNote({ ...noteData, ownerId: user.id, ownerName: user.username }); fetchData(); showToast('Nota creada con IA'); }}
        onEdit={(noteData) => { setEditingNote(noteData); setNoteModalOpen(true); }} />}
      {isCommandPaletteOpen && <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => setCommandPaletteOpen(false)}
            notes={[...myNotes, ...sharedNotes]} projects={projects} groups={groups} categories={db.getGeneralCategories(user.id).active}
            onSelectAction={(action) => {
                if (action.type === 'note') { setViewMode('dashboard'); setEditingNote(action.item); setNoteModalOpen(true); }
                if (action.type === 'project') { setViewMode('projects'); /* TODO: Select project in view */ }
                if (action.type === 'category') { setViewMode('dashboard'); addCustomTab({name: action.item, type: 'category', value: action.item})}
            }}
      />}
    </div>
  );
};

export default Dashboard;
