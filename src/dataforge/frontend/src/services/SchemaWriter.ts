import YAML from 'yaml';
import type { Table } from '../types/schema';

export class SchemaWriter {
  /**
   * Converts the internal application state into a standard YAML string.
   */
  static generateYaml(domain: string, tables: Table[]): string {
    const schemaObj: any = {
      domain,
      tables: {}
    };

    tables.forEach(t => {
      const colsObj: any = {};
      t.columns.forEach(c => {
        const colDef: any = { dtype: c.dtype };
        
        if (c.isPrimaryKey) colDef.primary_key = true;
        if (c.fakerProvider) colDef.faker_provider = c.fakerProvider;
        
        const nullProb = parseFloat(c.nullable);
        if (!isNaN(nullProb) && nullProb > 0) {
          colDef.nullable = nullProb;
        }

        if (c.min) colDef.min = isNaN(Number(c.min)) ? c.min : Number(c.min);
        if (c.max) colDef.max = isNaN(Number(c.max)) ? c.max : Number(c.max);

        if (c.isForeignKey && c.fkTable && c.fkColumn) {
          colDef.foreign_key = {
            table: c.fkTable,
            column: c.fkColumn
          };
        }

        colsObj[c.name] = colDef;
      });

      schemaObj.tables[t.name] = {
        rows: t.rows,
        columns: colsObj
      };
    });

    return YAML.stringify(schemaObj, null, 2);
  }

  /**
   * Triggers a browser download of the YAML string.
   */
  static downloadYaml(yamlStr: string, filename: string = 'schema.yaml'): void {
    if (!yamlStr) return;
    const blob = new Blob([yamlStr], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
