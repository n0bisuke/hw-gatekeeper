const { Client } = require('@notionhq/client');

class NotionClient {
  constructor(token, databaseId) {
    this.client = new Client({ auth: token });
    this.databaseId = databaseId;
    this._dataSourceId = null;
  }

  async _getDataSourceId() {
    if (this._dataSourceId) return this._dataSourceId;
    const db = await this.client.databases.retrieve({ database_id: this.databaseId });
    this._dataSourceId = db.data_sources[0].id;
    return this._dataSourceId;
  }

  async queryPendingSubmissions(targetIds) {
    const orFilters = targetIds.map((id) => ({
      property: 'title',
      title: { contains: id },
    }));

    const dataSourceId = await this._getDataSourceId();
    const response = await this.client.dataSources.query({
      data_source_id: dataSourceId,
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
      case 'formula':
        if (prop.formula.type === 'string') return prop.formula.string || '';
        if (prop.formula.type === 'number') return String(prop.formula.number ?? '');
        return '';
      case 'rollup':
        if (prop.rollup.type === 'array' && prop.rollup.array.length > 0) {
          const first = prop.rollup.array[0];
          if (first.type === 'formula') {
            if (first.formula.type === 'string') return first.formula.string || '';
            if (first.formula.type === 'number') return String(first.formula.number ?? '');
          }
          if (first.type === 'title') return first.title?.map((t) => t.plain_text).join('') || '';
          if (first.type === 'rich_text') return first.rich_text?.map((t) => t.plain_text).join('') || '';
          if (first.type === 'number') return String(first.number ?? '');
        }
        if (prop.rollup.type === 'number') return String(prop.rollup.number ?? '');
        if (prop.rollup.type === 'string') return prop.rollup.string || '';
        return '';
      default:
        return null;
    }
  }
}

module.exports = NotionClient;
