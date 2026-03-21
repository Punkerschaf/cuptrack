import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#6F4E37',
      light: '#A0785A',
      dark: '#4E3524',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#D4A574',
      light: '#E8C9A0',
      dark: '#B8834A',
      contrastText: '#3E2723',
    },
    background: {
      default: '#FAF6F1',
      paper: '#FFFFFF',
    },
    success: { main: '#4CAF50' },
    warning: { main: '#FF9800' },
    error: { main: '#F44336' },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 500 },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: { backgroundColor: '#4E3524' },
      },
    },
  },
});

export default theme;
