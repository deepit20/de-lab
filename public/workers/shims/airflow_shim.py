# @@file airflow/__init__.py
"""DE Lab Airflow emulator: parses DAG files written with the real Airflow 2.x API, builds the task graph,
validates it (cycles, duplicate ids, missing start_date, top-level work) and can simulate a run with dag.test().
The scheduler, executors, metadata DB and real operators are NOT emulated."""
import datetime as _dt
__version__ = '2.9-delab-emulator'
_DAGS = []
_CURRENT = []

class AirflowException(Exception): pass
class AirflowSkipException(Exception): pass
class AirflowFailException(Exception): pass

def _reset():
    _DAGS.clear(); _CURRENT.clear()

class DAG:
    def __init__(self, dag_id, schedule=None, schedule_interval=None, start_date=None, catchup=True, default_args=None, tags=None, description=None, max_active_runs=16, params=None, end_date=None, **kw):
        self.dag_id, self.schedule = dag_id, schedule if schedule is not None else schedule_interval
        self.start_date, self.catchup, self.default_args = start_date or (default_args or {}).get('start_date'), catchup, default_args or {}
        self.tags, self.description, self.tasks, self.max_active_runs, self.params = tags or [], description, {}, max_active_runs, params or {}
        self.warnings = []
        _DAGS.append(self)
    def __enter__(self): _CURRENT.append(self); return self
    def __exit__(self, *a): _CURRENT.pop()
    def _add(self, t):
        if t.task_id in self.tasks: raise AirflowException(f"DuplicateTaskIdFound: Task id '{t.task_id}' has already been added to the DAG")
        self.tasks[t.task_id] = t
    @property
    def task_ids(self): return list(self.tasks)
    def get_task(self, tid): return self.tasks[tid]
    def topological(self):
        indeg = {t: len(self.tasks[t].upstream) for t in self.tasks}
        q = [t for t in self.tasks if indeg[t] == 0]; order = []
        while q:
            t = q.pop(0); order.append(t)
            for d in sorted(self.tasks[t].downstream):
                indeg[d] -= 1
                if indeg[d] == 0: q.append(d)
        if len(order) != len(self.tasks):
            raise AirflowException('Cycle detected in DAG: ' + ', '.join(sorted(set(self.tasks) - set(order))))
        return order
    def test(self, execution_date=None, fail=None):
        """Simulate one DAG run locally: tasks run in dependency order, XComs are passed, retries & trigger rules applied.
        fail: optional dict {task_id: number_of_times_to_fail} to rehearse failure handling."""
        logical = execution_date or (self.start_date or _dt.datetime(2025, 1, 1))
        print(f"=== Simulated run of DAG '{self.dag_id}' | logical_date={logical} ===")
        fail = dict(fail or {})
        state, xcom = {}, {}
        for tid in self.topological():
            t = self.tasks[tid]
            ups = [state[u] for u in t.upstream]
            rule = t.trigger_rule
            runnable = {
                'all_success': all(s == 'success' for s in ups),
                'all_failed': all(s in ('failed', 'upstream_failed') for s in ups),
                'all_done': True,
                'one_success': any(s == 'success' for s in ups) or not ups,
                'one_failed': any(s in ('failed', 'upstream_failed') for s in ups),
                'none_failed': all(s in ('success', 'skipped') for s in ups),
                'none_failed_min_one_success': all(s in ('success', 'skipped') for s in ups) and (any(s == 'success' for s in ups) or not ups),
                'none_skipped': all(s != 'skipped' for s in ups),
                'always': True,
            }.get(rule, True)
            if not runnable:
                if rule in ('all_success', 'none_failed_min_one_success') and ups and all(s == 'skipped' for s in ups): state[tid] = 'skipped'
                elif rule == 'all_success' and any(s == 'skipped' for s in ups) and not any(s in ('failed', 'upstream_failed') for s in ups): state[tid] = 'skipped'
                else: state[tid] = 'upstream_failed' if any(s in ('failed', 'upstream_failed') for s in ups) else 'skipped'
                print(f"[{tid}] -> {state[tid].upper()} (trigger_rule={rule}, upstream={ups})")
                continue
            attempts = t.retries + 1
            for attempt in range(1, attempts + 1):
                try:
                    ctx = {'ds': logical.strftime('%Y-%m-%d') if hasattr(logical, 'strftime') else str(logical), 'logical_date': logical, 'data_interval_start': logical, 'task_instance': _TI(tid, xcom), 'ti': _TI(tid, xcom), 'params': self.params, 'dag': self, 'task': t}
                    if fail.get(tid, 0) > 0:
                        fail[tid] -= 1
                        raise AirflowException(f"Simulated failure (attempt {attempt})")
                    result = t.execute(ctx)
                    if isinstance(t, BranchPythonOperator):
                        follow = [result] if isinstance(result, str) else list(result or [])
                        for d in t.downstream:
                            if d not in follow: self._skip_branch(d, state, follow)
                    if result is not None and t.do_xcom_push: xcom[(tid, 'return_value')] = result
                    state[tid] = 'success'
                    print(f"[{tid}] -> SUCCESS" + (f" (attempt {attempt})" if attempt > 1 else '') + (f" | returned {result!r}" if result is not None else ''))
                    break
                except AirflowSkipException:
                    state[tid] = 'skipped'; print(f"[{tid}] -> SKIPPED"); break
                except Exception as e:
                    if attempt < attempts and not isinstance(e, AirflowFailException):
                        print(f"[{tid}] attempt {attempt} failed: {e} -> UP_FOR_RETRY (retry_delay={t.retry_delay})")
                    else:
                        state[tid] = 'failed'; print(f"[{tid}] -> FAILED: {type(e).__name__}: {e}")
                        if t.on_failure_callback:
                            try: t.on_failure_callback({'task_instance': _TI(tid, xcom), 'exception': e})
                            except Exception as cb: print(f"  on_failure_callback error: {cb}")
                        break
            if tid in state and state[tid] == 'skipped' and tid in getattr(self, '_preskipped', set()): pass
        ok = all(s in ('success', 'skipped') for s in state.values())
        print(f"=== DagRun {'SUCCESS' if ok else 'FAILED'} | " + ', '.join(f"{k}={v}" for k, v in state.items()) + " ===")
        self._last = state
        return state
    def _skip_branch(self, tid, state, follow):
        t = self.tasks[tid]
        t.__dict__.setdefault('_branch_skip', True)
        orig = t.execute
        def skipper(ctx, _o=orig, _t=t):
            _t.execute = _o
            raise AirflowSkipException()
        t.execute = skipper
    def __repr__(self): return f"<DAG: {self.dag_id}>"

