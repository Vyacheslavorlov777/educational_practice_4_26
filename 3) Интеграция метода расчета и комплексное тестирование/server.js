const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { openDatabase, seedIfEmpty } = require('./db');
const { getAllPartners, getPartnerById, createPartner, updatePartner, getSalesHistoryForPartner } = require('./partnerService');
const { calculateMaterialConsumption } = require('./materialCalculator');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const db = openDatabase();
seedIfEmpty(db);

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

// Дублирует клиентскую валидацию на сервере: клиент можно обойти (curl, DevTools),
// а БД не должна получать некорректные данные ни при каком сценарии.
function validatePartnerData(data) {
  if (!data.name || !String(data.name).trim()) {
    return 'Наименование партнера не должно быть пустым.';
  }
  if (!data.email || !String(data.email).trim()) {
    return 'Email не должен быть пустым.';
  }
  if (!Number.isInteger(data.rating) || data.rating < 0) {
    return 'Рейтинг должен быть целым числом от 0. Пожалуйста, удалите знаки препинания и повторите попытку.';
  }
  return null;
}

function serveStaticFile(res, filePath) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const partnerIdMatch = req.url.match(/^\/api\/partners\/(\d+)$/);
  const partnerHistoryMatch = req.url.match(/^\/api\/partners\/(\d+)\/sales$/);

  if (partnerHistoryMatch && req.method === 'GET') {
    try {
      const partnerId = Number(partnerHistoryMatch[1]);
      const partner = getPartnerById(db, partnerId);
      if (!partner) {
        sendJson(res, 404, { error: 'Партнер не найден' });
        return;
      }
      sendJson(res, 200, { partner, sales: getSalesHistoryForPartner(db, partnerId) });
    } catch (error) {
      sendJson(res, 500, { error: 'Не удалось получить историю продаж партнера.' });
    }
    return;
  }

  if (req.url === '/api/material-calculator' && req.method === 'POST') {
    try {
      const data = await readJsonBody(req);
      const result = calculateMaterialConsumption(
        Number(data.productTypeId),
        Number(data.materialTypeId),
        Number(data.quantity),
        Number(data.param1),
        Number(data.param2)
      );
      sendJson(res, 200, { result });
    } catch (error) {
      sendJson(res, 500, { error: 'Не удалось выполнить расчет материалов. Повторите попытку позже.' });
    }
    return;
  }

  if (req.url === '/api/partners' && req.method === 'GET') {
    try {
      sendJson(res, 200, getAllPartners(db));
    } catch (error) {
      sendJson(res, 500, { error: 'Не удалось получить список партнеров. Проверьте подключение к базе данных.' });
    }
    return;
  }

  if (req.url === '/api/partners' && req.method === 'POST') {
    try {
      const data = await readJsonBody(req);
      const validationError = validatePartnerData(data);
      if (validationError) {
        sendJson(res, 400, { error: validationError });
        return;
      }
      sendJson(res, 201, createPartner(db, data));
    } catch (error) {
      sendJson(res, 500, { error: 'Не удалось создать партнера. Повторите попытку позже.' });
    }
    return;
  }

  if (partnerIdMatch && req.method === 'GET') {
    try {
      const partner = getPartnerById(db, Number(partnerIdMatch[1]));
      if (!partner) {
        sendJson(res, 404, { error: 'Партнер не найден' });
        return;
      }
      sendJson(res, 200, partner);
    } catch (error) {
      sendJson(res, 500, { error: 'Не удалось получить данные партнера.' });
    }
    return;
  }

  if (partnerIdMatch && req.method === 'PUT') {
    try {
      const data = await readJsonBody(req);
      const validationError = validatePartnerData(data);
      if (validationError) {
        sendJson(res, 400, { error: validationError });
        return;
      }
      const partner = updatePartner(db, Number(partnerIdMatch[1]), data);
      if (!partner) {
        sendJson(res, 404, { error: 'Партнер не найден' });
        return;
      }
      sendJson(res, 200, partner);
    } catch (error) {
      sendJson(res, 500, { error: 'Не удалось обновить партнера. Повторите попытку позже.' });
    }
    return;
  }

  const requestedPath = req.url === '/' ? '/index.html' : req.url;
  const safePath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  serveStaticFile(res, filePath);
});

server.listen(PORT, () => {
  console.log(`CRM с валидацией запущена: http://localhost:${PORT}`);
});
