import 'dotenv/config';

export default {
  port: parseInt(process.env.PORT || '3000', 10),
  jwtSecret: process.env.JWT_SECRET || 'cuptrack-dev-secret-change-in-production',
  rootUsername: process.env.ROOT_USERNAME || 'root',
  rootPassword: process.env.ROOT_PASSWORD || 'Coffee',
};