class _TI:
    def __init__(self, tid, store): self.task_id, self.store = tid, store
    def xcom_push(self, key, value): self.store[(self.task_id, key)] = value
    def xcom_pull(self, task_ids=None, key='return_value'):
        if isinstance(task_ids, (list, tuple)): return [self.store.get((t, key)) for t in task_ids]
        return self.store.get((task_ids, key))

def _as_list(x):
    if isinstance(x, (list, tuple, set)): return list(x)
    return [x]

class BaseOperator:
    ui_color = '#fff'
    def __init__(self, task_id, dag=None, retries=None, retry_delay=None, trigger_rule='all_success', depends_on_past=False, pool=None, sla=None, execution_timeout=None, on_failure_callback=None, do_xcom_push=True, owner=None, email_on_failure=False, retry_exponential_backoff=False, max_retry_delay=None, doc_md=None, **kwargs):
        self.task_id = task_id
        self.dag = dag or (_CURRENT[-1] if _CURRENT else None)
        if self.dag is None: raise AirflowException(f"Task '{task_id}' was created outside of a DAG context - use 'with DAG(...) as dag:' or pass dag=dag")
        da = self.dag.default_args
        self.retries = retries if retries is not None else da.get('retries', 0)
        self.retry_delay = retry_delay if retry_delay is not None else da.get('retry_delay', _dt.timedelta(minutes=5))
        self.trigger_rule = getattr(trigger_rule, 'value', trigger_rule)
        self.on_failure_callback = on_failure_callback or da.get('on_failure_callback')
        self.sla, self.execution_timeout, self.pool, self.do_xcom_push = sla, execution_timeout, pool, do_xcom_push
        self.upstream, self.downstream = set(), set()
        self.extra = {k: v for k, v in kwargs.items() if isinstance(v, (str, int, float, bool))}
        self.dag._add(self)
    @property
    def operator(self): return type(self).__name__
    def set_downstream(self, other):
        for o in _as_list(other):
            o = getattr(o, 'operator_obj', o)
            self.downstream.add(o.task_id); o.upstream.add(self.task_id)
    def set_upstream(self, other):
        for o in _as_list(other): getattr(o, 'operator_obj', o).set_downstream(self)
    def __rshift__(self, other): self.set_downstream(other); return other
    def __lshift__(self, other): self.set_upstream(other); return other
    def __rrshift__(self, other):
        for o in _as_list(other): getattr(o, 'operator_obj', o).set_downstream(self)
        return self
    def __rlshift__(self, other):
        for o in _as_list(other): getattr(o, 'operator_obj', o).set_upstream(self)
        return self
    def execute(self, context): return None
    def __repr__(self): return f"<Task({self.operator}): {self.task_id}>"

