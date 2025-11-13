import React, { useState, useEffect } from 'react';
import { db, Note, PublicUser, Group } from '../db';
import ExternalShareModal from './ExternalShareModal';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  noteToShare: Note;
  currentUser: PublicUser;
  fetchData: () => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, noteToShare, currentUser, fetchData, showToast }) => {
  const [availableUsers, setAvailableUsers] = useState<PublicUser[]>([]);
  const [availableGroups, setAvailableGroups] = useState<Group[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [isExternalShareOpen, setExternalShareOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const allUsers = db.getAllUsers().filter(u => u.id !== currentUser.id);
      const allGroups = db.getGroupsForUser(currentUser.id);
      
      setAvailableUsers(allUsers);
      setAvailableGroups(allGroups);

      setSelectedUserIds(noteToShare.sharedWith?.users || []);
      setSelectedGroupIds(noteToShare.sharedWith?.groups || []);
    }
  }, [isOpen, currentUser.id, noteToShare]);

  const handleToggleUser = (userId: string) => {
    setSelectedUserIds(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
  };

  const handleToggleGroup = (groupId: string) => {
    setSelectedGroupIds(prev => prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]);
  };

  const handleShare = () => {
    db.updateNoteSharing(noteToShare.id, { users: selectedUserIds, groups: selectedGroupIds });
    showToast('Permisos de compartición actualizados');
    fetchData();
    onClose();
  };
  
  if (isExternalShareOpen) {
      return <ExternalShareModal isOpen={true} onClose={() => { setExternalShareOpen(false); onClose(); }} noteToShare={noteToShare} currentUser={currentUser} />
  }

  if (!isOpen) return null;
  
  const companyUsers = availableUsers.filter(u => u.company && u.company === currentUser.company);
  const otherUsers = availableUsers.filter(u => !u.company || u.company !== currentUser.company);


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={onClose}>
      <div className="bg-surface rounded-lg shadow-xl w-full max-w-lg m-4" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-border-color">
          <div className="flex justify-between items-start gap-4">
            <div className="flex-grow">
              <h3 className="text-xl font-semibold text-primary">Compartir Nota</h3>
              <p className="mt-1 text-sm text-text-secondary truncate">
                Compartiendo: <span className="font-medium">{noteToShare.text}</span>
              </p>
            </div>
          </div>
           <div className="mt-4 flex space-x-1 bg-gray-100 p-1 rounded-md">
                <div className="w-full text-center px-3 py-1 text-sm bg-white shadow rounded-md font-semibold text-primary">Interno</div>
                <button onClick={() => setExternalShareOpen(true)} className="w-full text-center px-3 py-1 text-sm hover:bg-gray-200 rounded-md text-text-secondary">Externo</button>
            </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[50vh] overflow-y-auto pr-2">
            <div>
              <h4 className="font-semibold text-text-primary mb-2">Con Personas</h4>
              <div className="space-y-1">
                {companyUsers.length > 0 && <p className="text-xs font-bold text-gray-500 uppercase">En tu compañía</p>}
                {companyUsers.map(user => (
                  <label key={user.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-100 cursor-pointer">
                    <input type="checkbox" checked={selectedUserIds.includes(user.id)} onChange={() => handleToggleUser(user.id)} className="h-4 w-4 text-secondary rounded border-gray-300 focus:ring-secondary" />
                    <span>{user.username}</span>
                  </label>
                ))}
                {otherUsers.length > 0 && <p className="text-xs font-bold text-gray-500 uppercase pt-2">Otros usuarios</p>}
                {otherUsers.map(user => (
                  <label key={user.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-100 cursor-pointer">
                    <input type="checkbox" checked={selectedUserIds.includes(user.id)} onChange={() => handleToggleUser(user.id)} className="h-4 w-4 text-secondary rounded border-gray-300 focus:ring-secondary" />
                    <span>{user.username}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-text-primary mb-2">Con Grupos</h4>
              <div className="space-y-1">
                {availableGroups.length > 0 ? availableGroups.map(group => (
                  <label key={group.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-100 cursor-pointer">
                    <input type="checkbox" checked={selectedGroupIds.includes(group.id)} onChange={() => handleToggleGroup(group.id)} className="h-4 w-4 text-secondary rounded border-gray-300 focus:ring-secondary" />
                    <span>{group.name}</span>
                  </label>
                )) : <p className="text-sm text-gray-500">No perteneces a ningún grupo.</p>}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end p-4 space-x-2 bg-gray-50 border-t border-border-color">
          <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">
            Cancelar
          </button>
          <button onClick={handleShare} className="px-4 py-2 text-white rounded-md bg-primary hover:bg-blue-800">
            Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;