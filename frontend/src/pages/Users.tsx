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
          Benutzerverwaltung
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateOpen(true)}
        >
          Neuer Benutzer
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
          placeholder="Suchen..."
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
          label="Typ"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          sx={{ minWidth: 150 }}
        >
          <MenuItem value="">Alle</MenuItem>
          <MenuItem value="admin">Admin</MenuItem>
          <MenuItem value="api">API-User</MenuItem>
          <MenuItem value="drinker">Drinker</MenuItem>
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
                  Name
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortKey === 'username'}
                  direction={sortKey === 'username' ? sortDir : 'asc'}
                  onClick={() => handleSort('username')}
                >
                  Benutzername
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortKey === 'type'}
                  direction={sortKey === 'type' ? sortDir : 'asc'}
                  onClick={() => handleSort('type')}
                >
                  Typ
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">
                <TableSortLabel
                  active={sortKey === 'balance'}
                  direction={sortKey === 'balance' ? sortDir : 'asc'}
                  onClick={() => handleSort('balance')}
                >
                  Guthaben
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">Aktionen</TableCell>
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
                  <Tooltip title="Info">
                    <IconButton
                      size="small"
                      onClick={() => openInfo(user)}
                    >
                      <InfoIcon />
                    </IconButton>
                  </Tooltip>
                  {!user.isRoot && (
                    <Tooltip title="Bearbeiten">
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
                  Keine Benutzer gefunden
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

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      await api.createUser(form);
      onCreated();
      onClose();
      setForm({ username: '', displayName: '', password: '', type: 'drinker' });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Neuer Benutzer</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <TextField
          fullWidth
          label="Benutzername"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          margin="dense"
          required
        />
        <TextField
          fullWidth
          label="Anzeigename"
          value={form.displayName}
          onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          margin="dense"
          required
        />
        <TextField
          fullWidth
          select
          label="Typ"
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
          margin="dense"
        >
          <MenuItem value="admin">Admin</MenuItem>
          <MenuItem value="api">API-User</MenuItem>
          <MenuItem value="drinker">Drinker</MenuItem>
        </TextField>
        {form.type !== 'api' && (
          <TextField
            fullWidth
            label="Passwort"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            margin="dense"
            required
          />
        )}
        {form.type === 'drinker' && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Eine Terminal-PIN wird automatisch generiert.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Abbrechen</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          Erstellen
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
      setError(e instanceof Error ? e.message : 'Fehler');
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
      setError(e instanceof Error ? e.message : 'Fehler');
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
        Benutzer bearbeiten: {user.displayName}
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <TextField
          fullWidth
          label="Anzeigename"
          value={form.displayName}
          onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          margin="dense"
        />
        {user.type !== 'api' && (
          <TextField
            fullWidth
            label="Neues Passwort (leer lassen = unverändert)"
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
              label="Guthaben (€)"
              type="number"
              value={form.balance}
              onChange={(e) => setForm({ ...form, balance: e.target.value })}
              margin="dense"
            />
            <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
              Identifier
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
                  onChange={(e) => updateIdentifier(idx, e.target.value)}
                  placeholder={ident.type === 'kaba_nfc' ? '01:23:45:67:89:AB:CD' : ''}
                  sx={{ flex: 1 }}
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
              <Button size="small" onClick={() => addIdentifier('pin')}>
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
            <Typography variant="subtitle2">API-Key</Typography>
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
              Löschen
            </Button>
          ) : (
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Typography variant="body2" color="error">
                Wirklich löschen?
              </Typography>
              <Button
                color="error"
                variant="contained"
                size="small"
                onClick={handleDelete}
              >
                Ja
              </Button>
              <Button size="small" onClick={() => setConfirmDelete(false)}>
                Nein
              </Button>
            </Box>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            Speichern
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}

/* ─── Info Dialog ─── */

const LOG_TYPE_LABELS: Record<string, string> = {
  coffee: 'Kaffee gezählt',
  balance: 'Guthaben geändert',
  login: 'Anmeldung',
  user_created: 'Benutzer erstellt',
  user_deleted: 'Benutzer gelöscht',
};

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
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Info: {user.displayName}</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Benutzername
          </Typography>
          <Typography>{user.username}</Typography>
        </Box>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Typ
          </Typography>
          <Chip label={TYPE_LABELS[user.type]} size="small" />
        </Box>
        {user.type === 'drinker' && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Aktuelles Guthaben
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
          Aktivitätslog
        </Typography>
        {loading ? (
          <CircularProgress size={24} />
        ) : logs.length === 0 ? (
          <Typography color="text.secondary">Keine Einträge</Typography>
        ) : (
          <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
            {logs.slice(0, 50).map((log) => (
              <ListItem key={log.id}>
                <ListItemText
                  primary={LOG_TYPE_LABELS[log.type] || log.type}
                  secondary={`${new Date(log.createdAt).toLocaleString('de-DE')}${
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
        <Button onClick={onClose}>Schließen</Button>
      </DialogActions>
    </Dialog>
  );
}
