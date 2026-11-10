# @@file pyspark/__init__.py
"""DE Lab practice emulator for a subset of the PySpark DataFrame API.
It runs on a single thread in your browser so you can practise syntax and reasoning.
Real Spark distributes work across executors; behaviour around partitions/shuffles is simulated, not real."""
__version__ = "3.5-delab-emulator"
# @@file pyspark/sql/__init__.py
from pyspark.sql._core import SparkSession, DataFrame, Row, Column, GroupedData, Window
from pyspark.sql import functions
from pyspark.sql import types
from pyspark.sql.window import Window
# @@file pyspark/sql/window.py
from pyspark.sql._core import Window
# @@file pyspark/sql/types.py
class DataType:
    def __init__(self, *a, **k): pass
    def __repr__(self): return type(self).__name__ + "()"
class StringType(DataType): pass
class IntegerType(DataType): pass
class LongType(DataType): pass
class DoubleType(DataType): pass
class FloatType(DataType): pass
class BooleanType(DataType): pass
class DateType(DataType): pass
class TimestampType(DataType): pass
class DecimalType(DataType): pass
class StructField:
    def __init__(self, name, dataType, nullable=True): self.name, self.dataType, self.nullable = name, dataType, nullable
class StructType:
    def __init__(self, fields=None): self.fields = list(fields or [])
    def add(self, name, dataType=None, nullable=True): self.fields.append(StructField(name, dataType, nullable)); return self
    @property
    def names(self): return [f.name for f in self.fields]
# @@file pyspark/sql/functions.py
from pyspark.sql._core import (col, column, lit, when, coalesce, expr, broadcast,
    sum, count, avg, mean, min, max, countDistinct, count_distinct, first, last, collect_list, collect_set, sumDistinct,
    round, upper, lower, trim, ltrim, rtrim, length, concat, concat_ws, substring, regexp_replace, split, initcap,
    to_date, to_timestamp, year, month, dayofmonth, date_format, datediff, date_add, date_sub, current_date, current_timestamp,
    row_number, rank, dense_rank, lag, lead, ntile, percent_rank, cume_dist, abs, sqrt, floor, ceil, isnull, asc, desc, greatest, least, monotonically_increasing_id, md5, sha2, hash, explode)
# @@file pyspark/sql/_core.py
import builtins, json, csv, io, re, os, datetime as _dt, math, hashlib

_bsum, _bmin, _bmax, _bround, _babs = builtins.sum, builtins.min, builtins.max, builtins.round, builtins.abs

class Row(tuple):
    def __new__(cls, *args, **kwargs):
        if kwargs:
            r = tuple.__new__(cls, kwargs.values()); r.__fields__ = list(kwargs.keys()); return r
        r = tuple.__new__(cls, args); r.__fields__ = [f"_{i+1}" for i in range(len(args))]; return r
    def __getattr__(self, k):
        if k.startswith('__'): raise AttributeError(k)
        try: return self[self.__fields__.index(k)]
        except ValueError: raise AttributeError(f"Row has no field '{k}'")
    def __getitem__(self, k):
        if isinstance(k, str): return tuple.__getitem__(self, self.__fields__.index(k))
        return tuple.__getitem__(self, k)
    def asDict(self): return dict(zip(self.__fields__, self))
    def __repr__(self): return "Row(" + ", ".join(f"{k}={v!r}" for k, v in zip(self.__fields__, self)) + ")"

class _Ctx:
    """Row accessor used while evaluating expressions (supports joined rows)."""
    __slots__ = ('row', 'left', 'right', 'lid', 'rid')
    def __init__(self, row=None, left=None, right=None, lid=None, rid=None):
        self.row, self.left, self.right, self.lid, self.rid = row, left, right, lid, rid
    def get(self, name, src=None):
        if self.row is not None:
            if name in self.row: return self.row[name]
            raise _AnalysisException(f"Column '{name}' does not exist. Available: {list(self.row.keys())}")
        if src is not None and src == self.lid: return self.left.get(name)
        if src is not None and src == self.rid: return self.right.get(name)
        inl, inr = self.left is not None and name in self.left, self.right is not None and name in self.right
        if inl and inr: raise _AnalysisException(f"Reference '{name}' is ambiguous - use df1['{name}'] / df2['{name}'] or join on='{name}'.")
        if inl: return self.left[name]
        if inr: return self.right[name]
        raise _AnalysisException(f"Column '{name}' does not exist in either side of the join.")

class _AnalysisException(Exception): pass
AnalysisException = _AnalysisException

def _null(*vals): return any(v is None for v in vals)

def _find_aggs(obj, out, depth=0):
    """Collect aggregate columns nested inside an expression (via closures), e.g. round(sum(x), 2)."""
    if depth > 12: return
    if isinstance(obj, Column):
        out.extend(a for a in obj._aggs if a not in out)
    elif isinstance(obj, (list, tuple)):
        for o in obj: _find_aggs(o, out, depth + 1)

