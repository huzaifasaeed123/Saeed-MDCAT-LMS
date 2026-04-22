// frontend/src/App.jsx
import React from 'react';
import { AuthProvider, AuthContext } from './core/auth/AuthContext';
import AppRouter from './core/router/AppRouter';
import AuthLoadingScreen from './shared/components/AuthLoadingScreen';

// Inner component so it can consume AuthContext
const AppContent = () => {
  const { loading } = React.useContext(AuthContext);
  if (loading) return <AuthLoadingScreen />;
  return <AppRouter />;
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
