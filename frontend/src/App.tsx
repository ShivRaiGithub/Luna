import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './styles/globals.css';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import WalletApp from './pages/WalletApp';
import DAppDemo from './pages/DAppDemo';
import NotFound from './pages/NotFound';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth/:mode" element={<AuthPage />} />
        <Route path="/app/wallet" element={<WalletApp />} />
        <Route path="/demo" element={<DAppDemo />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;

