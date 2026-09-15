import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { WatchlistProvider } from './context/WatchlistContext'
import { NotificationProvider } from './context/NotificationContext'
import { AuthProvider } from './context/AuthContext'
import './index.css'
import App from './App.tsx'
import { BackendWakeBanner } from './components/BackendWakeBanner'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <WatchlistProvider>
          <NotificationProvider>
            <App />
            <BackendWakeBanner />
          </NotificationProvider>
        </WatchlistProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
