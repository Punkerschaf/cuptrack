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
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import { useTranslation } from 'react-i18next';
import { api } from '../../api';
import type { TerminalInfo } from '../../types';

type Step =
  | 'home'
  | 'pin'
  | 'menu'
  | 'counting'
  | 'editBalance'
  | 'balanceUpdated'
  | 'guestCoffeeCounted';

export default function TerminalView() {
  const { terminalName } = useParams<{ terminalName: string }>();
  const { t } = useTranslation();
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
  const [alphabetFilter, setAlphabetFilter] = useState<string | null>(null);
  const [nfcScanning, setNfcScanning] = useState(false);
  const [nfcStatus, setNfcStatus] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');
  const [nfcError, setNfcError] = useState('');
  const [nfcSupported] = useState(() => 'NDEFReader' in window);
  const [codeName, setCodeName] = useState('');
  const [connected, setConnected] = useState(true);
  const [guestCoffeePrice, setGuestCoffeePrice] = useState(0);

  useEffect(() => {
    api.getVersion().then((v) => setCodeName(v.codeName)).catch(() => {});
  }, []);

  // Connection polling
  useEffect(() => {
    let active = true;
    const check = () => {
      api.getVersion()
        .then(() => { if (active) setConnected(true); })
        .catch(() => { if (active) setConnected(false); });
    };
    check();
    const interval = setInterval(check, 15000);
    return () => { active = false; clearInterval(interval); };
  }, []);

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
    setAlphabetFilter(null);
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
          setNfcError(t('terminalView.nfcNoSerial'));
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
          setNfcError(t('terminalView.nfcNoUser'));
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
      setNfcError(e instanceof Error ? e.message : t('terminalView.nfcError'));
      setTimeout(() => { setNfcStatus('idle'); setNfcError(''); }, 3000);
    }
  }, [terminalName, nfcSupported, nfcStatus]);

  // Auto-redirect after confirmation screens
  useEffect(() => {
    if (step === 'counting' || step === 'balanceUpdated' || step === 'guestCoffeeCounted') {
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
      setError(e instanceof Error ? e.message : t('common.error'));
    }
  };

  const handleAddBalance = async (amount: number) => {
    if (!terminalName) return;
    try {
      const res = await api.updateBalance(
        terminalName,
        sessionToken,
        amount,
        'add',
      );
      setBalance(res.newBalance);
      setStep('balanceUpdated');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('common.error'));
    }
  };

  const handleResetBalance = async () => {
    if (!terminalName) return;
    try {
      const res = await api.updateBalance(
        terminalName,
        sessionToken,
        0,
        'reset',
      );
      setBalance(res.newBalance);
      setStep('balanceUpdated');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('common.error'));
    }
  };

  const handleGuestCoffee = async () => {
    if (!terminalName) return;
    try {
      const res = await api.recordAnonymousCoffee(terminalName);
      setGuestCoffeePrice(res.price);
      setStep('guestCoffeeCounted');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('common.error'));
    }
  };

  if (loading)
    return (
      <CenteredBox codeName={codeName} connected={connected}>
        <CircularProgress />
      </CenteredBox>
    );

  if (error || !info)
    return (
      <CenteredBox codeName={codeName} connected={connected}>
        <Alert severity="error" sx={{ maxWidth: 400 }}>
          {error || t('terminalView.terminalNotFound')}
        </Alert>
      </CenteredBox>
    );

  // ─── Home: User list ───
  if (step === 'home') {
    const alphabetFilterEnabled = info.terminal.alphabetFilter?.enabled !== false;

    // Compute available letters from all users
    const availableLetters = alphabetFilterEnabled
      ? Array.from(
          new Set(
            info.users
              .map((u) => u.displayName.charAt(0).toUpperCase())
              .filter((c) => c.length > 0),
          ),
        ).sort((a, b) => a.localeCompare(b))
      : [];

    const filteredUsers = info.users.filter((u) => {
      const matchesSearch = u.displayName
        .toLowerCase()
        .includes(userSearch.toLowerCase());
      const matchesLetter =
        !alphabetFilter ||
        u.displayName.charAt(0).toUpperCase() === alphabetFilter;
      return matchesSearch && matchesLetter;
    });

    return (
      <TerminalWrapper codeName={codeName} terminalName={info.terminal.name} connected={connected}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <LocalCafeIcon sx={{ fontSize: 48, color: '#6F4E37' }} />
          {info.machine && (
            <>
              <Typography variant="h4" fontWeight={700} color="#6F4E37">
                {info.machine.name}
              </Typography>
              {info.machine.room && (
                <Typography variant="h6" color="text.secondary">
                  {info.machine.room}
                </Typography>
              )}
            </>
          )}
        </Box>

        <Typography variant="body2" color="text.secondary" gutterBottom sx={{ textAlign: 'center' }}>
          {t('terminalView.selectName')}
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
              {nfcScanning ? t('terminalView.nfcScanning') : t('terminalView.nfcLogin')}
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
            placeholder={t('common.search')}
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

        {alphabetFilterEnabled && availableLetters.length > 1 && (
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 0.5,
              justifyContent: 'center',
              mb: 1,
            }}
          >
            <Button
              variant={alphabetFilter === null ? 'contained' : 'outlined'}
              onClick={() => setAlphabetFilter(null)}
              sx={{
                minWidth: 44,
                minHeight: 44,
                px: 1.5,
                py: 1,
                fontSize: '1rem',
                fontWeight: alphabetFilter === null ? 700 : 400,
                backgroundColor: alphabetFilter === null ? '#6F4E37' : undefined,
                color: alphabetFilter === null ? 'white' : '#6F4E37',
                borderColor: '#6F4E37',
                '&:hover': {
                  backgroundColor: alphabetFilter === null ? '#4E3524' : '#FAF6F1',
                },
              }}
            >
              {t('common.all')}
            </Button>
            {availableLetters.map((letter) => (
              <Button
                key={letter}
                variant={alphabetFilter === letter ? 'contained' : 'outlined'}
                onClick={() =>
                  setAlphabetFilter(alphabetFilter === letter ? null : letter)
                }
                sx={{
                  minWidth: 44,
                  minHeight: 44,
                  px: 1.5,
                  py: 1,
                  fontSize: '1rem',
                  fontWeight: alphabetFilter === letter ? 700 : 400,
                  backgroundColor:
                    alphabetFilter === letter ? '#6F4E37' : undefined,
                  color: alphabetFilter === letter ? 'white' : '#6F4E37',
                  borderColor: '#6F4E37',
                  '&:hover': {
                    backgroundColor:
                      alphabetFilter === letter ? '#4E3524' : '#FAF6F1',
                  },
                }}
              >
                {letter}
              </Button>
            ))}
          </Box>
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
                  {t('terminalView.noUsers')}
                </Typography>
              </Box>
            )}
          </List>
        </Paper>

        {/* Guest Coffee Button */}
        <Box sx={{ textAlign: 'center', mt: 3 }}>
          <Button
            variant="outlined"
            size="large"
            startIcon={<LocalCafeIcon />}
            onClick={handleGuestCoffee}
            sx={{
              py: 1.5,
              px: 4,
              fontSize: '1.1rem',
              color: '#6F4E37',
              borderColor: '#6F4E37',
              '&:hover': { backgroundColor: '#FAF6F1', borderColor: '#4E3524' },
            }}
          >
            {t('terminalView.guestCoffee')}
            {info.machine && (
              <Typography
                component="span"
                sx={{ ml: 1, fontSize: '0.9rem', opacity: 0.8 }}
              >
                ({info.machine.pricePerCoffee.toFixed(2)} €)
              </Typography>
            )}
          </Button>
        </Box>
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
      <TerminalWrapper codeName={codeName} terminalName={info.terminal.name} connected={connected}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={resetToHome}
          sx={{ mb: 2 }}
        >
          {t('common.back')}
        </Button>
        <Typography variant="h5" textAlign="center" gutterBottom
          dangerouslySetInnerHTML={{ __html: t('terminalView.pinFor', { name: selectedUserName }) }}
        />

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
      <TerminalWrapper codeName={codeName} terminalName={info.terminal.name} connected={connected}>
        <Typography variant="h5" textAlign="center" gutterBottom
          dangerouslySetInnerHTML={{ __html: t('terminalView.greeting', { name: selectedUserName }) }}
        />
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
            {t('terminalView.yourBalance')}
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
            {t('terminalView.countCoffee')}
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
              setNewBalance('');
              setStep('editBalance');
            }}
            sx={{ py: 2 }}
          >
            {t('terminalView.editBalance')}
          </Button>

          <Button
            variant="text"
            size="large"
            onClick={resetToHome}
            sx={{ py: 1.5 }}
          >
            {t('common.cancel')}
          </Button>
        </Box>
      </TerminalWrapper>
    );
  }

  // ─── Coffee Counted Confirmation ───
  if (step === 'counting') {
    return (
      <TerminalWrapper codeName={codeName} terminalName={info.terminal.name} connected={connected}>
        <Box sx={{ textAlign: 'center' }}>
          <LocalCafeIcon sx={{ fontSize: 80, color: '#4CAF50', mb: 2 }} />
          <Typography variant="h4" fontWeight={700} color="success.main">
            {t('terminalView.coffeeCounted')}
          </Typography>
          <Typography variant="h5" sx={{ mt: 2 }}>
            {t('terminalView.newBalance')}{' '}
            <strong
              style={{
                color: balance >= 0 ? '#4CAF50' : '#F44336',
              }}
            >
              {balance.toFixed(2)} €
            </strong>
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 2 }}>
            {t('terminalView.backToStart')}
          </Typography>
        </Box>
      </TerminalWrapper>
    );
  }

  // ─── Edit Balance ───
  if (step === 'editBalance') {
    const quickButtons = info.terminal.quickButtons;
    const addAmount = parseFloat(newBalance);

    return (
      <TerminalWrapper codeName={codeName} terminalName={info.terminal.name} connected={connected}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => setStep('menu')}
          sx={{ mb: 2 }}
        >
          {t('common.back')}
        </Button>
        <Typography variant="h5" textAlign="center" gutterBottom>
          {t('terminalView.editBalance')}
        </Typography>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography color="text.secondary">
            {t('terminalView.currentBalance', { balance: balance.toFixed(2) })}
          </Typography>
        </Box>

        {/* Quick Buttons */}
        {quickButtons?.enabled && (
          <Box
            sx={{
              display: 'flex',
              gap: 2,
              justifyContent: 'center',
              mb: 3,
              maxWidth: 350,
              mx: 'auto',
            }}
          >
            <Button
              variant="contained"
              size="large"
              onClick={() => handleAddBalance(quickButtons.button1)}
              sx={{
                flex: 1,
                py: 2.5,
                fontSize: '1.2rem',
                fontWeight: 700,
                backgroundColor: '#4CAF50',
                '&:hover': { backgroundColor: '#388E3C' },
              }}
            >
              + {quickButtons.button1.toFixed(2)} €
            </Button>
            <Button
              variant="contained"
              size="large"
              onClick={() => handleAddBalance(quickButtons.button2)}
              sx={{
                flex: 1,
                py: 2.5,
                fontSize: '1.2rem',
                fontWeight: 700,
                backgroundColor: '#4CAF50',
                '&:hover': { backgroundColor: '#388E3C' },
              }}
            >
              + {quickButtons.button2.toFixed(2)} €
            </Button>
          </Box>
        )}

        {/* Custom amount input */}
        <Box sx={{ maxWidth: 300, mx: 'auto', mb: 2 }}>
          <TextField
            fullWidth
            label={t('terminalView.addAmountLabel')}
            type="number"
            value={newBalance}
            onChange={(e) => setNewBalance(e.target.value)}
            inputProps={{ step: '0.01', min: '0.01' }}
            autoFocus
          />
        </Box>
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            justifyContent: 'center',
            mb: 3,
          }}
        >
          <Button
            variant="contained"
            onClick={() => handleAddBalance(addAmount)}
            size="large"
            disabled={!newBalance || isNaN(addAmount) || addAmount <= 0}
            sx={{
              backgroundColor: '#4CAF50',
              '&:hover': { backgroundColor: '#388E3C' },
            }}
          >
            + {(!newBalance || isNaN(addAmount) || addAmount <= 0) ? '0.00' : addAmount.toFixed(2)} € {t('terminalView.addBalance')}
          </Button>
        </Box>

        {/* Reset to 0 */}
        <Box sx={{ textAlign: 'center' }}>
          <Button
            variant="outlined"
            color="error"
            onClick={handleResetBalance}
            size="large"
          >
            {t('terminalView.resetBalance')}
          </Button>
        </Box>
      </TerminalWrapper>
    );
  }

  // ─── Balance Updated Confirmation ───
  if (step === 'balanceUpdated') {
    return (
      <TerminalWrapper codeName={codeName} terminalName={info.terminal.name} connected={connected}>
        <Box sx={{ textAlign: 'center' }}>
          <AccountBalanceWalletIcon
            sx={{ fontSize: 80, color: '#4CAF50', mb: 2 }}
          />
          <Typography variant="h4" fontWeight={700} color="success.main">
            {t('terminalView.balanceUpdated')}
          </Typography>
          <Typography variant="h5" sx={{ mt: 2 }}>
            {t('terminalView.newBalance')}{' '}
            <strong
              style={{
                color: balance >= 0 ? '#4CAF50' : '#F44336',
              }}
            >
              {balance.toFixed(2)} €
            </strong>
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 2 }}>
            {t('terminalView.backToStart')}
          </Typography>
        </Box>
      </TerminalWrapper>
    );
  }

  // ─── Guest Coffee Confirmation ───
  if (step === 'guestCoffeeCounted') {
    return (
      <TerminalWrapper codeName={codeName} terminalName={info.terminal.name} connected={connected}>
        <Box sx={{ textAlign: 'center' }}>
          <LocalCafeIcon sx={{ fontSize: 80, color: '#4CAF50', mb: 2 }} />
          <Typography variant="h4" fontWeight={700} color="success.main">
            {t('terminalView.guestCoffeeSuccess', { price: guestCoffeePrice.toFixed(2) })}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 2 }}>
            {t('terminalView.backToStart')}
          </Typography>
        </Box>
      </TerminalWrapper>
    );
  }

  return null;
}

