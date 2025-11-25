const express = require('express');
const cors = require('cors');
const db = require('./db');
const bcrypt = require('bcryptjs');
const { signToken, authMiddleware, requireRole, findUserByUsername } = require('./auth');
const path = require('path');
const fs = require('fs');
const config = require(path.join(__dirname, 'config.json'));

const app = express();
const PORT = process.env.PORT || 4000;
const PRICE_MIN_DELTA = parseFloat(process.env.PRICE_MIN_DELTA || '0.01');

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Impresión térmica
const { printTest, printSale } = require('./print');
app.post('/api/print/test', async (req, res) => {
  try {
    await printTest();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'PRINT_ERROR', details: e.message });
  }
});

// Listar productos
app.get('/api/products', (req, res) => {
  db.all('SELECT * FROM products ORDER BY name ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB_ERROR', details: err.message });
    res.json(rows);
  });
});

// Registrar venta
app.post('/api/sales', authMiddleware, (req, res) => {
  const { items, payments, payment_method, payment_ref } = req.body;
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'EMPTY_CART' });
  const validMethods = ['cash', 'transfer_qr', 'card', 'account'];

  db.get(
    'SELECT id FROM shifts WHERE status = ? AND terminal = ? ORDER BY id DESC LIMIT 1',
    ['open', config.terminal],
    (err, shiftRow) => {
      if (err) return res.status(500).json({ error: 'DB_ERROR', details: err.message });
      if (!shiftRow) return res.status(400).json({ error: 'NO_OPEN_SHIFT' });
      const shiftId = shiftRow.id;
      // Validar stock y calcular total
      const productIds = items.map((it) => it.id);
      const placeholders = productIds.map(() => '?').join(',');
      db.all(`SELECT id, name, price, stock FROM products WHERE id IN (${placeholders})`, productIds, (err2, rows) => {
        if (err2) return res.status(500).json({ error: 'DB_ERROR', details: err2.message });
        const byId = new Map(rows.map((r) => [r.id, r]));
        for (const it of items) {
          const pr = byId.get(it.id);
          if (!pr) return res.status(400).json({ error: 'PRODUCT_NOT_FOUND', details: it.id });
          if (pr.stock < it.qty) return res.status(400).json({ error: 'INSUFFICIENT_STOCK', details: { id: it.id, stock: pr.stock, qty: it.qty } });
          if (it.price == null) it.price = pr.price;
        }
        const total = items.reduce((s, it) => s + (it.price * it.qty), 0);

        // Validación de pagos
        let usingMixed = Array.isArray(payments) && payments.length > 0;
        let paidAmount = 0;
        if (usingMixed) {
          for (const p of payments) {
            if (!p || !validMethods.includes(p.method)) return res.status(400).json({ error: 'INVALID_PAYMENT_METHOD' });
            if (typeof p.amount !== 'number' || p.amount <= 0) return res.status(400).json({ error: 'INVALID_PAYMENT_AMOUNT' });
            paidAmount += p.amount;
          }
          const diff = Math.abs(paidAmount - total);
          if (diff > 0.01) return res.status(400).json({ error: 'PAYMENTS_NOT_MATCH_TOTAL', details: { total, paidAmount } });
        } else {
          if (!payment_method || !validMethods.includes(payment_method)) return res.status(400).json({ error: 'INVALID_PAYMENT_METHOD' });
          paidAmount = total;
        }

        db.serialize(() => {
          db.run('BEGIN TRANSACTION');
          const createdAt = Date.now();
          db.run(
            'INSERT INTO sales (user_id, shift_id, branch, terminal, total, created_at, payment_method, payment_ref, paid_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [req.user.id, shiftId, config.branch, config.terminal, total, createdAt, usingMixed ? 'mixed' : payment_method, usingMixed ? null : (payment_ref || null), paidAmount],
            function (err3) {
              if (err3) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: 'DB_ERROR', details: err3.message });
              }
              const saleId = this.lastID;
              let pending = items.length;
              let failed = false;
              for (const it of items) {
                const lineTotal = it.price * it.qty;
                db.run(
                  'INSERT INTO sale_items (sale_id, product_id, name, price, qty, line_total) VALUES (?, ?, ?, ?, ?, ?)',
                  [saleId, it.id, byId.get(it.id).name, it.price, it.qty, lineTotal],
                  function (err4) {
                    if (err4 && !failed) {
                      failed = true;
                      db.run('ROLLBACK');
                      return res.status(500).json({ error: 'DB_ERROR', details: err4.message });
                    }
                  }
                );
                const current = byId.get(it.id);
                const oldPrice = current.price;
                const newPrice = it.price;
                const priceChanged = Math.abs(newPrice - oldPrice) >= PRICE_MIN_DELTA;
                const allowPriceChange = req.user && req.user.role === 'admin';
                const updateStockOnly = () => db.run(
                  'UPDATE products SET stock = stock - ? WHERE id = ?',
                  [it.qty, it.id],
                  function (err5) {
                    if (err5 && !failed) {
                      failed = true;
                      db.run('ROLLBACK');
                      return res.status(500).json({ error: 'DB_ERROR', details: err5.message });
                    }
                    pending--;
                    if (pending === 0 && !failed) {
                      // Insertar pagos mixtos si corresponde
                      const insertPayments = () => new Promise((resolve, reject) => {
                        if (!usingMixed) return resolve();
                        let left = payments.length;
                        if (left === 0) return resolve();
                        for (const p of payments) {
                          db.run(
                            'INSERT INTO sale_payments (sale_id, method, amount, ref, created_at) VALUES (?, ?, ?, ?, ?)',
                            [saleId, p.method, p.amount, p.ref || null, createdAt],
                            function (err7) {
                              if (err7) return reject(err7);
                              left--;
                              if (left === 0) resolve();
                            }
                          );
                        }
                      });
                      insertPayments().then(() => {
                        db.run('COMMIT', async (err6) => {
                          if (err6) {
                            return res.status(500).json({ error: 'DB_ERROR', details: err6.message });
                          }
                          const sale = { id: saleId, total, created_at: createdAt, payment_method: usingMixed ? 'mixed' : payment_method, payment_ref: usingMixed ? null : (payment_ref || null) };
                          // Desacoplar la impresión para no bloquear el registro de la venta
                          // Ejecutar en background y capturar errores sin afectar la respuesta
                          try {
                            // No esperar a que la impresora responda
                            printSale(sale, items, usingMixed ? payments : null).catch(() => {});
                          } catch {}
                          res.status(201).json({ id: saleId, total });
                        });
                      }).catch((err7) => {
                        failed = true;
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: 'DB_ERROR', details: err7.message });
                      });
                    }
                  }
                );
                if (priceChanged && allowPriceChange) {
                  db.run(
                    'UPDATE products SET stock = stock - ?, price = ? WHERE id = ?',
                    [it.qty, newPrice, it.id],
                    function (err5a) {
                      if (err5a && !failed) {
                        failed = true;
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: 'DB_ERROR', details: err5a.message });
                      }
                      db.run(
                        'INSERT INTO product_price_history (product_id, old_price, new_price, sale_id, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                        [it.id, oldPrice, newPrice, saleId, req.user.id, createdAt],
                        function (err5b) {
                          if (err5b && !failed) {
                            failed = true;
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: 'DB_ERROR', details: err5b.message });
                          }
                          pending--;
                          if (pending === 0 && !failed) {
                            const insertPayments = () => new Promise((resolve, reject) => {
                              if (!usingMixed) return resolve();
                              let left = payments.length;
                              if (left === 0) return resolve();
                              for (const p of payments) {
                                db.run(
                                  'INSERT INTO sale_payments (sale_id, method, amount, ref, created_at) VALUES (?, ?, ?, ?, ?)',
                                  [saleId, p.method, p.amount, p.ref || null, createdAt],
                                  function (err7) {
                                    if (err7) return reject(err7);
                                    left--;
                                    if (left === 0) resolve();
                                  }
                                );
                              }
                            });
                            insertPayments().then(() => {
                              db.run('COMMIT', async (err6) => {
                                if (err6) {
                                  return res.status(500).json({ error: 'DB_ERROR', details: err6.message });
                                }
                                const sale = { id: saleId, total, created_at: createdAt, payment_method: usingMixed ? 'mixed' : payment_method, payment_ref: usingMixed ? null : (payment_ref || null) };
                                try {
                                  printSale(sale, items, usingMixed ? payments : null).catch(() => {});
                                } catch {}
                                res.status(201).json({ id: saleId, total });
                              });
                            }).catch((err7) => {
                              failed = true;
                              db.run('ROLLBACK');
                              return res.status(500).json({ error: 'DB_ERROR', details: err7.message });
                            });
                          }
                        }
                      );
                    }
                  );
                } else {
                  updateStockOnly();
                }
              }
            }
          );
        });
      });
    }
  );
});

