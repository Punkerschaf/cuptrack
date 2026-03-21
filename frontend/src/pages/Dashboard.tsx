import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
} from '@mui/material';
import LocalCafeIcon from '@mui/icons-material/LocalCafe';
import PeopleIcon from '@mui/icons-material/People';
import CoffeeMakerIcon from '@mui/icons-material/CoffeeMaker';
import TabletIcon from '@mui/icons-material/Tablet';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import type { DashboardStats } from '../types';

export default function Dashboard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getDashboardStats()
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  if (!stats)
    return (
      <Typography color="error">
        {t('dashboard.errorLoading')}
      </Typography>
    );

  const summaryCards = [
    {
      label: t('dashboard.coffeesToday'),
      value: stats.coffeesToday,
      icon: <LocalCafeIcon fontSize="large" />,
      color: '#6F4E37',
    },
    {
      label: t('dashboard.coffeesTotal'),
      value: stats.totalCoffees,
      icon: <LocalCafeIcon fontSize="large" />,
      color: '#8D6E63',
    },
    {
      label: t('dashboard.users'),
      value: stats.totalUsers,
      icon: <PeopleIcon fontSize="large" />,
      color: '#A1887F',
    },
    {
      label: t('dashboard.machines'),
      value: stats.totalMachines,
      icon: <CoffeeMakerIcon fontSize="large" />,
      color: '#D4A574',
    },
    {
      label: t('dashboard.terminals'),
      value: stats.totalTerminals,
      icon: <TabletIcon fontSize="large" />,
      color: '#BCAAA4',
    },
  ];

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        {t('dashboard.title')}
      </Typography>

      {/* Summary Cards */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, 1fr)',
            sm: 'repeat(3, 1fr)',
            md: 'repeat(5, 1fr)',
          },
          gap: 2,
          mb: 4,
        }}
      >
        {summaryCards.map((card) => (
          <Card key={card.label}>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Box sx={{ color: card.color, mb: 1 }}>{card.icon}</Box>
              <Typography variant="h4" fontWeight={700}>
                {card.value}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {card.label}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Chart + Lists */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' },
          gap: 3,
        }}
      >
        {/* Bar Chart */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {t('dashboard.coffeesPerDay')}
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.coffeesPerDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d: string) => d.slice(5)}
                  fontSize={12}
                />
                <YAxis allowDecimals={false} />
                <Tooltip labelFormatter={(d: string) => t('dashboard.date', { date: d })} />
                <Bar
                  dataKey="count"
                  fill="#6F4E37"
                  name={t('dashboard.coffees')}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Side Lists */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('dashboard.topDrinkers')}
              </Typography>
              {stats.topDrinkers.length === 0 ? (
                <Typography color="text.secondary">
                  {t('dashboard.noData')}
                </Typography>
              ) : (
                stats.topDrinkers.map((d, i) => (
                  <Box
                    key={d.userId}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      py: 0.5,
                    }}
                  >
                    <Typography>
                      {i + 1}. {d.displayName}
                    </Typography>
                    <Typography fontWeight={600}>{d.count}</Typography>
                  </Box>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('dashboard.popularMachines')}
              </Typography>
              {stats.popularMachines.length === 0 ? (
                <Typography color="text.secondary">
                  {t('dashboard.noData')}
                </Typography>
              ) : (
                stats.popularMachines.map((m, i) => (
                  <Box
                    key={m.machineId}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      py: 0.5,
                    }}
                  >
                    <Typography>
                      {i + 1}. {m.name}
                    </Typography>
                    <Typography fontWeight={600}>{m.count}</Typography>
                  </Box>
                ))
              )}
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
}
