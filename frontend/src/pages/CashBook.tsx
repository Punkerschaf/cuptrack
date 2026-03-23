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
  Chip,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import type { CashBookEntry, User, Machine, Terminal } from '../types';

type SortKey = 'createdAt' | 'type' | 'amount';
type SortDir = 'asc' | 'desc';
type TypeFilter = 'all' | 'deposit' | 'withdrawal' | 'anonymous_coffee';

export default function CashBook() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<CashBookEntry[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [error, setError] = useState('');
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [deleteEntry, setDeleteEntry] = useState<CashBookEntry | null>(null);

  // Lookup maps for display names
  const [users, setUsers] = useState<User[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [terminals, setTerminals] = useState<Terminal[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.getCashBook(),
      api.getCashBookBalance(),
      api.getUsers(),
      api.getMachines(),
      api.getTerminals(),
    ])
      .then(([e, b, u, m, term]) => {
        setEntries(e);
        setBalance(b.balance);
        setUsers(u);
        setMachines(m);
        setTerminals(term);
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
      setSortDir(key === 'createdAt' ? 'desc' : 'asc');
    }
  };

  const getUserName = (id: string) => {
    if (id === 'terminal') return t('cashBook.terminal');
    const user = users.find((u) => u.id === id);
    return user ? user.displayName : id;
  };

  const getMachineName = (id: string | null) => {
    if (!id) return '–';
    const machine = machines.find((m) => m.id === id);
    return machine ? machine.name : id;
  };

  const getTerminalName = (id: string | null) => {
    if (!id) return '';
    const terminal = terminals.find((t) => t.id === id);
    return terminal ? terminal.name : '';
  };

  const typeLabel = (type: CashBookEntry['type']) => {
    switch (type) {
      case 'deposit':
        return t('cashBook.deposit');
      case 'withdrawal':
        return t('cashBook.withdrawal');
      case 'anonymous_coffee':
        return t('cashBook.anonymousCoffee');
    }
  };

  const typeColor = (type: CashBookEntry['type']): 'success' | 'error' | 'info' => {
    switch (type) {
      case 'deposit':
        return 'success';
      case 'withdrawal':
        return 'error';
      case 'anonymous_coffee':
        return 'info';
    }
  };

  const filtered = entries
    .filter((e) => {
      if (typeFilter !== 'all' && e.type !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          e.comment.toLowerCase().includes(q) ||
          getUserName(e.performedBy).toLowerCase().includes(q) ||
          getMachineName(e.machineId).toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      let cmp: number;
      switch (sortKey) {
        case 'createdAt':
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'type':
          cmp = a.type.localeCompare(b.type);
          break;
        case 'amount':
          cmp = a.amount - b.amount;
          break;
        default:
          cmp = 0;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const handleDelete = async () => {
    if (!deleteEntry) return;
    try {
      await api.deleteCashBookEntry(deleteEntry.id);
      setDeleteEntry(null);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('common.error'));
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" mt={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header: Title + Balance + Action Button */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="h5" fontWeight={700}>
            {t('cashBook.title')}
          </Typography>
          <Typography
            variant="h6"
            fontWeight={600}
            color={balance >= 0 ? 'success.main' : 'error.main'}
          >
            {t('cashBook.balance')}: {balance.toFixed(2)} €
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<EditIcon />}
          onClick={() => setTransactionOpen(true)}
        >
          {t('cashBook.newTransaction')}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Filter Bar */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder={t('common.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 200 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <TextField
          size="small"
          select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="all">{t('common.all')}</MenuItem>
          <MenuItem value="deposit">{t('cashBook.deposit')}</MenuItem>
          <MenuItem value="withdrawal">{t('cashBook.withdrawal')}</MenuItem>
          <MenuItem value="anonymous_coffee">{t('cashBook.anonymousCoffee')}</MenuItem>
        </TextField>
      </Box>

      {/* Table */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel
                  active={sortKey === 'createdAt'}
                  direction={sortKey === 'createdAt' ? sortDir : 'desc'}
                  onClick={() => handleSort('createdAt')}
                >
                  {t('cashBook.date')}
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortKey === 'type'}
                  direction={sortKey === 'type' ? sortDir : 'asc'}
                  onClick={() => handleSort('type')}
                >
                  {t('cashBook.type')}
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">
                <TableSortLabel
                  active={sortKey === 'amount'}
                  direction={sortKey === 'amount' ? sortDir : 'asc'}
                  onClick={() => handleSort('amount')}
                >
                  {t('cashBook.amount')}
                </TableSortLabel>
              </TableCell>
              <TableCell>{t('cashBook.comment')}</TableCell>
              <TableCell>{t('cashBook.performedBy')}</TableCell>
              <TableCell>{t('cashBook.machine')}</TableCell>
              <TableCell align="center">{t('common.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography color="text.secondary" sx={{ py: 3 }}>
                    {t('cashBook.noEntries')}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {new Date(entry.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={typeLabel(entry.type)}
                      color={typeColor(entry.type)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      fontWeight: 600,
                      color: entry.type === 'withdrawal' ? 'error.main' : 'success.main',
                    }}
                  >
                    {entry.type === 'withdrawal' ? '−' : '+'} {entry.amount.toFixed(2)} €
                  </TableCell>
                  <TableCell>{entry.comment || '–'}</TableCell>
                  <TableCell>
                    {getUserName(entry.performedBy)}
                    {entry.terminalId && (
                      <Typography variant="caption" display="block" color="text.secondary">
                        {getTerminalName(entry.terminalId)}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{getMachineName(entry.machineId)}</TableCell>
                  <TableCell align="center">
                    {entry.type !== 'anonymous_coffee' && (
                      <Tooltip title={t('common.delete')}>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => setDeleteEntry(entry)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Transaction Dialog */}
      <TransactionDialog
        open={transactionOpen}
        onClose={() => setTransactionOpen(false)}
        onCreated={load}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteEntry} onClose={() => setDeleteEntry(null)}>
        <DialogTitle>{t('cashBook.confirmDeleteTitle')}</DialogTitle>
        <DialogContent>
          <Typography>{t('cashBook.confirmDeleteText')}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteEntry(null)}>{t('common.cancel')}</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

/* ─── Transaction Dialog (Deposit / Withdrawal) ─── */

function TransactionDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useTranslation();
  const [type, setType] = useState<'deposit' | 'withdrawal'>('withdrawal');
  const [amount, setAmount] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleClose = () => {
    setType('withdrawal');
    setAmount('');
    setComment('');
    setError('');
    onClose();
  };

  const handleSave = async () => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError(t('cashBook.amount'));
      return;
    }
    if (!comment.trim()) {
      setError(t('cashBook.comment'));
      return;
    }

    setSaving(true);
    setError('');
    try {
      const fn = type === 'deposit' ? api.createCashBookDeposit : api.createCashBookWithdrawal;
      await fn({ amount: parsedAmount, comment: comment.trim() });
      handleClose();
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('cashBook.newTransaction')}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
            {error}
          </Alert>
        )}
        <ToggleButtonGroup
          value={type}
          exclusive
          onChange={(_e, val) => { if (val) setType(val); }}
          fullWidth
          sx={{ mt: 1, mb: 2 }}
        >
          <ToggleButton value="withdrawal" color="error">
            {t('cashBook.withdrawal')}
          </ToggleButton>
          <ToggleButton value="deposit" color="success">
            {t('cashBook.deposit')}
          </ToggleButton>
        </ToggleButtonGroup>
        <TextField
          autoFocus
          fullWidth
          label={t('cashBook.amountLabel')}
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputProps={{ step: '0.01', min: '0.01' }}
          sx={{ mb: 2 }}
        />
        <TextField
          fullWidth
          label={t('cashBook.comment')}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          multiline
          rows={2}
          required
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{t('common.cancel')}</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          color={type === 'deposit' ? 'success' : 'error'}
          disabled={saving}
        >
          {saving ? <CircularProgress size={24} /> : t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