class Column:
    def __init__(self, fn, name, agg=None, win=None, src=None, sort=None, kind='expr', key=None):
        self._fn, self._name, self._agg, self._win, self._src, self._sort, self._kind = fn, name, agg, win, src, sort, kind
        self._key = key
        if kind == 'agg':
            self._aggs = [self]
        else:
            found = []
            for cell in (getattr(fn, '__closure__', None) or ()):
                try: _find_aggs(cell.cell_contents, found)
                except ValueError: pass
            self._aggs = found
    def _eval(self, ctx): return self._fn(ctx)
    def alias(self, name):
        n = Column(self._fn, name, self._agg, self._win, self._src, self._sort, self._kind, self._key)
        if hasattr(self, '_cases'): n._cases = self._cases
        if self._kind != 'agg': n._aggs = self._aggs
        return n
    name = alias
    def __repr__(self): return f"Column<'{self._name}'>"
    def _bin(self, other, op, sym, nulls=True):
        o = other if isinstance(other, Column) else lit(other)
        def f(c):
            a, b = self._eval(c), o._eval(c)
            if nulls and _null(a, b): return None
            return op(a, b)
        return Column(f, f"({self._name} {sym} {o._name})")
    def __add__(s, o): return s._bin(o, lambda a, b: a + b, '+')
    def __radd__(s, o): return lit(o)._bin(s, lambda a, b: a + b, '+')
    def __sub__(s, o): return s._bin(o, lambda a, b: a - b, '-')
    def __rsub__(s, o): return lit(o)._bin(s, lambda a, b: a - b, '-')
    def __mul__(s, o): return s._bin(o, lambda a, b: a * b, '*')
    def __rmul__(s, o): return lit(o)._bin(s, lambda a, b: a * b, '*')
    def __truediv__(s, o): return s._bin(o, lambda a, b: None if b == 0 else a / b, '/')
    def __mod__(s, o): return s._bin(o, lambda a, b: a % b, '%')
    def __eq__(s, o): return s._bin(o, lambda a, b: a == b, '=')
    def __ne__(s, o): return s._bin(o, lambda a, b: a != b, '!=')
    def __gt__(s, o): return s._bin(o, lambda a, b: a > b, '>')
    def __ge__(s, o): return s._bin(o, lambda a, b: a >= b, '>=')
    def __lt__(s, o): return s._bin(o, lambda a, b: a < b, '<')
    def __le__(s, o): return s._bin(o, lambda a, b: a <= b, '<=')
    def __and__(s, o):
        o = o if isinstance(o, Column) else lit(o)
        def f(c):
            a, b = s._eval(c), o._eval(c)
            if a is False or b is False: return False
            if a is None or b is None: return None
            return True
        return Column(f, f"({s._name} AND {o._name})")
    def __or__(s, o):
        o = o if isinstance(o, Column) else lit(o)
        def f(c):
            a, b = s._eval(c), o._eval(c)
            if a is True or b is True: return True
            if a is None or b is None: return None
            return False
        return Column(f, f"({s._name} OR {o._name})")
    def __invert__(s): return Column(lambda c: None if s._eval(c) is None else not s._eval(c), f"(NOT {s._name})")
    def __neg__(s): return Column(lambda c: None if s._eval(c) is None else -s._eval(c), f"(- {s._name})")
    def __bool__(self): raise ValueError("Cannot convert column into bool: use '&' for 'and', '|' for 'or', '~' for 'not' when building DataFrame boolean expressions.")
    __hash__ = object.__hash__
    def isNull(s): return Column(lambda c: s._eval(c) is None, f"({s._name} IS NULL)")
    def isNotNull(s): return Column(lambda c: s._eval(c) is not None, f"({s._name} IS NOT NULL)")
    def isin(s, *vals):
        vals = vals[0] if len(vals) == 1 and isinstance(vals[0], (list, tuple, set)) else vals
        return Column(lambda c: None if s._eval(c) is None else s._eval(c) in vals, f"({s._name} IN {tuple(vals)})")
    def between(s, lo, hi): return (s >= lo) & (s <= hi)
    def like(s, pat):
        rx = re.compile('^' + re.escape(pat).replace('%', '.*').replace('_', '.') + '$')
        return Column(lambda c: None if s._eval(c) is None else bool(rx.match(str(s._eval(c)))), f"{s._name} LIKE {pat}")
    def rlike(s, pat): return Column(lambda c: None if s._eval(c) is None else bool(re.search(pat, str(s._eval(c)))), f"{s._name} RLIKE {pat}")
    def contains(s, v): return Column(lambda c: None if s._eval(c) is None else str(v) in str(s._eval(c)), f"contains({s._name}, {v})")
    def startswith(s, v): return Column(lambda c: None if s._eval(c) is None else str(s._eval(c)).startswith(v), f"startswith({s._name}, {v})")
    def endswith(s, v): return Column(lambda c: None if s._eval(c) is None else str(s._eval(c)).endswith(v), f"endswith({s._name}, {v})")
    def cast(s, t):
        t = (t if isinstance(t, str) else type(t).__name__.replace('Type', '')).lower()
        def conv(v):
            if v is None: return None
            try:
                if t in ('int', 'integer', 'long', 'bigint'): return int(float(v))
                if t in ('double', 'float', 'decimal'): return float(v)
                if t in ('string',): return str(v)
                if t in ('boolean', 'bool'): return str(v).lower() in ('true', '1', 'yes')
                if t == 'date': return _to_date(v)
            except (ValueError, TypeError): return None
            return v
        return Column(lambda c: conv(s._eval(c)), s._name)
    astype = cast
    def asc(s): return Column(s._fn, s._name, src=s._src, sort=(False, 'first'))
    def desc(s): return Column(s._fn, s._name, src=s._src, sort=(True, 'last'))
    def asc_nulls_last(s): return Column(s._fn, s._name, src=s._src, sort=(False, 'last'))
    def desc_nulls_first(s): return Column(s._fn, s._name, src=s._src, sort=(True, 'first'))
    def when(s, cond, value): return s._when_chain(cond, value)
    def otherwise(s, value):
        if not hasattr(s, '_cases'): raise ValueError('otherwise() can only follow when()')
        cases = s._cases; v = value if isinstance(value, Column) else lit(value)
        def f(c):
            for cond, val in cases:
                if cond._eval(c) is True: return val._eval(c)
            return v._eval(c)
        return Column(f, 'CASE WHEN ... END')
    def _when_chain(s, cond, value):
        cases = list(getattr(s, '_cases', [])) + [(cond, value if isinstance(value, Column) else lit(value))]
        def f(c):
            for cnd, val in cases:
                if cnd._eval(c) is True: return val._eval(c)
            return None
        n = Column(f, 'CASE WHEN ... END'); n._cases = cases; return n
    def over(s, window):
        if s._kind not in ('win', 'agg'): raise _AnalysisException(f"{s._name} is not a window or aggregate function")
        return Column(s._fn, s._name, agg=s._agg, win=window, kind='winexpr')
    def getField(s, k): return Column(lambda c: (s._eval(c) or {}).get(k), f"{s._name}.{k}")
    def __getitem__(s, k): return Column(lambda c: None if s._eval(c) is None else s._eval(c)[k], f"{s._name}[{k}]")

def col(name):
    if isinstance(name, Column): return name
    if name == '*': return Column(None, '*', kind='star')
    if '.' in name and not name.startswith('`'):
        base, field = name.split('.', 1)
        return Column(lambda c: _dig(c, base, field), name)
    return Column(lambda c: c.get(name), name)
def _dig(c, base, field):
    try: v = c.get(base)
    except _AnalysisException: return c.get(base + '.' + field)
    for f in field.split('.'): v = None if v is None else (v.get(f) if isinstance(v, dict) else getattr(v, f, None))
    return v
column = col
def _c(x): return col(x) if isinstance(x, str) else (x if isinstance(x, Column) else lit(x))
def lit(v):
    if isinstance(v, Column): return v
    return Column(lambda c: v, repr(v) if isinstance(v, str) else str(v))
