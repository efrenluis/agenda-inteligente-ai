/**
 * db.ts — Single-file listo para Google AI Studio Build
 * Incluye tipos y una implementación de almacenamiento con soporte para
 * Usuarios, Notas (con jerarquía), Proyectos (con color y pestañas) y Grupos (con solicitudes y roles).
 */

//// ====================== Tipos ======================

export interface User {
  id: string;
  username: string;
  password: string;
  company?: string;
  photoB64?: string;
  email?: string;
  phone?: string;
}

export type PublicUser = Omit<User, 'password'>;

export interface Attachment {
  id: string;
  type: 'link' | 'file';
  name: string;
  content: string; // URL for links, data URL (base64) for files
}

export interface Note {
  id: string;
  text: string;
  description?: string;
  attachments?: Attachment[];
  isCompleted: boolean;
  createdAt: number;
  date?: string;
  time?: string;
  location?: string;
  reminder?: number;
  categories: string[]; // Nombres de categorías
  ownerId: string;
  ownerName: string;
  sharedWith: {
    users: string[]; // ids de usuarios
    groups: string[]; // ids de grupos
  };
  projectIds?: string[]; // CHANGE: Now an array to support multi-project association
  parentId?: string; // para anidar notas
}

export interface GroupMember {
    userId: string;
    role: 'admin' | 'member';
}
export interface Group {
    id: string;
    name: string;
    ownerId: string;
    members: GroupMember[];
    pendingMemberIds?: string[];
}

export interface Category {
    name: string;
    color: string; // e.g., 'cat-sky'
}
export interface CategorySettings {
    masterList: Category[];
    active: string[]; // array of category names
}

export interface Project {
    id: string;
    name: string;
    description?: string;
    ownerId: string;
    color: string;
    tabs: CustomTab[];
    categories: CategorySettings;
}

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

//// ====================== Claves ======================

const USERS_KEY = 'agenda_users';
const NOTES_KEY = 'agenda_notes';
const GROUPS_KEY = 'agenda_groups';
const PROJECTS_KEY = 'agenda_projects';
const SESSION_KEY = 'agenda_session';
const USER_CATEGORIES_KEY = 'agenda_user_categories';
const CUSTOM_TABS_KEY = 'agenda_custom_tabs';

//// ====================== Fallbacks entorno ======================

const memoryStore = new Map<string, string>();
const memoryStorage: StorageLike = {
  getItem: (k) => (memoryStore.has(k) ? memoryStore.get(k)! : null),
  setItem: (k, v) => { memoryStore.set(k, v); },
  removeItem: (k) => { memoryStore.delete(k); },
};

const storage: StorageLike = (() => {
  try {
    const ls = (globalThis as any)?.localStorage;
    if (ls && typeof ls.getItem === 'function' && typeof ls.setItem === 'function') {
      return ls as StorageLike;
    }
  } catch { /* ignore */ }
  console.warn('localStorage not found, using in-memory fallback.');
  return memoryStorage;
})();

export const uuid = () =>
  (typeof (globalThis as any)?.crypto !== 'undefined' &&
   typeof (globalThis as any).crypto.randomUUID === 'function')
    ? (globalThis as any).crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

//// ====================== Constantes/Tipos extra ======================
export const PALETTE_COLORS = [
  'cat-sky', 'cat-green', 'cat-amber', 'cat-indigo', 'cat-rose', 'cat-teal', 
  'cat-fuchsia', 'cat-lime', 'cat-cyan', 'cat-violet', 'cat-red', 'cat-orange',
  'cat-yellow', 'cat-emerald', 'cat-blue', 'cat-purple', 'cat-pink'
];
const stringToHash = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
};
const PREDEFINED_CATEGORIES: Category[] = [
    { name: 'Trabajo', color: 'cat-sky' }, { name: 'Personal', color: 'cat-green' },
    { name: 'Hogar', color: 'cat-amber' }, { name: 'Estudios', color: 'cat-indigo' },
    { name: 'Salud', color: 'cat-rose' }, { name: 'Compras', color: 'cat-teal' },
    { name: 'Ocio', color: 'cat-lime' }, { name: 'Urgente', color: 'cat-red' },
    { name: 'Idea', color: 'cat-violet' },
];

export const PROJECT_COLORS = PALETTE_COLORS;

type UserGeneralCategories = Record<string, CategorySettings>;
export type CustomTab = { 
  id: string; 
  name: string; 
  type: 'category' | 'multi-category' | 'project-category' | 'project-multi-category'; 
  value: string | string[];
};

//// ====================== Migración & Helpers de Almacenamiento ======================

