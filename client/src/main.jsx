import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConfigProvider } from 'antd'
import 'antd/dist/reset.css'
import './index.css'
import App from './App.jsx'
import { appTheme } from './app/theme.js'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ConfigProvider theme={appTheme}>
      <App />
    </ConfigProvider>
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('BrewTrack offline shell could not be registered.', error)
    })
  })
}
