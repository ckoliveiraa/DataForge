import YAML from 'yaml';
import type { Schema, Table, Column } from '../types/schema';

export class SchemaReader {
  /**
   * Parses a YAML string and converts it into the internal React state representation.
   */
  static parseYaml(yamlString: string): Schema {
    const rawObj = YAML.parse(yamlString);
    if (!rawObj || typeof rawObj !== 'object') {
      throw new Error("Invalid YAML format");
    }

    const domain = rawObj.domain || 'custom';
    const rawTables = rawObj.tables || {};
    
    const tables: Table[] = Object.keys(rawTables).map(tableName => {
      const tData = rawTables[tableName];
      const rawCols = tData.columns || {};
      
      const columns: Column[] = Object.keys(rawCols).map(colName => {
        const cData = rawCols[colName];
        return {
          id: crypto.randomUUID(),
          name: colName,
          dtype: cData.dtype || 'str',
          isPrimaryKey: !!cData.primary_key,
          fakerProvider: cData.faker_provider || '',
          nullable: cData.nullable ? String(cData.nullable) : '0',
          isForeignKey: !!cData.foreign_key,
          fkTable: cData.foreign_key?.table || '',
          fkColumn: cData.foreign_key?.column || 'id',
          min: cData.min != null ? String(cData.min) : '',
          max: cData.max != null ? String(cData.max) : '',
          choices: Array.isArray(cData.choices) ? cData.choices.map(String) : [],
        };
      });

      return {
        id: crypto.randomUUID(),
        name: tableName,
        rows: tData.rows || 1000,
        columns
      };
    });

    return {
      domain,
      tables
    };
  }

  /**
   * Reads a File object and returns a Promise with the generated Schema state.
   */
  static async readFromFile(file: File): Promise<Schema> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          resolve(this.parseYaml(text));
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    });
  }
}
