const fs = require('fs');
const path = require('path');

// CI環境ではSecretsを一時ファイルから読み込み、環境変数への露出を防ぐ
function readSecret(name) {
  const secretsDir = process.env.SECRETS_DIR;
  if (secretsDir) {
    const filePath = path.join(secretsDir, name);
    try {
      return fs.readFileSync(filePath, 'utf8').trim();
    } catch {
      // フォールバック: 環境変数から読み込み
    }
  }
  return process.env[name];
}

const ENV = process.env;

module.exports = {
  NOTION_TOKEN: readSecret('NOTION_TOKEN') || ENV.NOTION_TOKEN,
  NOTION_DATABASE_ID: readSecret('NOTION_DATABASE_ID') || ENV.NOTION_DATABASE_ID,
  GOOGLE_SERVICE_ACCOUNT_KEY: readSecret('GOOGLE_SERVICE_ACCOUNT_KEY') || ENV.GOOGLE_SERVICE_ACCOUNT_KEY,
  MANAGEMENT_SPREADSHEET_ID: readSecret('MANAGEMENT_SPREADSHEET_ID') || ENV.MANAGEMENT_SPREADSHEET_ID,
  PLAN_MIN_LENGTH: 150,
  WEEK_REGEX: /po\d{2}-(\d{2})/i,
  JAPANESE_WEEKDAYS: ['日', '月', '火', '水', '木', '金', '土'],
  IS_CI: ENV.GITHUB_ACTIONS === 'true',
};