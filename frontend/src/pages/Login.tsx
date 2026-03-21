import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import LocalCafeIcon from '@mui/icons-material/LocalCafe';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { api } from '../api';

export default function Login() {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [versionInfo, setVersionInfo] = useState<{ version: string; codeName: string } | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.getVersion().then((v) => setVersionInfo({ version: v.version, codeName: v.codeName })).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/dashboard');
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('auth.loginFailed'),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #6F4E37 0%, #3E2723 100%)',
      }}
    >
      <Card sx={{ maxWidth: 400, width: '100%', mx: 2 }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <LocalCafeIcon
              sx={{ fontSize: 48, color: 'primary.main', mb: 1 }}
            />
            <Typography variant="h4" fontWeight={700} color="primary.main">
              {t('auth.appName')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('auth.adminDashboard')}
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label={t('auth.username')}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              margin="normal"
              autoFocus
              required
            />
            <TextField
              fullWidth
              label={t('auth.password')}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              margin="normal"
              required
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <Button
              fullWidth
              type="submit"
              variant="contained"
              size="large"
              disabled={loading}
              sx={{ mt: 3 }}
            >
              {loading ? t('auth.loggingIn') : t('auth.login')}
            </Button>
          </form>
        </CardContent>
      </Card>
      {versionInfo && (
        <Typography
          variant="caption"
          sx={{ mt: 2, color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}
        >
          CupTrack v{versionInfo.version} &mdash; {versionInfo.codeName}
        </Typography>
      )}
    </Box>
  );
}
