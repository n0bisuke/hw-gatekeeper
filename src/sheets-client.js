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
      range: '設定!A2:N100',
    });
    const rows = res.data.values || [];
    return rows.map((r, i) => ({
      targetId: r[0]?.trim(),
      deadlineWeekday: r[1]?.trim(),
      deadlineTime: r[2]?.trim(),
      unlockWeekday: r[3]?.trim(),
      unlockTime: r[4]?.trim(),
      discordWebhook: r[5]?.trim(),
      discordThread: r[6]?.trim(),
      teamsWebhook: r[7]?.trim(),
      quietHours: r[8]?.trim(),
      operationLimit: r[9]?.trim(),
      transferSheetId: r[10]?.trim(),
      transferTabName: r[11]?.trim(),
      notes: r[12]?.trim(),
      rowIndex: i + 2, // ヘッダー行が1行目なので、データは2行目から
    }));
  }

  async getSchedule(spreadsheetId) {
    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId,
      range: '目安スケジュール!A2:C100',
    });
    const rows = res.data.values || [];
    const schedule = {};
    rows.forEach((r) => {
      const week = parseInt(r[0], 10);
      if (!isNaN(week) && r[2]) {
        schedule[week] = new Date(r[2]);
      }
    });
    return schedule;
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
      range: `設定!N${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[this._now()]],
      },
    });
  }

  async updateSystemActive(spreadsheetId) {
    await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: '設定!N1',
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
