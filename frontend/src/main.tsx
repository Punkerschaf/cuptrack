import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme';
import App from './App';
import i18n from './i18n';
import { api } from './api';

// Load the global language setting from the server before rendering
api.getSettings().then((settings) => {
  if (settings?.language) {
    i18n.changeLanguage(settings.language);
  }
}).catch(() => {
  // fallback to default (de)
}).finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </React.StrictMode>,
  );
});
