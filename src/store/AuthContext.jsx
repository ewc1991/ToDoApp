import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = still resolving

  useEffect(() => {
    return onAuthStateChanged(auth, setUser);
  }, []);

  const signIn = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const signUp = (email, password) => createUserWithEmailAndPassword(auth, email, password);
  const resetPassword = (email) => sendPasswordResetEmail(auth, email);
  const logOut = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, signIn, signUp, resetPassword, logOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
