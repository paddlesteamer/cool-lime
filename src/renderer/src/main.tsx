import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { installNetLime } from './limeNet'
import './styles.css'
import '@xterm/xterm/css/xterm.css'
if (!window.lime) installNetLime()
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