def when(cond, value): return Column(lambda c: None, 'CASE')._when_chain(cond, value)
def coalesce(*cols):
    cs = [_c(x) for x in cols]
    def f(c):
        for x in cs:
            v = x._eval(c)
            if v is not None: return v
        return None
    return Column(f, f"coalesce({', '.join(x._name for x in cs)})")
def expr(s):
    m = re.fullmatch(r"\s*(\w+)\s*(=|==|!=|<>|>=|<=|>|<)\s*(.+?)\s*", s)
    if m:
        a, op, b = m.groups(); b = b.strip("'\"") if re.match(r"^['\"].*['\"]$", b.strip()) else (float(b) if re.match(r'^-?\d+(\.\d+)?$', b) else col(b))
        ops = {'=': '__eq__', '==': '__eq__', '!=': '__ne__', '<>': '__ne__', '>=': '__ge__', '<=': '__le__', '>': '__gt__', '<': '__lt__'}
        return getattr(col(a), ops[op])(b)
    return col(s.strip())
def broadcast(df): df._hint = 'broadcast'; return df

_AGG_ID = [0]
def _agg_col(label, src, fn):
    _AGG_ID[0] += 1
    key = f"__agg{_AGG_ID[0]}"
    return Column(lambda c, k=key: c.get(k), label, agg=(src, fn), kind='agg', key=key)
def _agg(name, init):
    def maker(x='*'):
        cx = None if x == '*' else _c(x)
        label = f"{name}({'1' if cx is None else cx._name})"
        return _agg_col(label, cx, init)
    return maker
def _nn(vals): return [v for v in vals if v is not None]
sum = _agg('sum', lambda vs: _bsum(_nn(vs)) if _nn(vs) else None)
avg = _agg('avg', lambda vs: (_bsum(_nn(vs)) / len(_nn(vs))) if _nn(vs) else None)
mean = avg
min = _agg('min', lambda vs: _bmin(_nn(vs)) if _nn(vs) else None)
max = _agg('max', lambda vs: _bmax(_nn(vs)) if _nn(vs) else None)
first = _agg('first', lambda vs: vs[0] if vs else None)
last = _agg('last', lambda vs: vs[-1] if vs else None)
collect_list = _agg('collect_list', lambda vs: _nn(vs))
collect_set = _agg('collect_set', lambda vs: list(dict.fromkeys(_nn(vs))))
sumDistinct = _agg('sum_distinct', lambda vs: _bsum(set(_nn(vs))) if _nn(vs) else None)
def count(x='*'):
    if x == '*' or (isinstance(x, Column) and x._kind == 'star'):
        return _agg_col('count(1)', None, lambda vs: len(vs))
    cx = _c(x); return _agg_col(f"count({cx._name})", cx, lambda vs: len(_nn(vs)))
def countDistinct(*xs):
    cs = [_c(x) for x in xs]
    tup = Column(lambda c: None if any(x._eval(c) is None for x in cs) else tuple(x._eval(c) for x in cs), ','.join(x._name for x in cs))
    return _agg_col(f"count(DISTINCT {tup._name})", tup, lambda vs: len(set(_nn(vs))))
count_distinct = countDistinct

def _f1(name, fn):
    def maker(x, *args):
        cx = _c(x)
        return Column(lambda c: None if cx._eval(c) is None else fn(cx._eval(c), *args), f"{name}({cx._name})")
    return maker
def round(x, scale=0):
    cx = _c(x); return Column(lambda c: None if cx._eval(c) is None else _bround(cx._eval(c), scale), f"round({cx._name}, {scale})")
upper = _f1('upper', lambda v: str(v).upper()); lower = _f1('lower', lambda v: str(v).lower())
trim = _f1('trim', lambda v: str(v).strip()); ltrim = _f1('ltrim', lambda v: str(v).lstrip()); rtrim = _f1('rtrim', lambda v: str(v).rstrip())
initcap = _f1('initcap', lambda v: str(v).title()); length = _f1('length', lambda v: len(str(v)))
abs = _f1('abs', lambda v: _babs(v)); sqrt = _f1('sqrt', lambda v: math.sqrt(v)); floor = _f1('floor', lambda v: math.floor(v)); ceil = _f1('ceil', lambda v: math.ceil(v))
md5 = _f1('md5', lambda v: hashlib.md5(str(v).encode()).hexdigest())
def sha2(x, bits=256): cx = _c(x); return Column(lambda c: None if cx._eval(c) is None else hashlib.sha256(str(cx._eval(c)).encode()).hexdigest(), f"sha2({cx._name})")
def hash(*xs): cs = [_c(x) for x in xs]; return Column(lambda c: builtins.hash(tuple(x._eval(c) for x in cs)) & 0x7fffffff, 'hash')
def isnull(x): return _c(x).isNull()
def asc(x): return _c(x).asc()
def desc(x): return _c(x).desc()
def substring(x, pos, ln): cx = _c(x); return Column(lambda c: None if cx._eval(c) is None else str(cx._eval(c))[pos - 1:pos - 1 + ln], f"substring({cx._name},{pos},{ln})")
def regexp_replace(x, pat, rep): cx = _c(x); return Column(lambda c: None if cx._eval(c) is None else re.sub(pat, rep.replace('$', '\\'), str(cx._eval(c))), f"regexp_replace({cx._name})")
def split(x, pat): cx = _c(x); return Column(lambda c: None if cx._eval(c) is None else re.split(pat, str(cx._eval(c))), f"split({cx._name})")
def concat(*xs):
    cs = [_c(x) for x in xs]
    return Column(lambda c: None if any(x._eval(c) is None for x in cs) else ''.join(str(x._eval(c)) for x in cs), f"concat({', '.join(x._name for x in cs)})")
def concat_ws(sep, *xs):
    cs = [_c(x) for x in xs]
    return Column(lambda c: sep.join(str(v) for v in (x._eval(c) for x in cs) if v is not None), f"concat_ws({sep}, ...)")
def greatest(*xs): cs = [_c(x) for x in xs]; return Column(lambda c: _bmax(_nn([x._eval(c) for x in cs]) or [None]), 'greatest')
def least(*xs): cs = [_c(x) for x in xs]; return Column(lambda c: _bmin(_nn([x._eval(c) for x in cs]) or [None]), 'least')
_mid = [0]
def monotonically_increasing_id():
    def f(c): _mid[0] += 1; return _mid[0] - 1
    return Column(f, 'monotonically_increasing_id()')
