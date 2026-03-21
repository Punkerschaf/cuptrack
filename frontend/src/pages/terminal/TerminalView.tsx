import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Paper,
  CircularProgress,
  Alert,
  TextField,
  List,
  ListItemButton,
  ListItemText,
  InputAdornment,
} from '@mui/material';
import LocalCafeIcon from '@mui/icons-material/LocalCafe';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BackspaceIcon from '@mui/icons-material/Backspace';
import SearchIcon from '@mui/icons-material/Search';
import NfcIcon from '@mui/icons-material/Nfc';
import { api } from '../../api';
import type { TerminalInfo } from '../../types';

type Step =
  | 'home'
  | 'pin'
  | 'menu'
  | 'counting'
  | 'editBalance'
  | 'balanceUpdated';

export default function TerminalView() {
  const { terminalName } = useParams<{ terminalName: string }>();
  const [info, setInfo] = useState<TerminalInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // State
  const [step, setStep] = useState<Step>('home');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedUserName, setSelectedUserName] = useState('');
  const [pin, setPin] = useState('');
  const [pinStatus, setPinStatus] = useState<'idle' | 'success' | 'error'>(
    'idle',
  );
  const [sessionToken, setSessionToken] = useState('');
  const [balance, setBalance] = useState(0);
  const [newBalance, setNewBalance] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [nfcScanning, setNfcScanning] = useState(false);
  const [nfcStatus, setNfcStatus] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');
  const [nfcError, setNfcError] = useState('');
  const [nfcSupported] = useState(() => 'NDEFReader' in window);

  const loadInfo = useCallback(() => {
    if (!terminalName) return;
    setLoading(true);
    api
      .getTerminalInfo(terminalName)
      .then(setInfo)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [terminalName]);

  useEffect(() => {
    loadInfo();
  }, [loadInfo]);

  const resetToHome = useCallback(() => {
    setStep('home');
    setSelectedUserId('');
    setSelectedUserName('');
    setPin('');
    setPinStatus('idle');
    setSessionToken('');
    setBalance(0);
    setNewBalance('');
    setUserSearch('');
    setNfcScanning(false);
    setNfcStatus('idle');
    setNfcError('');
    loadInfo();
  }, [loadInfo]);

  const handleNfcScan = useCallback(async () => {
    if (!terminalName || !nfcSupported) return;
    setNfcScanning(true);
    setNfcStatus('scanning');
    setNfcError('');

    try {
      const ndef = new (window as any).NDEFReader();
      const abortController = new AbortController();

      await ndef.scan({ signal: abortController.signal });

      ndef.addEventListener('reading', async (event: any) => {
        abortController.abort();
        const serialNumber: string = event.serialNumber || '';
        if (!serialNumber) {
          setNfcStatus('error');
          setNfcError('Keine Seriennummer auf dem NFC-Tag gefunden');
          setNfcScanning(false);
          setTimeout(() => setNfcStatus('idle'), 3000);
          return;
        }

        try {
          const res = await api.verifyNfc(terminalName, serialNumber);
          setNfcStatus('success');
          setSelectedUserId(res.user.id);
          setSelectedUserName(res.user.displayName);
          setSessionToken(res.sessionToken);
          setBalance(res.user.balance);
          setNfcScanning(false);
          setTimeout(() => setStep('menu'), 600);
        } catch {
          setNfcStatus('error');
          setNfcError('Kein Benutzer mit dieser NFC-Karte gefunden');
          setNfcScanning(false);
          setTimeout(() => { setNfcStatus('idle'); setNfcError(''); }, 3000);
        }
      }, { once: true });

      // Auto-cancel after 30s
      setTimeout(() => {
        abortController.abort();
        setNfcScanning(false);
        if (nfcStatus === 'scanning') {
          setNfcStatus('idle');
          setNfcError('');
        }
      }, 30000);
    } catch (e: unknown) {
      setNfcScanning(false);
      setNfcStatus('error');
      setNfcError(e instanceof Error ? e.message : 'NFC-Fehler');
      setTimeout(() => { setNfcStatus('idle'); setNfcError(''); }, 3000);
    }
  }, [terminalName, nfcSupported, nfcStatus]);

  // Auto-redirect after confirmation screens
  useEffect(() => {
    if (step === 'counting' || step === 'balanceUpdated') {
      const timer = setTimeout(resetToHome, 3000);
      return () => clearTimeout(timer);
    }
  }, [step, resetToHome]);

  const selectUser = (userId: string, displayName: string) => {
    setSelectedUserId(userId);
    setSelectedUserName(displayName);
    setPin('');
    setPinStatus('idle');
    setStep('pin');
  };

  const handlePinDigit = async (digit: string) => {
    if (pinStatus !== 'idle') return;
    const next = pin + digit;
    setPin(next);

    if (next.length === 4 && terminalName) {
      try {
        const res = await api.verifyPin(terminalName, selectedUserId, next);
        setPinStatus('success');
        setSessionToken(res.sessionToken);
        setBalance(res.user.balance);
        setTimeout(() => setStep('menu'), 600);
      } catch {
        setPinStatus('error');
        setTimeout(() => {
          setPin('');
          setPinStatus('idle');
        }, 1000);
      }
    }
  };

  const handlePinBackspace = () => {
    if (pinStatus !== 'idle') return;
    setPin(pin.slice(0, -1));
  };

  const handleCountCoffee = async () => {
    if (!terminalName) return;
    try {
      const res = await api.countCoffee(terminalName, sessionToken);
      setBalance(res.newBalance);
      setStep('counting');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler');
    }
  };

  const handleUpdateBalance = async () => {
    if (!terminalName) return;
    try {
      const res = await api.updateBalance(
        terminalName,
        sessionToken,
        parseFloat(newBalance),
      );
      setBalance(res.newBalance);
      setStep('balanceUpdated');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler');
    }
  };

  if (loading)
    return (
      <CenteredBox>
        <CircularProgress />
      </CenteredBox>
    );

  if (error || !info)
    return (
      <CenteredBox>
        <Alert severity="error" sx={{ maxWidth: 400 }}>
          {error || 'Terminal nicht gefunden'}
        </Alert>
      </CenteredBox>
    );

  // ─── Home: User list ───
  if (step === 'home') {
    const filteredUsers = info.users.filter((u) =>
      u.displayName.toLowerCase().includes(userSearch.toLowerCase()),
    );

    return (
      <TerminalWrapper>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <LocalCafeIcon sx={{ fontSize: 48, color: '#6F4E37' }} />
          <Typography variant="h4" fontWeight={700} color="#6F4E37">
            {info.terminal.name}
          </Typography>
          {info.machine && (
            <Typography color="text.secondary">
              {info.machine.name}
              {info.machine.room ? ` — ${info.machine.room}` : ''}
            </Typography>
          )}
        </Box>

        <Typography variant="h6" gutterBottom sx={{ textAlign: 'center' }}>
          Wähle deinen Namen:
        </Typography>

        {nfcSupported && (
          <Box sx={{ textAlign: 'center', mb: 2 }}>
            <Button
              variant={nfcScanning ? 'outlined' : 'contained'}
              startIcon={<NfcIcon />}
              onClick={nfcScanning ? undefined : handleNfcScan}
              disabled={nfcScanning}
              sx={{
                py: 1.5,
                px: 4,
                fontSize: '1.1rem',
                backgroundColor: nfcStatus === 'success' ? '#4CAF50'
                  : nfcStatus === 'error' ? '#F44336'
                  : nfcScanning ? undefined : '#6F4E37',
                color: nfcScanning ? undefined : 'white',
                '&:hover': { backgroundColor: nfcScanning ? undefined : '#4E3524' },
                animation: nfcScanning ? 'pulse 1.5s infinite' : 'none',
                '@keyframes pulse': {
                  '0%': { opacity: 1 },
                  '50%': { opacity: 0.6 },
                  '100%': { opacity: 1 },
                },
              }}
            >
              {nfcScanning ? 'NFC-Karte jetzt auflegen...' : 'Mit NFC-Karte anmelden'}
            </Button>
            {nfcError && (
              <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                {nfcError}
              </Typography>
            )}
          </Box>
        )}

        {info.users.length > 8 && (
          <TextField
            size="small"
            placeholder="Suchen..."
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            fullWidth
            sx={{ mb: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        )}

        <Paper
          sx={{
            maxHeight: 400,
            overflow: 'auto',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <List disablePadding>
            {filteredUsers.map((u) => (
              <ListItemButton
                key={u.id}
                onClick={() => selectUser(u.id, u.displayName)}
                sx={{ py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}
              >
                <ListItemText
                  primary={u.displayName}
                  primaryTypographyProps={{ fontSize: '1.1rem' }}
                />
              </ListItemButton>
            ))}
            {filteredUsers.length === 0 && (
              <Box p={2} textAlign="center">
                <Typography color="text.secondary">
                  Keine Benutzer gefunden
                </Typography>
              </Box>
            )}
          </List>
        </Paper>
      </TerminalWrapper>
    );
  }

  // ─── PIN Input ───
  if (step === 'pin') {
    const bgColor =
      pinStatus === 'success'
        ? '#4CAF50'
        : pinStatus === 'error'
          ? '#F44336'
          : 'transparent';

    return (
      <TerminalWrapper>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={resetToHome}
          sx={{ mb: 2 }}
        >
          Zurück
        </Button>
        <Typography variant="h5" textAlign="center" gutterBottom>
          PIN für <strong>{selectedUserName}</strong>
        </Typography>

        {/* PIN dots */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            gap: 2,
            my: 3,
            p: 2,
            borderRadius: 2,
            backgroundColor: bgColor,
            transition: 'background-color 0.3s',
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <Box
              key={i}
              sx={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                border: '2px solid',
                borderColor:
                  pinStatus === 'success' || pinStatus === 'error'
                    ? 'white'
                    : '#6F4E37',
                backgroundColor:
                  i < pin.length
                    ? pinStatus === 'success' || pinStatus === 'error'
                      ? 'white'
                      : '#6F4E37'
                    : 'transparent',
                transition: 'all 0.2s',
              }}
            />
          ))}
        </Box>

        {/* Numpad */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 1.5,
            maxWidth: 300,
            mx: 'auto',
          }}
        >
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'].map(
            (key) => {
              if (key === '')
                return <Box key="empty" />;
              if (key === 'back')
                return (
                  <Button
                    key="back"
                    variant="outlined"
                    onClick={handlePinBackspace}
                    sx={{ py: 2, fontSize: '1.2rem' }}
                  >
                    <BackspaceIcon />
                  </Button>
                );
              return (
                <Button
                  key={key}
                  variant="outlined"
                  onClick={() => handlePinDigit(key)}
                  sx={{
                    py: 2,
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    color: '#6F4E37',
                    borderColor: '#6F4E37',
                    '&:hover': { backgroundColor: '#FAF6F1' },
                  }}
                >
                  {key}
                </Button>
              );
            },
          )}
        </Box>
      </TerminalWrapper>
    );
  }

  // ─── Menu: Coffee / Balance / Cancel ───
  if (step === 'menu') {
    return (
      <TerminalWrapper>
        <Typography variant="h5" textAlign="center" gutterBottom>
          Hallo, <strong>{selectedUserName}</strong>!
        </Typography>
        <Box
          sx={{
            textAlign: 'center',
            mb: 4,
            p: 2,
            borderRadius: 2,
            backgroundColor: balance >= 0 ? '#E8F5E9' : '#FFEBEE',
          }}
        >
          <Typography variant="body2" color="text.secondary">
            Dein Guthaben
          </Typography>
          <Typography
            variant="h3"
            fontWeight={700}
            color={balance >= 0 ? 'success.main' : 'error.main'}
          >
            {balance.toFixed(2)} €
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            maxWidth: 350,
            mx: 'auto',
          }}
        >
          <Button
            variant="contained"
            size="large"
            startIcon={<LocalCafeIcon />}
            onClick={handleCountCoffee}
            sx={{
              py: 3,
              fontSize: '1.3rem',
              backgroundColor: '#6F4E37',
              '&:hover': { backgroundColor: '#4E3524' },
            }}
          >
            Kaffee zählen
            {info.machine && (
              <Typography
                component="span"
                sx={{ ml: 1, fontSize: '0.9rem', opacity: 0.8 }}
              >
                ({info.machine.pricePerCoffee.toFixed(2)} €)
              </Typography>
            )}
          </Button>

          <Button
            variant="outlined"
            size="large"
            startIcon={<AccountBalanceWalletIcon />}
            onClick={() => {
              setNewBalance(String(balance));
              setStep('editBalance');
            }}
            sx={{ py: 2 }}
          >
            Guthaben bearbeiten
          </Button>

          <Button
            variant="text"
            size="large"
            onClick={resetToHome}
            sx={{ py: 1.5 }}
          >
            Abbrechen
          </Button>
        </Box>
      </TerminalWrapper>
    );
  }

  // ─── Coffee Counted Confirmation ───
  if (step === 'counting') {
    return (
      <TerminalWrapper>
        <Box sx={{ textAlign: 'center' }}>
          <LocalCafeIcon sx={{ fontSize: 80, color: '#4CAF50', mb: 2 }} />
          <Typography variant="h4" fontWeight={700} color="success.main">
            Kaffee gezählt!
          </Typography>
          <Typography variant="h5" sx={{ mt: 2 }}>
            Neues Guthaben:{' '}
            <strong
              style={{
                color: balance >= 0 ? '#4CAF50' : '#F44336',
              }}
            >
              {balance.toFixed(2)} €
            </strong>
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 2 }}>
            Zurück zum Start in wenigen Sekunden...
          </Typography>
        </Box>
      </TerminalWrapper>
    );
  }

  // ─── Edit Balance ───
  if (step === 'editBalance') {
    return (
      <TerminalWrapper>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => setStep('menu')}
          sx={{ mb: 2 }}
        >
          Zurück
        </Button>
        <Typography variant="h5" textAlign="center" gutterBottom>
          Guthaben bearbeiten
        </Typography>
        <Box sx={{ textAlign: 'center', mb: 2 }}>
          <Typography color="text.secondary">
            Aktuelles Guthaben: {balance.toFixed(2)} €
          </Typography>
        </Box>
        <Box sx={{ maxWidth: 300, mx: 'auto', mb: 3 }}>
          <TextField
            fullWidth
            label="Neues Guthaben (€)"
            type="number"
            value={newBalance}
            onChange={(e) => setNewBalance(e.target.value)}
            inputProps={{ step: '0.01' }}
            autoFocus
          />
        </Box>
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            justifyContent: 'center',
          }}
        >
          <Button variant="text" onClick={() => setStep('menu')} size="large">
            Abbrechen
          </Button>
          <Button
            variant="contained"
            onClick={handleUpdateBalance}
            size="large"
            disabled={newBalance === '' || isNaN(parseFloat(newBalance))}
          >
            Bestätigen
          </Button>
        </Box>
      </TerminalWrapper>
    );
  }

  // ─── Balance Updated Confirmation ───
  if (step === 'balanceUpdated') {
    return (
      <TerminalWrapper>
        <Box sx={{ textAlign: 'center' }}>
          <AccountBalanceWalletIcon
            sx={{ fontSize: 80, color: '#4CAF50', mb: 2 }}
          />
          <Typography variant="h4" fontWeight={700} color="success.main">
            Guthaben aktualisiert!
          </Typography>
          <Typography variant="h5" sx={{ mt: 2 }}>
            Neues Guthaben:{' '}
            <strong
              style={{
                color: balance >= 0 ? '#4CAF50' : '#F44336',
              }}
            >
              {balance.toFixed(2)} €
            </strong>
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 2 }}>
            Zurück zum Start in wenigen Sekunden...
          </Typography>
        </Box>
      </TerminalWrapper>
    );
  }

  return null;
}

/* ─── Layout Helpers ─── */

function CenteredBox({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FAF6F1',
      }}
    >
      {children}
    </Box>
  );
}

function TerminalWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: '#FAF6F1',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        pt: { xs: 2, sm: 4 },
        px: 2,
      }}
    >
      <Paper
        elevation={3}
        sx={{
          maxWidth: 480,
          width: '100%',
          p: { xs: 2, sm: 4 },
          borderRadius: 3,
        }}
      >
        {children}
      </Paper>
    </Box>
  );
}
