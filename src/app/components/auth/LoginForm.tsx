// src/components/auth/LoginForm.tsx
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { LogIn, Mail, Lock, Eye, EyeOff, KeyRound, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../../lib/supabase';

export function LoginForm() {
  const { login, isLoading } = useAuth();
  const adminEmail = useMemo(() => (import.meta.env.VITE_ADMIN_EMAIL || 'pappiro26@gmail.com').toLowerCase().trim(), []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [recoverySuccess, setRecoverySuccess] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');

  useEffect(() => {
    const isRecoveryUrl = window.location.href.includes('type=recovery');
    if (isRecoveryUrl) {
      setIsRecovering(true);
      setIsResettingPassword(true);
    }

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== 'PASSWORD_RECOVERY') {
        return;
      }

      setIsRecovering(true);
      setIsResettingPassword(true);
      setRecoverySuccess(false);
      setResetError('');
      setResetSuccess('Verificación confirmada. Ahora define tu nueva contraseña.');
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (!email.trim()) {
      setLoginError('El correo electrónico es requerido');
      return;
    }

    if (email.toLowerCase().trim() !== adminEmail) {
      setLoginError('Solo el correo administrador autorizado puede iniciar sesión');
      return;
    }

    if (!password || password.length < 6) {
      setLoginError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    try {
      await login(email, password);
    } catch {
      setLoginError('Credenciales incorrectas');
    }
  };

  const handleRecoverySubmit = async (e: FormEvent) => {
    e.preventDefault();
    setRecoveryError('');
    setResetError('');
    setResetSuccess('');

    if (!recoveryEmail.trim()) {
      setRecoveryError('El correo electrónico es requerido');
      return;
    }

    const normalizedEmail = recoveryEmail.toLowerCase().trim();
    if (normalizedEmail !== adminEmail) {
      setRecoveryError('Solo puedes recuperar la contraseña del correo administrador');
      return;
    }

    setRecoveryLoading(true);
    try {
      const redirectTo = `${window.location.origin}${window.location.pathname}`;
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo,
      });

      if (error) {
        setRecoveryError(error.message || 'No se pudo enviar el correo de recuperación');
        return;
      }

      setRecoverySuccess(true);
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleUpdateRecoveredPassword = async (e: FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');

    if (!newPassword || !confirmNewPassword) {
      setResetError('Completa ambos campos de contraseña');
      return;
    }

    if (newPassword.length < 6) {
      setResetError('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setResetError('Las contraseñas no coinciden');
      return;
    }

    setRecoveryLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setResetError(error.message || 'No se pudo actualizar la contraseña');
        return;
      }

      await supabase.auth.signOut();
      setResetSuccess('Contraseña actualizada. Ahora inicia sesión con la nueva contraseña.');
      setIsResettingPassword(false);
      setIsRecovering(false);
      setRecoverySuccess(false);
      setRecoveryEmail('');
      setNewPassword('');
      setConfirmNewPassword('');
      window.history.replaceState({}, document.title, window.location.pathname);
    } finally {
      setRecoveryLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center font-sans bg-gray-50">
      <div
        className="w-full min-h-screen bg-cover bg-center flex flex-col lg:flex-row justify-center lg:justify-end items-center lg:pr-10 xl:pr-16 2xl:pr-24 relative pt-6 pb-8 sm:pt-12 lg:pt-0 lg:pb-0 px-4 sm:px-6 lg:px-0 gap-4 sm:gap-8 lg:gap-0"
        style={{ backgroundImage: "url('/assets/fondo.webp')" }}
      >
        <div className="hidden lg:flex absolute top-4 xl:top-8 left-4 xl:left-8 w-40 xl:w-56">
          <img
            src="/assets/logo-versionblanco.webp"
            alt="Pappiro Logo"
            className="h-40 xl:h-64 w-auto object-contain drop-shadow-lg"
            style={{ maxWidth: '600px' }}
          />
        </div>

        <div className="lg:hidden flex-shrink-0 w-[85vw] max-w-[18rem] min-w-[13rem] p-2 rounded-2xl bg-white/8 backdrop-blur-[2px] border border-white/15 shadow-md mx-auto">
          <img
            src="/assets/logo-versionblanco.webp"
            alt="Pappiro Logo"
            className="h-48 sm:h-52 md:h-56 w-full object-contain drop-shadow-sm"
            style={{ maxWidth: '100%' }}
          />
        </div>

        <div className="w-full max-w-md sm:max-w-md lg:max-w-lg bg-white rounded-2xl sm:rounded-3xl lg:rounded-[30px] p-6 sm:p-8 lg:p-12 shadow-lg sm:shadow-xl lg:shadow-2xl relative flex-shrink-0">
          {isRecovering ? (
            <>
              <button
                onClick={() => {
                  setIsRecovering(false);
                  setRecoverySuccess(false);
                  setRecoveryError('');
                  setRecoveryEmail('');
                  setIsResettingPassword(false);
                  setNewPassword('');
                  setConfirmNewPassword('');
                  setResetError('');
                  setResetSuccess('');
                  window.history.replaceState({}, document.title, window.location.pathname);
                }}
                className="flex items-center gap-1 text-sm sm:text-sm text-blue-600 hover:text-blue-700 font-medium mb-4 sm:mb-5 lg:mb-6 transition"
              >
                <ArrowLeft size={14} className="sm:w-4 sm:h-4" />
                Volver al inicio de sesión
              </button>

              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-1 sm:mb-2 lg:mb-3 text-gray-900">Recuperar Contraseña</h2>
              <p className="text-xs sm:text-sm lg:text-base text-gray-500 mb-5 sm:mb-6 lg:mb-8 leading-relaxed">
                {isResettingPassword
                  ? 'Ya confirmaste el enlace. Define tu nueva contraseña para finalizar el cambio.'
                  : 'Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña'}
              </p>

              {isResettingPassword ? (
                <form onSubmit={handleUpdateRecoveredPassword} className="space-y-3 sm:space-y-4">
                  <div>
                    <label htmlFor="newPassword" className="block text-sm sm:text-sm font-medium text-gray-700 mb-1.5">
                      Nueva contraseña
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                      <input
                        id="newPassword"
                        type={showNewPassword ? 'text' : 'password'}
                        placeholder="**********"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        disabled={recoveryLoading}
                        className="w-full pl-10 sm:pl-10 pr-10 py-3 sm:py-3 rounded-lg sm:rounded-xl border border-gray-300 text-sm sm:text-sm lg:text-base bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="confirmNewPassword" className="block text-sm sm:text-sm font-medium text-gray-700 mb-1.5">
                      Confirmar nueva contraseña
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                      <input
                        id="confirmNewPassword"
                        type={showConfirmNewPassword ? 'text' : 'password'}
                        placeholder="**********"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        disabled={recoveryLoading}
                        className="w-full pl-10 sm:pl-10 pr-10 py-3 sm:py-3 rounded-lg sm:rounded-xl border border-gray-300 text-sm sm:text-sm lg:text-base bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                      >
                        {showConfirmNewPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
                      </button>
                    </div>
                  </div>

                  {resetError && <p className="text-red-600 text-xs sm:text-sm mt-1.5">{resetError}</p>}
                  {resetSuccess && <p className="text-green-700 text-xs sm:text-sm mt-1.5">{resetSuccess}</p>}

                  <button
                    type="submit"
                    disabled={recoveryLoading}
                    className="w-full py-3 sm:py-3 lg:py-4 px-4 rounded-lg sm:rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold text-sm sm:text-sm lg:text-base hover:shadow-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-4 sm:mt-5 lg:mt-6"
                  >
                    {recoveryLoading ? 'Actualizando...' : 'Guardar nueva contraseña'}
                  </button>
                </form>
              ) : recoverySuccess ? (
                <div className="bg-green-50 border border-green-200 p-3 sm:p-4 rounded-lg text-sm sm:text-base">
                  <p className="font-medium text-green-800 mb-1">¡Correo enviado!</p>
                  <p className="text-green-700 text-xs sm:text-sm leading-relaxed">
                    Revisa el correo administrador y abre el enlace para continuar con el cambio de contraseña.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleRecoverySubmit} className="space-y-3 sm:space-y-4">
                  <div>
                    <label htmlFor="recoveryEmail" className="block text-sm sm:text-sm font-medium text-gray-700 mb-1.5">
                      Correo Electrónico
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                      <input
                        id="recoveryEmail"
                        type="email"
                        placeholder="admin@dominio.com"
                        value={recoveryEmail}
                        onChange={(e) => setRecoveryEmail(e.target.value)}
                        disabled={recoveryLoading}
                        className="w-full pl-10 sm:pl-10 pr-4 py-3 sm:py-3 rounded-lg sm:rounded-xl border border-gray-300 text-sm sm:text-sm lg:text-base bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                      />
                    </div>
                    {recoveryError && (
                      <p className="text-red-600 text-xs sm:text-sm mt-1.5">{recoveryError}</p>
                    )}
                    <p className="text-gray-500 text-xs sm:text-sm mt-1.5">
                      Usa el correo administrador configurado para el panel.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={recoveryLoading}
                    className="w-full py-3 sm:py-3 lg:py-4 px-4 rounded-lg sm:rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold text-sm sm:text-sm lg:text-base hover:shadow-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-4 sm:mt-5 lg:mt-6"
                  >
                    {recoveryLoading ? 'Enviando...' : 'Enviar Enlace de Recuperación'}
                  </button>

                  <p className="text-xs sm:text-sm text-gray-500 text-center leading-relaxed pt-2">
                    Nota: El enlace de recuperación tendrá una validez de 24 horas. Si no recibes el correo en unos minutos, revisa tu carpeta de spam.
                  </p>
                </form>
              )}
            </>
          ) : (
            <>
              <h2 className="text-3xl sm:text-3xl lg:text-3xl font-bold mb-2 sm:mb-2 lg:mb-3 text-gray-900 text-center">Bienvenido</h2>
              <p className="text-sm sm:text-sm lg:text-base text-gray-500 mb-5 sm:mb-6 lg:mb-8 leading-relaxed text-center">
                Ingresa tus credenciales para acceder al sistema
              </p>

              {loginError && (
                <div className="bg-red-50 border border-red-200 p-2.5 sm:p-3 rounded-lg text-xs sm:text-sm mb-4 sm:mb-5 text-red-700">
                  {loginError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm sm:text-sm font-medium text-gray-700 mb-1.5">
                    Correo Electrónico
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                    <input
                      id="email"
                      type="email"
                      placeholder="usuario@pappiro.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                      className="w-full pl-10 sm:pl-10 pr-4 py-3 sm:py-3 rounded-lg sm:rounded-xl border border-gray-300 text-sm sm:text-sm lg:text-base bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm sm:text-sm font-medium text-gray-700 mb-1.5">
                    Contraseña
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="**********"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      className="w-full pl-10 sm:pl-10 pr-10 py-3 sm:py-3 rounded-lg sm:rounded-xl border border-gray-300 text-sm sm:text-sm lg:text-base bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
                    </button>
                  </div>
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setIsRecovering(true)}
                    className="flex items-center gap-1 text-sm sm:text-sm text-blue-600 hover:text-blue-700 font-medium transition"
                  >
                    <KeyRound size={14} className="sm:w-4 sm:h-4" />
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 sm:py-3 lg:py-4 px-4 rounded-lg sm:rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold text-sm sm:text-sm lg:text-base flex items-center justify-center gap-2 hover:shadow-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-4 sm:mt-5 lg:mt-6"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Autenticando...
                    </>
                  ) : (
                    <>
                      <LogIn size={16} className="sm:w-5 sm:h-5" />
                      Iniciar Sesión
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
