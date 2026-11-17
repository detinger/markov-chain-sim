import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
// Vendor styles load first (GraphEditor imports @xyflow/react CSS), then tokens, app, and flow overrides.
import '@xyflow/react/dist/style.css'
import './styles/tokens.css'
import './styles/app.css'
import './styles/flow-theme.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
