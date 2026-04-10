export type Column = {
  id: string;
  name: string;
  dtype: string;
  isPrimaryKey: boolean;
  fakerProvider: string;
  nullable: string;
  isForeignKey: boolean;
  fkTable: string;
  fkColumn: string;
  min: string;
  max: string;
  choices: string[];
};

export type Table = {
  id: string;
  name: string;
  rows: number;
  columns: Column[];
  position?: { x: number; y: number };
};

export type Schema = {
  domain: string;
  tables: Table[];
};