def explode(x):
    cx = _c(x); return Column(cx._fn, f"col", kind='explode')

def _to_date(v, fmt=None):
    if v is None: return None
    if isinstance(v, _dt.datetime): return v.date()
    if isinstance(v, _dt.date): return v
    s = str(v)
    try:
        if fmt: return _dt.datetime.strptime(s, fmt.replace('yyyy', '%Y').replace('MM', '%m').replace('dd', '%d').replace('HH', '%H').replace('mm', '%M').replace('ss', '%S')).date()
        return _dt.date.fromisoformat(s[:10])
    except ValueError: return None
def to_date(x, fmt=None): cx = _c(x); return Column(lambda c: _to_date(cx._eval(c), fmt), f"to_date({cx._name})")
def to_timestamp(x, fmt=None):
    cx = _c(x)
    def f(c):
        v = cx._eval(c)
        if v is None: return None
        try: return _dt.datetime.fromisoformat(str(v).replace('Z', '').replace('T', ' '))
        except ValueError: return None
    return Column(f, f"to_timestamp({cx._name})")
def year(x): cx = to_date(x); return Column(lambda c: None if cx._eval(c) is None else cx._eval(c).year, f"year({_c(x)._name})")
def month(x): cx = to_date(x); return Column(lambda c: None if cx._eval(c) is None else cx._eval(c).month, f"month({_c(x)._name})")
def dayofmonth(x): cx = to_date(x); return Column(lambda c: None if cx._eval(c) is None else cx._eval(c).day, f"dayofmonth({_c(x)._name})")
def date_format(x, fmt):
    cx = to_date(x); py = fmt.replace('yyyy', '%Y').replace('MM', '%m').replace('dd', '%d')
    return Column(lambda c: None if cx._eval(c) is None else cx._eval(c).strftime(py), f"date_format({_c(x)._name})")
def datediff(end, start): a, b = to_date(end), to_date(start); return Column(lambda c: None if _null(a._eval(c), b._eval(c)) else (a._eval(c) - b._eval(c)).days, 'datediff')
def date_add(x, n): a = to_date(x); return Column(lambda c: None if a._eval(c) is None else a._eval(c) + _dt.timedelta(days=n), 'date_add')
def date_sub(x, n): a = to_date(x); return Column(lambda c: None if a._eval(c) is None else a._eval(c) - _dt.timedelta(days=n), 'date_sub')
def current_date(): return Column(lambda c: _dt.date.today(), 'current_date()')
def current_timestamp(): return Column(lambda c: _dt.datetime.now(), 'current_timestamp()')

def _win(name, fn): return lambda *a: Column(lambda c: None, f"{name}()", agg=(None, ('win', name, fn, a)), kind='win')
row_number = _win('row_number', None); rank = _win('rank', None); dense_rank = _win('dense_rank', None)
percent_rank = _win('percent_rank', None); cume_dist = _win('cume_dist', None)
def ntile(n): return Column(lambda c: None, f"ntile({n})", agg=(None, ('win', 'ntile', None, (n,))), kind='win')
def lag(x, offset=1, default=None): return Column(lambda c: None, f"lag({_c(x)._name})", agg=(_c(x), ('win', 'lag', None, (offset, default))), kind='win')
def lead(x, offset=1, default=None): return Column(lambda c: None, f"lead({_c(x)._name})", agg=(_c(x), ('win', 'lead', None, (offset, default))), kind='win')

class WindowSpec:
    def __init__(self, parts=(), orders=(), frame=None): self.parts, self.orders, self.frame = list(parts), list(orders), frame
    def partitionBy(self, *cols): return WindowSpec([_c(c) for c in _flat(cols)], self.orders, self.frame)
    def orderBy(self, *cols): return WindowSpec(self.parts, [_c(c) for c in _flat(cols)], self.frame)
    def rowsBetween(self, a, b): return WindowSpec(self.parts, self.orders, ('rows', a, b))
    def rangeBetween(self, a, b): return WindowSpec(self.parts, self.orders, ('rows', a, b))
class Window:
    unboundedPreceding = -(1 << 62); unboundedFollowing = (1 << 62); currentRow = 0
    @staticmethod
    def partitionBy(*cols): return WindowSpec().partitionBy(*cols)
    @staticmethod
    def orderBy(*cols): return WindowSpec().orderBy(*cols)
def _flat(cols):
    out = []
    for c in cols:
        if isinstance(c, (list, tuple)): out.extend(c)
        else: out.append(c)
    return out

class _Key:
    """Sort key handling None and mixed types like Spark (nulls first asc, last desc)."""
    __slots__ = ('v', 'desc', 'nf')
    def __init__(self, v, desc, nf): self.v, self.desc, self.nf = v, desc, nf
    def __lt__(self, o):
        a, b = self.v, o.v
        if a is None and b is None: return False
        if a is None: return self.nf
        if b is None: return not self.nf
        try: return (a > b) if self.desc else (a < b)
        except TypeError: return (str(a) > str(b)) if self.desc else (str(a) < str(b))
    def __eq__(self, o): return self.v == o.v
def _sortkey(orders):
    def k(row):
        ctx = _Ctx(row)
        out = []
        for o in orders:
            desc, nulls = o._sort or (False, 'first')
            out.append(_Key(o._eval(ctx), desc, nulls == 'first'))
        return out
    return k

