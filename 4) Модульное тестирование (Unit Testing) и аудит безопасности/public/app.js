const PARTNER_TYPES = ['ЗАО', 'ООО', 'ИП', 'АО', 'ПАО'];

let editingPartnerId = null; // null => режим добавления, число => режим редактирования
let selectedPartnerId = null; // ID партнера, выбранного в списке (для кнопки "История продаж")
let formSnapshot = ''; // сериализованное состояние формы на момент открытия окна (для проверки несохраненных изменений)

const WINDOW_TITLES = {
  main: 'CRM: Реестр партнеров',
  edit: {
    add: 'CRM: Карточка партнера [Добавление]',
    edit: 'CRM: Карточка партнера [Редактирование]',
  },
};

const mainWindow = document.getElementById('mainWindow');
const editWindow = document.getElementById('editWindow');
const historyWindow = document.getElementById('historyWindow');
const calculatorWindow = document.getElementById('calculatorWindow');
const editWindowTitle = document.getElementById('editWindowTitle');
const historyWindowTitle = document.getElementById('historyWindowTitle');
const historyTableBody = document.getElementById('historyTableBody');
const partnerList = document.getElementById('partnerList');
const partnerForm = document.getElementById('partnerForm');
const calculatorForm = document.getElementById('calculatorForm');
const calculatorResult = document.getElementById('calculatorResult');
const fieldType = document.getElementById('fieldType');
const btnHistory = document.getElementById('btnHistory');

/* ---------- MessageBox: аналог System.Windows.MessageBox с 3 типами ---------- */

const MESSAGEBOX_PRESETS = {
  error: { icon: '✕', title: 'Ошибка' },
  warning: { icon: '!', title: 'Предупреждение' },
  info: { icon: 'i', title: 'Информация' },
};

const messageBoxOverlay = document.getElementById('messageBoxOverlay');
const messageBoxIcon = document.getElementById('messageBoxIcon');
const messageBoxTitle = document.getElementById('messageBoxTitle');
const messageBoxText = document.getElementById('messageBoxText');
const messageBoxOk = document.getElementById('messageBoxOk');
const messageBoxCancel = document.getElementById('messageBoxCancel');
const messageBoxPanel = messageBoxOverlay.querySelector('.messagebox');

// Показывает модальное окно нужного типа и возвращает Promise<boolean>:
// true — нажата "ОК", false — нажата "Отмена" (или закрытие без действия для info/error, где кнопка отмены скрыта).
function showMessageBox(type, text, { showCancel = false } = {}) {
  const preset = MESSAGEBOX_PRESETS[type];
  messageBoxPanel.className = `messagebox messagebox--${type}`;
  messageBoxIcon.textContent = preset.icon;
  messageBoxTitle.textContent = preset.title;
  messageBoxText.textContent = text;
  messageBoxCancel.classList.toggle('messagebox__cancel--hidden', !showCancel);
  messageBoxOverlay.classList.remove('messagebox-overlay--hidden');

  return new Promise((resolve) => {
    function cleanup(result) {
      messageBoxOverlay.classList.add('messagebox-overlay--hidden');
      messageBoxOk.removeEventListener('click', onOk);
      messageBoxCancel.removeEventListener('click', onCancel);
      resolve(result);
    }
    function onOk() { cleanup(true); }
    function onCancel() { cleanup(false); }

    messageBoxOk.addEventListener('click', onOk);
    messageBoxCancel.addEventListener('click', onCancel);
  });
}

/* ---------- Валидация формы перед отправкой в БД ---------- */

class ValidationError extends Error {}

function validateFormData(data) {
  if (!data.name.trim()) {
    throw new ValidationError('Наименование партнера не должно быть пустым. Заполните поле и повторите попытку.');
  }
  if (!data.email.trim()) {
    throw new ValidationError('Email не должен быть пустым. Укажите электронную почту партнера и повторите попытку.');
  }
  if (!Number.isInteger(data.rating) || data.rating < 0) {
    throw new ValidationError('Рейтинг должен быть целым числом от 0. Пожалуйста, удалите знаки препинания и повторите попытку.');
  }
}

