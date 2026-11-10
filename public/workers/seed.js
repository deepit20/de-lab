/* Deterministic practice datasets shared by the SQL (SQLite) and Python (Pyodide) engines.
   Every run produces identical data, so expected results can be computed from reference solutions. */
(function (g) {
  function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 } }
  const pad = (n) => String(n).padStart(2, '0')
  const day = (base, add) => { const d = new Date(Date.UTC(2024, 0, 1) + (base + add) * 86400000); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` }

  function build() {
    const r = rng(42)
    const pick = (a) => a[Math.floor(r() * a.length)]
    const int = (a, b) => a + Math.floor(r() * (b - a + 1))
    const first = ['Aarav', 'Diya', 'Rohan', 'Ananya', 'Kabir', 'Isha', 'Vivaan', 'Meera', 'Arjun', 'Sara', 'Neha', 'Rahul', 'Priya', 'Karan', 'Zoya', 'Dev', 'Tara', 'Nikhil', 'Pooja', 'Aditya', 'Liam', 'Emma', 'Noah', 'Olivia', 'Mia']
    const last = ['Sharma', 'Iyer', 'Rao', 'Patel', 'Nair', 'Gupta', 'Reddy', 'Khan', 'Das', 'Menon', 'Shetty', 'Kulkarni', 'Smith', 'Brown', 'Wilson']
    const cities = [['Bengaluru', 'India'], ['Mumbai', 'India'], ['Pune', 'India'], ['Hyderabad', 'India'], ['Chennai', 'India'], ['Delhi', 'India'], ['London', 'UK'], ['Manchester', 'UK'], ['Singapore', 'Singapore'], ['Dubai', 'UAE']]
    const segments = ['Consumer', 'Consumer', 'Consumer', 'Corporate', 'SMB']

    const customers = []
    for (let i = 1; i <= 120; i++) {
      const fn = pick(first), ln = pick(last), c = pick(cities)
      customers.push({ customer_id: i, name: `${fn} ${ln}`, email: r() < 0.06 ? null : `${fn}.${ln}${i}@example.com`.toLowerCase(), city: c[0], country: c[1], segment: pick(segments), signup_date: day(-200, int(0, 520)) })
    }
    const cats = { Electronics: ['Wireless Mouse', 'USB-C Hub', 'Mechanical Keyboard', '27in Monitor', 'Noise Cancelling Headphones', 'Webcam HD', 'Portable SSD 1TB', 'Smart Watch'], Books: ['Designing Data-Intensive Applications', 'The Data Warehouse Toolkit', 'Fundamentals of Data Engineering', 'Python Crash Course', 'SQL Performance Explained', 'Spark: The Definitive Guide'], Home: ['Desk Lamp', 'Ergonomic Chair', 'Standing Desk', 'Coffee Mug', 'Water Bottle', 'Plant Pot'], Fashion: ['Hoodie', 'Sneakers', 'Backpack', 'Cap', 'T-Shirt', 'Jacket'], Grocery: ['Green Tea', 'Coffee Beans', 'Dark Chocolate', 'Almonds', 'Oats'] }
    const products = []
    let pid = 1
    for (const [cat, names] of Object.entries(cats)) for (const n of names) {
      const base = cat === 'Electronics' ? int(15, 320) : cat === 'Books' ? int(18, 60) : cat === 'Home' ? int(8, 450) : cat === 'Fashion' ? int(12, 120) : int(3, 25)
      products.push({ product_id: pid++, name: n, category: cat, price: base + (int(0, 99) / 100), is_active: r() < 0.9 ? 1 : 0 })
    }
    const statuses = ['delivered', 'delivered', 'delivered', 'delivered', 'shipped', 'cancelled', 'returned']
    const channels = ['web', 'web', 'app', 'app', 'store']
    const orders = [], items = []
    let oiid = 1
    for (let o = 1; o <= 900; o++) {
      const cust = r() < 0.15 ? int(1, 12) : int(1, 110) // some loyal heavy buyers; customers 111-120 never order
      const d = day(0, int(0, 545))
      const n = int(1, 4)
      const used = new Set(); let amount = 0
      for (let k = 0; k < n; k++) {
        let p = pick(products); while (used.has(p.product_id)) p = pick(products)
        used.add(p.product_id)
        const q = r() < 0.75 ? 1 : int(2, 4)
        const unit = Math.round(p.price * (r() < 0.2 ? 0.9 : 1) * 100) / 100
        amount += q * unit
        items.push({ order_item_id: oiid++, order_id: o, product_id: p.product_id, quantity: q, unit_price: unit })
      }
      orders.push({ order_id: o, customer_id: cust, order_date: d, status: pick(statuses), channel: pick(channels), amount: Math.round(amount * 100) / 100 })
    }
    orders.sort((a, b) => (a.order_date < b.order_date ? -1 : a.order_date > b.order_date ? 1 : a.order_id - b.order_id))

    const depts = ['Engineering', 'Data', 'Sales', 'Marketing', 'Finance']
    const employees = [{ emp_id: 1, name: 'Anita Rao', dept: 'Executive', manager_id: null, salary: 250000, hire_date: '2015-04-01' }]
    const leads = []
    depts.forEach((dp, i) => { const id = i + 2; leads.push(id); employees.push({ emp_id: id, name: `${pick(first)} ${pick(last)}`, dept: dp, manager_id: 1, salary: int(140, 180) * 1000, hire_date: day(-2500, int(0, 900)) }) })
    for (let e = 7; e <= 34; e++) { const li = int(0, 4); employees.push({ emp_id: e, name: `${pick(first)} ${pick(last)}`, dept: depts[li], manager_id: e > 20 && r() < 0.5 ? int(7, 20) : leads[li], salary: int(55, 135) * 1000, hire_date: day(-1800, int(0, 2100)) }) }
    for (const e of employees) if (e.manager_id && e.manager_id >= 7) e.dept = employees.find((m) => m.emp_id === e.manager_id).dept

    const events = []
    let eid = 1
    for (let u = 1; u <= 60; u++) {
      let t = Date.UTC(2025, 5, 1) + int(0, 20) * 86400000 + int(0, 23) * 3600000
      const sessions = int(1, 4)
      for (let s = 0; s < sessions; s++) {
        const len = int(1, 7)
        for (let k = 0; k < len; k++) {
          const type = k === len - 1 && r() < 0.3 ? 'purchase' : k > 0 && r() < 0.3 ? 'add_to_cart' : 'page_view'
          const d = new Date(t)
          events.push({ event_id: eid++, user_id: u, event_type: type, page: pick(['/home', '/search', '/product', '/cart', '/checkout']), event_time: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}` })
          t += int(20, 600) * 1000
        }
        t += int(45, 600) * 60000
      }
    }
    events.sort((a, b) => (a.event_time < b.event_time ? -1 : 1)).forEach((e, i) => (e.event_id = i + 1))

    // Raw staging feed with realistic issues: duplicates, casing, whitespace, nulls, multiple versions per key
    const stg = []
    let sid = 1
    for (let i = 0; i < 70; i++) {
      const c = customers[int(0, 119)]
      const versions = r() < 0.35 ? int(2, 3) : 1
      for (let v = 0; v < versions; v++) {
        const messy = r()
        stg.push({ stg_id: sid++, customer_id: c.customer_id, name: messy < 0.2 ? `  ${c.name.toUpperCase()} ` : c.name, email: c.email && messy > 0.85 ? c.email.toUpperCase() : c.email, city: v > 0 ? pick(cities)[0] : c.city, updated_at: `2025-0${int(1, 9)}-${pad(int(10, 28))} ${pad(int(0, 23))}:${pad(int(0, 59))}:00`, source: pick(['crm', 'web']) })
      }
    }
    stg.push({ ...stg[3], stg_id: sid++ }) // exact duplicate row
    const daily = []
    for (let d = 0; d < 60; d++) daily.push({ sale_date: day(365, d), store_id: 1 + (d % 3), revenue: Math.round((800 + r() * 900 + (d % 7 === 5 ? 600 : 0)) * 100) / 100 })
    const daily_sales = daily.filter((_, i) => i % 11 !== 7) // a few missing dates (gaps)
    return { customers, products, orders, order_items: items, employees, web_events: events, stg_customers: stg, daily_sales }
  }

  const SCHEMA = {
    customers: 'customer_id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT, city TEXT, country TEXT, segment TEXT, signup_date TEXT',
    products: 'product_id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT, price REAL, is_active INTEGER',
    orders: 'order_id INTEGER PRIMARY KEY, customer_id INTEGER REFERENCES customers(customer_id), order_date TEXT, status TEXT, channel TEXT, amount REAL',
    order_items: 'order_item_id INTEGER PRIMARY KEY, order_id INTEGER REFERENCES orders(order_id), product_id INTEGER REFERENCES products(product_id), quantity INTEGER, unit_price REAL',
    employees: 'emp_id INTEGER PRIMARY KEY, name TEXT, dept TEXT, manager_id INTEGER REFERENCES employees(emp_id), salary INTEGER, hire_date TEXT',
    web_events: 'event_id INTEGER PRIMARY KEY, user_id INTEGER, event_type TEXT, page TEXT, event_time TEXT',
    stg_customers: 'stg_id INTEGER, customer_id INTEGER, name TEXT, email TEXT, city TEXT, updated_at TEXT, source TEXT',
    daily_sales: 'sale_date TEXT, store_id INTEGER, revenue REAL',
  }
  const DESCRIPTIONS = {
    customers: 'One row per customer (120). ~6% have NULL email. Customers 111–120 never ordered.',
    products: 'Product catalogue (31) across 5 categories.',
    orders: 'One row per order (900), Jan 2024 – Jun 2025. amount = sum of its items.',
    order_items: 'Order lines — grain: one product within one order.',
    employees: 'Org chart with manager_id self-reference (for self joins & recursive CTEs).',
    web_events: 'Clickstream events (sessionisation, funnels, gaps).',
    stg_customers: 'Raw CRM feed: duplicates, messy casing/whitespace, several versions per customer (dedup & upsert practice).',
    daily_sales: 'Daily revenue per store with a few missing dates (gaps & islands, running totals).',
  }

  function sqlLiteral(v) { if (v === null || v === undefined) return 'NULL'; if (typeof v === 'number') return String(v); return "'" + String(v).replace(/'/g, "''") + "'" }
  function seedSQL() {
    const data = build()
    const out = ['PRAGMA foreign_keys = OFF;', 'BEGIN;']
    for (const [t, cols] of Object.entries(SCHEMA)) {
      out.push(`CREATE TABLE ${t} (${cols});`)
      const rows = data[t]
      if (!rows.length) continue
      const keys = Object.keys(rows[0])
      for (let i = 0; i < rows.length; i += 200) {
        out.push(`INSERT INTO ${t} (${keys.join(',')}) VALUES ` + rows.slice(i, i + 200).map((r) => '(' + keys.map((k) => sqlLiteral(r[k])).join(',') + ')').join(',') + ';')
      }
    }
    out.push('CREATE INDEX idx_orders_customer ON orders(customer_id);', 'COMMIT;')
    return out.join('\n')
  }
  function toCSV(rows) {
    const keys = Object.keys(rows[0])
    const esc = (v) => (v === null || v === undefined ? '' : /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v))
    return [keys.join(','), ...rows.map((r) => keys.map((k) => esc(r[k])).join(','))].join('\n') + '\n'
  }
  function dataFiles() {
    const d = build()
    const messy = d.stg_customers.map((r) => ({ customer_id: r.customer_id, name: r.name, email: r.email ?? '', city: r.city, updated_at: r.updated_at }))
    messy.splice(5, 0, { customer_id: 'abc', name: 'Bad Row', email: 'not-an-email', city: '', updated_at: 'yesterday' })
    const logs = []
    const lr = rng(7)
    const lv = ['INFO', 'INFO', 'INFO', 'WARNING', 'ERROR']
    for (let i = 0; i < 80; i++) { const lvl = lv[Math.floor(lr() * lv.length)]; logs.push(`2025-06-0${1 + (i % 9)}T${pad(i % 24)}:${pad((i * 7) % 60)}:00Z ${lvl} pipeline=${['orders_daily', 'customers_sync', 'events_stream'][i % 3]} ${lvl === 'ERROR' ? 'msg="load failed: timeout after 30s"' : lvl === 'WARNING' ? `msg="rows rejected=${1 + (i % 5)}"` : `msg="rows loaded=${100 + i * 3}"`}`) }
    return {
      '/data/orders.csv': toCSV(d.orders),
      '/data/customers.csv': toCSV(d.customers),
      '/data/order_items.csv': toCSV(d.order_items),
      '/data/products.json': JSON.stringify(d.products, null, 2),
      '/data/events.jsonl': d.web_events.slice(0, 400).map((e) => JSON.stringify({ id: e.event_id, user: { id: e.user_id }, type: e.event_type, page: e.page, ts: e.event_time.replace(' ', 'T') + 'Z' })).join('\n') + '\n',
      '/data/messy_customers.csv': toCSV(messy),
      '/data/pipeline.log': logs.join('\n') + '\n',
      '/data/daily_sales.csv': toCSV(d.daily_sales),
    }
  }
  g.DESeed = { build, seedSQL, dataFiles, SCHEMA, DESCRIPTIONS }
})(typeof self !== 'undefined' ? self : this)