_ID = [0]
class DataFrame:
    def __init__(self, rows, columns, session, plan=None, parts=8):
        _ID[0] += 1
        self._id, self._rows, self._cols, self.sparkSession, self._plan, self._parts, self._hint = _ID[0], rows, list(columns), session, plan or [], parts, None
    def _new(self, rows, cols, step, parts=None): return DataFrame(rows, cols, self.sparkSession, self._plan + [step], parts or self._parts)
    def __getitem__(self, k):
        if isinstance(k, str): return Column(lambda c, k=k, s=self._id: c.get(k, s), k, src=self._id)
        if isinstance(k, Column): return self.filter(k)
        if isinstance(k, (list, tuple)): return self.select(*k)
        raise TypeError(k)
    def __getattr__(self, k):
        if k.startswith('_'): raise AttributeError(k)
        if k in self.__dict__.get('_cols', []): return self[k]
        raise AttributeError(f"'DataFrame' object has no attribute '{k}'")
    @property
    def columns(self): return list(self._cols)
    @property
    def dtypes(self): return [(c, _typename([r.get(c) for r in self._rows[:50]])) for c in self._cols]
    @property
    def schema(self): return self.dtypes
    @property
    def rdd(self): return _RDD(self)
    @property
    def write(self): return DataFrameWriter(self)
    @property
    def na(self): return _NA(self)
    # ---- transformations (lazy in real Spark) ----
    def _expand(self, cols):
        out = []
        for c in _flat(cols):
            if isinstance(c, str) and c == '*' or isinstance(c, Column) and c._kind == 'star': out.extend(col(x) for x in self._cols)
            else: out.append(_c(c))
        return out
    def select(self, *cols):
        cs = self._expand(cols)
        if any(c._kind == 'agg' or (c._aggs and c._kind != 'winexpr') for c in cs): return self.groupBy().agg(*cs)
        if any(c._kind == 'winexpr' for c in cs):
            df = self
            names = []
            for i, c in enumerate(cs):
                if c._kind == 'winexpr': df = df.withColumn(f"__w{i}", c); names.append(col(f"__w{i}").alias(c._name))
                else: names.append(c)
            return df.select(*names)
        ex = [c for c in cs if c._kind == 'explode']
        names = [c._name for c in cs]
        if len(set(names)) != len(names): pass
        rows = []
        for r in self._rows:
            ctx = _Ctx(r)
            if ex:
                arr = ex[0]._eval(ctx) or []
                for item in arr:
                    rows.append({c._name: (item if c._kind == 'explode' else c._eval(ctx)) for c in cs})
            else:
                rows.append({c._name: c._eval(ctx) for c in cs})
        return self._new(rows, names, f"Project [{', '.join(names)}]")
    def selectExpr(self, *exprs): return self.select(*[expr(e) if ' as ' not in e.lower() else expr(re.split(r'(?i)\s+as\s+', e)[0]).alias(re.split(r'(?i)\s+as\s+', e)[1]) for e in exprs])
    def filter(self, cond):
        c = expr(cond) if isinstance(cond, str) else cond
        rows = [r for r in self._rows if c._eval(_Ctx(r)) is True]
        return self._new(rows, self._cols, f"Filter {c._name}")
    where = filter
    def withColumn(self, name, c):
        c = _c(c)
        if c._kind == 'winexpr': return self._window(name, c)
        if c._kind == 'agg': raise _AnalysisException(f"Aggregate {c._name} in withColumn needs .over(window) or groupBy().agg()")
        rows = [{**r, name: c._eval(_Ctx(r))} for r in self._rows]
        cols = self._cols + ([] if name in self._cols else [name])
        return self._new(rows, cols, f"Project [*, {c._name} AS {name}]")
    def withColumns(self, mapping):
        df = self
        for k, v in mapping.items(): df = df.withColumn(k, v)
        return df
    def withColumnRenamed(self, old, new):
        rows = [{(new if k == old else k): v for k, v in r.items()} for r in self._rows]
        return self._new(rows, [new if c == old else c for c in self._cols], f"Rename {old} -> {new}")
    def toDF(self, *names): return self._new([dict(zip(names, (r[c] for c in self._cols))) for r in self._rows], list(names), 'ToDF')
    def drop(self, *names):
        names = [n._name if isinstance(n, Column) else n for n in names]
        cols = [c for c in self._cols if c not in names]
        return self._new([{k: r[k] for k in cols} for r in self._rows], cols, f"Drop {names}")
    def _window(self, name, c):
        w = c._win; src, spec = c._agg
        parts = {}
        for i, r in enumerate(self._rows):
            ctx = _Ctx(r)
            key = tuple(p._eval(ctx) for p in w.parts)
            parts.setdefault(key, []).append(i)
        out = [dict(r) for r in self._rows]
        for key, idx in parts.items():
            if w.orders: idx = sorted(idx, key=lambda i: _sortkey(w.orders)(self._rows[i]))
            ok = [tuple(o._eval(_Ctx(self._rows[i])) for o in w.orders) for i in idx]
            n = len(idx)
            if isinstance(spec, tuple) and spec[0] == 'win':
                kind, args = spec[1], spec[3]
                rk = drk = 0
                for pos, i in enumerate(idx):
                    if kind == 'row_number': v = pos + 1
                    elif kind in ('rank', 'percent_rank'):
                        if pos == 0 or ok[pos] != ok[pos - 1]: rk = pos + 1
                        v = rk if kind == 'rank' else ((rk - 1) / (n - 1) if n > 1 else 0.0)
                    elif kind == 'dense_rank':
                        if pos == 0 or ok[pos] != ok[pos - 1]: drk += 1
                        v = drk
                    elif kind == 'cume_dist': v = _bsum(1 for q in ok if q <= ok[pos]) / n
                    elif kind == 'ntile': v = int(pos * args[0] / n) + 1
                    elif kind in ('lag', 'lead'):
                        off, default = args; j = pos - off if kind == 'lag' else pos + off
                        v = src._eval(_Ctx(self._rows[idx[j]])) if 0 <= j < n else default
                    out[i][name] = v
            else:
                fn = spec
                frame = w.frame or (('rows', Window.unboundedPreceding, 0) if w.orders else None)
                vals = [None if src is None else src._eval(_Ctx(self._rows[i])) for i in idx]
                for pos, i in enumerate(idx):
                    if frame is None: sl = vals
                    else:
                        lo = 0 if frame[1] <= Window.unboundedPreceding else _bmax(0, pos + frame[1])
                        hi = n - 1 if frame[2] >= Window.unboundedFollowing else _bmin(n - 1, pos + frame[2])
                        if frame is not w.frame and w.orders:  # default RANGE frame includes peers (ties)
                            while hi + 1 < n and ok[hi + 1] == ok[pos]: hi += 1
                        sl = vals[lo:hi + 1]
                    out[i][name] = fn(sl if src is not None else [1] * len(sl))
        cols = self._cols + ([] if name in self._cols else [name])
        return self._new(out, cols, f"Window [{c._name} AS {name}] (shuffle: partitionBy {[p._name for p in w.parts]})")
    def groupBy(self, *cols): return GroupedData(self, [_c(c) for c in _flat(cols)])
    groupby = groupBy
    def agg(self, *exprs): return self.groupBy().agg(*exprs)
    def orderBy(self, *cols, ascending=True):
        cs = [_c(c) for c in _flat(cols)]
        if ascending is False: cs = [c.desc() if not c._sort else c for c in cs]
        if isinstance(ascending, list): cs = [c if a else c.desc() for c, a in zip(cs, ascending)]
        return self._new(sorted(self._rows, key=_sortkey(cs)), self._cols, f"Sort [{', '.join(c._name + (' DESC' if c._sort and c._sort[0] else ' ASC') for c in cs)}] (global sort = shuffle)")
    sort = orderBy
    def limit(self, n): return self._new(self._rows[:n], self._cols, f"GlobalLimit {n}")
    def distinct(self): return self.dropDuplicates()
    def dropDuplicates(self, subset=None):
        seen, rows = set(), []
        keys = subset or self._cols
        for r in self._rows:
            k = tuple(_hashable(r.get(c)) for c in keys)
            if k not in seen: seen.add(k); rows.append(r)
        return self._new(rows, self._cols, f"Deduplicate {keys} (shuffle)")
    drop_duplicates = dropDuplicates
    def union(self, other):
        if len(other._cols) != len(self._cols): raise _AnalysisException(f"Union can only be performed on tables with the same number of columns ({len(self._cols)} vs {len(other._cols)})")
        rows = self._rows + [dict(zip(self._cols, (r[c] for c in other._cols))) for r in other._rows]
        return self._new(rows, self._cols, 'Union (by position!)')
    unionAll = union
    def unionByName(self, other, allowMissingColumns=False):
        cols = self._cols + [c for c in other._cols if c not in self._cols] if allowMissingColumns else self._cols
        if not allowMissingColumns and set(other._cols) != set(self._cols): raise _AnalysisException('unionByName: column sets differ - pass allowMissingColumns=True')
        rows = [{c: r.get(c) for c in cols} for r in self._rows + other._rows]
        return self._new(rows, cols, 'Union (by name)')
    def join(self, other, on=None, how='inner'):
        how = {'left_outer': 'left', 'leftouter': 'left', 'right_outer': 'right', 'rightouter': 'right', 'outer': 'full', 'full_outer': 'full', 'fullouter': 'full', 'leftanti': 'left_anti', 'anti': 'left_anti', 'leftsemi': 'left_semi', 'semi': 'left_semi'}.get(how, how)
        if isinstance(on, str): on = [on]
        using = isinstance(on, list) and all(isinstance(x, str) for x in on)
        cond = None
        if isinstance(on, list) and not using: cond = on[0]; [cond := cond & x for x in on[1:]]
        elif isinstance(on, Column): cond = on
        def match(l, r):
            if using: return all(l.get(k) is not None and l.get(k) == r.get(k) for k in on)
            if cond is None: return True
            return cond._eval(_Ctx(left=l, right=r, lid=self._id, rid=other._id)) is True
        lcols, rcols = self._cols, other._cols
        if using: cols = list(on) + [c for c in lcols if c not in on] + [c for c in rcols if c not in on]
        else: cols = lcols + [c for c in rcols if c not in lcols] if how not in ('left_anti', 'left_semi') else lcols
        index = None
        if using:
            index = {}
            for j, r in enumerate(other._rows): index.setdefault(tuple(r.get(k) for k in on), []).append(j)
        rows, matched_r = [], set()
        def merged(l, r):
            d = {}
            if using:
                for k in on: d[k] = (l or {}).get(k) if l is not None and (l or {}).get(k) is not None else (r or {}).get(k)
            for c in lcols:
                if not (using and c in on): d[c] = None if l is None else l.get(c)
            for c in rcols:
                if not (using and c in on) and c not in d: d[c] = None if r is None else r.get(c)
            return d
        for l in self._rows:
            cands = index.get(tuple(l.get(k) for k in on), []) if index is not None else range(len(other._rows))
            ms = [j for j in cands if match(l, other._rows[j])]
            if how == 'left_semi':
                if ms: rows.append(dict(l))
                continue
            if how == 'left_anti':
                if not ms: rows.append(dict(l))
                continue
            for j in ms: matched_r.add(j); rows.append(merged(l, other._rows[j]))
            if not ms and how in ('left', 'full'): rows.append(merged(l, None))
        if how in ('right', 'full'):
            for j, r in enumerate(other._rows):
                if j not in matched_r: rows.append(merged(None, r))
        strategy = 'BroadcastHashJoin' if (other._hint == 'broadcast' or len(other._rows) < 1000) else 'SortMergeJoin (shuffle both sides)'
        return self._new(rows, cols, f"Join {how} on {on if using else (cond._name if cond is not None else 'cross')} [{strategy}]")
    def crossJoin(self, other): return self.join(other, None, 'cross')
    def fillna(self, value, subset=None):
        cols = subset or self._cols
        def fill(r):
            d = dict(r)
            for c in cols:
                v = value.get(c) if isinstance(value, dict) else value
                if c in d and d[c] is None and v is not None and (isinstance(value, dict) or type(v) == type(_first_nn(self._rows, c)) or _first_nn(self._rows, c) is None or (isinstance(v, (int, float)) and isinstance(_first_nn(self._rows, c), (int, float)))): d[c] = v
            return d
        return self._new([fill(r) for r in self._rows], self._cols, 'FillNA')
    def dropna(self, how='any', subset=None):
        cols = subset or self._cols
        keep = (lambda r: all(r.get(c) is not None for c in cols)) if how == 'any' else (lambda r: any(r.get(c) is not None for c in cols))
        return self._new([r for r in self._rows if keep(r)], self._cols, 'DropNA')
    def repartition(self, n, *cols): return self._new(self._rows, self._cols, f"Repartition {n} (full shuffle)", parts=n if isinstance(n, int) else 200)
    def coalesce(self, n): return self._new(self._rows, self._cols, f"Coalesce {n} (no shuffle)", parts=_bmin(n, self._parts))
    def cache(self): self._plan = self._plan + ['InMemoryRelation (cached)']; return self
    def persist(self, *a): return self.cache()
    def unpersist(self): return self
    def alias(self, name): return self
    def hint(self, name, *a): self._hint = name; return self
    def createOrReplaceTempView(self, name): self.sparkSession._views[name.lower()] = self
    createTempView = createOrReplaceTempView
    def transform(self, fn, *a, **k): return fn(self, *a, **k)
    # ---- actions ----
    def collect(self): return [Row(**{c: r.get(c) for c in self._cols}) for r in self._rows]
    def take(self, n): return self.collect()[:n]
    def head(self, n=None): return self.take(1)[0] if n is None and self._rows else self.take(n or 1)
    def first(self): return self.head()
    def count(self): return len(self._rows)
    def isEmpty(self): return not self._rows
    def toPandas(self):
        import pandas as pd
        return pd.DataFrame([{c: r.get(c) for c in self._cols} for r in self._rows], columns=self._cols)
    def show(self, n=20, truncate=True, vertical=False):
        rows = self._rows[:n]
        def fmt(v):
            s = 'NULL' if v is None else ('true' if v is True else 'false' if v is False else str(v))
            return s[:17] + '...' if truncate and len(s) > 20 else s
        cells = [[fmt(r.get(c)) for c in self._cols] for r in rows]
        w = [_bmax([len(c)] + [len(x[i]) for x in cells]) for i, c in enumerate(self._cols)]
        line = '+' + '+'.join('-' * x for x in w) + '+'
        print(line); print('|' + '|'.join(c.rjust(w[i]) for i, c in enumerate(self._cols)) + '|'); print(line)
        for x in cells: print('|' + '|'.join(v.rjust(w[i]) for i, v in enumerate(x)) + '|')
        print(line)
        if len(self._rows) > n: print(f"only showing top {n} rows")
        print()
    def printSchema(self):
        print('root')
        for c, t in self.dtypes: print(f" |-- {c}: {t} (nullable = true)")
        print()
    def explain(self, extended=False):
        print('== Physical Plan (DE Lab emulation) ==')
        for i, s in enumerate(reversed(self._plan)): print(('   ' * i) + '+- ' + s)
        print(f"   partitions: {self._parts}\n")
    def describe(self, *cols):
        cols = cols or [c for c, t in self.dtypes if t in ('int', 'bigint', 'double')]
        stats = []
        for name, f in [('count', lambda v: len(v)), ('mean', lambda v: _bsum(v) / len(v) if v else None), ('min', lambda v: _bmin(v) if v else None), ('max', lambda v: _bmax(v) if v else None)]:
            stats.append({'summary': name, **{c: f(_nn([r.get(c) for r in self._rows])) for c in cols}})
        return DataFrame(stats, ['summary'] + list(cols), self.sparkSession)
    def __repr__(self): return f"DataFrame[{', '.join(f'{c}: {t}' for c, t in self.dtypes)}]"

