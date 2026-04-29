const { PLAN_MIN_LENGTH } = require('./config');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const PROP_PLAN = 'Plan (背景・意図説明・備考) ';
const PROP_DO = 'Do (宿題遂行と提出) 宿題記事をツイートしたTwitter URLなど';

class Validator {
  constructor(notionClient) {
    this.notion = notionClient;
  }

  async validate(page) {
    const errors = [];

    const title = this.notion.getPropertyValue(page, 'title', 'title') ||
                  this.notion.getPropertyValue(page, 'タイトル', 'title') ||
                  this.notion.getPropertyValue(page, 'Name', 'title');
    const plan = this.notion.getPropertyValue(page, PROP_PLAN, 'rich_text');
    const doUrl = this.notion.getPropertyValue(page, PROP_DO, 'url');
    const studentName = this.notion.getPropertyValue(page, '学生名（確認用）', 'formula');
    const homeworkId = this.notion.getPropertyValue(page, '課題ID(外部参照用)', 'formula');

    if (!studentName || studentName === '_') {
      errors.push('「学生名」が未入力です');
    }
    if (!homeworkId) {
      errors.push('「宿題」が未入力です');
    }
    if (!plan || plan.trim().length < PLAN_MIN_LENGTH) {
      errors.push(`「Plan」が${PLAN_MIN_LENGTH}文字未満です (現在: ${plan?.trim().length || 0}文字)`);
    }
    if (!doUrl || !doUrl.trim()) {
      errors.push('「Do」のURLが未入力です');
    } else {
      const doUrlStr = doUrl.trim();
      // x.com/twitter.comで/status/を含まないのはプロフィールURL
      const urlWithScheme = doUrlStr.startsWith('http') ? doUrlStr : 'https://' + doUrlStr;
      if (/x\.com|twitter\.com/i.test(new URL(urlWithScheme).hostname)) {
        const parsed = new URL(urlWithScheme);
        if (!parsed.pathname.includes('/status/')) {
          errors.push('「Do」がプロフィールURLです。投稿のURLを入力してください');
        } else {
          const reachable = await this._checkXUrl(doUrlStr);
          if (!reachable) {
            errors.push('「Do」のURLにアクセスできません: ' + doUrlStr);
          }
        }
      } else {
        const reachable = await this._checkUrlReachable(doUrlStr);
        if (!reachable) {
          errors.push('「Do」のURLにアクセスできません: ' + doUrlStr);
        }
      }
    }

    return {
      title: title || '(タイトルなし)',
      notionUrl: page.url,
      doUrl: doUrl || '',
      plan: plan || '',
      studentName: studentName || '',
      homeworkId: homeworkId || '',
      errors,
      valid: errors.length === 0,
    };
  }

  async _checkUrlReachable(urlStr, redirectCount = 0) {
    if (redirectCount > 5) return false;

    // URLスキームがない場合は補完
    if (!/^https?:\/\//i.test(urlStr)) {
      urlStr = 'https://' + urlStr;
    }

    let parsed;
    try {
      parsed = new URL(urlStr);
    } catch {
      return false;
    }

    return new Promise((resolve) => {
      const mod = parsed.protocol === 'https:' ? https : http;
      const options = {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        timeout: 10000,
        headers: {
          'User-Agent': 'Gatekeeper/1.0',
          'Accept': 'text/html,application/json,*/*',
        },
      };

      const req = mod.request(options, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // リダイレクトを追跡
          const redirectUrl = new URL(res.headers.location, urlStr).href;
          req.destroy();
          resolve(this._checkUrlReachable(redirectUrl, redirectCount + 1));
          return;
        }

        const ok = res.statusCode >= 200 && res.statusCode < 400;
        // ヘッダー確認後すぐ切断（ボディは不要）
        res.destroy();
        resolve(ok);
      });

      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });

      req.end();
    });
  }
  async _checkXUrl(urlStr) {
    return new Promise((resolve) => {
      const apiUrl = 'https://publish.twitter.com/oembed?url=' + encodeURIComponent(urlStr);
      const req = https.get(apiUrl, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          const ok = res.statusCode === 200;
          if (!ok) console.log('oEmbed API:', res.statusCode, data.substring(0, 80));
          res.destroy();
          resolve(ok);
        });
      });
      req.on('error', () => resolve(false));
      req.setTimeout(10000, () => { req.destroy(); resolve(false); });
      req.end();
    });
  }
}

module.exports = Validator;