/* ---------- Навигация и рендеринг ---------- */

function initPartnerTypeSelect() {
  fieldType.innerHTML = PARTNER_TYPES
    .map((type) => `<option value="${type}">${type}</option>`)
    .join('');
}

function showWindow(name, title) {
  mainWindow.classList.toggle('window--hidden', name !== 'main');
  editWindow.classList.toggle('window--hidden', name !== 'edit');
  historyWindow.classList.toggle('window--hidden', name !== 'history');
  calculatorWindow.classList.toggle('window--hidden', name !== 'calculator');

  if (name === 'main') {
    document.title = WINDOW_TITLES.main;
  } else if (name === 'edit') {
    document.title = WINDOW_TITLES.edit[editingPartnerId ? 'edit' : 'add'];
  } else if (name === 'calculator') {
    document.title = 'CRM: Калькулятор расхода материалов';
  } else {
    document.title = title;
  }
}

function fillFormWithPartner(partner) {
  fieldType.value = partner.partnerType;
  document.getElementById('fieldName').value = partner.name;
  document.getElementById('fieldRating').value = partner.rating;
  document.getElementById('fieldAddress').value = partner.address || '';
  document.getElementById('fieldDirector').value = partner.director || '';
  document.getElementById('fieldPhone').value = partner.phone || '';
  document.getElementById('fieldEmail').value = partner.email || '';
}

function resetForm() {
  partnerForm.reset();
  fieldType.selectedIndex = 0;
}

function readFormData() {
  return {
    partnerType: fieldType.value,
    name: document.getElementById('fieldName').value,
    rating: Number(document.getElementById('fieldRating').value),
    address: document.getElementById('fieldAddress').value,
    director: document.getElementById('fieldDirector').value,
    phone: document.getElementById('fieldPhone').value,
    email: document.getElementById('fieldEmail').value,
  };
}

function takeFormSnapshot() {
  formSnapshot = JSON.stringify(readFormData());
}

function isFormDirty() {
  return JSON.stringify(readFormData()) !== formSnapshot;
}

async function loadPartners() {
  try {
    const response = await fetch('/api/partners');
    if (!response.ok) throw new Error('bad status');
    const partners = await response.json();
    partnerList.innerHTML = partners
      .map((p) => `<li class="partner-list__item" data-id="${p.id}">${p.partnerType} «${p.name}» — рейтинг ${p.rating}</li>`)
      .join('');
    selectedPartnerId = null;
    btnHistory.disabled = true;
  } catch (error) {
    await showMessageBox('error', 'Не удалось загрузить список партнеров. Проверьте подключение к серверу и обновите страницу.');
  }
}

function renderHistoryTable(sales) {
  if (sales.length === 0) {
    historyTableBody.innerHTML = '<tr><td colspan="3" class="history-table__empty">Отгрузок пока не было</td></tr>';
    return;
  }
  historyTableBody.innerHTML = sales
    .map((sale) => `<tr><td>${sale.productName}</td><td>${sale.quantity}</td><td>${sale.soldAt}</td></tr>`)
    .join('');
}

// Клик по строке только выделяет партнера (в отличие от dblclick, который открывает редактирование),
// чтобы кнопка "История продаж" знала, чей partner_id передавать в PartnerHistoryWindow.
partnerList.addEventListener('click', (event) => {
  const item = event.target.closest('.partner-list__item');
  if (!item) return;

  partnerList.querySelectorAll('.partner-list__item--selected').forEach((el) => el.classList.remove('partner-list__item--selected'));
  item.classList.add('partner-list__item--selected');

  selectedPartnerId = Number(item.dataset.id);
  btnHistory.disabled = false;
});

btnHistory.addEventListener('click', async () => {
  if (!selectedPartnerId) return;

  try {
    const response = await fetch(`/api/partners/${selectedPartnerId}/sales`);
    if (!response.ok) throw new Error('bad status');
    const { partner, sales } = await response.json();

    const title = `CRM: История реализации продукции — ${partner.name}`;
    historyWindowTitle.textContent = title;
    renderHistoryTable(sales);
    showWindow('history', title);
  } catch (error) {
    await showMessageBox('error', 'Не удалось загрузить историю продаж партнера. Попробуйте еще раз.');
  }
});