def _first_nn(rows, c):
    for r in rows:
        if r.get(c) is not None: return r.get(c)
    return None
def _hashable(v): return tuple(v) if isinstance(v, list) else (json.dumps(v, sort_keys=True) if isinstance(v, dict) else v)
def _typename(vals):
    vals = [v for v in vals if v is not None]
    if not vals: return 'string'
    v = vals[0]
    return 'boolean' if isinstance(v, bool) else 'bigint' if isinstance(v, int) else 'double' if isinstance(v, float) else 'date' if isinstance(v, _dt.date) and not isinstance(v, _dt.datetime) else 'timestamp' if isinstance(v, _dt.datetime) else 'array' if isinstance(v, list) else 'struct' if isinstance(v, dict) else 'string'

class _NA:
    def __init__(self, df): self.df = df
    def fill(self, value, subset=None): return self.df.fillna(value, subset)
    def drop(self, how='any', subset=None): return self.df.dropna(how, subset)

class _RDD:
    def __init__(self, df): self.df = df
    def getNumPartitions(self): return self.df._parts
    def collect(self): return self.df.collect()

class GroupedData:
    def __init__(self, df, keys): self.df, self.keys = df, keys
    def agg(self, *exprs):
        if len(exprs) == 1 and isinstance(exprs[0], dict):
            exprs = [globals()[fn if fn != 'mean' else 'avg'](c).alias(f"{fn}({c})") for c, fn in exprs[0].items()]
        for e in exprs:
            if not isinstance(e, Column) or not e._aggs: raise _AnalysisException(f"{getattr(e, '_name', e)} is not an aggregate expression - wrap it in F.sum/F.count/...")
        groups = {}
        for r in self.df._rows:
            ctx = _Ctx(r)
            groups.setdefault(tuple(_hashable(k._eval(ctx)) for k in self.keys), [None, []])
            g = groups[tuple(_hashable(k._eval(ctx)) for k in self.keys)]
            if g[0] is None: g[0] = [k._eval(ctx) for k in self.keys]
            g[1].append(r)
        if not self.keys and not groups: groups[()] = [[], []]
        rows = []
        for _, (kv, rs) in groups.items():
            d = {k._name: v for k, v in zip(self.keys, kv or [])}
            for e in exprs:
                inner = {}
                for a in e._aggs:
                    src, fn = a._agg
                    vals = [src._eval(_Ctx(r)) for r in rs] if src is not None else rs
                    inner[a._key] = fn(vals)
                d[e._name] = e._eval(_Ctx(inner))
            rows.append(d)
        names = [k._name for k in self.keys] + [e._name for e in exprs]
        return self.df._new(rows, names, f"HashAggregate keys={[k._name for k in self.keys]} (shuffle by key)")
    def _simple(self, fn, cols):
        cols = cols or [c for c, t in self.df.dtypes if t in ('bigint', 'double') and c not in [k._name for k in self.keys]]
        return self.agg(*[globals()[fn](c).alias(f"{fn}({c})") for c in cols])
    def count(self): return self.agg(count('*').alias('count'))
    def sum(self, *cols): return self._simple('sum', cols)
    def avg(self, *cols): return self._simple('avg', cols)
    mean = avg
    def max(self, *cols): return self._simple('max', cols)
    def min(self, *cols): return self._simple('min', cols)

