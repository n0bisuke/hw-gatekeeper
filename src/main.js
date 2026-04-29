const config = require('./config');
const NotionClient = require('./notion-client');
const SheetsClient = require('./sheets-client');
const Scheduler = require('./scheduler');
const Validator = require('./validator');
const Notifier = require('./notifier');

// CI（GitHub Actions）上では学生名などの個人情報をマスク
function displayTitle(title) {
  if (!config.IS_CI) return title;
  return (title || '').split('_')[0] || title;
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
  console.log(`監視対象ターゲット: ${targetIds.join(', ')}`);
  console.log(`(${settings.length}件中、稼働リミット切れを除外します)`);

  const now = new Date();
  const activeSettings = settings.filter((s) => {
    if (!s.operationLimit) return true;
    const limit = new Date(s.operationLimit);
    return now <= limit;
  });

  const activeTargetIds = activeSettings.map((s) => s.targetId);
  if (activeTargetIds.length === 0) {
    console.log('有効なターゲットがありません。処理を終了します。');
    return;
  }
  console.log(`有効ターゲット: ${activeTargetIds.join(', ')}`);

  // 2. 該当ターゲットIDの提出のみをNotionから取得
  console.log('Notionから提出済みデータを取得中...');
  const submissions = await notion.queryPendingSubmissions(activeTargetIds);
  console.log(`${submissions.length}件の対象データを取得しました。`);

  // 教育運営スプレッドシート（目安スケジュール）は任意
  let schedule = {};
  let hasAcademicSheet = false;
  if (config.ACADEMIC_SPREADSHEET_ID) {
    try {
      schedule = await sheets.getSchedule(config.ACADEMIC_SPREADSHEET_ID);
      hasAcademicSheet = Object.keys(schedule).length > 0;
    } catch (e) {
      console.log('目安スケジュールの読み込みに失敗（スキップ）:', e.message?.substring(0, 80));
    }
  }
  const scheduler = new Scheduler(settings, schedule);

  // 3. 1件ずつ処理
  for (const page of submissions) {
    const title = notion.getPropertyValue(page, 'title', 'title') ||
                  notion.getPropertyValue(page, 'タイトル', 'title') ||
                  notion.getPropertyValue(page, 'Name', 'title');

    // 対応する設定を特定
    const upperTitle = title.toUpperCase();
    const setting = settings.find((s) => upperTitle.startsWith(s.targetId.toUpperCase()));
    if (!setting) continue;

    // 週番号を抽出
    const weekNumber = notion.extractWeekNumber(title, setting.targetId);
    if (!weekNumber) {
      console.log(`週番号抽出失敗: ${displayTitle(title)} — スキップ`);
      continue;
    }

    console.log(`\n--- ${displayTitle(title)} (${setting.targetId}, 第${weekNumber}週) ---`);

    // バリデーション
    const validator = new Validator(notion);
    const result = validator.validate(page);
    const errors = [...(result.errors || [])];

    // 窓口判定（教育運営シートがある場合のみ）
    if (hasAcademicSheet) {
      const windowResult = scheduler.isWithinWindow(setting.targetId, weekNumber);
      if (!windowResult.valid) {
        errors.push(windowResult.reason);
      }
    }

    const notifier = new Notifier();

    if (errors.length > 0) {
      console.log(`→ 却下: ${errors.join(' / ')}`);
      await sheets.appendLog(config.MANAGEMENT_SPREADSHEET_ID, {
        targetId: setting.targetId,
        title,
        weekNumber,
        result: '却下',
        reason: errors.join('; '),
      });
      await notifier.sendRejected(result, setting, errors);
    } else {
      console.log('→ 受理: 条件を満たしています');
      await sheets.appendLog(config.MANAGEMENT_SPREADSHEET_ID, {
        targetId: setting.targetId,
        title,
        weekNumber,
        result: '受理',
        reason: '正常',
      });

      if (setting.notes === '本科' && config.ACADEMIC_SPREADSHEET_ID) {
        console.log('  教員FBシートへ書き込み...');
        try {
          await sheets.appendFeedback(config.ACADEMIC_SPREADSHEET_ID, weekNumber, page.url);
        } catch (e) {
          console.error('  教員FBシート書き込み失敗:', e.message?.substring(0, 80));
        }
      }

      await notifier.sendAccepted(result, setting);
    }
  }

  console.log('\n=== 処理完了 ===');
}

module.exports = main;
