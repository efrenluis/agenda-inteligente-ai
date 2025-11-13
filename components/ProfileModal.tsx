import React, { useState } from 'react';
import { db, PublicUser } from '../db';
import GroupManagerModal from './GroupManagerModal';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: PublicUser;
  onUserUpdate: (user: PublicUser) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
  onLogout: () => void;
  onManageCategories: () => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, currentUser, onUserUpdate, showToast, onLogout, onManageCategories }) => {
  const [username, setUsername] = useState(currentUser.username);
  const [company, setCompany] = useState(currentUser.company || '');
  const [photoB64, setPhotoB64] = useState(currentUser.photoB64);
  const [email, setEmail] = useState(currentUser.email || '');
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [error, setError] = useState('');
  
  const [isGroupManagerOpen, setGroupManagerOpen] = useState(false);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
          setError('La imagen es demasiado grande (máx 2MB).');
          return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoB64(reader.result as string);
        setError('');
      };
      reader.onerror = () => setError('No se pudo leer la imagen.');
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username.trim()) {
      setError('El nombre de usuario no puede estar vacío.');
      return;
    }

    const trimmedCompany = company.trim();
    if (trimmedCompany && trimmedCompany !== currentUser.company) {
        const existingGroup = db.getAllGroups().find(g => g.name.toLowerCase() === trimmedCompany.toLowerCase());
        if (existingGroup) {
            db.requestToJoinGroup(existingGroup.id, currentUser.id);
            showToast(`Solicitud enviada para unirte a ${existingGroup.name}`);
        } else {
            db.createGroup(trimmedCompany, currentUser.id);
            showToast(`Nuevo grupo "${trimmedCompany}" creado`);
        }
    }

    const updatedUser = db.updateUser({ ...currentUser, username, company: trimmedCompany || undefined, photoB64, email: email.trim() || undefined, phone: phone.trim() || undefined });

    if (updatedUser) {
      onUserUpdate(updatedUser);
      showToast('Perfil actualizado con éxito');
      onClose();
    } else {
        setError('No se pudo actualizar el perfil.');
    }
  };

  if (!isOpen) return null;

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={onClose}>
      <div className="bg-surface rounded-lg shadow-xl w-full max-w-md m-4" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <h3 className="text-xl font-semibold text-primary">Tu Perfil</h3>
            
            <div className="flex items-center space-x-4">
              <img src={photoB64 || `https://ui-avatars.com/api/?name=${username}&background=1e40af&color=fff&font-size=0.5`} alt="Avatar" className="w-20 h-20 rounded-full object-cover" />
              <div>
                <label htmlFor="photo-upload" className="cursor-pointer px-3 py-1.5 text-sm font-medium text-primary bg-blue-100 rounded-md hover:bg-blue-200 transition-colors">
                  Cambiar foto
                </label>
                <input id="photo-upload" type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
              </div>
            </div>

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">Nombre de usuario</label>
              <input type="text" id="username" value={username} onChange={e => setUsername(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-border-color focus:outline-none focus:ring-secondary focus:border-secondary sm:text-sm rounded-md" required />
            </div>

            <div>
              <label htmlFor="company" className="block text-sm font-medium text-gray-700">Compañía / Grupo</label>
              <input type="text" id="company" value={company} onChange={e => setCompany(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-border-color focus:outline-none focus:ring-secondary focus:border-secondary sm:text-sm rounded-md" />
            </div>

             <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
              <input type="email" id="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-border-color focus:outline-none focus:ring-secondary focus:border-secondary sm:text-sm rounded-md" />
            </div>

             <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Teléfono</label>
              <input type="tel" id="phone" value={phone} onChange={e => setPhone(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-border-color focus:outline-none focus:ring-secondary focus:border-secondary sm:text-sm rounded-md" />
            </div>

            <div className="pt-2">
                <button type="button" onClick={() => { onClose(); setGroupManagerOpen(true); }} className="w-full text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-md text-sm font-medium text-text-primary transition-colors">Gestionar Grupos</button>
            </div>

            {error && <p className="text-sm text-center text-red-600">{error}</p>}
          </div>
          <div className="flex justify-between p-4 bg-gray-50 border-t border-border-color">
            <button type="button" onClick={onLogout} className="px-4 py-2 text-sm text-red-700 bg-red-100 rounded-md hover:bg-red-200">
              Cerrar Sesión
            </button>
            <div className="space-x-2">
                <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 text-white rounded-md bg-primary hover:bg-blue-800">
                  Guardar Cambios
                </button>
            </div>
          </div>
        </form>
      </div>
    </div>
    
    {isGroupManagerOpen && <GroupManagerModal isOpen={isGroupManagerOpen} onClose={() => setGroupManagerOpen(false)} currentUser={currentUser} />}
    </>
  );
};

export default ProfileModal;
