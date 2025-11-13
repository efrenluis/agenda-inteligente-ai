import React, { useState, useEffect, useMemo } from 'react';
import { Note, Project, Group } from '../db';

type Action = {
    id: string;
    type: 'note' | 'project' | 'group' | 'category' | 'action';
    name: string;
    item?: any;
    icon: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  notes: Note[];
  projects: Project[];
  groups: Group[];
  categories: string[];
  onSelectAction: (action: Action) => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, notes, projects, groups, categories, onSelectAction }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
      if (!isOpen) {
          setSearchTerm('');
          setSelectedIndex(0);
      }
  }, [isOpen]);

  const allActions = useMemo<Action[]>(() => {
    const noteActions: Action[] = notes.map(n => ({ id: n.id, type: 'note', name: n.text, item: n, icon: '📝' }));
    const projectActions: Action[] = projects.map(p => ({ id: p.id, type: 'project', name: `Proyecto: ${p.name}`, item: p, icon: '📂' }));
    const groupActions: Action[] = groups.map(g => ({ id: g.id, type: 'group', name: `Grupo: ${g.name}`, item: g, icon: '👥' }));
    const categoryActions: Action[] = categories.map(c => ({ id: c, type: 'category', name: `Categoría: ${c}`, item: c, icon: '🏷️' }));
    // Could add more static actions here
    return [...noteActions, ...projectActions, ...groupActions, ...categoryActions];
  }, [notes, projects, groups, categories]);
  
  const filteredActions = useMemo(() => {
      if (!searchTerm) return allActions;
      const lowerCaseSearch = searchTerm.toLowerCase();
      return allActions.filter(action => 
          action.name.toLowerCase().includes(lowerCaseSearch) ||
          action.type.toLowerCase().includes(lowerCaseSearch)
      );
  }, [searchTerm, allActions]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (!isOpen) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % (filteredActions.length || 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + (filteredActions.length || 1)) % (filteredActions.length || 1));
        } else if (e.key === 'Enter' && filteredActions[selectedIndex]) {
            e.preventDefault();
            onSelectAction(filteredActions[selectedIndex]);
            onClose();
        } else if (e.key === 'Escape') {
            onClose();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredActions, selectedIndex, onSelectAction, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black bg-opacity-50" onClick={onClose}>
      <div className="bg-surface rounded-lg shadow-xl w-full max-w-2xl m-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <input
          type="text"
          placeholder="Busca notas, proyectos, categorías..."
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setSelectedIndex(0); }}
          className="w-full p-4 text-lg border-b border-gray-200 focus:outline-none"
          autoFocus
        />
        <ul className="max-h-96 overflow-y-auto">
            {filteredActions.length > 0 ? filteredActions.map((action, index) => (
                <li key={action.id + action.type} 
                    className={`p-4 cursor-pointer flex items-center justify-between space-x-3 ${selectedIndex === index ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
                    onClick={() => { onSelectAction(action); onClose(); }}
                    onMouseEnter={() => setSelectedIndex(index)}
                >
                    <div className="flex items-center space-x-3 overflow-hidden">
                      <span className="text-xl">{action.icon}</span>
                      <span className="truncate">{action.name}</span>
                    </div>
                    <span className="text-xs font-semibold text-gray-500 bg-gray-200 px-2 py-1 rounded-md capitalize">{action.type}</span>
                </li>
            )) : (
                <li className="p-6 text-center text-gray-500">No se encontraron resultados.</li>
            )}
        </ul>
      </div>
    </div>
  );
};

export default CommandPalette;