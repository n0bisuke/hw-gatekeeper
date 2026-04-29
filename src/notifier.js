const https = require('https');
const http = require('http');
const { URL } = require('url');

class Notifier {
  constructor(webhooks) {
    this.webhooks = webhooks;
  }

  async sendAccepted(result, setting) {
    const lines = [
      `✅ **受理: ${result.title}**`,
      '',
      `学生: ${result.studentName || '(不明)'}`,
      `課題: ${result.homeworkId || '(不明)'}`,
      `Notion: ${result.notionUrl}`,
      `提出週: 第${result.weekNumber}週`,
    ];
    if (result.doUrl) lines.push(`Do: ${result.doUrl}`);
    lines.push(`受理時刻: ${new Date().toLocaleString('ja-JP')}`);
    const message = lines.join('\n');

    await this._notify(message, setting);
  }

  async sendRejected(result, setting, reasons) {
    const reasonText = Array.isArray(reasons) ? reasons.join('\n') : reasons;
    const lines = [
      `❌ **却下: ${result.title}**`,
      '',
      `学生: ${result.studentName || '(不明)'}`,
      `課題: ${result.homeworkId || '(不明)'}`,
      `Notion: ${result.notionUrl}`,
      `提出週: 第${result.weekNumber}週`,
    ];
    if (result.doUrl) lines.push(`Do: ${result.doUrl}`);
    if (result.plan && reasonText.includes('Plan')) {
      lines.push(`Plan内容:\n${result.plan}`);
    }
    lines.push(`却下理由:\n${reasonText}`);
    lines.push(`却下時刻: ${new Date().toLocaleString('ja-JP')}`);
    const message = lines.join('\n');

    await this._notify(message, setting);
  }

  async _notify(content, setting) {
    const payloads = [];

    if (setting.discordWebhook) {
      payloads.push(this._sendDiscord(content, setting.discordWebhook, setting.discordThread));
    }
    if (setting.teamsWebhook) {
      payloads.push(this._sendTeams(content, setting.teamsWebhook));
    }

    await Promise.all(payloads);
  }

  _sendDiscord(content, webhookUrl, threadUrl) {
    return new Promise((resolve, reject) => {
      // threadUrlが/channels/形式の場合、そこからthread_idを抽出
      let url = webhookUrl;
      if (threadUrl) {
        const threadMatch = threadUrl.match(/\/channels\/\d+\/(\d+)/);
        const threadId = threadMatch ? threadMatch[1] : threadUrl;
        url = webhookUrl + (webhookUrl.includes('?') ? '&' : '?') + 'thread_id=' + threadId;
      }
      const body = JSON.stringify({ content });
      const parsed = new URL(url);
      const options = {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      };

      const req = (parsed.protocol === 'https:' ? https : http).request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            console.warn(`Discord送信失敗 (${res.statusCode}):`, data?.substring(0, 100));
          } else {
            console.log(`Discord通知送信済 (${res.statusCode})`);
          }
          resolve(data);
        });
      });

      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  _sendTeams(content, webhookUrl) {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify({
        '@type': 'MessageCard',
        '@context': 'https://schema.org/extensions',
        text: content,
      });
      const parsed = new URL(webhookUrl);
      const options = {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      };

      const req = (parsed.protocol === 'https:' ? https : http).request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            console.warn(`Teams送信失敗 (${res.statusCode}):`, data?.substring(0, 100));
          } else {
            console.log(`Teams通知送信済 (${res.statusCode})`);
          }
          resolve(data);
        });
      });

      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }
}

module.exports = Notifier;
