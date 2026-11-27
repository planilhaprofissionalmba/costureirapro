import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import './costura.css'
import App from './App.tsx'
import { bindInstallCapture } from './lib/install'

bindInstallCapture()

registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    void registration?.update()
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
