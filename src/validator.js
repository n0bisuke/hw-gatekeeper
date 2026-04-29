const { PLAN_MIN_LENGTH } = require('./config');

class Validator {
  constructor(notionClient) {
    this.notion = notionClient;
  }

  validate(page) {
    const errors = [];

    const title = this.notion.getPropertyValue(page, 'title', 'title') ||
                  this.notion.getPropertyValue(page, 'タイトル', 'title') ||
                  this.notion.getPropertyValue(page, 'Name', 'title');
    const student = this.notion.getPropertyValue(page, '学生名', 'relation');
    const homework = this.notion.getPropertyValue(page, '宿題', 'relation');
    const plan = this.notion.getPropertyValue(page, 'Plan', 'rich_text');
    const doUrl = this.notion.getPropertyValue(page, 'Do', 'url');

    if (!student || student.length === 0) {
      errors.push('「学生名」が未入力です');
    }
    if (!homework || homework.length === 0) {
      errors.push('「宿題」が未入力です');
    }
    if (!plan || plan.trim().length < PLAN_MIN_LENGTH) {
      errors.push(`「Plan」が${PLAN_MIN_LENGTH}文字未満です (現在: ${plan?.trim().length || 0}文字)`);
    }
    if (!doUrl || !doUrl.trim()) {
      errors.push('「Do」のURLが未入力です');
    }

    return {
      title: title || '(タイトルなし)',
      notionUrl: page.url,
      errors,
      valid: errors.length === 0,
    };
  }
}

module.exports = Validator;
