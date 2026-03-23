import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Divider,
} from '@mui/material';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import LanguageIcon from '@mui/icons-material/Language';
import { useTranslation } from 'react-i18next';
import { api } from '../api';

interface LogCleanup {
  deletedAt: string;
  deletedBy: string;
  deletedCount: number;
  periodFrom: string;
  periodTo: string;
}

export default function Settings() {
  const { t, i18n } = useTranslation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);
  const [cleanups, setCleanups] = useState<LogCleanup[]>([]);
  const [cleanupsLoading, setCleanupsLoading] = useState(true);

  useEffect(() => {
    loadCleanups();
  }, []);

  const loadCleanups = async () => {
    setCleanupsLoading(true);
    try {
      const data = await api.getLogCleanups();
      setCleanups(data);
    } catch {
      // ignore
    } finally {
      setCleanupsLoading(false);
    }
  };

  const handleLanguageChange = async (lang: string) => {
    try {
      await api.updateSettings({ language: lang });
      i18n.changeLanguage(lang);
    } catch {
      // silently fail
    }
  };

  const handleCleanupLogs = async () => {
    setConfirmOpen(false);
    setLoading(true);
    setResult(null);
    try {
      const res = await api.cleanupLogs();
      if (res.deletedCount === 0) {
        setResult({ type: 'info', message: t('settings.noOldLogs') });
      } else {
        setResult({
          type: 'success',
          message: t('settings.logsDeleted', {
            count: res.deletedCount,
            from: new Date(res.periodFrom!).toLocaleDateString(i18n.language),
            to: new Date(res.periodTo!).toLocaleDateString(i18n.language),
          }),
        });
        loadCleanups();
      }
    } catch {
      setResult({ type: 'error', message: t('settings.cleanupError') });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language);

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 700 }}>
        {t('settings.title')}
      </Typography>

      {/* Language Setting */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <LanguageIcon color="primary" />
          <Typography variant="h6">{t('settings.language')}</Typography>
        </Box>
        <Select
          size="small"
          value={i18n.language}
          onChange={(e) => handleLanguageChange(e.target.value)}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="de">{t('settings.german')}</MenuItem>
          <MenuItem value="en">{t('settings.english')}</MenuItem>
        </Select>
      </Paper>

      <Divider sx={{ my: 3 }} />

      {/* Log Cleanup */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <DeleteSweepIcon color="primary" />
          <Typography variant="h6">{t('settings.logCleanup')}</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('settings.logCleanupDescription')}
        </Typography>

        {result && (
          <Alert severity={result.type} sx={{ mb: 2 }} onClose={() => setResult(null)}>
            {result.message}
          </Alert>
        )}

        <Button
          variant="contained"
          color="error"
          startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <DeleteSweepIcon />}
          onClick={() => setConfirmOpen(true)}
          disabled={loading}
        >
          {t('settings.deleteOldLogs')}
        </Button>
      </Paper>

      {/* Cleanup History */}
      {!cleanupsLoading && cleanups.length > 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            {t('settings.cleanupHistory')}
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('settings.cleanupDate')}</TableCell>
                  <TableCell>{t('settings.cleanupBy')}</TableCell>
                  <TableCell>{t('settings.cleanupCount')}</TableCell>
                  <TableCell>{t('settings.cleanupPeriod')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {cleanups.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell>{formatDate(c.deletedAt)}</TableCell>
                    <TableCell>{c.deletedBy}</TableCell>
                    <TableCell>{c.deletedCount}</TableCell>
                    <TableCell>
                      {new Date(c.periodFrom).toLocaleDateString(i18n.language)}
                      {' – '}
                      {new Date(c.periodTo).toLocaleDateString(i18n.language)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>{t('settings.confirmCleanupTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t('settings.confirmCleanupText')}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleCleanupLogs} color="error" variant="contained">
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
