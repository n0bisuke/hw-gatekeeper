const ENV = process.env;

// Secretsを環境変数から読み込み、即座にprocess.envから削除して露出を防ぐ
const SECRET_KEYS = [
  'NOTION_TOKEN',
  'NOTION_DATABASE_ID',
  'GOOGLE_SERVICE_ACCOUNT_KEY',
  'MANAGEMENT_SPREADSHEET_ID',
];

const secrets = {};
for (const key of SECRET_KEYS) {
  if (ENV[key]) {
    secrets[key] = ENV[key];
    delete process.env[key];
  }
}

module.exports = {
  NOTION_TOKEN: secrets.NOTION_TOKEN,
  NOTION_DATABASE_ID: secrets.NOTION_DATABASE_ID,
  GOOGLE_SERVICE_ACCOUNT_KEY: secrets.GOOGLE_SERVICE_ACCOUNT_KEY,
  MANAGEMENT_SPREADSHEET_ID: secrets.MANAGEMENT_SPREADSHEET_ID,
  PLAN_MIN_LENGTH: 150,
  WEEK_REGEX: /po\d{2}-(\d{2})/i,
  JAPANESE_WEEKDAYS: ['日', '月', '火', '水', '木', '金', '土'],
  IS_CI: ENV.GITHUB_ACTIONS === 'true',
};