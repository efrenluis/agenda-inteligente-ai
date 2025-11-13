import React, { useState } from 'react';
import { db, Note, PublicUser, Group, Attachment, Category, Project } from '../db';
import { generateNoteDescription } from '../services/geminiService';

interface NoteItemProps {
  note: Note;
  currentUser: PublicUser;
  onEdit: (noteOrPartial: Note | Partial<Note>) => void;
  onShare: (note: Note) => void;
  onDelete: (noteId: string) => void;
  onCategoryClick: (category: string) => void;
  fetchData: () => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
  allUsers: PublicUser[];
  allGroups: Group[];
  allCategories: Category[]; // Can be general or project specific
  projects?: Project[]; 
  viewContext: 'dashboard' | 'project';
  contextProjectId?: string;
}

export const getCategoryAppearance = (categoryName: string | undefined, allCategories: Category[]) => {
  const defaultAppearance = { 
    cardBg: 'bg-gray-100', 
    pillBg: 'bg-gray-200', 
    pillText: 'text-gray-700', 
    border: 'border-gray-400',
  };
  if (!categoryName) return defaultAppearance;
  
  const category = allCategories.find(c => c.name === categoryName);
  const colorName = category?.color || 'cat-sky'; // Fallback color
  const colorShade = colorName.split('-')[1];

  return { 
      cardBg: `bg-${colorShade}-100`,
      pillBg: `bg-white`, 
      pillText: `text-${colorShade}-700`,
      border: `border-${colorShade}-500`,
  };
};

const CategoryPill: React.FC<{ 
  categoryName: string, 
  allCategoriesInView: Category[], 
  isClickable: boolean,
  onCategoryClick: (category: string) => void 
}> = ({ categoryName, allCategoriesInView, isClickable, onCategoryClick }) => {
  const { pillText, border } = getCategoryAppearance(categoryName, allCategoriesInView);
  
  const baseClasses = `inline-block px-2.5 py-1 text-xs font-semibold rounded-full bg-white border ${border} ${pillText}`;
  const interactiveClasses = isClickable ? 'transition-transform hover:scale-105 cursor-pointer' : 'cursor-default opacity-80';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isClickable) {
      onCategoryClick(categoryName);
    }
  };

  return (
    <button onClick={handleClick} disabled={!isClickable} className={`${baseClasses} ${interactiveClasses}`}>
      {categoryName}
    </button>
  );
};

const AttachmentPill: React.FC<{ attachment: Attachment }> = ({ attachment }) => {
    const isLink = attachment.type === 'link';
    const Icon = isLink ? '🔗' : '📎';
    
    return (
        <a href={attachment.content} target="_blank" rel="noopener noreferrer" 
           className="inline-flex items-center space-x-2 px-2.5 py-1 text-xs font-medium text-gray-700 bg-gray-200 rounded-full hover:bg-gray-300 transition-colors">
            <span>{Icon}</span>
            <span className="truncate max-w-xs">{attachment.name}</span>
        </a>
    );
};

