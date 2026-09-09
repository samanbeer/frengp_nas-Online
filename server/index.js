const app = require('./app');
const config = require('./config');

app.listen(config.PORT, () => {
  console.log(`=========================================`);
  console.log(`🚀 NAS File Manager Server běží na portu: ${config.PORT}`);
  console.log(`📁 FTPS Cíl: ftps://${config.FTPS_HOST}:${config.FTPS_PORT}`);
  console.log(`🌐 Prostředí: ${config.NODE_ENV}`);
  console.log(`=========================================`);
});
