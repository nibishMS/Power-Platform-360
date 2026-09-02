import { FluentProvider, webDarkTheme, webLightTheme } from '@fluentui/react-components'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const isDark = document.documentElement.getAttribute('data-theme') === 'dark'

createRoot(document.getElementById('root')!).render(
  <FluentProvider theme={isDark ? webDarkTheme : webLightTheme} className="fluent-root">
    <App />
  </FluentProvider>,
)