// Crear producto
app.post('/api/products', (req, res) => {
  const { sku, name, price, stock } = req.body;
  if (!sku || !name || price == null || stock == null) {
    return res.status(400).json({ error: 'VALIDATION_ERROR' });
  }
  const sql = 'INSERT INTO products (sku, name, price, stock) VALUES (?, ?, ?, ?)';
  db.run(sql, [sku, name, price, stock], function (err) {
    if (err) return res.status(500).json({ error: 'DB_ERROR', details: err.message });
    res.status(201).json({ id: this.lastID });
  });
});

// Actualizar producto
app.put('/api/products/:id', (req, res) => {
  const { id } = req.params;
  const { sku, name, price, stock } = req.body;
  const sql = 'UPDATE products SET sku = ?, name = ?, price = ?, stock = ? WHERE id = ?';
  db.run(sql, [sku, name, price, stock, id], function (err) {
    if (err) return res.status(500).json({ error: 'DB_ERROR', details: err.message });
    res.json({ changed: this.changes });
  });
});

// Eliminar producto
app.delete('/api/products/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM products WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: 'DB_ERROR', details: err.message });
    res.json({ deleted: this.changes });
  });
});

app.listen(PORT, () => {
  console.log(`SJPOS API escuchando en http://localhost:${PORT}`);
});
app.get('/api/products/:id/price-history', authMiddleware, (req, res) => {
  const { id } = req.params;
  db.all(
    'SELECT id, old_price, new_price, sale_id, user_id, created_at FROM product_price_history WHERE product_id = ? ORDER BY created_at DESC LIMIT 50',
    [id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'DB_ERROR', details: err.message });
      res.json(rows);
    }
  );
});
// Auth
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'VALIDATION_ERROR' });
  try {
    const user = await findUserByUsername(username);
    if (!user) return res.status(401).json({ error: 'BAD_CREDENTIALS' });
    const ok = bcrypt.compareSync(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'BAD_CREDENTIALS' });
    const token = signToken(user);
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (e) {
    res.status(500).json({ error: 'AUTH_ERROR', details: e.message });
  }
});

