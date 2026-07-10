import { describe, expect, it } from 'vitest';

import { splitSqlStatements } from './split-sql-statements.js';

describe('splitSqlStatements', () => {
  it('splits simple statements', () => {
    expect(splitSqlStatements('create table a (id int); create index i on a (id);')).toEqual([
      'create table a (id int)',
      'create index i on a (id)',
    ]);
  });

  it('keeps BEGIN/END trigger bodies intact', () => {
    const script = `
create table t (id int);
CREATE TRIGGER trg BEFORE INSERT ON t
FOR EACH ROW
BEGIN
  IF NEW.id IS NULL THEN
    SET NEW.id = 1;
  END IF;
END;
create index i on t (id);
`;

    expect(splitSqlStatements(script)).toEqual([
      'create table t (id int)',
      `CREATE TRIGGER trg BEFORE INSERT ON t
FOR EACH ROW
BEGIN
  IF NEW.id IS NULL THEN
    SET NEW.id = 1;
  END IF;
END`,
      'create index i on t (id)',
    ]);
  });
});
