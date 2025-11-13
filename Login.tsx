import React, { useState } from 'react';
import { db, PublicUser } from '../db';

interface LoginProps {
  onLogin: (user: PublicUser) => void;
}

const PasswordInput: React.FC<{
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  autoComplete: string;
  className?: string;
}> = ({ id, value, onChange, placeholder, autoComplete, className }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id} name={id} type={show ? 'text' : 'password'} autoComplete={autoComplete} required
        className={`w-full px-3 py-2 pr-10 ${className}`}
        placeholder={placeholder} value={value} onChange={onChange}
      />
      <button type="button" onClick={() => setShow(!show)} className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700">
        {show ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a9.97 9.97 0 01-1.563 3.029m0 0l-2.14 2.14" /></svg>
        ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
        )}
      </button>
    </div>
  );
};

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username || !password) {
      setError('Por favor, introduce un nombre de usuario y contraseña.');
      return;
    }

    if (isRegister) {
      if (password !== confirmPassword) {
        setError('Las contraseñas no coinciden.');
        return;
      }
      const user = db.register(username, password);
      if (!user) {
        setError('El nombre de usuario ya existe. Por favor, elige otro.');
        return;
      }
      sessionStorage.setItem('isNewUser', 'true');
      onLogin(user);

    } else {
      const user = db.login(username, password);
      if (!user) {
        setError('Nombre de usuario o contraseña incorrectos.');
        return;
      }
      onLogin(user);
    }
  };

  const commonInputClasses = "relative block w-full text-gray-900 placeholder-gray-500 border appearance-none border-border-color focus:outline-none focus:ring-secondary focus:border-secondary focus:z-10 sm:text-sm";

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-sm p-8 space-y-8 bg-white rounded-2xl shadow-xl">
        <div>
          <h2 className="text-3xl font-extrabold text-center text-primary">
            {isRegister ? 'Crear una cuenta' : 'Iniciar Sesión'}
          </h2>
          <p className="mt-2 text-center text-text-secondary">en tu Agenda Inteligente AI</p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <input
              id="username" name="username" type="text" autoComplete="username" required
              className={`${commonInputClasses} rounded-md px-3 py-2`}
              placeholder="Nombre de usuario" value={username} onChange={(e) => setUsername(e.target.value)}
            />
            <PasswordInput
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              className={`${commonInputClasses} rounded-md`}
            />
            {isRegister && (
              <PasswordInput
                id="confirm-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirmar Contraseña"
                autoComplete="new-password"
                className={`${commonInputClasses} rounded-md`}
              />
            )}
          </div>

          {error && <p className="text-sm text-center text-red-600">{error}</p>}

          <div>
            <button type="submit" className="relative flex justify-center w-full px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md group bg-primary hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary">
              {isRegister ? 'Registrarse' : 'Iniciar Sesión'}
            </button>
          </div>
        </form>
        <div className="text-sm text-center">
          <button onClick={() => { setIsRegister(!isRegister); setError(null);}} className="font-medium text-secondary hover:text-blue-700">
            {isRegister ? '¿Ya tienes una cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;