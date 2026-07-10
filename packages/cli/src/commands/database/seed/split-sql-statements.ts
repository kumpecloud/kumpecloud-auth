/**
 * Split SQL scripts into executable statements.
 * Understands BEGIN...END compound blocks (triggers/procedures) and string literals.
 */
export const splitSqlStatements = (script: string): string[] => {
  const statements: string[] = [];
  let current = '';
  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  const pushCurrent = () => {
    const trimmed = current.trim();

    if (trimmed.length > 0) {
      statements.push(trimmed);
    }

    current = '';
  };

  for (let index = 0; index < script.length; index += 1) {
    const char = script[index]!;
    const next = script[index + 1];

    if (inLineComment) {
      current += char;

      if (char === '\n') {
        inLineComment = false;
      }

      continue;
    }

    if (inBlockComment) {
      current += char;

      if (char === '*' && next === '/') {
        current += '/';
        index += 1;
        inBlockComment = false;
      }

      continue;
    }

    if (!inSingleQuote && !inDoubleQuote) {
      if (char === '-' && next === '-') {
        current += char;
        inLineComment = true;
        continue;
      }

      if (char === '/' && next === '*') {
        current += char;
        inBlockComment = true;
        continue;
      }
    }

    if (inSingleQuote) {
      current += char;

      if (char === "'" && next === "'") {
        current += next;
        index += 1;
        continue;
      }

      if (char === "'") {
        inSingleQuote = false;
      }

      continue;
    }

    if (inDoubleQuote) {
      current += char;

      if (char === '"' && next === '"') {
        current += next;
        index += 1;
        continue;
      }

      if (char === '"') {
        inDoubleQuote = false;
      }

      continue;
    }

    if (char === "'") {
      inSingleQuote = true;
      current += char;
      continue;
    }

    if (char === '"') {
      inDoubleQuote = true;
      current += char;
      continue;
    }

    // Track BEGIN/END depth for compound statements (case-insensitive word boundaries).
    // Do not treat END IF / END WHILE / END LOOP / END CASE as block terminators.
    const remaining = script.slice(index);
    const beginMatch = /^(begin)\b/i.exec(remaining);
    const endBlockMatch = /^(end(?!\s+(?:if|while|loop|case)\b))\b/i.exec(remaining);
    const endInnerMatch = /^(end\s+(?:if|while|loop|case))\b/i.exec(remaining);

    if (beginMatch) {
      current += beginMatch[1]!;
      index += beginMatch[1]!.length - 1;
      depth += 1;
      continue;
    }

    if (endInnerMatch) {
      current += endInnerMatch[1]!;
      index += endInnerMatch[1]!.length - 1;
      continue;
    }

    if (endBlockMatch && depth > 0) {
      current += endBlockMatch[1]!;
      index += endBlockMatch[1]!.length - 1;
      depth -= 1;
      continue;
    }

    if (char === ';' && depth === 0) {
      pushCurrent();
      continue;
    }

    current += char;
  }

  pushCurrent();

  return statements;
};
