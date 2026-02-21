import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CopilotKit } from '@copilotkit/react-core'
import { App } from './App'
import '@copilotkit/react-ui/styles.css'
import './styles.css'

const COPILOTKIT_PUBLIC_API_KEY = import.meta.env.VITE_COPILOTKIT_PUBLIC_API_KEY || 'ck_pub_d3574cc661fee812ecdaaf53f5a7e9d7'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CopilotKit publicApiKey={COPILOTKIT_PUBLIC_API_KEY} showDevConsole={false}>
      <App />
    </CopilotKit>
  </StrictMode>,
)
