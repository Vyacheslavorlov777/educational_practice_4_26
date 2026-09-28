const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const dbPath = path.join(__dirname, 'partners.db');

function openDatabase() {
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS partners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      partner_type TEXT NOT NULL,
      name TEXT NOT NULL,
      rating INTEGER DEFAULT 0,
      address TEXT,
      director TEXT,
      phone TEXT,
      email TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS sales_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      partner_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      sold_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (partner_id) REFERENCES partners(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);

  return db;
}

function seedIfEmpty(db) {
  const row = db.prepare('SELECT COUNT(*) AS total FROM partners').get();
  if (row.total > 0) return;

  const insertPartner = db.prepare(`
    INSERT INTO partners (partner_type, name, rating, address, director, phone, email)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertProduct = db.prepare('INSERT INTO products (name) VALUES (?)');
  const insertSale = db.prepare(`
    INSERT INTO sales_history (partner_id, product_id, quantity, sold_at)
    VALUES (?, ?, ?, ?)
  `);

  const partners = [
    { type: 'ЗАО', name: 'Северный Альянс', rating: 9, address: 'г. Москва, ул. Ленина, 1', director: 'Ковалёв А.П.', phone: '+7 223 322-22-32', email: 'info@severny.ru' },
    { type: 'ООО', name: 'ТоргСервис', rating: 7, address: 'г. Казань, ул. Баумана, 12', director: 'Мельникова О.И.', phone: '+7 495 111-22-33', email: 'sales@torgservice.ru' },
    { type: 'ИП', name: 'Кофе Плюс', rating: 8, address: 'г. Санкт-Петербург, Невский пр., 5', director: 'Захаров Д.С.', phone: '+7 812 555-44-66', email: 'zaharov@coffeeplus.ru' },
  ];

  const partnerIds = partners.map((p) => Number(
    insertPartner.run(p.type, p.name, p.rating, p.address, p.director, p.phone, p.email).lastInsertRowid
  ));

  const products = ['Кофе в зернах 1кг', 'Кофе молотый 250г', 'Сироп ванильный 1л', 'Стаканы бумажные 400мл'];
  const productIds = products.map((name) => Number(insertProduct.run(name).lastInsertRowid));

  const sales = [
    { partnerId: partnerIds[0], productId: productIds[0], quantity: 120, soldAt: '2026-01-12 10:30:00' },
    { partnerId: partnerIds[0], productId: productIds[1], quantity: 80, soldAt: '2026-02-03 14:00:00' },
    { partnerId: partnerIds[0], productId: productIds[2], quantity: 30, soldAt: '2026-03-18 09:15:00' },
    { partnerId: partnerIds[1], productId: productIds[1], quantity: 40, soldAt: '2026-01-25 11:00:00' },
    { partnerId: partnerIds[1], productId: productIds[3], quantity: 200, soldAt: '2026-02-14 16:45:00' },
    { partnerId: partnerIds[2], productId: productIds[0], quantity: 15, soldAt: '2026-03-01 12:20:00' },
  ];

  for (const sale of sales) {
    insertSale.run(sale.partnerId, sale.productId, sale.quantity, sale.soldAt);
  }
}

module.exports = { openDatabase, seedIfEmpty };
