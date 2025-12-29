import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Root path renders App without a caseId - redirect happens on first message */}
        <Route path="/" element={<App />} />
        <Route path="/case/:caseId" element={<App />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
