// Turns raw errors into teaching moments, and reviews SQL for engineering quality (not just correctness).
export interface ErrorHelp { title: string; meaning: string; causes: string[]; debug: string }
const PY: Record<string, ErrorHelp> = {
  NameError: { title: 'NameError — Python does not know that name', meaning: 'A variable or function is used before it was defined, or its name is misspelled.', causes: ['Typo in a variable/function name (Python is case-sensitive)', 'Using a variable defined inside a function from outside it', 'Forgetting to import a module', 'Using a name before the line that assigns it runs'], debug: 'Look at the exact name in the message, then search your code for where it is assigned.' },
  TypeError: { title: 'TypeError — an operation got the wrong type', meaning: 'You combined values that do not support that operation (e.g. str + int) or called a function with the wrong arguments.', causes: ['Adding a string and a number — convert with str() / int()', 'Calling a function with too many/few arguments', "Treating None as a value ('NoneType' object is not ...) — a function returned nothing", 'Calling something that is not callable'], debug: 'Print type(x) of the values on the failing line.' },
  KeyError: { title: 'KeyError — that key is not in the dictionary', meaning: 'dict[key] was used with a key that does not exist.', causes: ['Typo or different casing in the key', 'Data is missing a field for some records', 'Key has extra whitespace'], debug: 'Use d.get(key, default) for optional fields, or print(d.keys()) to see what exists.' },
  IndexError: { title: 'IndexError — position out of range', meaning: 'You accessed a list position that does not exist.', causes: ['Off-by-one: the last index is len(x) - 1', 'Empty list', 'Splitting a string produced fewer parts than expected'], debug: 'Print len(x) before indexing; iterate directly instead of by index.' },
  AttributeError: { title: "AttributeError — that object has no such attribute/method", meaning: 'You called a method that this type does not have.', causes: ["Calling a method on None ('NoneType' object has no attribute) — check what the previous call returned", 'Confusing list and str methods (append vs +)', 'Typo in method name'], debug: 'Print type(obj) and dir(obj).' },
  ValueError: { title: 'ValueError — right type, wrong value', meaning: 'The value cannot be converted or processed, e.g. int("abc").', causes: ['Parsing a number/date from bad input', 'Unpacking the wrong number of values', 'Data quality issue in a source file'], debug: 'Validate or try/except around the conversion and log the bad value.' },
  ZeroDivisionError: { title: 'ZeroDivisionError', meaning: 'Division by zero.', causes: ['Computing a ratio for an empty group', 'Average of an empty list'], debug: 'Guard: return None (or 0) when the denominator is 0.' },
  SyntaxError: { title: 'SyntaxError — Python cannot parse the code', meaning: 'The code is not valid Python, so nothing ran.', causes: ['Missing colon after if/for/def', 'Unclosed bracket or quote (the error may point to the NEXT line)', 'Using = instead of == in a condition'], debug: 'Look at the marked line AND the line above it.' },
  IndentationError: { title: 'IndentationError', meaning: 'Blocks in Python are defined by indentation; this one is inconsistent.', causes: ['Mixing tabs and spaces', 'Missing indentation after a colon', 'Unexpected extra indent'], debug: 'Use 4 spaces consistently.' },
  UnboundLocalError: { title: 'UnboundLocalError', meaning: 'A variable is assigned inside a function, so Python treats it as local — but it was read before assignment.', causes: ['Modifying a global counter inside a function', 'Assigning only in one branch of an if'], debug: 'Pass the value in as a parameter and return the new value.' },
  RecursionError: { title: 'RecursionError — recursion too deep', meaning: 'A function called itself too many times.', causes: ['Missing or unreachable base case'], debug: 'Check the base case is reached for every input.' },
  FileNotFoundError: { title: 'FileNotFoundError', meaning: 'No file exists at that path.', causes: ['Wrong path — practice files live in /data (e.g. /data/orders.csv)', 'Relative path from the wrong working directory'], debug: 'import os; print(os.listdir("/data"))' },
  ModuleNotFoundError: { title: 'ModuleNotFoundError', meaning: 'That package is not installed in this sandbox.', causes: ['Typo in module name', 'Library not available in the browser (e.g. requests cannot make real network calls here)'], debug: 'Standard library, pandas, numpy and the pyspark/airflow emulators are available.' },
  JSONDecodeError: { title: 'JSONDecodeError — invalid JSON', meaning: 'The text is not valid JSON.', causes: ['Reading JSON Lines with json.load (use one json.loads per line)', 'Single quotes instead of double quotes', 'Trailing commas'], debug: 'Print the first 200 characters of the text.' },
  AssertionError: { title: 'AssertionError', meaning: 'An assert statement was False.', causes: ['A test/check found a wrong result'], debug: 'Read the assertion message and compare expected vs actual.' },
  AnalysisException: { title: 'AnalysisException (Spark)', meaning: 'Spark could not resolve the query — usually a column/table name problem.', causes: ['Column does not exist or is misspelled', 'Ambiguous column after a join', 'Non-aggregated column in groupBy().agg()'], debug: 'df.printSchema() / df.columns to see what exists.' },
  AirflowException: { title: 'AirflowException', meaning: 'The DAG definition is invalid.', causes: ['Duplicate task_id', 'Task created outside a DAG context', 'Cycle in dependencies'], debug: 'Read the message — it names the offending task.' },
  TIMEOUT: { title: 'Execution timed out', meaning: 'The code ran longer than the limit and was stopped.', causes: ['while loop whose condition never becomes False', 'Recursion without a base case', 'Very large nested loops'], debug: 'Add a print inside the loop to see whether the loop variable changes.' },
}
export function explainPyError(etype: string | null, msg = ''): ErrorHelp | null {
  if (!etype && /TIMEOUT/.test(msg)) return PY.TIMEOUT
  if (!etype) return null
  return PY[etype] || null
}

