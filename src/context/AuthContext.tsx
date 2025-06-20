import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "../firebase/firebaseConfig";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const REACT_APP_API_URL = process.env.REACT_APP_API_URL;
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [criticalError, setCriticalError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);

      // Call backend API with user id if user is logged in
      if (firebaseUser) {
        try {
          const token = await auth.currentUser?.getIdToken();
          const response = await fetch(`${REACT_APP_API_URL}user/login`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({ user_id: firebaseUser.uid }),
          });
          if (!response.ok) {
            throw new Error("Failed to retrieve user data from server");
          }
        } catch (error) {
          console.error("Failed to retrieve user data from server:", error);
          setCriticalError("Failed to retrieve user data from server. Please try again later.");
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signOutUser = async () => {
    await auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut: signOutUser }}>
      {criticalError ? (
        <div className="min-h-screen flex flex-col justify-center items-center bg-gray-50">
          <h1 className="text-2xl font-bold mb-4 text-center">
            Whoops! Server is not responding!
          </h1>
          <p className="text-lg text-center">
            {criticalError}
          </p>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};