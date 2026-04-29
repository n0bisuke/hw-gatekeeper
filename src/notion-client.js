const { Client } = require('@notionhq/client');

class NotionClient {
  constructor(token, databaseId) {
    this.client = new Client({ auth: token });
    this.databaseId = databaseId;
  }

  async queryPendingSubmissions(targetIds) {
    const orFilters = targetIds.map((id) => ({
      property: 'title',
      title: { contains: id },
    }));

    const response = await this.client.databases.query({
      database_id: this.databaseId,
      filter: {
        and: [
          {
            property: 'Status',
            select: {
              equals: '提出済(FB待ち)',
            },
          },
          { or: orFilters },
        ],
      },
    });
    return response.results;
  }

  extractWeekNumber(title, targetId) {
    const afterTarget = title.slice(targetId.length);
    const match = afterTarget.match(/^\D*(\d{2})/);
    return match ? parseInt(match[1], 10) : null;
  }

  getPropertyValue(page, propertyName, type) {
    const prop = page.properties[propertyName];
    if (!prop) return null;

    switch (type) {
      case 'title':
        return prop.title?.map((t) => t.plain_text).join('') || '';
      case 'rich_text':
        return prop.rich_text?.map((t) => t.plain_text).join('') || '';
      case 'relation':
        return prop.relation || [];
      case 'url':
        return prop.url || '';
      case 'select':
        return prop.select?.name || '';
      default:
        return null;
    }
  }
}

module.exports = NotionClient;
