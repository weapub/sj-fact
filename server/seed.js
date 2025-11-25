const db = require('./db');
const bcrypt = require('bcryptjs');

const products = [
  { sku: '1001', name: 'Pan', price: 1.50, stock: 100 },
  { sku: '1002', name: 'Leche', price: 0.95, stock: 80 },
  { sku: '1003', name: 'Huevos (docena)', price: 2.40, stock: 50 },
  { sku: '1004', name: 'Arroz 1kg', price: 1.20, stock: 60 },
  { sku: '1005', name: 'Azúcar 1kg', price: 1.10, stock: 70 }
];

db.serialize(() => {
  const stmt = db.prepare('INSERT OR IGNORE INTO products (sku, name, price, stock) VALUES (?, ?, ?, ?)');
  for (const p of products) {
    stmt.run([p.sku, p.name, p.price, p.stock]);
  }
  stmt.finalize((err) => {
    if (err) {
      console.error('Error al finalizar el seeding:', err);
    } else {
      console.log('Seeding completado.');
    }
  });
  // Seed default users
  const adminHash = bcrypt.hashSync('admin123', 10);
  db.run('INSERT OR IGNORE INTO users (username, password_hash, role) VALUES (?, ?, ?)', ['admin', adminHash, 'admin']);
  const cashierHash = bcrypt.hashSync('cajero123', 10);
  db.run('INSERT OR IGNORE INTO users (username, password_hash, role) VALUES (?, ?, ?)', ['cajero', cashierHash, 'cajero']);
  console.log('Usuarios por defecto creados: admin/admin123, cajero/cajero123');
  db.close();
});