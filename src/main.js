const config = require('./config');
const NotionClient = require('./notion-client');
const SheetsClient = require('./sheets-client');
const Scheduler = require('./scheduler');
const Validator = require('./validator');
const Notifier = require('./notifier');

// CI（GitHub Actions）上では個人情報・内部IDをマスク
function mask(val) {
  if (!config.IS_CI || !val) return val;
  return '***';
}

// 非通知時間チェック（JST）。format: "0:30-9:00"
function isInQuietHours(rangeStr) {
  if (!rangeStr) return false;
  const [startStr, endStr] = rangeStr.split('-').map((s) => s.trim());
  if (!startStr || !endStr) return false;
  const [sh, sm] = startStr.split(':').map(Number);
  const [eh, em] = endStr.split(':').map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return false;
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  const now = new Date();
  const jstMin = now.getUTCHours() * 60 + now.getUTCMinutes() + 9 * 60; // JST = UTC+9
  const curMin = jstMin % (24 * 60);
  if (startMin <= endMin) {
    return curMin >= startMin && curMin < endMin;
  }
  // 日付をまたぐ場合（例: 22:00-6:00）
  return curMin >= startMin || curMin < endMin;
}

function makeStudentId(result) {
  return [result.studentName, result.homeworkId].filter(Boolean).join('_');
}

