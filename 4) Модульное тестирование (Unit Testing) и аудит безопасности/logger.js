const fs = require('node:fs');
const path = require('node:path');

const LOG_FILE = path.join(__dirname, 'app.log');

// Простейшее файловое логирование ошибок: дата, время и понятный текст исключения.
// Используется во всех try...catch блоках сервера, чтобы у разработчика была история сбоев после инцидента.
function logError(context, error) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${context}: ${error.message || error}\n`;

  console.error(line.trim());
  fs.appendFile(LOG_FILE, line, () => {}); // сбой записи лога не должен ронять обработку запроса
}

module.exports = { logError };