class PythonOperator(BaseOperator):
    def __init__(self, task_id, python_callable, op_args=None, op_kwargs=None, **kw):
        super().__init__(task_id, **kw)
        if not callable(python_callable): raise AirflowException('python_callable must be callable (pass the function, do not call it!)')
        self.python_callable, self.op_args, self.op_kwargs = python_callable, op_args or [], op_kwargs or {}
    def execute(self, context):
        import inspect
        params = inspect.signature(self.python_callable).parameters
        kwargs = dict(self.op_kwargs)
        if any(p.kind == p.VAR_KEYWORD for p in params.values()): kwargs.update({k: v for k, v in context.items() if k not in kwargs})
        else: kwargs.update({k: v for k, v in context.items() if k in params and k not in kwargs})
        return self.python_callable(*self.op_args, **kwargs)
class BranchPythonOperator(PythonOperator): pass
class ShortCircuitOperator(PythonOperator):
    def execute(self, context):
        r = super().execute(context)
        if not r:
            for d in self.downstream: self.dag._skip_branch(d, {}, [])
        return r
class BashOperator(BaseOperator):
    def __init__(self, task_id, bash_command, env=None, **kw):
        super().__init__(task_id, **kw); self.bash_command = bash_command
    def execute(self, context):
        print(f"  $ {self.bash_command}   (bash not executed in emulator)")
class EmptyOperator(BaseOperator): pass
DummyOperator = EmptyOperator
class BaseSensorOperator(BaseOperator):
    def __init__(self, task_id, poke_interval=60, timeout=60 * 60 * 24 * 7, mode='poke', soft_fail=False, **kw):
        super().__init__(task_id, **kw); self.poke_interval, self.timeout, self.mode, self.soft_fail = poke_interval, timeout, mode, soft_fail
    def poke(self, context): return True
    def execute(self, context):
        if not self.poke(context): raise AirflowException('Sensor condition not met')
        print(f"  sensor satisfied (mode={self.mode}, poke_interval={self.poke_interval}s, timeout={self.timeout}s)")
class FileSensor(BaseSensorOperator):
    def __init__(self, task_id, filepath, fs_conn_id='fs_default', **kw): super().__init__(task_id, **kw); self.filepath = filepath
    def poke(self, context):
        import os
        return os.path.exists(self.filepath) or True
class ExternalTaskSensor(BaseSensorOperator):
    def __init__(self, task_id, external_dag_id, external_task_id=None, **kw): super().__init__(task_id, **kw); self.external_dag_id = external_dag_id
class PythonSensor(BaseSensorOperator):
    def __init__(self, task_id, python_callable, **kw): super().__init__(task_id, **kw); self.python_callable = python_callable
    def poke(self, context): return bool(self.python_callable())
class TriggerDagRunOperator(BaseOperator):
    def __init__(self, task_id, trigger_dag_id, **kw): super().__init__(task_id, **kw); self.trigger_dag_id = trigger_dag_id
class _GenericOperator(BaseOperator):
    def __init__(self, task_id, **kw):
        keep = {k: v for k, v in kw.items() if k in ('dag', 'retries', 'retry_delay', 'trigger_rule', 'on_failure_callback', 'sla', 'execution_timeout', 'pool', 'do_xcom_push')}
        super().__init__(task_id, **keep); self.config = {k: v for k, v in kw.items() if k not in keep}
    def execute(self, context): print(f"  {self.operator} would run with {list(self.config)[:6]} (not executed in emulator)")
class BigQueryInsertJobOperator(_GenericOperator): pass
class GCSToBigQueryOperator(_GenericOperator): pass
class BigQueryCheckOperator(_GenericOperator): pass
class SQLExecuteQueryOperator(_GenericOperator): pass
class SparkSubmitOperator(_GenericOperator): pass

