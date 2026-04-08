import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ThemeContext } from './lib/ThemeContext'
import { ToastProvider, ToastContainer } from './components/Toast'
import { _setPalette, darkPalette, lightPalette } from './lib/theme'
import './index.css'

function Root() {
  const [isDark, setIsDark] = useState(true)

  function toggleTheme() {
    setIsDark(prev => {
      const next = !prev
      _setPalette(next ? darkPalette : lightPalette)
      return next
    })
  }

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      <ToastProvider>
        <App />
        <ToastContainer />
      </ToastProvider>
    </ThemeContext.Provider>
  )
}

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element #root was not found.')

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)