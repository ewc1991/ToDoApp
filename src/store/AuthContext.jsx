import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../firebase';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = still resolving

  useEffect(() => {
    return onAuthStateChanged(auth, setUser);
  }, []);

  const signIn = () => signInWithPopup(auth, new GoogleAuthProvider());
  const logOut = () => signOut(auth);

  return <AuthContext.Provider value={{ user, signIn, logOut }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
