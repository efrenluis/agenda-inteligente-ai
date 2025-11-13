import React, { useState, useEffect, useMemo } from 'react';
import { db, PublicUser, Group } from '../db';

interface GroupManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: PublicUser;
}

type GroupView = 'my-groups' | 'discover';

const GroupManagerModal: React.FC<GroupManagerModalProps> = ({ isOpen, onClose, currentUser }) => {
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [view, setView] = useState<GroupView>('my-groups');
  
  const allUsers = useMemo(() => db.getAllUsers(), [isOpen]);

  const fetchData = () => {
    setUserGroups(db.getGroupsForUser(currentUser.id));
    setAllGroups(db.getAllGroups());
    // Reselect to get fresh data if a group is selected
    if (selectedGroup) {
      setSelectedGroup(db.getAllGroups().find(g => g.id === selectedGroup.id) || null);
    }
  };
  
  useEffect(() => {
    if (isOpen) {
      fetchData();
      setView('my-groups');
    } else {
      setSelectedGroup(null);
      setNewGroupName('');
    }
  }, [isOpen, currentUser.id]);
  
  const handleCreateGroup = () => {
      if (!newGroupName.trim()) return;
      db.createGroup(newGroupName.trim(), currentUser.id);
      fetchData();
      setNewGroupName('');
      setView('my-groups');
  };

  const handleToggleMemberRole = (userId: string) => {
      if (!selectedGroup || selectedGroup.ownerId !== currentUser.id || selectedGroup.ownerId === userId) return;
      const memberIndex = selectedGroup.members.findIndex(m => m.userId === userId);
      if (memberIndex === -1) return;
      
      const updatedMembers = [...selectedGroup.members];
      updatedMembers[memberIndex].role = updatedMembers[memberIndex].role === 'admin' ? 'member' : 'admin';
      
      const updatedGroup = { ...selectedGroup, members: updatedMembers };
      db.updateGroup(updatedGroup);
      fetchData();
  }

  const handleRequest = (userId: string, approve: boolean) => {
      if (!selectedGroup) return;
      const isAdmin = selectedGroup.members.some(m => m.userId === currentUser.id && m.role === 'admin');
      if (!isAdmin) return;

      const updatedGroup = { ...selectedGroup };
      updatedGroup.pendingMemberIds = (updatedGroup.pendingMemberIds || []).filter(id => id !== userId);
      if (approve) {
          updatedGroup.members = [...updatedGroup.members, {userId, role: 'member'}];
      }
      db.updateGroup(updatedGroup);
      fetchData();
  }
  
  const handleRequestToJoin = (groupId: string) => {
    db.requestToJoinGroup(groupId, currentUser.id);
    alert('Solicitud enviada!');
    fetchData();
  };


  const handleDeleteGroup = () => {
      if (!selectedGroup || selectedGroup.ownerId !== currentUser.id) return;
      if (window.confirm(`¿Seguro que quieres eliminar el grupo "${selectedGroup.name}"? Esta acción no se puede deshacer.`)) {
          db.deleteGroup(selectedGroup.id);
          fetchData();
          setSelectedGroup(null);
      }
  }

  if (!isOpen) return null;
  
  const pendingUsers = (selectedGroup?.pendingMemberIds || []).map(id => allUsers.find(u => u.id === id)).filter(Boolean) as PublicUser[];
  const isCurrentUserAdmin = selectedGroup?.members.some(m => m.userId === currentUser.id && m.role === 'admin') ?? false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={onClose}>
      <div className="bg-surface rounded-lg shadow-xl w-full max-w-3xl m-4 h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-border-color flex justify-between items-center">
          <h3 className="text-xl font-semibold text-primary">Gestionar Grupos</h3>
          <div className="flex space-x-1 bg-gray-200 p-1 rounded-md">
            <button onClick={() => setView('my-groups')} className={`px-3 py-1 text-sm rounded-md ${view === 'my-groups' ? 'bg-white shadow' : ''}`}>Mis Grupos</button>
            <button onClick={() => setView('discover')} className={`px-3 py-1 text-sm rounded-md ${view === 'discover' ? 'bg-white shadow' : ''}`}>Descubrir</button>
          </div>
        </div>
        <div className="flex-grow flex overflow-hidden">
            <div className="w-1/3 border-r border-border-color p-4 overflow-y-auto">
                <h4 className="font-semibold text-text-primary mb-2">{view === 'my-groups' ? 'Mis Grupos' : 'Todos los Grupos'}</h4>
                <div className="space-y-2">
                    {(view === 'my-groups' ? userGroups : allGroups).map(group => (
                        <button key={group.id} onClick={() => setSelectedGroup(group)} className={`w-full text-left p-2 rounded-md ${selectedGroup?.id === group.id ? 'bg-blue-100 text-primary' : 'hover:bg-gray-100'}`}>
                            {group.name}
                        </button>
                    ))}
                </div>
                 {view === 'my-groups' && (
                    <div className="mt-4 pt-4 border-t border-border-color">
                        <input type="text" placeholder="Nuevo grupo..." value={newGroupName} onChange={e => setNewGroupName(e.target.value)} className="w-full p-2 border border-border-color rounded-md" onKeyDown={e => e.key === 'Enter' && handleCreateGroup()}/>
                        <button onClick={handleCreateGroup} className="w-full mt-2 px-4 py-2 text-white bg-secondary rounded-md">Crear Grupo</button>
                    </div>
                )}
            </div>
            <div className="w-2/3 p-6 overflow-y-auto">
                {selectedGroup ? (
                    <div>
                        <div className="flex justify-between items-center">
                            <h4 className="text-lg font-bold">{selectedGroup.name}</h4>
                             {selectedGroup.ownerId === currentUser.id && (
                                <button onClick={handleDeleteGroup} className="text-sm text-red-600 hover:underline">Eliminar Grupo</button>
                            )}
                        </div>
                        <p className="text-sm text-gray-500">Propietario: {allUsers.find(u=>u.id === selectedGroup.ownerId)?.username}</p>
                        
                        {!userGroups.some(ug => ug.id === selectedGroup.id) && (
                            <button onClick={() => handleRequestToJoin(selectedGroup.id)} className="mt-4 w-full px-4 py-2 text-white bg-green-600 rounded-md">
                                Unirse al Grupo
                            </button>
                        )}
                        
                        {isCurrentUserAdmin && pendingUsers.length > 0 && (
                            <div className="mt-6">
                                <h5 className="font-semibold mb-2">Solicitudes Pendientes</h5>
                                <div className="space-y-2 p-3 bg-amber-50 rounded-md border border-amber-200">
                                    {pendingUsers.map(user => (
                                        <div key={user.id} className="flex justify-between items-center">
                                            <span>{user.username}</span>
                                            <div className="space-x-2">
                                                <button onClick={() => handleRequest(user.id, true)} className="text-sm px-2 py-1 bg-green-100 text-green-700 rounded-md">Aprobar</button>
                                                <button onClick={() => handleRequest(user.id, false)} className="text-sm px-2 py-1 bg-red-100 text-red-700 rounded-md">Rechazar</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="mt-6">
                            <h5 className="font-semibold mb-2">Miembros ({selectedGroup.members.length})</h5>
                            <div className="space-y-1">
                                {selectedGroup.members.map(member => {
                                    const user = allUsers.find(u => u.id === member.userId);
                                    if (!user) return null;
                                    return (
                                        <div key={user.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-md">
                                            <span>{user.username} {user.company && `(${user.company})`} - <span className="text-xs font-semibold text-gray-500">{member.role}</span></span>
                                            {isCurrentUserAdmin && currentUser.id !== user.id && (
                                                <button onClick={() => handleToggleMemberRole(user.id)} className="text-xs px-2 py-1 bg-gray-200 rounded-md">
                                                    {member.role === 'admin' ? 'Degradar' : 'Ascender'}
                                                </button>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        <p>Selecciona un grupo para ver sus detalles o crea uno nuevo.</p>
                    </div>
                )}
            </div>
        </div>
        <div className="flex justify-end p-4 space-x-2 bg-gray-50 border-t border-border-color">
          <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupManagerModal;