/* ─── Layout Helpers ─── */

function ConnectionIndicator({ connected }: { connected: boolean }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <FiberManualRecordIcon
        sx={{
          fontSize: 10,
          color: connected ? '#4CAF50' : '#F44336',
          animation: connected ? 'none' : 'blink 1.5s infinite',
          '@keyframes blink': {
            '0%': { opacity: 1 },
            '50%': { opacity: 0.3 },
            '100%': { opacity: 1 },
          },
        }}
      />
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
        {connected ? 'Verbunden' : 'Keine Verbindung'}
      </Typography>
    </Box>
  );
}

function CenteredBox({ children, codeName, connected = true }: { children: React.ReactNode; codeName?: string; connected?: boolean }) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FAF6F1',
      }}
    >
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, pb: 2 }}>
        <ConnectionIndicator connected={connected} />
        {codeName && (
          <Typography variant="caption" color="text.secondary">
            CupTrack &mdash; {codeName}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

function TerminalWrapper({ children, codeName, terminalName, connected = true }: { children: React.ReactNode; codeName?: string; terminalName?: string; connected?: boolean }) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: '#FAF6F1',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'center',
        pt: { xs: 2, sm: 4 },
        px: 2,
        pb: 2,
      }}
    >
      <Paper
        elevation={3}
        sx={{
          maxWidth: 480,
          width: '100%',
          p: { xs: 2, sm: 4 },
          borderRadius: 3,
          flex: 1,
        }}
      >
        {children}
      </Paper>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, mt: 2 }}>
        <ConnectionIndicator connected={connected} />
        {terminalName && (
          <Typography variant="caption" color="text.secondary">
            {terminalName}
          </Typography>
        )}
        {codeName && (
          <Typography variant="caption" color="text.secondary">
            CupTrack &mdash; {codeName}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
