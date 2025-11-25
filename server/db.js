const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, 'data', 'sjpos.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Performance tweaks: enable WAL, set reasonable sync and busy timeout
  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA synchronous = NORMAL');
  db.run('PRAGMA busy_timeout = 3000');

  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku TEXT UNIQUE,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin','cajero','supervisor'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    branch TEXT NOT NULL,
    terminal TEXT NOT NULL,
    opening_amount REAL NOT NULL,
    closing_amount REAL,
    open_time INTEGER NOT NULL,
    close_time INTEGER,
    status TEXT NOT NULL CHECK(status IN ('open','closed')),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    shift_id INTEGER NOT NULL,
    branch TEXT NOT NULL,
    terminal TEXT NOT NULL,
    total REAL NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(shift_id) REFERENCES shifts(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    qty INTEGER NOT NULL,
    line_total REAL NOT NULL,
    FOREIGN KEY(sale_id) REFERENCES sales(id),
    FOREIGN KEY(product_id) REFERENCES products(id)
  )`);

  // Pagos por venta (pagos mixtos)
  db.run(`CREATE TABLE IF NOT EXISTS sale_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL,
    method TEXT NOT NULL,
    amount REAL NOT NULL,
    ref TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(sale_id) REFERENCES sales(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS product_price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    old_price REAL NOT NULL,
    new_price REAL NOT NULL,
    sale_id INTEGER,
    user_id INTEGER,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(product_id) REFERENCES products(id),
    FOREIGN KEY(sale_id) REFERENCES sales(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_pph_product ON product_price_history(product_id)');

  // Migrations: add payment columns if missing
  db.run('ALTER TABLE sales ADD COLUMN payment_method TEXT', () => {});
  db.run('ALTER TABLE sales ADD COLUMN payment_ref TEXT', () => {});
  db.run('ALTER TABLE sales ADD COLUMN paid_amount REAL', () => {});

  // Indexes to speed up product listing and lookups
  db.run('CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)');
  db.run('CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku)');
});

module.exports = db;
