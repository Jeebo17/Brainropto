import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import { GlobalPipeSound } from './components/GlobalPipeSound.tsx';
import { SettingsProvider } from './context/SettingsContext.tsx';
import './index.css';


function isDesktop() {
  const ua = navigator.userAgent;
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isSmallScreen = window.innerWidth < 900 || window.innerHeight < 600;
  return !isMobile && !isSmallScreen;
}

function BlockedOverlay() {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: '#181e2a',
      color: '#fff',
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 28,
      textAlign: 'center',
      padding: 32,
    }}>
      <div>
        <div style={{ fontSize: 64, marginBottom: 24 }}>🚫</div>
        This site only works on desktop devices (Windows, Mac, Linux) with a large screen.<br />
        Please use a desktop or laptop computer.<br /><br />
        Mobile, tablet, and low-powered devices are not supported.
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  isDesktop() ? (
    <StrictMode>
      <SettingsProvider>
        <GlobalPipeSound />
        <BrowserRouter>
          <App />
          
          <p className="text-sm text-slate-400 opacity-30 fixed left-1/2 -translate-x-1/2 bottom-1">
            © 2026 Octopodes. All rights reserved | Nathan W, Oliver CB & Amy P
          </p>
        </BrowserRouter>
      </SettingsProvider>
    </StrictMode>
  ) : (
    <BlockedOverlay />
  )
);