async function main() {
  if (!config.NOTION_TOKEN || !config.NOTION_DATABASE_ID || !config.GOOGLE_SERVICE_ACCOUNT_KEY || !config.MANAGEMENT_SPREADSHEET_ID) {
    console.error('環境変数が不足しています。必要: NOTION_TOKEN, NOTION_DATABASE_ID, GOOGLE_SERVICE_ACCOUNT_KEY, MANAGEMENT_SPREADSHEET_ID');
    process.exit(1);
  }

  const notion = new NotionClient(config.NOTION_TOKEN, config.NOTION_DATABASE_ID);
  const sheets = new SheetsClient(config.GOOGLE_SERVICE_ACCOUNT_KEY);

  // 1. まず設定シートを読んで、どのターゲットIDを監視するか決める
  console.log('設定を読み込み中...');
  const settings = await sheets.getSettings(config.MANAGEMENT_SPREADSHEET_ID);
  if (settings.length === 0) {
    console.log('設定シートが空です。処理を終了します。');
    return;
  }

  const targetIds = settings.map((s) => s.targetId);
  console.log(`監視対象ターゲット: ${mask(targetIds.join(', '))}`);
  console.log(`(${settings.length}件中、稼働リミット切れを除外します)`);

  const now = new Date();
  const activeSettings = settings.filter((s) => {
    if (!s.operationLimit) return true;
    const limit = new Date(s.operationLimit);
    return now <= limit;
  });

  const activeTargetIds = activeSettings.map((s) => s.targetId);
  if (activeTargetIds.length === 0) {
    console.log('有効なターゲットがありません。宿題チェックをスキップします。');
  } else {
    console.log(`有効ターゲット: ${mask(activeTargetIds.join(', '))}`);

    // 2. 該当ターゲットIDの提出のみをNotionから取得
    console.log('Notionから提出済みデータを取得中...');
    const submissions = await notion.queryPendingSubmissions(activeTargetIds);
  console.log(`${submissions.length}件の対象データを取得しました。`);

  const scheduler = new Scheduler(settings);
  let existingLogs = [];
  try {
    existingLogs = await sheets.getRecentLogs(config.MANAGEMENT_SPREADSHEET_ID);
  } catch (e) {
    console.log('ログ読み込み失敗（重複チェックなしで続行）:', e.message?.substring(0, 80));
  }

  const quietActive = activeSettings.some((s) => isInQuietHours(s.quietHours));
  if (quietActive) {
    console.log('非通知時間中です。通知をスキップします。');
  }

  // 4. 1件ずつ処理
  for (const page of submissions) {
    const title = notion.getPropertyValue(page, 'title', 'title') ||
                  notion.getPropertyValue(page, 'タイトル', 'title') ||
                  notion.getPropertyValue(page, 'Name', 'title');

    // 対応する設定を特定
    const upperTitle = title.toUpperCase();
    const setting = settings.find((s) => {
      if (!upperTitle.startsWith(s.targetId.toUpperCase())) return false;
      // 学生IDフィルタ: 設定に学生IDがある場合は学籍番号と照合
      if (s.targetStudentId) {
        const gakuseki = notion.getPropertyValue(page, '学籍番号', 'rollup');
        return gakuseki === s.targetStudentId;
      }
      return true;
    });
    if (!setting) continue;

    // 週番号を抽出
    const weekNumber = notion.extractWeekNumber(title, setting.targetId);
    if (!weekNumber) {
      console.log(`週番号抽出失敗: ${mask(title)} — スキップ`);
      continue;
    }

    console.log(`\n--- ${mask(title)} (${mask(setting.targetId)}, 第${mask(String(weekNumber))}週) ---`);

    // バリデーション
    const validator = new Validator(notion);
    const result = await validator.validate(page);
    const errors = [...(result.errors || [])];

    // 窓口判定
    const windowResult = scheduler.isWithinWindow(setting.targetId);
    if (!windowResult.valid) {
      errors.push(windowResult.reason);
    }

    const studentId = makeStudentId(result);
    const reasonStr = errors.length > 0 ? errors.join('; ') : '正常';

    // 重複チェック: 同じID + 同じ理由のログが既にあるか
    const isDuplicate = existingLogs.some((row) => {
      return row[0] === studentId && row[5] === reasonStr;
    });
    if (isDuplicate) {
      console.log(`→ スキップ: 同一内容が既に記録済みです`);
      continue;
    }

    // 非通知時間なら通知しない（ログは残す）
    const skipNotify = quietActive || isInQuietHours(setting.quietHours);

    const notifier = new Notifier();

    if (errors.length > 0) {
      console.log(`→ 却下: ${errors.join(' / ')}`);
      await sheets.appendLog(config.MANAGEMENT_SPREADSHEET_ID, {
        targetId: setting.targetId,
        title,
        weekNumber,
        studentName: result.studentName,
        homeworkId: result.homeworkId,
        notionUrl: page.url,
        result: '却下',
        reason: errors.join('; '),
        transferred: '未実施',
      });
      existingLogs.push([studentId, '', '', '', '', reasonStr]);
      result.weekNumber = weekNumber;
      if (!skipNotify) await notifier.sendRejected(result, setting, errors);
      else console.log('  (非通知時間のため通知スキップ)');
    } else {
      console.log('→ 受理: 条件を満たしています');

      // 転記先シートへ書き込み
      let transferred = '未実施';
      if (setting.transferSheetId && setting.transferTabName) {
        try {
          await sheets.transferToSheet(setting.transferSheetId, setting.transferTabName, {
            studentName: result.studentName,
            homeworkId: result.homeworkId,
            targetId: setting.targetId,
            category: result.category,
            result: '受理',
            notionUrl: page.url,
          });
          transferred = '済';
          console.log('  転記先シートへ書き込み完了');
        } catch (e) {
          console.error('  転記先シート書き込み失敗:', e.message?.substring(0, 80));
        }
      }

      await sheets.appendLog(config.MANAGEMENT_SPREADSHEET_ID, {
        targetId: setting.targetId,
        title,
        weekNumber,
        studentName: result.studentName,
        homeworkId: result.homeworkId,
        notionUrl: page.url,
        result: '受理',
        reason: '正常',
        transferred,
      });
      existingLogs.push([studentId, '', '', '', '', reasonStr]);

      if (!skipNotify) await notifier.sendAccepted(result, setting);
      else console.log('  (非通知時間のため通知スキップ)');
    }
  } // end of for loop
  } // end else

  // ヘルスチェック: システム稼働時刻をN1に更新（毎回）
  try {
    await sheets.updateSystemActive(config.MANAGEMENT_SPREADSHEET_ID);
  } catch (e) {
    console.error('システム稼働更新失敗:', e.message?.substring(0, 80));
  }

  // 各ターゲットの最終稼働時刻を更新（実際に処理されたターゲットのみ）
  for (const s of activeSettings) {
    try {
      await sheets.updateLastActive(config.MANAGEMENT_SPREADSHEET_ID, s.rowIndex);
    } catch (e) {
      console.error(`最終稼働更新失敗 (${s.targetId}):`, e.message?.substring(0, 80));
    }
  }

  console.log('\n=== 処理完了 ===');
}

module.exports = main;