def _infer(v):
    if v is None or v == '': return None
    for f in (int, float):
        try: return f(v)
        except ValueError: pass
    if v.lower() in ('true', 'false'): return v.lower() == 'true'
    return v

class DataFrameReader:
    def __init__(self, s): self.s, self.opts, self.fmt, self._schema = s, {}, 'parquet', None
    def option(self, k, v): self.opts[k.lower()] = v; return self
    def options(self, **kw):
        for k, v in kw.items(): self.option(k, v)
        return self
    def format(self, f): self.fmt = f; return self
    def schema(self, s): self._schema = s; return self
    def load(self, path=None): return getattr(self, self.fmt)(path)
    def csv(self, path, header=None, inferSchema=None, sep=None):
        header = str(header if header is not None else self.opts.get('header', False)).lower() == 'true'
        infer = str(inferSchema if inferSchema is not None else self.opts.get('inferschema', False)).lower() == 'true'
        with open(path, newline='') as fh: data = list(csv.reader(fh, delimiter=sep or self.opts.get('sep', ',')))
        cols = data[0] if header else [f"_c{i}" for i in range(len(data[0]))]
        body = data[1:] if header else data
        rows = [{c: (_infer(v) if infer else (v if v != '' else None)) for c, v in zip(cols, r)} for r in body if r]
        return DataFrame(rows, cols, self.s, [f"FileScan csv [{path}]"])
    def json(self, path):
        with open(path) as fh: text = fh.read().strip()
        recs = json.loads(text) if text.startswith('[') else [json.loads(l) for l in text.splitlines() if l.strip()]
        cols = list(dict.fromkeys(k for r in recs for k in r))
        return DataFrame([{c: r.get(c) for c in cols} for r in recs], cols, self.s, [f"FileScan json [{path}]"])
    def parquet(self, path):
        meta = path.rstrip('/') + '/_delab.json'
        if not os.path.exists(meta): raise _AnalysisException(f"Path does not exist: {path} (in this emulator, read parquet you wrote with df.write.parquet)")
        with open(meta) as fh: d = json.load(fh)
        return DataFrame(d['rows'], d['cols'], self.s, [f"FileScan parquet [{path}] (columnar: only needed columns are read)"])
    def table(self, name): return self.s.table(name)

