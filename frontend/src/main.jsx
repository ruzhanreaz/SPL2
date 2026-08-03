import { Buffer } from 'buffer';
import process from 'process';

// Polyfills for Node.js modules in browser
window.Buffer = Buffer;
window.process = process;

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
