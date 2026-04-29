const https = require('https');
const http = require('http');
const { URL } = require('url');

class Notifier {
  constructor(webhooks) {
    this.webhooks = webhooks;
  }

  async sendAccepted(result, setting) {
    const message = `✅ **受理: ${result.title}**\n\n` +
      `Notion: ${result.notionUrl}\n` +
      `提出週: 第${result.weekNumber}週\n` +
      `受理時刻: ${new Date().toLocaleString('ja-JP')}`;

    await this._notify(message, setting);
  }

  async sendRejected(result, setting, reasons) {
    const reasonText = Array.isArray(reasons) ? reasons.join('\n') : reasons;
    const message = `❌ **却下: ${result.title}**\n\n` +
      `Notion: ${result.notionUrl}\n` +
      `提出週: 第${result.weekNumber}週\n` +
      `却下理由:\n${reasonText}\n\n` +
      `却下時刻: ${new Date().toLocaleString('ja-JP')}`;

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
      const url = threadUrl || webhookUrl;
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
        res.on('end', () => resolve(data));
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
        res.on('end', () => resolve(data));
      });

      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }
}

module.exports = Notifier;
