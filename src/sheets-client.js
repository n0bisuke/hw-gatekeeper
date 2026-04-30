const { google } = require('googleapis');

class SheetsClient {
  constructor(keyJsonStr) {
    // GitHub ActionsのSecretsにJSONを入れるとクォートが壊れる問題への対策
    const sanitized = keyJsonStr.replace(/^['"]|['"]$/g, '');
    const keyJson = JSON.parse(sanitized);
    const auth = new google.auth.GoogleAuth({
      credentials: keyJson,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    this.sheets = google.sheets({ version: 'v4', auth });
  }

  async getSettings(spreadsheetId) {
    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId,
      range: '設定!A2:Q100',
    });
    const rows = res.data.values || [];
    return rows.map((r, i) => ({
      targetId: r[0]?.trim(),
      targetStudentId: r[1]?.trim(),
      deadlineWeekday: r[2]?.trim(),
      deadlineTime: r[3]?.trim(),
      unlockWeekday: r[4]?.trim(),
      unlockTime: r[5]?.trim(),
      discordWebhook: r[6]?.trim(),
      discordThread: r[7]?.trim(),
      teamsWebhook: r[8]?.trim(),
      acceptPrefix: r[9]?.trim(),
      rejectPrefix: r[10]?.trim(),
      quietHours: r[11]?.trim(),
      operationLimit: r[12]?.trim(),
      transferSheetId: r[13]?.trim(),
      transferTabName: r[14]?.trim(),
      rowIndex: i + 2,
    }));
  }

  async appendLog(spreadsheetId, entry) {
    const studentId = [entry.studentName, entry.homeworkId].filter(Boolean).join('_');
    await this.sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'ログ!A:H',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          studentId,
          this._now(),
          entry.targetId,
          entry.title,
          entry.result,
          entry.reason,
          entry.notionUrl || '',
          entry.transferred || '未実施',
        ]],
      },
    });
  }

  async getRecentLogs(spreadsheetId) {
    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'ログ!A:H',
    });
    return (res.data.values || []).slice(1); // ヘッダー行を除く
  }

  async transferToSheet(spreadsheetId, tabName, entry) {
    const studentId = [entry.studentName, entry.homeworkId].filter(Boolean).join('_');
    await this.sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${tabName}!A:F`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          studentId,
          this._now(),
          entry.targetId,
          entry.category || '',
          entry.result,
          entry.notionUrl || '',
        ]],
      },
    });
  }

  async updateLastActive(spreadsheetId, rowIndex) {
    await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `設定!P${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[this._now()]],
      },
    });
  }

  async updateSystemActive(spreadsheetId) {
    await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: '設定!P1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[`最終稼働: ${this._now()}`]],
      },
    });
  }

  async appendFeedback(spreadsheetId, week, notionUrl) {
    const range = '実装授業とFB（教員記入）!A1:Z100';
    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    const rows = res.data.values || [];
    let targetRow = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] === String(week)) {
        targetRow = i + 1;
        break;
      }
    }
    if (targetRow === -1) return;

    const currentRes = await this.sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `実装授業とFB（教員記入）!A${targetRow}:Z${targetRow}`,
    });
    const currentRow = currentRes.data.values?.[0] || [];
    const emptyCol = currentRow.findIndex((cell) => !cell);
    const colIndex = emptyCol === -1 ? currentRow.length : emptyCol;
    const colLetter = this._indexToColumn(colIndex);

    await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `実装授業とFB（教員記入）!${colLetter}${targetRow}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[notionUrl]],
      },
    });
  }

  _now() {
    return new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  }

  _indexToColumn(index) {
    let col = '';
    let n = index;
    while (n >= 0) {
      col = String.fromCharCode((n % 26) + 65) + col;
      n = Math.floor(n / 26) - 1;
    }
    return col || 'A';
  }
}

module.exports = SheetsClient;