const NoteItem: React.FC<NoteItemProps> = ({ note, currentUser, onEdit, onShare, onDelete, onCategoryClick, fetchData, showToast, allUsers, allGroups, allCategories, projects, viewContext, contextProjectId }) => {
  const isOwner = note.ownerId === currentUser.id;
  const type = (note.projectIds && note.projectIds.length > 0) ? 'task' : 'note';

  const mainCategoryName = note.categories[0];
  const { cardBg, border } = getCategoryAppearance(mainCategoryName, allCategories);
  
  const generalCategories = db.getGeneralCategories(currentUser.id).masterList;

  const finalCardBg = note.isCompleted ? 'bg-gray-100 opacity-70' : cardBg;
  const textStyle = note.isCompleted ? 'line-through text-gray-500' : 'text-text-primary';
  
  const isShared = (note.sharedWith?.users?.length || 0) > 0 || (note.sharedWith?.groups?.length || 0) > 0;
  
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(note.id);
  };
  
   const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(note);
  };

  const handleShareClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onShare(note);
  };

  const handleToggleComplete = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (isOwner || !note.isCompleted) {
        db.updateNote({ ...note, isCompleted: !note.isCompleted });
        fetchData();
    }
  };

  const handleGenerateDescription = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsGeneratingDesc(true);
    const description = await generateNoteDescription(note.text);
    if (description) {
        db.updateNote({ ...note, description });
        fetchData();
        showToast('Descripción generada por IA');
    } else {
        showToast('No se pudo generar la descripción', 'error');
    }
    setIsGeneratingDesc(false);
  };

  const getShareInfo = () => {
      const userNames = note.sharedWith.users.map(uid => allUsers.find(u => u.id === uid)?.username).filter(Boolean);
      const groupNames = note.sharedWith.groups.map(gid => allGroups.find(g => g.id === gid)?.name).filter(Boolean);
      const allNames = [...userNames, ...groupNames];
      if(allNames.length > 2) {
          return `${allNames.slice(0, 2).join(', ')} y ${allNames.length - 2} más`;
      }
      return allNames.join(', ');
  }

  const projectPills = (note.projectIds || [])
    .map(pid => projects?.find(p => p.id === pid))
    .filter((p): p is Project => !!p);


  return (
    <div className={`rounded-lg shadow-md overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 flex flex-col ${finalCardBg} border-l-4 ${border}`}>
      <div className="p-5 flex-grow">
         <div className="flex justify-between items-start mb-2">
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <span title={type === 'task' ? 'Tarea de Proyecto' : 'Nota General'} className="text-sm font-bold text-gray-500">
                  {type === 'task' ? '○' : '●'}
                </span>
                {viewContext === 'dashboard' && projectPills.length > 0 ? projectPills.map(p => (
                    <div key={p.id} className="flex items-center space-x-1 bg-white px-2 py-0.5 rounded-full border border-gray-200">
                        <span className={`w-2 h-2 rounded-full bg-${p.color.split('-')[1]}-500`}></span>
                        <span className="text-xs font-semibold text-gray-600">{p.name}</span>
                    </div>
                )) : null}
            </div>
            <input
              type="checkbox"
              checked={note.isCompleted}
              onChange={handleToggleComplete}
              className="w-5 h-5 ml-4 text-secondary border-gray-300 rounded focus:ring-secondary cursor-pointer"
            />
        </div>

        <p className={`flex-1 text-base font-medium break-words ${textStyle}`}>{note.text}</p>
        
        {note.description ? (
            <p className="mt-2 text-sm text-gray-600 italic border-l-2 border-gray-300 pl-2">
                {note.description}
            </p>
        ) : null}

        {!isOwner && (
          <p className="mt-2 text-sm text-text-secondary">
            De: <span className="font-semibold">{note.ownerName}</span>
          </p>
        )}
        
        {(isShared || note.date || note.time || note.location || (note.attachments && note.attachments.length > 0)) && <div className="border-t my-3 border-black/10"></div>}
        
        {isShared && (
            <div className="text-sm text-text-secondary flex items-center space-x-2">
                <span>🤝</span>
                <span className="truncate">Compartido con: {getShareInfo()}</span>
            </div>
        )}
        {(note.date || note.time) && (
            <div className="text-sm text-text-secondary flex items-center space-x-2 mt-2">
                <span>📅</span>
                <span>{note.date} {note.time && `@ ${note.time}`}</span>
            </div>
        )}
        {note.location && (
            <div className="mt-2 text-sm text-text-secondary flex items-center space-x-2">
                <span>📍</span>
                <span>{note.location}</span>
            </div>
        )}
        
        {note.attachments && note.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
                {note.attachments.map(att => <AttachmentPill key={att.id} attachment={att} />)}
            </div>
        )}

        {note.categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {note.categories.map(catName => {
              let isClickable = false;
              if (viewContext === 'dashboard') {
                isClickable = generalCategories.some(gc => gc.name === catName);
              } else if (viewContext === 'project' && contextProjectId) {
                const project = projects?.find(p => p.id === contextProjectId);
                isClickable = project?.categories.masterList.some(pc => pc.name === catName) ?? false;
              }
              return (
                <CategoryPill 
                  key={catName} 
                  categoryName={catName} 
                  allCategoriesInView={allCategories} 
                  onCategoryClick={onCategoryClick}
                  isClickable={isClickable}
                />
              )
            })}
          </div>
        )}
      </div>

      <div className="flex justify-end p-2 space-x-2 bg-black/5 border-t border-black/5">
        {type === 'task' && isOwner && !note.description && (
            <button onClick={handleGenerateDescription} disabled={isGeneratingDesc} className="px-3 py-1 text-sm font-medium text-purple-700 bg-purple-100 rounded-md hover:bg-purple-200 disabled:opacity-50 transition-colors">
                {isGeneratingDesc ? '...' : '✨'}
            </button>
        )}
        <button onClick={handleEditClick} className="px-3 py-1 text-sm font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors">
            {isOwner ? 'Editar' : 'Ver'}
        </button>
        {isOwner && (
          <>
            <button onClick={handleShareClick} className="px-3 py-1 text-sm font-medium text-green-700 bg-green-100 rounded-md hover:bg-green-200 transition-colors">
                Compartir
            </button>
            <button onClick={handleDeleteClick} className="px-3 py-1 text-sm font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200 transition-colors">
                Eliminar
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default NoteItem;