// Migra una estructura de categorías antigua (string[]) a la nueva (CategorySettings)
const migrateCategories = (oldCategories: any): CategorySettings => {
    if (Array.isArray(oldCategories) && typeof oldCategories[0] === 'string') {
        // Estructura antigua: solo un array de strings (la 'masterList')
        const masterList: Category[] = oldCategories.map((catName: string) => {
            const predefined = PREDEFINED_CATEGORIES.find(p => p.name === catName);
            return {
                name: catName,
                color: predefined?.color || PALETTE_COLORS[stringToHash(catName) % PALETTE_COLORS.length]
            };
        });
        return { masterList, active: masterList.map(c => c.name) };
    }
    // Si ya es una estructura `CategorySettings` pero `masterList` es de strings
    if (oldCategories && oldCategories.masterList && typeof oldCategories.masterList[0] === 'string') {
        const masterList: Category[] = oldCategories.masterList.map((catName: string) => {
            const predefined = PREDEFINED_CATEGORIES.find(p => p.name === catName);
            return {
                name: catName,
                color: predefined?.color || PALETTE_COLORS[stringToHash(catName) % PALETTE_COLORS.length]
            };
        });
        return { masterList, active: oldCategories.active || masterList.map(c => c.name) };
    }
    // Si ya tiene el formato correcto o es inválido, devolver como está (o un default)
    return oldCategories && Array.isArray(oldCategories.masterList) ? oldCategories : { masterList: [], active: [] };
};

const getFromStorage = <T>(key: string, validator: (item: any) => item is T): T[] => {
    try {
        const json = storage.getItem(key);
        if (!json) return [];
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed)) {
            // Migration for projectId -> projectIds
            if (key === NOTES_KEY) {
                return parsed.map(note => {
                    if (note.projectId && !note.projectIds) {
                        note.projectIds = [note.projectId];
                        delete note.projectId;
                    }
                    return note;
                }).filter(validator);
            }
            return parsed.filter(validator);
        }
        storage.removeItem(key);
        return [];
    } catch (e) {
        console.error(`Failed to parse ${key} from storage`, e);
        storage.removeItem(key);
        return [];
    }
};

const saveToStorage = (key: string, data: any) => {
    try {
        storage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.error(`Failed to save ${key}`, e);
    }
};

const getStoredUsers = (): User[] => getFromStorage(USERS_KEY, (u): u is User => u && typeof u === 'object' && typeof u.id === 'string' && typeof u.username === 'string' && typeof u.password === 'string');
const getStoredNotes = (): Note[] => getFromStorage(NOTES_KEY, (n): n is Note => n && typeof n === 'object' && typeof n.id === 'string' && typeof n.text === 'string');
const getStoredGroups = (): Group[] => getFromStorage(GROUPS_KEY, (g): g is Group => g && typeof g === 'object' && typeof g.id === 'string' && typeof g.name === 'string');
const getStoredProjects = (): Project[] => getFromStorage(PROJECTS_KEY, (p): p is Project => p && typeof p === 'object' && typeof p.id === 'string' && typeof p.name === 'string');

const getStoredUserCategories = (): UserGeneralCategories => { try { const r = storage.getItem(USER_CATEGORIES_KEY); return r ? JSON.parse(r) : {}; } catch { return {}; } };
export const getStoredCustomTabs = (): CustomTab[] => { try { const r = storage.getItem(CUSTOM_TABS_KEY); return r ? JSON.parse(r) : []; } catch { return []; } };

const saveUsers = (data: User[]) => saveToStorage(USERS_KEY, data);
const saveNotes = (data: Note[]) => saveToStorage(NOTES_KEY, data);
const saveGroups = (data: Group[]) => saveToStorage(GROUPS_KEY, data);
const saveProjects = (data: Project[]) => saveToStorage(PROJECTS_KEY, data);
const saveUserCategories = (data: UserGeneralCategories) => saveToStorage(USER_CATEGORIES_KEY, data);
export const saveCustomTabs = (data: CustomTab[]) => saveToStorage(CUSTOM_TABS_KEY, data);


//// ====================== API pública ======================