document.getElementById('btnHistoryBack').addEventListener('click', () => {
  showWindow('main');
});

document.getElementById('btnAddPartner').addEventListener('click', () => {
  editingPartnerId = null;
  resetForm();
  editWindowTitle.textContent = WINDOW_TITLES.edit.add;
  showWindow('edit');
  takeFormSnapshot();
});

partnerList.addEventListener('dblclick', async (event) => {
  const item = event.target.closest('.partner-list__item');
  if (!item) return;

  const partnerId = Number(item.dataset.id);
  try {
    const response = await fetch(`/api/partners/${partnerId}`);
    if (!response.ok) throw new Error('not found');
    const partner = await response.json();

    editingPartnerId = partnerId;
    fillFormWithPartner(partner);
    editWindowTitle.textContent = WINDOW_TITLES.edit.edit;
    showWindow('edit');
    takeFormSnapshot();
  } catch (error) {
    await showMessageBox('error', 'Не удалось загрузить данные партнера. Попробуйте открыть карточку еще раз.');
  }
});

document.getElementById('btnBack').addEventListener('click', async () => {
  if (isFormDirty()) {
    const confirmed = await showMessageBox(
      'warning',
      'Введенные данные не сохранены и будут потеряны. Продолжить без сохранения?',
      { showCancel: true }
    );
    if (!confirmed) return;
  }
  showWindow('main');
});

partnerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = readFormData();

  try {
    validateFormData(data);
  } catch (error) {
    if (error instanceof ValidationError) {
      await showMessageBox('error', error.message);
      return;
    }
    throw error;
  }

  const url = editingPartnerId ? `/api/partners/${editingPartnerId}` : '/api/partners';
  const method = editingPartnerId ? 'PUT' : 'POST';

  try {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || 'Сервер отклонил запрос.');
    }

    await loadPartners();
    showWindow('main');
    await showMessageBox('info', 'Партнер успешно сохранен.');
  } catch (error) {
    await showMessageBox('error', error.message || 'Не удалось сохранить партнера. СУБД недоступна, повторите попытку позже.');
  }
});

document.getElementById('btnCalculator').addEventListener('click', () => {
  calculatorForm.reset();
  calculatorResult.textContent = '';
  calculatorResult.classList.remove('calculator-result--error');
  showWindow('calculator');
});

document.getElementById('btnCalculatorBack').addEventListener('click', () => {
  showWindow('main');
});

calculatorForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const payload = {
    productTypeId: Number(document.getElementById('calcProductType').value),
    materialTypeId: Number(document.getElementById('calcMaterialType').value),
    quantity: Number(document.getElementById('calcQuantity').value),
    param1: Number(document.getElementById('calcParam1').value),
    param2: Number(document.getElementById('calcParam2').value),
  };

  try {
    const response = await fetch('/api/material-calculator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error('Сервер отклонил запрос расчета.');

    const { result } = await response.json();

    // Метод возвращает -1 вместо исключения при некорректных входных данных —
    // интерфейс обязан распознать этот код и показать понятную причину, а не просто число "-1".
    if (result === -1) {
      calculatorResult.textContent = '';
      await showMessageBox(
        'error',
        'Не удалось выполнить расчет: проверьте, что тип продукции и тип материала выбраны из списка, ' +
        'количество продукции больше нуля, а параметры изделия — положительные числа.'
      );
      return;
    }

    calculatorResult.classList.remove('calculator-result--error');
    calculatorResult.textContent = `Итоговый расход материала: ${result} ед.`;
  } catch (error) {
    calculatorResult.textContent = '';
    await showMessageBox('error', 'Не удалось выполнить расчет материалов. Проверьте подключение к серверу и повторите попытку.');
  }
});

initPartnerTypeSelect();
loadPartners();
showWindow('main');
