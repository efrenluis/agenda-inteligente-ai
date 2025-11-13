import React, { useState, useEffect, useCallback } from 'react';
import { db, PublicUser } from './db';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

const App: React.FC = () => {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Cargar la fuente de Google Fonts dinámicamente
    const link = document.createElement('link');
    link.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap";
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }, []);

  const refreshUser = useCallback(() => {
    const currentUser = db.getCurrentUser();
    setUser(currentUser);
    return currentUser;
  }, []);

  useEffect(() => {
    refreshUser();
    setLoading(false);
  }, [refreshUser]);

  const handleLogin = (loggedInUser: PublicUser) => {
    setUser(loggedInUser);
  };

  const handleLogout = () => {
    db.logout();
    setUser(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen font-sans">
        <div className="text-xl font-semibold text-primary">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans">
      {user ? (
        <Dashboard user={user} onLogout={handleLogout} refreshUser={refreshUser} />
      ) : (
        <Login onLogin={handleLogin} />
      )}
    </div>
  );
};

export default App;