export const db = {
  // --- Auth & User ---
  register(username: string, password_plaintext: string): PublicUser | null {
    const users = getStoredUsers();
    if (users.find(u => u.username === username)) return null;

    // Email, phone, company are now added/managed via the user profile, not at registration.
    const newUser: User = { id: uuid(), username, password: password_plaintext };
    const defaultCats: CategorySettings = { masterList: PREDEFINED_CATEGORIES, active: PREDEFINED_CATEGORIES.map(c => c.name) };
    this.saveGeneralCategories(newUser.id, defaultCats);
    
    saveUsers([...users, newUser]);
    const { password, ...userForSession } = newUser;
    return userForSession;
  },

  login(username: string, password_plaintext: string): PublicUser | null {
    const user = getStoredUsers().find(u => u.username === username && u.password === password_plaintext);
    if (!user) return null;
    const { password, ...userForSession } = user;
    storage.setItem(SESSION_KEY, JSON.stringify(userForSession));
    return userForSession;
  },

  logout: () => storage.removeItem(SESSION_KEY),

  getCurrentUser(): PublicUser | null {
    try {
      const userJson = storage.getItem(SESSION_KEY);
      if (!userJson) return null;
      const user = JSON.parse(userJson);
      const fullUser = getStoredUsers().find(u => u.id === user.id);
      if (!fullUser) {
        storage.removeItem(SESSION_KEY);
        return null;
      }
      const { password, ...publicUser } = fullUser;
      return publicUser;
    } catch {
      storage.removeItem(SESSION_KEY);
      return null;
    }
  },
  
  updateUser(updatedUser: PublicUser): PublicUser | null {
      const users = getStoredUsers();
      const userIndex = users.findIndex(u => u.id === updatedUser.id);
      if (userIndex === -1) return null;
      
      const fullUser = { ...users[userIndex], ...updatedUser };
      users[userIndex] = fullUser;
      saveUsers(users);
      
      const { password, ...userForSession } = fullUser;
      storage.setItem(SESSION_KEY, JSON.stringify(userForSession));
      return userForSession;
  },

  getAllUsers: (): PublicUser[] => getStoredUsers().map(({ password, ...rest }) => rest),

  // --- Notes ---
  getNotesForUser(userId: string): { myNotes: Note[]; sharedNotes: Note[] } {
    const allNotes = getStoredNotes();
    const userGroups = this.getGroupsForUser(userId).map(g => g.id);

    const myNotes = allNotes.filter(n => n.ownerId === userId);
    const sharedNotes = allNotes.filter(n => 
        n.ownerId !== userId && (
            (n.sharedWith?.users || []).includes(userId) ||
            (n.sharedWith?.groups || []).some(groupId => userGroups.includes(groupId))
        )
    );
    return { myNotes, sharedNotes };
  },

  addNote(noteData: Omit<Note, 'id' | 'createdAt'>): Note {
    const allNotes = getStoredNotes();
    const newNote: Note = {
      id: uuid(),
      createdAt: Date.now(),
      ...noteData,
      sharedWith: noteData.sharedWith || { users: [], groups: [] },
    };
    saveNotes([...allNotes, newNote]);
    return newNote;
  },

  updateNote(updatedNote: Note): void {
    const allNotes = getStoredNotes();
    const idx = allNotes.findIndex(n => n.id === updatedNote.id);
    if (idx !== -1) {
      allNotes[idx] = updatedNote;
      saveNotes(allNotes);
    }
  },

  deleteNote(noteId: string): void {
    let allNotes = getStoredNotes();
    
    const idsToDelete = new Set<string>();
    const queue: string[] = [noteId];
    idsToDelete.add(noteId);

    // Build a map of parent-child relationships for efficient traversal
    const childrenMap = new Map<string, string[]>();
    allNotes.forEach(n => {
        if (n.parentId) {
            if (!childrenMap.has(n.parentId)) {
                childrenMap.set(n.parentId, []);
            }
            childrenMap.get(n.parentId)!.push(n.id);
        }
    });

    // Traverse the hierarchy to find all notes to delete
    while (queue.length > 0) {
        const currentId = queue.shift()!;
        const children = childrenMap.get(currentId);
        if (children) {
            for (const childId of children) {
                if (!idsToDelete.has(childId)) {
                    idsToDelete.add(childId);
                    queue.push(childId);
                }
            }
        }
    }
    
    const remainingNotes = allNotes.filter(n => !idsToDelete.has(n.id));
    saveNotes(remainingNotes);
  },

  updateNoteSharing(noteId: string, sharingData: { users: string[], groups: string[] }): Note | null {
    const allNotes = getStoredNotes();
    const idx = allNotes.findIndex(n => n.id === noteId);
    if (idx === -1) return null;
    allNotes[idx].sharedWith = sharingData;
    saveNotes(allNotes);
    return allNotes[idx];
  },

  // --- Categories ---
  deleteCategory(userId: string, categoryName: string, projectId?: string): void {
    // 1. Update the master list
    if (projectId) {
        const project = this.getProjectsForUser(userId).find(p => p.id === projectId);
        if (project) {
            const updatedSettings = {
                masterList: project.categories.masterList.filter(c => c.name !== categoryName),
                active: project.categories.active.filter(c => c !== categoryName)
            };
            this.updateProject({ ...project, categories: updatedSettings });
        }
    } else {
        const generalCategories = this.getGeneralCategories(userId);
        const updatedSettings = {
            masterList: generalCategories.masterList.filter(c => c.name !== categoryName),
            active: generalCategories.active.filter(c => c !== categoryName)
        };
        this.saveGeneralCategories(userId, updatedSettings);
    }

    // 2. Remove the category from all associated notes
    const allNotes = getStoredNotes();
    const updatedNotes = allNotes.map(note => {
        if (note.categories.includes(categoryName)) {
            // Unconditionally remove the category if it's present. The context is determined by where the delete action was initiated.
             return { ...note, categories: note.categories.filter(c => c !== categoryName) };
        }
        return note;
    });
    saveNotes(updatedNotes);
  },
  getGeneralCategories: (userId: string): CategorySettings => {
    const allUserCategories = getStoredUserCategories();
    const data = allUserCategories[userId];
    if (!data) {
        const defaultCats: CategorySettings = { masterList: PREDEFINED_CATEGORIES, active: PREDEFINED_CATEGORIES.map(c => c.name) };
        allUserCategories[userId] = defaultCats;
        saveUserCategories(allUserCategories);
        return defaultCats;
    }
    // Check for old format and migrate
    if (data.masterList && typeof data.masterList[0] === 'string') {
        const migratedData = migrateCategories(data);
        allUserCategories[userId] = migratedData;
        saveUserCategories(allUserCategories);
        return migratedData;
    }
    return data;
  },
  saveGeneralCategories: (userId: string, categories: CategorySettings) => {
    const all = getStoredUserCategories();
    all[userId] = categories;
    saveUserCategories(all);
  },
  getActiveGeneralCategories: (userId: string): CategorySettings => {
    return db.getGeneralCategories(userId);
  },
  getActiveProjectCategories: (projectId: string): CategorySettings => {
    const project = getStoredProjects().find(p => p.id === projectId);
    if (!project) return { masterList: [], active: [] };

    // Check for migration
    if (project.categories && project.categories.masterList && typeof project.categories.masterList[0] === 'string') {
        const migratedCategories = migrateCategories(project.categories);
        const updatedProject = { ...project, categories: migratedCategories };
        db.updateProject(updatedProject);
        return migratedCategories;
    }
    return project.categories;
  },

  // --- Groups ---
  createGroup(name: string, ownerId: string): Group {
    const newGroup: Group = { id: uuid(), name, ownerId, members: [{userId: ownerId, role: 'admin'}], pendingMemberIds: [] };
    saveGroups([...getStoredGroups(), newGroup]);
    return newGroup;
  },
  requestToJoinGroup(groupId: string, userId: string) {
      const groups = getStoredGroups();
      const group = groups.find(g => g.id === groupId);
      if (group && !group.members.some(m => m.userId === userId) && !(group.pendingMemberIds || []).includes(userId)) {
          group.pendingMemberIds = [...(group.pendingMemberIds || []), userId];
          this.updateGroup(group);
      }
  },
  getGroupsForUser(userId: string): Group[] {
    return getStoredGroups().filter(g => g.members.some(m => m.userId === userId));
  },
  getAllGroups: (): Group[] => getStoredGroups(),
  updateGroup(updatedGroup: Group): void {
      const groups = getStoredGroups();
      const idx = groups.findIndex(g => g.id === updatedGroup.id);
      if (idx !== -1) {
          groups[idx] = updatedGroup;
          saveGroups(groups);
      }
  },
  deleteGroup(groupId: string): void {
      saveGroups(getStoredGroups().filter(g => g.id !== groupId));
      const notes = getStoredNotes();
      notes.forEach(n => {
          if (n.sharedWith?.groups.includes(groupId)) {
              n.sharedWith.groups = n.sharedWith.groups.filter(g => g !== groupId);
          }
      });
      saveNotes(notes);
  },

  // --- Projects ---
  createProject(name: string, description: string, ownerId: string, categories: CategorySettings): Project {
    const newProject: Project = { 
        id: uuid(), 
        name, 
        ownerId,
        description: description, 
        color: PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)], 
        tabs: [],
        categories: categories
    };
    saveProjects([...getStoredProjects(), newProject]);
    return newProject;
  },
  getProjectsForUser(userId: string): Project[] {
    return getStoredProjects().filter(p => p.ownerId === userId);
  },
  updateProject(updatedProject: Project): void {
      const projects = getStoredProjects();
      const idx = projects.findIndex(p => p.id === updatedProject.id);
      if (idx !== -1) {
          projects[idx] = updatedProject;
          saveProjects(projects);
      }
  },
  deleteProject(projectId: string): void {
    saveProjects(getStoredProjects().filter(p => p.id !== projectId));
    saveNotes(getStoredNotes().filter(n => !(n.projectIds || []).includes(projectId)));
  },
};

export default db;
