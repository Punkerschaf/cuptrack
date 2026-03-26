import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Paper,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Alert,
  CircularProgress,
  Tooltip,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import InfoIcon from '@mui/icons-material/Info';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import type { User, LogEntry, Identifier } from '../types';

type SortKey = 'displayName' | 'username' | 'type' | 'balance';
type SortDir = 'asc' | 'desc';

const TYPE_LABELS: Record<string, string> = {
  admin: 'Admin',
  api: 'API-User',
  drinker: 'Drinker',
};

const TYPE_COLORS: Record<string, 'primary' | 'secondary' | 'default'> = {
  admin: 'primary',
  api: 'secondary',
  drinker: 'default',
};

export default function Users() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('displayName');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [error, setError] = useState('');

  // Modal states
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [infoUser, setInfoUser] = useState<User | null>(null);
  const [infoLogs, setInfoLogs] = useState<LogEntry[]>([]);
  const [infoLoading, setInfoLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .getUsers()
      .then(setUsers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const filtered = users
    .filter((u) => {
      const q = search.toLowerCase();
      const matchesSearch =
        u.displayName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q);
      const matchesType = !typeFilter || u.type === typeFilter;
      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      const cmp =
        typeof aVal === 'number' && typeof bVal === 'number'
          ? aVal - bVal
          : String(aVal).localeCompare(String(bVal));
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const openInfo = async (user: User) => {
    setInfoUser(user);
    setInfoLoading(true);
    try {
      const logs = await api.getUserLog(user.id);
      setInfoLogs(logs);
    } catch {
      setInfoLogs([]);
    } finally {
      setInfoLoading(false);
    }
  };

  if (loading)
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Typography variant="h4" fontWeight={700}>
          {t('users.title')}
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateOpen(true)}
        >
          {t('users.newUser')}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder={t('common.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 250 }}
        />
        <TextField
          size="small"
          select
          label={t('common.type')}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          sx={{ minWidth: 150 }}
        >
          <MenuItem value="">{t('common.all')}</MenuItem>
          <MenuItem value="admin">{t('users.typeAdmin')}</MenuItem>
          <MenuItem value="api">{t('users.typeApi')}</MenuItem>
          <MenuItem value="drinker">{t('users.typeDrinker')}</MenuItem>
        </TextField>
      </Box>

      {/* Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel
                  active={sortKey === 'displayName'}
                  direction={sortKey === 'displayName' ? sortDir : 'asc'}
                  onClick={() => handleSort('displayName')}
                >
                  {t('common.name')}
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortKey === 'username'}
                  direction={sortKey === 'username' ? sortDir : 'asc'}
                  onClick={() => handleSort('username')}
                >
                  {t('auth.username')}
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortKey === 'type'}
                  direction={sortKey === 'type' ? sortDir : 'asc'}
                  onClick={() => handleSort('type')}
                >
                  {t('common.type')}
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">
                <TableSortLabel
                  active={sortKey === 'balance'}
                  direction={sortKey === 'balance' ? sortDir : 'asc'}
                  onClick={() => handleSort('balance')}
                >
                  {t('users.balance')}
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">{t('common.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((user) => (
              <TableRow key={user.id} hover>
                <TableCell>
                  {user.displayName}
                  {user.isRoot && (
                    <Chip label="Root" size="small" sx={{ ml: 1 }} />
                  )}
                </TableCell>
                <TableCell>{user.username}</TableCell>
                <TableCell>
                  <Chip
                    label={TYPE_LABELS[user.type]}
                    color={TYPE_COLORS[user.type]}
                    size="small"
                  />
                </TableCell>
                <TableCell align="right">
                  {user.type === 'drinker'
                    ? `${user.balance.toFixed(2)} €`
                    : '—'}
                </TableCell>
                <TableCell align="right">
                  <Tooltip title={t('common.info')}>
                    <IconButton
                      size="small"
                      onClick={() => openInfo(user)}
                    >
                      <InfoIcon />
                    </IconButton>
                  </Tooltip>
                  {!user.isRoot && (
                    <Tooltip title={t('common.edit')}>
                      <IconButton
                        size="small"
                        onClick={() => setEditUser(user)}
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  {t('users.noUsers')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create Dialog */}
      <CreateUserDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={load}
      />

      {/* Edit Dialog */}
      {editUser && (
        <EditUserDialog
          user={editUser}
          onClose={() => setEditUser(null)}
          onUpdated={load}
        />
      )}

      {/* Info Dialog */}
      {infoUser && (
        <InfoDialog
          user={infoUser}
          logs={infoLogs}
          loading={infoLoading}
          onClose={() => setInfoUser(null)}
        />
      )}
    </Box>
  );
}

/* ─── Create User Dialog ─── */

function CreateUserDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    username: '',
    displayName: '',
    password: '',
    type: 'drinker' as string,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const { t } = useTranslation();

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      await api.createUser(form);
      onCreated();
      onClose();
      setForm({ username: '', displayName: '', password: '', type: 'drinker' });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('users.createTitle')}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <TextField
          fullWidth
          label={t('auth.username')}
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          margin="dense"
          required
        />
        <TextField
          fullWidth
          label={t('users.displayName')}
          value={form.displayName}
          onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          margin="dense"
          required
        />
        <TextField
          fullWidth
          select
          label={t('common.type')}
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
          margin="dense"
        >
          <MenuItem value="admin">{t('users.typeAdmin')}</MenuItem>
          <MenuItem value="api">{t('users.typeApi')}</MenuItem>
          <MenuItem value="drinker">{t('users.typeDrinker')}</MenuItem>
        </TextField>
        {form.type !== 'api' && (
          <TextField
            fullWidth
            label={t('auth.password')}
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            margin="dense"
            required
          />
        )}
        {form.type === 'drinker' && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {t('users.pinAutoGenerated')}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {t('common.create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ─── Edit User Dialog ─── */

function EditUserDialog({
  user,
  onClose,
  onUpdated,
}: {
  user: User;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [form, setForm] = useState({
    displayName: user.displayName,
    password: '',
    balance: String(user.balance),
    identifiers: [...user.identifiers],
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { t } = useTranslation();

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      const data: Record<string, unknown> = {
        displayName: form.displayName,
      };
      if (form.password) data.password = form.password;
      if (user.type === 'drinker') {
        data.balance = parseFloat(form.balance);
        data.identifiers = form.identifiers;
      }
      await api.updateUser(user.id, data);
      onUpdated();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.deleteUser(user.id);
      onUpdated();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('common.error'));
      setConfirmDelete(false);
    }
  };

  const updateIdentifier = (idx: number, value: string) => {
    const updated = [...form.identifiers];
    updated[idx] = { ...updated[idx], value };
    setForm({ ...form, identifiers: updated });
  };

  const removeIdentifier = (idx: number) => {
    setForm({
      ...form,
      identifiers: form.identifiers.filter((_, i) => i !== idx),
    });
  };

  const addIdentifier = (type: Identifier['type']) => {
    setForm({
      ...form,
      identifiers: [
        ...form.identifiers,
        { id: crypto.randomUUID(), type, value: '' },
      ],
    });
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {t('users.editTitle', { name: user.displayName })}
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <TextField
          fullWidth
          label={t('users.displayName')}
          value={form.displayName}
          onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          margin="dense"
        />
        {user.type !== 'api' && (
          <TextField
            fullWidth
            label={t('users.newPassword')}
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            margin="dense"
          />
        )}
        {user.type === 'drinker' && (
          <>
            <TextField
              fullWidth
              label={t('users.balanceLabel')}
              type="number"
              value={form.balance}
              onChange={(e) => setForm({ ...form, balance: e.target.value })}
              margin="dense"
            />
            <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
              {t('users.identifier')}
            </Typography>
            {form.identifiers.map((ident, idx) => (
              <Box
                key={ident.id}
                sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}
              >
                <Chip label={ident.type === 'kaba_nfc' ? 'KABA NFC (SN#)' : ident.type.toUpperCase()} size="small" />
                <TextField
                  size="small"
                  value={ident.value}
                  onChange={(e) => {
                    if (ident.type === 'pin') {
                      const v = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
                      updateIdentifier(idx, v);
                    } else {
                      updateIdentifier(idx, e.target.value);
                    }
                  }}
                  placeholder={ident.type === 'kaba_nfc' ? '01:23:45:67:89:AB:CD' : ''}
                  sx={{ flex: 1 }}
                  {...(ident.type === 'pin' && {
                    inputProps: { inputMode: 'numeric', pattern: '[0-9]{4}', maxLength: 4 },
                    error: ident.value.length > 0 && ident.value.length < 4,
                    helperText: ident.value.length > 0 && ident.value.length < 4 ? t('users.pinMustBe4Digits') : '',
                  })}
                />
                <IconButton
                  size="small"
                  onClick={() => removeIdentifier(idx)}
                  color="error"
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
            <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
              <Button size="small" onClick={() => addIdentifier('pin')} disabled={form.identifiers.some(i => i.type === 'pin')}>
                + PIN
              </Button>
              <Button size="small" onClick={() => addIdentifier('rfid')}>
                + RFID
              </Button>
              <Button size="small" onClick={() => addIdentifier('nfc')}>
                + NFC
              </Button>
              <Button size="small" onClick={() => addIdentifier('kaba_nfc')}>
                + KABA NFC (SN#)
              </Button>
              <Button size="small" onClick={() => addIdentifier('qr')}>
                + QR
              </Button>
            </Box>
          </>
        )}
        {user.type === 'api' && user.apiKey && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2">{t('users.apiKey')}</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TextField
                size="small"
                value={user.apiKey}
                fullWidth
                InputProps={{ readOnly: true }}
              />
              <IconButton
                size="small"
                onClick={() =>
                  navigator.clipboard.writeText(user.apiKey!)
                }
              >
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between' }}>
        <Box>
          {!confirmDelete ? (
            <Button color="error" onClick={() => setConfirmDelete(true)}>
              {t('common.delete')}
            </Button>
          ) : (
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Typography variant="body2" color="error">
                {t('common.confirmDelete')}
              </Typography>
              <Button
                color="error"
                variant="contained"
                size="small"
                onClick={handleDelete}
              >
                {t('common.yes')}
              </Button>
              <Button size="small" onClick={() => setConfirmDelete(false)}>
                {t('common.no')}
              </Button>
            </Box>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {t('common.save')}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}

/* ─── Info Dialog ─── */

function InfoDialog({
  user,
  logs,
  loading,
  onClose,
}: {
  user: User;
  logs: LogEntry[];
  loading: boolean;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const LOG_TYPE_LABELS: Record<string, string> = {
    coffee: t('logs.coffee'),
    balance: t('logs.balance'),
    login: t('logs.login'),
    user_created: t('logs.userCreated'),
    user_deleted: t('logs.userDeleted'),
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('users.infoTitle', { name: user.displayName })}</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {t('auth.username')}
          </Typography>
          <Typography>{user.username}</Typography>
        </Box>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {t('common.type')}
          </Typography>
          <Chip label={TYPE_LABELS[user.type]} size="small" />
        </Box>
        {user.type === 'drinker' && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {t('users.currentBalance')}
            </Typography>
            <Typography
              variant="h5"
              fontWeight={700}
              color={user.balance >= 0 ? 'success.main' : 'error.main'}
            >
              {user.balance.toFixed(2)} €
            </Typography>
          </Box>
        )}
        <Divider sx={{ my: 2 }} />
        <Typography variant="h6" gutterBottom>
          {t('common.activityLog')}
        </Typography>
        {loading ? (
          <CircularProgress size={24} />
        ) : logs.length === 0 ? (
          <Typography color="text.secondary">{t('common.noEntries')}</Typography>
        ) : (
          <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
            {logs.slice(0, 50).map((log) => (
              <ListItem key={log.id}>
                <ListItemText
                  primary={LOG_TYPE_LABELS[log.type] || log.type}
                  secondary={`${new Date(log.createdAt).toLocaleString(i18n.language === 'de' ? 'de-DE' : 'en-US')}${
                    log.details
                      ? ' — ' +
                        Object.entries(log.details)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(', ')
                      : ''
                  }`}
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.close')}</Button>
      </DialogActions>
    </Dialog>
  );
}
