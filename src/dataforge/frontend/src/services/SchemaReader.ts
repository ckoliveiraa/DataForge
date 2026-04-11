import YAML from 'yaml';
import type { Schema, Table, Column } from '../types/schema';

export class SchemaReader {
  /**
   * Parses a YAML string and converts it into the internal React state representation.
   */
  static parseYaml(yamlString: string): Schema {
    let rawObj: any;
    try {
      rawObj = YAML.parse(yamlString);
    } catch (err: any) {
      const msg: string = err?.message ?? String(err);
      if (msg.includes('Map keys must be unique')) {
        const lineMatch = msg.match(/line (\d+)/i);
        const keyMatch = msg.match(/at line \d+[^:]*:\s*(\S+)/);
        const location = lineMatch ? ` (linha ${lineMatch[1]})` : '';
        const key = keyMatch ? ` — coluna/chave duplicada: "${keyMatch[1]}"` : '';
        throw new Error(
          `O YAML contém chaves duplicadas${key}${location}. ` +
          `A IA gerou duas colunas com o mesmo nome na mesma tabela. ` +
          `Tente gerar novamente ou edite o YAML removendo a duplicata.`
        );
      }
      throw new Error(`Erro ao interpretar o YAML: ${msg}`);
    }
    if (!rawObj || typeof rawObj !== 'object') {
      throw new Error("Formato YAML inválido: o arquivo não contém um objeto válido.");
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