class XComArg:
    def __init__(self, op): self.operator_obj = op
    def __rshift__(self, other): self.operator_obj.set_downstream(other); return other
    def __lshift__(self, other): self.operator_obj.set_upstream(other); return other
    def __rrshift__(self, other): self.operator_obj.__rrshift__(other); return self
    def __getitem__(self, k): return _XRef(self.operator_obj, k)
    def resolve(self, store): return store.get((self.operator_obj.task_id, 'return_value'))
    @property
    def task_id(self): return self.operator_obj.task_id
    def __repr__(self): return f"XComArg({self.operator_obj.task_id})"
class _XRef(XComArg):
    def __init__(self, op, k): super().__init__(op); self.k = k
    def resolve(self, store): v = super().resolve(store); return None if v is None else v[self.k]

class _TaskFlowOperator(PythonOperator):
    def __init__(self, task_id, fn, args, kwargs, **kw):
        super().__init__(task_id, python_callable=fn, **kw)
        self.call_args, self.call_kwargs = args, kwargs
        for a in list(args) + list(kwargs.values()):
            for x in (a if isinstance(a, (list, tuple)) else [a]):
                if isinstance(x, XComArg): x.operator_obj.set_downstream(self)
    def execute(self, context):
        store = context['ti'].store
        res = lambda a: a.resolve(store) if isinstance(a, XComArg) else ([res(x) for x in a] if isinstance(a, list) else a)
        import inspect
        params = inspect.signature(self.python_callable).parameters
        kwargs = {k: res(v) for k, v in self.call_kwargs.items()}
        for k in ('ds', 'ti', 'logical_date', 'params', 'data_interval_start'):
            if k in params and k not in kwargs: kwargs[k] = context[k]
        return self.python_callable(*[res(a) for a in self.call_args], **kwargs)
class _TaskFlowBranch(_TaskFlowOperator, BranchPythonOperator): pass

class _TaskDecorator:
    def __call__(self, fn=None, **opts):
        if fn is None: return lambda f: self._wrap(f, opts)
        return self._wrap(fn, {})
    def _wrap(self, fn, opts, cls=_TaskFlowOperator):
        counter = [0]
        def make(*args, **kwargs):
            dag = _CURRENT[-1] if _CURRENT else None
            tid = opts.get('task_id', fn.__name__)
            if dag and tid in dag.tasks:
                counter[0] += 1; tid = f"{tid}__{counter[0]}"
            op = cls(tid, fn, args, kwargs, **{k: v for k, v in opts.items() if k != 'task_id'})
            return XComArg(op)
        make.__wrapped__ = fn
        make.override = lambda **o: self._wrap(fn, {**opts, **o}, cls)
        return make
    def branch(self, fn=None, **opts):
        if fn is None: return lambda f: self._wrap(f, opts, _TaskFlowBranch)
        return self._wrap(fn, {}, _TaskFlowBranch)
    def bash(self, fn=None, **opts): return self(fn, **opts)
    python = property(lambda self: self)
    sensor = property(lambda self: self)
task = _TaskDecorator()

def dag(dag_id=None, **dag_kwargs):
    def deco(fn):
        def build(*a, **k):
            d = DAG(dag_id or fn.__name__, **dag_kwargs)
            with d: fn(*a, **k)
            return d
        return build
    if callable(dag_id): fn, dag_id = dag_id, None; return deco(fn)
    return deco

def chain(*tasks):
    for a, b in zip(tasks, tasks[1:]):
        for x in _as_list(a):
            for y in _as_list(b): getattr(x, 'operator_obj', x).set_downstream(y)
def cross_downstream(from_tasks, to_tasks):
    for x in from_tasks:
        for y in to_tasks: getattr(x, 'operator_obj', x).set_downstream(y)

class TaskGroup:
    def __init__(self, group_id, **kw): self.group_id = group_id
    def __enter__(self): return self
    def __exit__(self, *a): pass

class Variable:
    _store = {}
    @staticmethod
    def get(key, default_var=None, deserialize_json=False): return Variable._store.get(key, default_var)
    @staticmethod
    def set(key, value): Variable._store[key] = value

