import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Divider,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import CoffeeMakerIcon from '@mui/icons-material/CoffeeMaker';
import TabletIcon from '@mui/icons-material/Tablet';
import LogoutIcon from '@mui/icons-material/Logout';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import { useAuth } from '../contexts/AuthContext';

const DRAWER_WIDTH = 240;
const DRAWER_WIDTH_COLLAPSED = 64;

const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  { text: 'Benutzer', icon: <PeopleIcon />, path: '/dashboard/users' },
  {
    text: 'Maschinen',
    icon: <CoffeeMakerIcon />,
    path: '/dashboard/machines',
  },
  { text: 'Terminals', icon: <TabletIcon />, path: '/dashboard/terminals' },
];

export default function DashboardLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [open, setOpen] = useState(!isMobile);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar
        sx={{
          justifyContent: open ? 'space-between' : 'center',
          px: open ? 2 : 0,
        }}
      >
        {open && (
          <Typography
            variant="h6"
            noWrap
            sx={{ fontWeight: 700, color: 'primary.main' }}
          >
            ☕ CupTrack
          </Typography>
        )}
        {!isMobile && (
          <IconButton onClick={() => setOpen(!open)} size="small">
            {open ? <ChevronLeftIcon /> : <MenuIcon />}
          </IconButton>
        )}
      </Toolbar>
      <Divider />
      <List sx={{ flex: 1 }}>
        {menuItems.map((item) => (
          <ListItemButton
            key={item.path}
            selected={location.pathname === item.path}
            onClick={() => {
              navigate(item.path);
              if (isMobile) setMobileOpen(false);
            }}
            sx={{
              px: open ? 2 : 'auto',
              justifyContent: open ? 'initial' : 'center',
              '&.Mui-selected': {
                backgroundColor: 'primary.light',
                color: 'white',
                '& .MuiListItemIcon-root': { color: 'white' },
              },
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: open ? 40 : 'auto',
                justifyContent: 'center',
              }}
            >
              {item.icon}
            </ListItemIcon>
            {open && <ListItemText primary={item.text} />}
          </ListItemButton>
        ))}
      </List>
      <Divider />
      <List>
        <ListItemButton
          onClick={handleLogout}
          sx={{
            px: open ? 2 : 'auto',
            justifyContent: open ? 'initial' : 'center',
          }}
        >
          <ListItemIcon
            sx={{
              minWidth: open ? 40 : 'auto',
              justifyContent: 'center',
            }}
          >
            <LogoutIcon />
          </ListItemIcon>
          {open && <ListItemText primary="Abmelden" />}
        </ListItemButton>
      </List>
    </Box>
  );

  const drawerWidth = open ? DRAWER_WIDTH : DRAWER_WIDTH_COLLAPSED;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Mobile AppBar */}
      <AppBar
        position="fixed"
        sx={{ zIndex: theme.zIndex.drawer + 1, display: { md: 'none' } }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setMobileOpen(!mobileOpen)}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap>
            ☕ CupTrack
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* Desktop Drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            transition: theme.transitions.create('width', {
              duration: theme.transitions.duration.shorter,
            }),
            overflowX: 'hidden',
          },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          mt: { xs: 8, md: 0 },
          ml: { md: `${drawerWidth}px` },
          transition: theme.transitions.create('margin', {
            duration: theme.transitions.duration.shorter,
          }),
          backgroundColor: 'background.default',
          minHeight: '100vh',
        }}
      >
        {user && (
          <Box
            sx={{
              display: { xs: 'none', md: 'flex' },
              justifyContent: 'flex-end',
              mb: 2,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              Angemeldet als <strong>{user.displayName}</strong>
            </Typography>
          </Box>
        )}
        <Outlet />
      </Box>
    </Box>
  );
}
