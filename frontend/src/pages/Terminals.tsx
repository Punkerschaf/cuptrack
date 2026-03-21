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
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SearchIcon from '@mui/icons-material/Search';
import { api } from '../api';
import type { Terminal, Machine, LogEntry } from '../types';

type SortKey = 'name' | 'machineName';
type SortDir = 'asc' | 'desc';

export default function Terminals() {
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editTerminal, setEditTerminal] = useState<Terminal | null>(null);
  const [infoTerminal, setInfoTerminal] = useState<Terminal | null>(null);
  const [infoLogs, setInfoLogs] = useState<LogEntry[]>([]);
  const [infoLoading, setInfoLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.getTerminals(), api.getMachines()])
      .then(([t, m]) => {
        setTerminals(t);
        setMachines(m);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const getMachineName = (t: Terminal) => t.machine?.name || '—';

  const filtered = terminals
    .filter((t) => {
      const q = search.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        getMachineName(t).toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const aVal = sortKey === 'machineName' ? getMachineName(a) : a.name;
      const bVal = sortKey === 'machineName' ? getMachineName(b) : b.name;
      const cmp = aVal.localeCompare(bVal);
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const openInfo = async (terminal: Terminal) => {
    setInfoTerminal(terminal);
    setInfoLoading(true);
    try {
      setInfoLogs(await api.getTerminalLog(terminal.id));
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
          Terminalverwaltung
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateOpen(true)}
          disabled={machines.length === 0}
        >
          Neues Terminal
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {machines.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Erstelle zuerst eine Maschine, bevor du ein Terminal anlegen kannst.
        </Alert>
      )}

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
        sx={{ mb: 2, minWidth: 250 }}
      />

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel
                  active={sortKey === 'name'}
                  direction={sortKey === 'name' ? sortDir : 'asc'}
                  onClick={() => handleSort('name')}
                >
                  Name
                </TableSortLabel>
              </TableCell>
              <TableCell>Slug</TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortKey === 'machineName'}
                  direction={sortKey === 'machineName' ? sortDir : 'asc'}
                  onClick={() => handleSort('machineName')}
                >
                  Maschine
                </TableSortLabel>
              </TableCell>
              <TableCell>Typ</TableCell>
              <TableCell align="right">Aktionen</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((t) => (
              <TableRow key={t.id} hover>
                <TableCell>{t.name}</TableCell>
                <TableCell>
                  <Chip label={t.slug} size="small" variant="outlined" />
                </TableCell>
                <TableCell>{getMachineName(t)}</TableCell>
                <TableCell>
                  <Chip label={t.type.toUpperCase()} size="small" />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Terminal öffnen">
                    <IconButton
                      size="small"
                      onClick={() =>
                        window.open(`/terminals/${t.slug}`, '_blank')
                      }
                    >
                      <OpenInNewIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Info">
                    <IconButton size="small" onClick={() => openInfo(t)}>
                      <InfoIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Bearbeiten">
                    <IconButton
                      size="small"
                      onClick={() => setEditTerminal(t)}
                    >
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  Keine Terminals gefunden
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create */}
      <CreateTerminalDialog
        open={createOpen}
        machines={machines}
        onClose={() => setCreateOpen(false)}
        onCreated={load}
      />

      {/* Edit */}
      {editTerminal && (
        <EditTerminalDialog
          terminal={editTerminal}
          machines={machines}
          onClose={() => setEditTerminal(null)}
          onUpdated={load}
        />
      )}

      {/* Info */}
      {infoTerminal && (
        <TerminalInfoDialog
          terminal={infoTerminal}
          logs={infoLogs}
          loading={infoLoading}
          onClose={() => setInfoTerminal(null)}
        />
      )}
    </Box>
  );
}

/* ─── Create ─── */

function CreateTerminalDialog({
  open,
  machines,
  onClose,
  onCreated,
}: {
  open: boolean;
  machines: Machine[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    name: '',
    machineId: machines[0]?.id || '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      await api.createTerminal(form);
      onCreated();
      onClose();
      setForm({ name: '', machineId: machines[0]?.id || '' });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Neues Terminal</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <TextField
          fullWidth
          label="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          margin="dense"
          required
          helperText="Der URL-Slug wird automatisch aus dem Namen generiert"
        />
        <TextField
          fullWidth
          select
          label="Maschine"
          value={form.machineId}
          onChange={(e) => setForm({ ...form, machineId: e.target.value })}
          margin="dense"
          required
        >
          {machines.map((m) => (
            <MenuItem key={m.id} value={m.id}>
              {m.name} {m.room ? `(${m.room})` : ''}
            </MenuItem>
          ))}
        </TextField>
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

/* ─── Edit ─── */

function EditTerminalDialog({
  terminal,
  machines,
  onClose,
  onUpdated,
}: {
  terminal: Terminal;
  machines: Machine[];
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [form, setForm] = useState({
    name: terminal.name,
    machineId: terminal.machineId,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      await api.updateTerminal(terminal.id, form);
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
      await api.deleteTerminal(terminal.id);
      onUpdated();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler');
      setConfirmDelete(false);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Terminal bearbeiten: {terminal.name}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <TextField
          fullWidth
          label="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          margin="dense"
        />
        <TextField
          fullWidth
          select
          label="Maschine"
          value={form.machineId}
          onChange={(e) => setForm({ ...form, machineId: e.target.value })}
          margin="dense"
        >
          {machines.map((m) => (
            <MenuItem key={m.id} value={m.id}>
              {m.name} {m.room ? `(${m.room})` : ''}
            </MenuItem>
          ))}
        </TextField>
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

/* ─── Info ─── */

const LOG_LABELS: Record<string, string> = {
  coffee: 'Kaffee gezählt',
  balance: 'Guthaben geändert',
};

function TerminalInfoDialog({
  terminal,
  logs,
  loading,
  onClose,
}: {
  terminal: Terminal;
  logs: LogEntry[];
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Info: {terminal.name}</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            URL-Slug
          </Typography>
          <Typography>/terminals/{terminal.slug}</Typography>
        </Box>
        <Box sx={{ mb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Maschine
          </Typography>
          <Typography>{terminal.machine?.name || '—'}</Typography>
        </Box>
        <Box sx={{ mb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Typ
          </Typography>
          <Chip label={terminal.type.toUpperCase()} size="small" />
        </Box>
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
                  primary={LOG_LABELS[log.type] || log.type}
                  secondary={new Date(log.createdAt).toLocaleString('de-DE')}
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
