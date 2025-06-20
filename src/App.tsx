import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import HomePage from "./pages/HomePage";
import ChatPage from "./pages/ChatPage";
// MUI components
import { Box, CircularProgress } from "@mui/material";

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <Box className="min-h-screen flex justify-center items-center">
        <CircularProgress />
      </Box>
    );
  }
  return user ? <>{children}</> : <Navigate to="/" replace />;
};

const AuthRedirect: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <Box className="min-h-screen flex justify-center items-center">
        <CircularProgress />
      </Box>
    );
  }
  return user ? <Navigate to="/chat" replace /> : <>{children}</>;
};

const App: React.FC = () => (
  <AuthProvider>
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <AuthRedirect>
              <HomePage />
            </AuthRedirect>
          }
        />
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  </AuthProvider>
);

export default App;