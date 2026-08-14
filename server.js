const { ready } = require('./db');
const app = require('./app');

const PORT = process.env.PORT || 4000;

ready
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Tilus-Tech API démarrée sur le port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Impossible de se connecter à la base de données Turso :', err);
    process.exit(1);
  });