def _export():
    out = []
    for d in _DAGS:
        problems = []
        try: d.topological(); cyc = None
        except AirflowException as e: cyc = str(e); problems.append(cyc)
        if d.start_date is None: problems.append('No start_date: Airflow will refuse to schedule this DAG.')
        if d.schedule is None: problems.append('schedule=None: DAG only runs when triggered manually (fine for ad-hoc DAGs).')
        if d.catchup and d.start_date is not None and hasattr(d.start_date, 'year') and d.start_date.year < 2025: problems.append(f'catchup=True with start_date {d.start_date:%Y-%m-%d}: Airflow would create a run for every missed interval since then.')
        for t in d.tasks.values():
            if t.retries == 0 and t.operator not in ('EmptyOperator',): pass
        no_retry = [t.task_id for t in d.tasks.values() if t.retries == 0 and t.operator not in ('EmptyOperator',)]
        if no_retry and len(no_retry) == len([t for t in d.tasks.values() if t.operator != 'EmptyOperator']): problems.append('No task has retries - transient failures (network, API limits) will fail the whole run. Set default_args={"retries": 2, ...}.')
        out.append({
            'dag_id': d.dag_id, 'schedule': str(d.schedule), 'start_date': str(d.start_date), 'catchup': d.catchup, 'tags': d.tags,
            'tasks': [{'id': t.task_id, 'op': t.operator, 'retries': t.retries, 'rule': t.trigger_rule, 'up': sorted(t.upstream), 'down': sorted(t.downstream)} for t in d.tasks.values()],
            'problems': problems, 'cycle': cyc, 'last_run': getattr(d, '_last', None),
        })
    return out
# @@file airflow/models/__init__.py
from airflow import DAG, BaseOperator, Variable
from airflow.models.baseoperator import chain, cross_downstream
# @@file airflow/models/dag.py
from airflow import DAG
# @@file airflow/models/baseoperator.py
from airflow import BaseOperator, chain, cross_downstream
# @@file airflow/operators/__init__.py
# @@file airflow/operators/python.py
from airflow import PythonOperator, BranchPythonOperator, ShortCircuitOperator
# @@file airflow/operators/python_operator.py
from airflow import PythonOperator, BranchPythonOperator
# @@file airflow/operators/bash.py
from airflow import BashOperator
# @@file airflow/operators/bash_operator.py
from airflow import BashOperator
# @@file airflow/operators/empty.py
from airflow import EmptyOperator
# @@file airflow/operators/dummy.py
from airflow import DummyOperator
# @@file airflow/operators/trigger_dagrun.py
from airflow import TriggerDagRunOperator
# @@file airflow/sensors/__init__.py
# @@file airflow/sensors/base.py
from airflow import BaseSensorOperator
# @@file airflow/sensors/filesystem.py
from airflow import FileSensor
# @@file airflow/sensors/external_task.py
from airflow import ExternalTaskSensor
# @@file airflow/sensors/python.py
from airflow import PythonSensor
# @@file airflow/decorators/__init__.py
from airflow import task, dag
# @@file airflow/utils/__init__.py
# @@file airflow/utils/dates.py
import datetime
def days_ago(n): return datetime.datetime.now() - datetime.timedelta(days=n)
# @@file airflow/utils/trigger_rule.py
class TriggerRule:
    ALL_SUCCESS = 'all_success'; ALL_FAILED = 'all_failed'; ALL_DONE = 'all_done'; ONE_SUCCESS = 'one_success'
    ONE_FAILED = 'one_failed'; NONE_FAILED = 'none_failed'; NONE_FAILED_MIN_ONE_SUCCESS = 'none_failed_min_one_success'
    NONE_SKIPPED = 'none_skipped'; ALWAYS = 'always'
# @@file airflow/utils/task_group.py
from airflow import TaskGroup
# @@file airflow/exceptions.py
from airflow import AirflowException, AirflowSkipException, AirflowFailException
# @@file airflow/providers/__init__.py
# @@file airflow/providers/google/__init__.py
# @@file airflow/providers/google/cloud/__init__.py
# @@file airflow/providers/google/cloud/operators/__init__.py
# @@file airflow/providers/google/cloud/operators/bigquery.py
from airflow import BigQueryInsertJobOperator, BigQueryCheckOperator
# @@file airflow/providers/google/cloud/transfers/__init__.py
# @@file airflow/providers/google/cloud/transfers/gcs_to_bigquery.py
from airflow import GCSToBigQueryOperator
# @@file airflow/providers/common/__init__.py
# @@file airflow/providers/common/sql/__init__.py
# @@file airflow/providers/common/sql/operators/__init__.py
# @@file airflow/providers/common/sql/operators/sql.py
from airflow import SQLExecuteQueryOperator
# @@file airflow/providers/apache/__init__.py
# @@file airflow/providers/apache/spark/__init__.py
# @@file airflow/providers/apache/spark/operators/__init__.py
# @@file airflow/providers/apache/spark/operators/spark_submit.py
from airflow import SparkSubmitOperator
