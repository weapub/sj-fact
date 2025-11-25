const escpos = require('escpos');
escpos.Network = require('escpos-network');
const path = require('path');
const fs = require('fs');

const configPath = path.join(__dirname, 'config.json');
const config = fs.existsSync(configPath) ? require(configPath) : { printer: { type: 'network', ip: '127.0.0.1', port: 9100 } };

function getDevice() {
  const { printer } = config;
  if (printer.type === 'network') {
    return new escpos.Network(printer.ip, printer.port || 9100);
  }
  throw new Error('Tipo de impresora no soportado');
}

async function printTest() {
  return new Promise((resolve, reject) => {
    const device = getDevice();
    const printer = new escpos.Printer(device);
    device.open((err) => {
      if (err) return reject(err);
      printer
        .encode('cp860')
        .align('ct')
        .style('b')
        .size(1, 1)
        .text('SJPOS')
        .size(0, 0)
        .text('Prueba de Impresion')
        .drawLine()
        .text(new Date().toLocaleString())
        .drawLine()
        .feed(2)
        .cut()
        .close(() => resolve(true));
    });
  });
}

async function printSale(sale, items, payments = null) {
  return new Promise((resolve, reject) => {
    const device = getDevice();
    const printer = new escpos.Printer(device);
    device.open((err) => {
      if (err) return reject(err);
      printer.align('ct').style('b').text('SJPOS').style('normal').align('lt');
      printer.text(`Comprobante: ${sale.id}`);
      printer.text(`Fecha: ${new Date(sale.created_at || Date.now()).toLocaleString()}`);
      printer.drawLine();
      items.forEach((it) => {
        const line = `${(it.qty + '').padStart(3)} x ${it.name}`;
        const price = (it.price * it.qty).toFixed(2);
        printer.text(line);
        printer.text(`    $ ${price}`);
      });
      printer.drawLine();
      const totalStr = items.reduce((s, i) => s + i.price * i.qty, 0).toFixed(2);
      printer.text(`Total: $ ${totalStr}`);
      const methodMap = {
        cash: 'EFECTIVO',
        transfer_qr: 'TRANSFERENCIA/QR',
        card: 'TARJETA',
        account: 'CUENTA CORRIENTE'
      };
      if (Array.isArray(payments) && payments.length > 0) {
        printer.text('Pagos:');
        payments.forEach((p) => {
          const m = methodMap[p.method] || (p.method || '').toUpperCase();
          printer.text(`- ${m}: $ ${Number(p.amount).toFixed(2)}`);
          if (p.ref) printer.text(`  Ref: ${p.ref}`);
        });
      } else if (sale.payment_method) {
        const m = methodMap[sale.payment_method] || sale.payment_method.toUpperCase();
        printer.text(`Medio de pago: ${m}`);
        if (sale.payment_ref) printer.text(`Ref: ${sale.payment_ref}`);
      }
      printer.feed(2).cut().close(() => resolve(true));
    });
  });
}

module.exports = { printTest, printSale };