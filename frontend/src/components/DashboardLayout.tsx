import { useState, useEffect } from 'react';
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
  Alert,
  AlertTitle,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import CoffeeMakerIcon from '@mui/icons-material/CoffeeMaker';
import TabletIcon from '@mui/icons-material/Tablet';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsIcon from '@mui/icons-material/Settings';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';
import type { MigrationStatus, PendingMigration } from '../types';

const DRAWER_WIDTH = 240;
const DRAWER_WIDTH_COLLAPSED = 64;

export default function DashboardLayout() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [open, setOpen] = useState(!isMobile);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [versionInfo, setVersionInfo] = useState<{ version: string; codeName: string } | null>(null);
  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus | null>(null);
  const [migrationDialogOpen, setMigrationDialogOpen] = useState(false);
  const [selectedMigration, setSelectedMigration] = useState<PendingMigration | null>(null);
  const [migrationRunning, setMigrationRunning] = useState(false);
  const [migrationError, setMigrationError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  useEffect(() => {
    api.getVersion().then((v) => setVersionInfo({ version: v.version, codeName: v.codeName })).catch(() => {});
    api.getMigrationStatus().then(setMigrationStatus).catch(() => {});
  }, []);

  const pendingManual = migrationStatus?.pending.filter(m => m.type === 'manual') ?? [];

  const handleRunMigration = async () => {
    if (!selectedMigration) return;
    setMigrationRunning(true);
    setMigrationError(null);
    try {
      const result = await api.runMigration(selectedMigration.version, true);
      if (result.success) {
        setMigrationDialogOpen(false);
        setSelectedMigration(null);
        // Refresh status
        const status = await api.getMigrationStatus();
        setMigrationStatus(status);
        if (!status.maintenanceMode) {
          window.location.reload();
        }
      }
    } catch (err) {
      setMigrationError(err instanceof Error ? err.message : String(err));
    } finally {
      setMigrationRunning(false);
    }
  };

  const menuItems = [
    { text: t('nav.dashboard'), icon: <DashboardIcon />, path: '/dashboard' },
    { text: t('nav.users'), icon: <PeopleIcon />, path: '/dashboard/users' },
    {
      text: t('nav.machines'),
      icon: <CoffeeMakerIcon />,
      path: '/dashboard/machines',
    },
    { text: t('nav.terminals'), icon: <TabletIcon />, path: '/dashboard/terminals' },
    { text: t('nav.cashBook'), icon: <AccountBalanceWalletIcon />, path: '/dashboard/cashbook' },
    { text: t('nav.settings'), icon: <SettingsIcon />, path: '/dashboard/settings' },
  ];

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
          {open && <ListItemText primary={t('auth.logout')} />}
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
          display: 'flex',
          flexDirection: 'column',
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
            <Typography variant="body2" color="text.secondary"
              dangerouslySetInnerHTML={{ __html: t('auth.loggedInAs', { name: user.displayName }) }}
            />
          </Box>
        )}
        {pendingManual.length > 0 && (
          <Alert
            severity="warning"
            icon={<WarningAmberIcon />}
            sx={{ mb: 2 }}
            action={
              user?.isRoot ? (
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => { setSelectedMigration(pendingManual[0]); setMigrationDialogOpen(true); }}
                >
                  {t('migrations.runMigration')}
                </Button>
              ) : undefined
            }
          >
            <AlertTitle>{t('migrations.bannerTitle')}</AlertTitle>
            {t('migrations.bannerText', { count: pendingManual.length })}
          </Alert>
        )}
        <Outlet />

        {/* Migration Dialog */}
        <Dialog open={migrationDialogOpen} onClose={() => !migrationRunning && setMigrationDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>{t('migrations.dialogTitle')}</DialogTitle>
          <DialogContent>
            {selectedMigration && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  {t('migrations.version')} {selectedMigration.version}: {selectedMigration.name}
                </Typography>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  {selectedMigration.description}
                </Typography>
                {selectedMigration.breaking && selectedMigration.breaking.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" color="error" gutterBottom>
                      {t('migrations.breakingChanges')}
                    </Typography>
                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                      {selectedMigration.breaking.map((b, i) => (
                        <li key={i}><Typography variant="body2">{b}</Typography></li>
                      ))}
                    </ul>
                  </Box>
                )}
                {selectedMigration.adminAction && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    <AlertTitle>{t('migrations.adminAction')}</AlertTitle>
                    {selectedMigration.adminAction}
                  </Alert>
                )}
                {migrationError && (
                  <Alert severity="error" sx={{ mt: 2 }}>{migrationError}</Alert>
                )}
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setMigrationDialogOpen(false)} disabled={migrationRunning}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleRunMigration}
              variant="contained"
              color="warning"
              disabled={migrationRunning}
              startIcon={migrationRunning ? <CircularProgress size={16} /> : undefined}
            >
              {migrationRunning ? t('migrations.running') : t('migrations.confirm')}
            </Button>
          </DialogActions>
        </Dialog>

        {versionInfo && (
          <Box sx={{ textAlign: 'center', mt: 'auto', pt: 4, pb: 2 }}>
            <Typography variant="caption" color="text.secondary">
              CupTrack v{versionInfo.version} &mdash; {versionInfo.codeName}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
