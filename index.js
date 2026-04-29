const main = require('./src/main');

main().catch((err) => {
  console.error('致命的なエラー:', err.message || err);
  process.exit(1);
});
