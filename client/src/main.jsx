import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { ConfigProvider } from './hooks/useConfig';
import { AuthProvider } from './hooks/useAuth';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ConfigProvider>
        <AuthProvider>
          <App />
          <Toaster
            position="top-center"
            toastOptions={{ duration: 4500, style: { borderRadius: '12px', fontSize: '14px' } }}
          />
        </AuthProvider>
      </ConfigProvider>
    </BrowserRouter>
  </StrictMode>,
);
