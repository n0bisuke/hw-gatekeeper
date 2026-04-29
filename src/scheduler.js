const dayjs = require('dayjs');
const { JAPANESE_WEEKDAYS } = require('./config');

class Scheduler {
  constructor(settings, schedule) {
    this.settings = settings;
    this.schedule = schedule;
  }

  getWindowForWeek(weekNumber) {
    const baseDate = this.schedule[weekNumber];
    if (!baseDate) return null;

    return this.settings.map((setting) => {
      const unlock = this._composeDateTime(baseDate, setting.unlockWeekday, setting.unlockTime);
      const deadline = this._composeDateTime(baseDate, setting.deadlineWeekday, setting.deadlineTime);
      return {
        ...setting,
        unlockDateTime: unlock,
        deadlineDateTime: deadline,
      };
    });
  }

  isWithinWindow(targetId, weekNumber) {
    const now = dayjs();
    const windows = this.getWindowForWeek(weekNumber);
    if (!windows) return { valid: false, reason: '該当週の目安スケジュールが見つかりません' };

    const matched = windows.find((w) => targetId.toUpperCase().startsWith(w.targetId.toUpperCase()));
    if (!matched) return { valid: false, reason: '該当するターゲットIDの設定が見つかりません' };

    const afterUnlock = now.isAfter(dayjs(matched.unlockDateTime)) || now.isSame(dayjs(matched.unlockDateTime));
    const beforeDeadline = now.isBefore(dayjs(matched.deadlineDateTime)) || now.isSame(dayjs(matched.deadlineDateTime));

    if (!afterUnlock) return { valid: false, reason: `提出受付開始前です (受付開始: ${dayjs(matched.unlockDateTime).format('YYYY/MM/DD HH:mm')})` };
    if (!beforeDeadline) return { valid: false, reason: `締切を過ぎています (締切: ${dayjs(matched.deadlineDateTime).format('YYYY/MM/DD HH:mm')})` };

    return { valid: true, setting: matched };
  }

  _composeDateTime(baseDate, weekdayName, timeStr) {
    const base = dayjs(baseDate);
    const targetWeekday = JAPANESE_WEEKDAYS.indexOf(weekdayName);
    if (targetWeekday === -1) return null;

    const currentWeekday = base.day();
    const diff = targetWeekday - currentWeekday;
    const targetDate = base.add(diff, 'day');

    const [hour, minute] = (timeStr || '00:00').split(':').map(Number);
    return targetDate.hour(hour || 0).minute(minute || 0).second(0).millisecond(0).toDate();
  }
}

module.exports = Scheduler;