export function explainSqlError(msg: string): string | null {
  const m = msg.toLowerCase()
  if (m.includes('no such column')) return 'A column name is wrong, or you used a SELECT alias in WHERE (WHERE runs before SELECT). Check table aliases: in a join, qualify columns like o.customer_id.'
  if (m.includes('no such table')) return 'Table name not found. Open the schema panel to see available tables.'
  if (m.includes('ambiguous column')) return 'Two joined tables have a column with this name — prefix it with the table alias (e.g. c.customer_id).'
  if (m.includes('misuse of aggregate') || m.includes('aggregate functions are not allowed')) return 'Aggregates (SUM, COUNT…) cannot be used in WHERE — filter groups with HAVING, or compute in a subquery/CTE first.'
  if (m.includes('syntax error')) return 'SQL could not be parsed. Common causes: a missing comma between columns, a trailing comma before FROM, unbalanced parentheses, or a keyword typo.'
  if (m.includes('misuse of window function')) return 'Window functions cannot be used in WHERE/GROUP BY/HAVING — compute them in a CTE/subquery, then filter the outer query.'
  if (m.includes('unique constraint')) return 'This insert/update would duplicate a primary key or UNIQUE value — use an upsert (INSERT ... ON CONFLICT DO UPDATE) or deduplicate first.'
  if (m.includes('not null constraint')) return 'A NOT NULL column received NULL.'
  if (m.includes('incomplete input')) return 'The statement ended early — check for an unclosed parenthesis or quote.'
  return null
}

export function reviewSql(sql: string): { sev: 'warn' | 'info'; msg: string }[] {
  const s = sql.replace(/--.*$/gm, '').replace(/\s+/g, ' ')
  const out: { sev: 'warn' | 'info'; msg: string }[] = []
  if (/select\s+\*/i.test(s) && !/count\(\*\)/i.test(s.replace(/select\s+\*/i, ''))) out.push({ sev: 'info', msg: 'SELECT * — in columnar warehouses (BigQuery) you pay for every column scanned. Select only what you need.' })
  if (/\bnot\s+in\s*\(\s*select/i.test(s)) out.push({ sev: 'warn', msg: 'NOT IN (subquery) returns no rows if the subquery contains a NULL. Prefer NOT EXISTS or a LEFT JOIN … IS NULL anti-join.' })
  if (/from\s+\w+(\s+\w+)?\s*,\s*\w+/i.test(s) && !/join/i.test(s)) out.push({ sev: 'info', msg: 'Comma (implicit) joins are easy to get wrong — use explicit JOIN … ON.' })
  if (/where[^;]*\b(upper|lower|substr|strftime|date|cast|trim)\s*\(\s*\w+\.?\w*\s*[,)]/i.test(s)) out.push({ sev: 'info', msg: 'A function applied to a column in WHERE can prevent index use / partition pruning (non-sargable). Compare the raw column to a computed constant where possible.' })
  if (/select\s+distinct[^;]*group\s+by/i.test(s)) out.push({ sev: 'info', msg: 'DISTINCT together with GROUP BY is usually redundant.' })
  if (/(sum|avg|count|min|max)\s*\([^)]*\)(?!\s+as\s)(?=\s*(,|from))/i.test(s)) out.push({ sev: 'info', msg: 'Give aggregate columns an alias (… AS total_revenue) so results are self-describing.' })
  if (/\(\s*select[^()]*order\s+by[^()]*\)/i.test(s) && !/limit/i.test(s)) out.push({ sev: 'info', msg: 'ORDER BY inside a subquery without LIMIT has no guaranteed effect on the outer result.' })
  if (/like\s+'%/i.test(s)) out.push({ sev: 'info', msg: "A leading-wildcard LIKE '%…' cannot use a normal index." })
  if (/union(?!\s+all)/i.test(s)) out.push({ sev: 'info', msg: 'UNION removes duplicates (an extra sort/hash step). Use UNION ALL if duplicates are impossible or wanted.' })
  if (/\/\s*count\(|\/\s*sum\(/i.test(s) && !/\*\s*1\.0|1\.0\s*\*|cast\(|nullif/i.test(s)) out.push({ sev: 'warn', msg: 'Division of integers may truncate (integer division) and can divide by zero. Multiply by 1.0 and wrap the denominator in NULLIF(x, 0).' })
  return out
}
