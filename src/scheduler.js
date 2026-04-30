const { JAPANESE_WEEKDAYS } = require('./config');

class Scheduler {
  constructor(settings) {
    this.settings = settings;
  }

  isWithinWindow(targetId) {
    const setting = this.settings.find((s) => s.targetId.toUpperCase() === targetId.toUpperCase());
    if (!setting) return { valid: false, reason: '該当するターゲットIDの設定が見つかりません' };

    // 曜日未設定なら時間判定なし（常に受理）
    if (!setting.deadlineWeekday || !setting.unlockWeekday) {
      return { valid: true };
    }

    const unlockDay = JAPANESE_WEEKDAYS.indexOf(setting.unlockWeekday);
    const deadlineDay = JAPANESE_WEEKDAYS.indexOf(setting.deadlineWeekday);
    if (unlockDay === -1 || deadlineDay === -1) return { valid: true };

    const [uh, um] = (setting.unlockTime || '00:00').split(':').map(Number);
    const [dh, dm] = (setting.deadlineTime || '23:59').split(':').map(Number);
    const unlockMin = uh * 60 + um;
    const deadlineMin = dh * 60 + dm;

    // JST現在時刻
    const now = new Date();
    let jstHour = now.getUTCHours() + 9;
    let jstDay = now.getUTCDay(); // 0=Sun
    if (jstHour >= 24) {
      jstHour -= 24;
      jstDay = (jstDay + 1) % 7;
    }
    const currentMin = jstHour * 60 + now.getUTCMinutes();

    // JSのday(0=Sun)と日本語曜日のindex(0=日)は同じ並び
    const curDay = jstDay;

    if (unlockDay === deadlineDay) {
      // 同じ曜日: 時刻だけで判定
      if (unlockMin <= deadlineMin) {
        // 例: 木9:00〜木23:59 → その時間内なら受理
        if (curDay === unlockDay && currentMin >= unlockMin && currentMin <= deadlineMin) {
          return { valid: true };
        }
        return { valid: false, reason: `受付時間外です (受付: ${setting.unlockWeekday} ${setting.unlockTime}〜${setting.deadlineWeekday} ${setting.deadlineTime})` };
      }
      // 例: 木23:59〜木9:00 → 時刻をまたぐ (翌週扱い)
      // 受付: 木23:59〜翌木9:00 = それ以外は却下
      if (curDay === unlockDay && (currentMin >= unlockMin || currentMin <= deadlineMin)) {
        return { valid: true };
      }
      if (curDay !== unlockDay) return { valid: false, reason: `受付時間外です (受付: ${setting.unlockWeekday} ${setting.unlockTime}〜${setting.deadlineWeekday} ${setting.deadlineTime})` };
      return { valid: false, reason: `受付時間外です (受付: ${setting.unlockWeekday} ${setting.unlockTime}〜${setting.deadlineWeekday} ${setting.deadlineTime})` };
    }

    // 解除曜から締切曜への受付窓口を判定
    const inWindow = this._isInWindow(curDay, currentMin, unlockDay, unlockMin, deadlineDay, deadlineMin);
    if (inWindow) return { valid: true };
    return { valid: false, reason: `受付時間外です (受付: ${setting.unlockWeekday} ${setting.unlockTime}〜${setting.deadlineWeekday} ${setting.deadlineTime})` };
  }

  _isInWindow(curDay, curMin, unlockDay, unlockMin, deadlineDay, deadlineMin) {
    const daysFromUnlock = (curDay - unlockDay + 7) % 7;
    const daysToDeadline = (deadlineDay - unlockDay + 7) % 7;

    if (daysFromUnlock === 0) {
      // 解除曜日当日
      if (curMin < unlockMin) return false;
      // 日付をまたがない窓口なら、締切曜が後にあるか同じ週
      if (daysToDeadline === 0) return curMin <= deadlineMin;
      return true;
    }

    if (daysFromUnlock === daysToDeadline) {
      // 締切曜日当日
      return curMin <= deadlineMin;
    }

    // 窓口中間日
    return daysFromUnlock < daysToDeadline;
  }
}

module.exports = Scheduler;