class DataFrameWriter:
    def __init__(self, df): self.df, self._mode, self._parts, self.fmt = df, 'errorifexists', [], 'parquet'
    def mode(self, m): self._mode = m; return self
    def partitionBy(self, *cols): self._parts = _flat(cols); return self
    def format(self, f): self.fmt = f; return self
    def option(self, k, v): return self
    def save(self, path): return getattr(self, self.fmt)(path)
    def _prep(self, path):
        if os.path.exists(path) and self._mode in ('error', 'errorifexists'): raise _AnalysisException(f"path {path} already exists. Set mode('overwrite') or mode('append').")
        os.makedirs(path, exist_ok=True)
    def parquet(self, path):
        self._prep(path)
        meta = path.rstrip('/') + '/_delab.json'
        rows = self.df._rows
        if self._mode == 'append' and os.path.exists(meta):
            with open(meta) as fh: rows = json.load(fh)['rows'] + rows
        with open(meta, 'w') as fh: json.dump({'cols': self.df._cols, 'rows': rows}, fh, default=str)
        if self._parts:
            vals = sorted(set(tuple(r.get(c) for c in self._parts) for r in self.df._rows), key=str)
            for v in vals: os.makedirs(path + '/' + '/'.join(f"{c}={x}" for c, x in zip(self._parts, v)), exist_ok=True)
            print(f"[emulator] wrote {len(self.df._rows)} rows to {path} as {len(vals)} partition folder(s): " + ', '.join('/'.join(f"{c}={x}" for c, x in zip(self._parts, v)) for v in vals[:6]) + (' ...' if len(vals) > 6 else ''))
        else:
            print(f"[emulator] wrote {len(self.df._rows)} rows to {path} ({self.df._parts} part files in real Spark - one per partition)")
    def csv(self, path, header=True):
        self._prep(path)
        with open(path.rstrip('/') + '/part-00000.csv', 'w', newline='') as fh:
            w = csv.writer(fh)
            if header: w.writerow(self.df._cols)
            for r in self.df._rows: w.writerow([r.get(c) for c in self.df._cols])
        print(f"[emulator] wrote {len(self.df._rows)} rows to {path}/part-00000.csv")
    def json(self, path): self.parquet(path)
    def saveAsTable(self, name): self.df.sparkSession._views[name.lower()] = self.df; print(f"[emulator] saved table {name}")

class SparkSession:
    _active = None
    class _Builder:
        def appName(self, n): return self
        def master(self, m): return self
        def config(self, *a, **k): return self
        def enableHiveSupport(self): return self
        def getOrCreate(self):
            if SparkSession._active is None: SparkSession._active = SparkSession()
            return SparkSession._active
    builder = _Builder()
    def __init__(self): self._views = {}; self.read = DataFrameReader(self); self.conf = _Conf(); self.version = '3.5 (DE Lab emulator)'
    def createDataFrame(self, data, schema=None):
        data = list(data)
        if hasattr(data, 'to_dict'): data = data.to_dict('records')
        if isinstance(schema, str): names = [p.strip().split()[0] for p in schema.split(',')]
        elif schema is not None and hasattr(schema, 'names'): names = schema.names
        elif isinstance(schema, (list, tuple)): names = list(schema)
        else: names = None
        rows = []
        for r in data:
            if isinstance(r, Row): d = r.asDict()
            elif isinstance(r, dict): d = dict(r)
            elif isinstance(r, (list, tuple)): d = dict(zip(names or [f"_{i+1}" for i in range(len(r))], r))
            else: d = {(names or ['value'])[0]: r}
            rows.append(d)
        cols = names or (list(dict.fromkeys(k for r in rows for k in r)) if rows else [])
        return DataFrame([{c: r.get(c) for c in cols} for r in rows], cols, self, ['LocalTableScan'])
    def range(self, start, end=None, step=1):
        if end is None: start, end = 0, start
        return DataFrame([{'id': i} for i in builtins.range(start, end, step)], ['id'], self, ['Range'])
    def table(self, name):
        if name.lower() not in self._views: raise _AnalysisException(f"Table or view not found: {name}")
        return self._views[name.lower()]
    def sql(self, query):
        import sqlite3
        con = sqlite3.connect(':memory:')
        for name, df in self._views.items():
            if re.search(r'\b' + re.escape(name) + r'\b', query, re.I):
                con.execute(f'CREATE TABLE "{name}" ({", ".join(chr(34) + c + chr(34) for c in df._cols)})')
                con.executemany(f'INSERT INTO "{name}" VALUES ({",".join("?" * len(df._cols))})', [[(str(v) if isinstance(v, (_dt.date, list, dict)) else v) for v in (r.get(c) for c in df._cols)] for r in df._rows])
        cur = con.execute(query)
        cols = [d[0] for d in cur.description] if cur.description else []
        return DataFrame([dict(zip(cols, r)) for r in cur.fetchall()], cols, self, ['SQL (Catalyst would optimise this exactly like DataFrame code)'])
    def stop(self): pass
    @property
    def sparkContext(self): return _SC()
class _Conf:
    def __init__(self): self.d = {'spark.sql.shuffle.partitions': '200', 'spark.sql.adaptive.enabled': 'true', 'spark.sql.autoBroadcastJoinThreshold': '10485760'}
    def set(self, k, v): self.d[k] = str(v)
    def get(self, k, default=None): return self.d.get(k, default)
class _SC:
    defaultParallelism = 8
    def setLogLevel(self, l): pass
