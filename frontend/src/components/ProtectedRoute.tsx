import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CircularProgress, Box } from '@mui/material';

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!user || user.type !== 'admin') return <Navigate to="/login" replace />;

  return <>{children}</>;
}
