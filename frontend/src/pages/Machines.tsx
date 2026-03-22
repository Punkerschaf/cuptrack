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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
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
import SearchIcon from '@mui/icons-material/Search';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import type { Machine, LogEntry } from '../types';

type SortKey = 'name' | 'room' | 'pricePerCoffee';
type SortDir = 'asc' | 'desc';

export default function Machines() {
  const { t } = useTranslation();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editMachine, setEditMachine] = useState<Machine | null>(null);
  const [infoMachine, setInfoMachine] = useState<Machine | null>(null);
  const [infoLogs, setInfoLogs] = useState<LogEntry[]>([]);
  const [infoLoading, setInfoLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .getMachines()
      .then(setMachines)
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

  const filtered = machines
    .filter((m) => {
      const q = search.toLowerCase();
      return (
        m.name.toLowerCase().includes(q) ||
        m.room.toLowerCase().includes(q)
      );
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

  const openInfo = async (machine: Machine) => {
    setInfoMachine(machine);
    setInfoLoading(true);
    try {
      setInfoLogs(await api.getMachineLog(machine.id));
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
          {t('machines.title')}
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateOpen(true)}
        >
          {t('machines.newMachine')}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

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
                  {t('common.name')}
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortKey === 'room'}
                  direction={sortKey === 'room' ? sortDir : 'asc'}
                  onClick={() => handleSort('room')}
                >
                  {t('machines.room')}
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">
                <TableSortLabel
                  active={sortKey === 'pricePerCoffee'}
                  direction={sortKey === 'pricePerCoffee' ? sortDir : 'asc'}
                  onClick={() => handleSort('pricePerCoffee')}
                >
                  {t('machines.pricePerCoffee')}
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">{t('common.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((m) => (
              <TableRow key={m.id} hover>
                <TableCell>{m.name}</TableCell>
                <TableCell>{m.room || '—'}</TableCell>
                <TableCell align="right">
                  {m.pricePerCoffee.toFixed(2)} €
                </TableCell>
                <TableCell align="right">
                  <Tooltip title={t('common.info')}>
                    <IconButton size="small" onClick={() => openInfo(m)}>
                      <InfoIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={t('common.edit')}>
                    <IconButton
                      size="small"
                      onClick={() => setEditMachine(m)}
                    >
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  {t('machines.noMachines')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create */}
      <CreateMachineDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={load}
      />

      {/* Edit */}
      {editMachine && (
        <EditMachineDialog
          machine={editMachine}
          onClose={() => setEditMachine(null)}
          onUpdated={load}
        />
      )}

      {/* Info */}
      {infoMachine && (
        <MachineInfoDialog
          machine={infoMachine}
          logs={infoLogs}
          loading={infoLoading}
          onClose={() => setInfoMachine(null)}
        />
      )}
    </Box>
  );
}

/* ─── Create ─── */

function CreateMachineDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({ name: '', room: '', pricePerCoffee: '0.50' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const { t } = useTranslation();

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      await api.createMachine({
        name: form.name,
        room: form.room,
        pricePerCoffee: parseFloat(form.pricePerCoffee),
      });
      onCreated();
      onClose();
      setForm({ name: '', room: '', pricePerCoffee: '0.50' });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('machines.createTitle')}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <TextField
          fullWidth
          label={t('common.name')}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          margin="dense"
          required
        />
        <TextField
          fullWidth
          label={t('machines.room')}
          value={form.room}
          onChange={(e) => setForm({ ...form, room: e.target.value })}
          margin="dense"
        />
        <TextField
          fullWidth
          label={t('machines.priceLabel')}
          type="number"
          inputProps={{ step: '0.01', min: '0' }}
          value={form.pricePerCoffee}
          onChange={(e) =>
            setForm({ ...form, pricePerCoffee: e.target.value })
          }
          margin="dense"
          required
        />
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

/* ─── Edit ─── */

function EditMachineDialog({
  machine,
  onClose,
  onUpdated,
}: {
  machine: Machine;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [form, setForm] = useState({
    name: machine.name,
    room: machine.room,
    pricePerCoffee: String(machine.pricePerCoffee),
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { t } = useTranslation();

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      await api.updateMachine(machine.id, {
        name: form.name,
        room: form.room,
        pricePerCoffee: parseFloat(form.pricePerCoffee),
      });
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
      await api.deleteMachine(machine.id);
      onUpdated();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('common.error'));
      setConfirmDelete(false);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('machines.editTitle', { name: machine.name })}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <TextField
          fullWidth
          label={t('common.name')}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          margin="dense"
        />
        <TextField
          fullWidth
          label={t('machines.room')}
          value={form.room}
          onChange={(e) => setForm({ ...form, room: e.target.value })}
          margin="dense"
        />
        <TextField
          fullWidth
          label={t('machines.priceLabel')}
          type="number"
          inputProps={{ step: '0.01', min: '0' }}
          value={form.pricePerCoffee}
          onChange={(e) =>
            setForm({ ...form, pricePerCoffee: e.target.value })
          }
          margin="dense"
        />
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
              <Button color="error" variant="contained" size="small" onClick={handleDelete}>
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

/* ─── Info ─── */

function MachineInfoDialog({
  machine,
  logs,
  loading,
  onClose,
}: {
  machine: Machine;
  logs: LogEntry[];
  loading: boolean;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const LOG_LABELS: Record<string, string> = {
    coffee: t('logs.coffee'),
    balance: t('logs.balance'),
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('machines.infoTitle', { name: machine.name })}</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {t('machines.room')}
          </Typography>
          <Typography>{machine.room || '—'}</Typography>
        </Box>
        <Box sx={{ mb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {t('machines.pricePerCoffee')}
          </Typography>
          <Typography>{machine.pricePerCoffee.toFixed(2)} €</Typography>
        </Box>
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
                  primary={LOG_LABELS[log.type] || log.type}
                  secondary={new Date(log.createdAt).toLocaleString(i18n.language === 'de' ? 'de-DE' : 'en-US')}
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
