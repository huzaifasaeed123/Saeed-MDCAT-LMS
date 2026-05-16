// frontend/src/App.jsx
import React from 'react';
import { AuthProvider, AuthContext } from './core/auth/AuthContext';
import { ThemeProvider } from './core/theme/ThemeContext';
import AppRouter from './core/router/AppRouter';
import AuthLoadingScreen from './shared/components/AuthLoadingScreen';

// Inner component so it can consume AuthContext
const AppContent = () => {
  const { loading } = React.useContext(AuthContext);
  if (loading) return <AuthLoadingScreen />;
  return <AppRouter />;
};

// ThemeProvider wraps everything so even the AuthLoadingScreen renders in
// the user's chosen theme — no flash of wrong palette on cold load.
function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
