require('dotenv').config();

module.exports = {
  PORT: parseInt(process.env.PORT, 10) || 5000,
  FTPS_HOST: process.env.FTPS_HOST || 'nas.frengp.cz',
  FTPS_USER: process.env.FTPS_USER || '',
  FTPS_REJECT_UNAUTHORIZED: process.env.FTPS_REJECT_UNAUTHORIZED === 'true',
  SESSION_SECRET: process.env.SESSION_SECRET || 'nas-super-secret-key-change-in-production',
  SESSION_TTL_MS: (parseInt(process.env.SESSION_TTL_HOURS, 10) || 24) * 60 * 60 * 1000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
};