// Turnos
app.get('/api/shifts/current', authMiddleware, (req, res) => {
  db.get(
    'SELECT * FROM shifts WHERE status = ? AND terminal = ? ORDER BY id DESC LIMIT 1',
    ['open', config.terminal],
    (err, row) => {
      if (err) return res.status(500).json({ error: 'DB_ERROR', details: err.message });
      res.json(row || null);
    }
  );
});

app.post('/api/shifts/open', authMiddleware, (req, res) => {
  const { opening_amount } = req.body;
  if (opening_amount == null) return res.status(400).json({ error: 'VALIDATION_ERROR' });
  db.get(
    'SELECT id FROM shifts WHERE status = ? AND terminal = ? LIMIT 1',
    ['open', config.terminal],
    (err, row) => {
      if (err) return res.status(500).json({ error: 'DB_ERROR', details: err.message });
      if (row) return res.status(400).json({ error: 'SHIFT_ALREADY_OPEN' });
      const now = Date.now();
      const sql =
        'INSERT INTO shifts (user_id, branch, terminal, opening_amount, open_time, status) VALUES (?, ?, ?, ?, ?, ?)';
      db.run(sql, [req.user.id, config.branch, config.terminal, opening_amount, now, 'open'], function (err2) {
        if (err2) return res.status(500).json({ error: 'DB_ERROR', details: err2.message });
        res.status(201).json({ id: this.lastID });
      });
    }
  );
});

app.post('/api/shifts/close', authMiddleware, (req, res) => {
  const { closing_amount } = req.body;
  if (closing_amount == null) return res.status(400).json({ error: 'VALIDATION_ERROR' });
  db.get(
    'SELECT * FROM shifts WHERE status = ? AND terminal = ? ORDER BY id DESC LIMIT 1',
    ['open', config.terminal],
    (err, row) => {
      if (err) return res.status(500).json({ error: 'DB_ERROR', details: err.message });
      if (!row) return res.status(400).json({ error: 'NO_OPEN_SHIFT' });
      const now = Date.now();
      const sql = 'UPDATE shifts SET closing_amount = ?, close_time = ?, status = ? WHERE id = ?';
      db.run(sql, [closing_amount, now, 'closed', row.id], function (err2) {
        if (err2) return res.status(500).json({ error: 'DB_ERROR', details: err2.message });
        res.json({ closed: true });
      });
    }
  );
});
