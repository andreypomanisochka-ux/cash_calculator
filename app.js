const STORAGE_KEY = 'dasha-piecework-tariffs';
const PRODUCTION_STORAGE_KEY = 'dasha-daily-production';
const THEME_STORAGE_KEY = 'dasha-salary-theme';
const THEME_COLORS = {
  light: '#f8fafc',
  dark: '#101815',
  pink: '#211827',
  action: '#0d0d0d',
};
const DEFAULT_SETTINGS = {
  thresholdOne: 10000,
  thresholdTwo: 17000,
  rateOne: 8,
  rateTwo: 9.5,
  rateThree: 11,
};

const elements = {
  themeSelect: document.querySelector('#theme-select'),
  quantity: document.querySelector('#quantity-input'),
  resultQuantity: document.querySelector('#result-quantity'),
  total: document.querySelector('#salary-total'),
  resultPeriod: document.querySelector('#result-period'),
  formula: document.querySelector('#formula-text'),
  settingsError: document.querySelector('#settings-error'),
  thresholdOne: document.querySelector('#threshold-one'),
  thresholdTwo: document.querySelector('#threshold-two'),
  rateOne: document.querySelector('#rate-one'),
  rateTwo: document.querySelector('#rate-two'),
  rateThree: document.querySelector('#rate-three'),
  openRangeStart: document.querySelector('#open-range-start'),
  entryForm: document.querySelector('#daily-entry-form'),
  entryDate: document.querySelector('#entry-date'),
  entryQuantity: document.querySelector('#entry-quantity'),
  journalFeedback: document.querySelector('#journal-feedback'),
  calendarDisclosure: document.querySelector('#calendar-disclosure'),
  calendarDayCount: document.querySelector('#calendar-day-count'),
  settingsDisclosure: document.querySelector('#settings-disclosure'),
  monthPicker: document.querySelector('#month-picker'),
  monthHeading: document.querySelector('#month-heading'),
  journalRows: document.querySelector('#journal-rows'),
  monthProduction: document.querySelector('#month-production'),
  monthWorkdays: document.querySelector('#month-workdays'),
  monthAverage: document.querySelector('#month-average'),
  monthSalary: document.querySelector('#month-salary'),
  activeMonthBadge: document.querySelector('#active-month-badge'),
  archiveCount: document.querySelector('#archive-count'),
  archiveGrid: document.querySelector('#archive-grid'),
  archiveEmpty: document.querySelector('#archive-empty'),
  archiveFeedback: document.querySelector('#archive-feedback'),
  importFile: document.querySelector('#import-file'),
  clearMonth: document.querySelector('#clear-month'),
  resetJournal: document.querySelector('#reset-journal'),
  reportScope: document.querySelector('#report-scope'),
  exportCsv: document.querySelector('#export-csv'),
};

const numberFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
const quantityFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const csvNumberFormat = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });
const weekdayFormat = new Intl.DateTimeFormat('ru-RU', { weekday: 'long' });
const dateFormat = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short' });
const csvDateFormat = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });

function applyTheme(theme, persist = true) {
  const selectedTheme = Object.hasOwn(THEME_COLORS, theme) ? theme : 'dark';
  document.documentElement.dataset.theme = selectedTheme;
  elements.themeSelect.value = selectedTheme;
  document.querySelector('#theme-color-meta').content = THEME_COLORS[selectedTheme];
  if (!persist) return;

  try {
    localStorage.setItem(THEME_STORAGE_KEY, selectedTheme);
  } catch {
    return;
  }
}

function formatNumber(value) {
  return numberFormat.format(value);
}

function formatCurrency(value) {
  return `${formatNumber(value)} ₽`;
}

function getTodayKey() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function getCurrentMonth() {
  return getTodayKey().slice(0, 7);
}

function parseDateKey(dateKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

function formatMonthTitle(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  const title = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' })
    .format(new Date(year, month - 1, 1))
    .replace(/\s*г\.?$/, '');
  return `${title.charAt(0).toLocaleUpperCase('ru-RU')}${title.slice(1)}`;
}

function formatDayCount(count) {
  const lastTwo = count % 100;
  const lastDigit = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return `${count} дней`;
  if (lastDigit === 1) return `${count} день`;
  if (lastDigit >= 2 && lastDigit <= 4) return `${count} дня`;
  return `${count} дней`;
}

function normalizeProductionRecords(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
  const records = {};

  for (const [key, value] of Object.entries(source)) {
    if (parseDateKey(key) && Number.isSafeInteger(value) && value >= 0) {
      records[key] = value;
      continue;
    }

    if (!/^\d{4}-\d{2}$/.test(key) || !value || typeof value !== 'object' || Array.isArray(value)) continue;
    for (const [dateKey, quantity] of Object.entries(value)) {
      if (dateKey.startsWith(`${key}-`) && parseDateKey(dateKey) && Number.isSafeInteger(quantity) && quantity >= 0) {
        records[dateKey] = quantity;
      }
    }
  }

  return records;
}

function groupProductionRecords(records) {
  return Object.entries(records).reduce((months, [dateKey, quantity]) => {
    const month = dateKey.slice(0, 7);
    months[month] ??= {};
    months[month][dateKey] = quantity;
    return months;
  }, {});
}

function loadProductionRecords() {
  try {
    return normalizeProductionRecords(JSON.parse(localStorage.getItem(PRODUCTION_STORAGE_KEY)));
  } catch {
    return {};
  }
}

function getSettingsFromInputs() {
  return {
    thresholdOne: Number(elements.thresholdOne.value),
    thresholdTwo: Number(elements.thresholdTwo.value),
    rateOne: Number(elements.rateOne.value),
    rateTwo: Number(elements.rateTwo.value),
    rateThree: Number(elements.rateThree.value),
  };
}

function isValidSettings(settings) {
  return Number.isSafeInteger(settings.thresholdOne)
    && Number.isSafeInteger(settings.thresholdTwo)
    && settings.thresholdOne > 0
    && settings.thresholdTwo > settings.thresholdOne
    && [settings.rateOne, settings.rateTwo, settings.rateThree].every((rate) => Number.isFinite(rate) && rate >= 0);
}

function setSettingsInputs(settings) {
  elements.thresholdOne.value = String(settings.thresholdOne);
  elements.thresholdTwo.value = String(settings.thresholdTwo);
  elements.rateOne.value = String(settings.rateOne);
  elements.rateTwo.value = String(settings.rateTwo);
  elements.rateThree.value = String(settings.rateThree);
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const settings = { ...DEFAULT_SETTINGS, ...saved };
    return isValidSettings(settings) ? settings : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

let settings = { ...DEFAULT_SETTINGS };
let productionRecords = {};
let selectedMonth = getCurrentMonth();

function getMonthQuantity() {
  return Object.entries(productionRecords)
    .filter(([dateKey]) => dateKey.startsWith(`${selectedMonth}-`))
    .reduce((total, [, quantity]) => total + quantity, 0);
}

function renderFormula() {
  const { thresholdOne, thresholdTwo, rateOne, rateTwo, rateThree } = settings;
  const rangeTwo = quantityFormat.format(thresholdTwo - thresholdOne);
  elements.formula.textContent = `Зарплата = min(Q, ${quantityFormat.format(thresholdOne)}) × ${formatNumber(rateOne)} + min(max(Q − ${quantityFormat.format(thresholdOne)}, 0), ${rangeTwo}) × ${formatNumber(rateTwo)} + max(Q − ${quantityFormat.format(thresholdTwo)}, 0) × ${formatNumber(rateThree)} ₽`;
  elements.openRangeStart.textContent = quantityFormat.format(thresholdTwo);
  document.querySelector('#detail-label-1').textContent = `Первые ${quantityFormat.format(thresholdOne)} шт`;
  document.querySelector('#detail-label-2').textContent = `От ${quantityFormat.format(thresholdOne + 1)} до ${quantityFormat.format(thresholdTwo)} шт`;
  document.querySelector('#detail-label-3').textContent = `Свыше ${quantityFormat.format(thresholdTwo)} шт`;
  document.querySelector('#detail-rate-1').textContent = formatNumber(rateOne);
  document.querySelector('#detail-rate-2').textContent = formatNumber(rateTwo);
  document.querySelector('#detail-rate-3').textContent = formatNumber(rateThree);
}

function calculate() {
  const quantity = Number(elements.quantity.value) || 0;
  const { total, tierUnits, tierSums } = calculateSalary(quantity);

  elements.total.replaceChildren(document.createTextNode(formatNumber(total)), Object.assign(document.createElement('span'), { textContent: ' ₽' }));
  elements.resultQuantity.textContent = `${quantityFormat.format(quantity)} шт`;
  elements.monthSalary.textContent = formatCurrency(total);

  tierUnits.forEach((units, index) => {
    const tier = index + 1;
    document.querySelector(`#detail-count-${tier}`).textContent = `${quantityFormat.format(units)} шт`;
    document.querySelector(`#detail-sum-${tier}`).textContent = formatCurrency(tierSums[index]);
  });
}

function calculateSalary(quantity) {
  const tierOneUnits = Math.min(quantity, settings.thresholdOne);
  const tierTwoUnits = Math.max(0, Math.min(quantity, settings.thresholdTwo) - settings.thresholdOne);
  const tierThreeUnits = Math.max(0, quantity - settings.thresholdTwo);
  const tierUnits = [tierOneUnits, tierTwoUnits, tierThreeUnits];
  const rates = [settings.rateOne, settings.rateTwo, settings.rateThree];
  const tierSums = tierUnits.map((units, index) => units * rates[index]);
  const total = tierSums.reduce((sum, amount) => sum + amount, 0);
  return { total, tierUnits, tierSums };
}

function roundMoney(amount) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function escapeCsvField(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function createCsvRows(scope) {
  const entries = Object.entries(productionRecords)
    .filter(([dateKey]) => scope === 'all' || dateKey.startsWith(`${selectedMonth}-`))
    .sort(([firstDate], [secondDate]) => firstDate.localeCompare(secondDate));
  const months = new Map();

  entries.forEach(([dateKey, quantity]) => {
    const monthKey = dateKey.slice(0, 7);
    months.set(monthKey, [...(months.get(monthKey) ?? []), [dateKey, quantity]]);
  });

  const rows = [];
  months.forEach((monthEntries) => {
    const monthQuantity = monthEntries.reduce((total, [, quantity]) => total + quantity, 0);
    const monthSalary = roundMoney(calculateSalary(monthQuantity).total);
    const effectiveRate = monthQuantity ? monthSalary / monthQuantity : 0;
    const salaryCents = Math.round(monthSalary * 100);
    const sharesInCents = monthEntries.map(([, quantity]) => salaryCents * quantity / (monthQuantity || 1));
    const allocatedCents = sharesInCents.map(Math.floor);
    const remainderOrder = sharesInCents
      .map((share, index) => ({ index, remainder: share - allocatedCents[index] }))
      .sort((first, second) => second.remainder - first.remainder);
    const centsToAllocate = salaryCents - allocatedCents.reduce((total, cents) => total + cents, 0);
    for (let index = 0; index < centsToAllocate; index += 1) {
      allocatedCents[remainderOrder[index].index] += 1;
    }

    monthEntries.forEach(([dateKey, quantity], index) => {
      rows.push([
        csvDateFormat.format(parseDateKey(dateKey)),
        quantity,
        csvNumberFormat.format(effectiveRate),
        csvNumberFormat.format(allocatedCents[index] / 100),
      ]);
    });
  });

  return rows;
}

function createCell(className, text) {
  const cell = document.createElement('td');
  if (className) cell.className = className;
  cell.textContent = text;
  return cell;
}

function createJournalRow(dateKey) {
  const date = parseDateKey(dateKey);
  const quantity = productionRecords[dateKey] ?? 0;
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  const status = quantity > 0 ? 'worked' : isWeekend ? 'off' : 'missed';
  const statusLabels = { worked: 'Рабочий', off: 'Выходной', missed: 'Пропущено' };
  const row = document.createElement('tr');
  row.className = `journal-row journal-row-${status}`;
  row.append(
    createCell('journal-date', dateFormat.format(date).replace('.', '')),
    createCell('journal-weekday', `${weekdayFormat.format(date).charAt(0).toLocaleUpperCase('ru-RU')}${weekdayFormat.format(date).slice(1)}`),
    createCell('journal-quantity', `${quantityFormat.format(quantity)} шт.`),
  );

  const statusCell = document.createElement('td');
  const statusBadge = document.createElement('span');
  statusBadge.className = `journal-status status-${status}`;
  statusBadge.textContent = statusLabels[status];
  statusCell.append(statusBadge);
  row.append(statusCell);

  const actionCell = document.createElement('td');
  const editButton = document.createElement('button');
  editButton.type = 'button';
  editButton.className = 'table-edit-button';
  editButton.textContent = 'Изменить';
  editButton.setAttribute('aria-label', `Редактировать запись за ${dateFormat.format(date)}`);
  editButton.addEventListener('click', () => {
    elements.entryDate.value = dateKey;
    elements.entryQuantity.value = String(quantity);
    elements.entryQuantity.focus();
    elements.journalFeedback.textContent = `Запись за ${dateFormat.format(date)} загружена для редактирования.`;
  });
  actionCell.append(editButton);

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'table-delete-button';
  deleteButton.textContent = 'Удалить';
  deleteButton.disabled = !Object.hasOwn(productionRecords, dateKey);
  deleteButton.title = `Удалить запись за ${dateFormat.format(date)}`;
  deleteButton.setAttribute('aria-label', `Удалить запись за ${dateFormat.format(date)}`);
  deleteButton.addEventListener('click', () => {
    if (!Object.hasOwn(productionRecords, dateKey)) return;
    if (!window.confirm(`Удалить запись за ${dateFormat.format(date)}?`)) return;

    const nextRecords = { ...productionRecords };
    delete nextRecords[dateKey];
    if (!persistProductionRecords(nextRecords)) return;
    if (elements.entryDate.value === dateKey) elements.entryQuantity.value = '';
    elements.journalFeedback.textContent = `Запись за ${dateFormat.format(date)} удалена.`;
    renderMonth();
  });
  actionCell.append(deleteButton);
  row.append(actionCell);
  return row;
}

function createArchiveCard(monthKey) {
  const quantity = Object.entries(productionRecords)
    .filter(([dateKey]) => dateKey.startsWith(`${monthKey}-`))
    .reduce((total, [, dailyQuantity]) => total + dailyQuantity, 0);
  const workedDays = Object.entries(productionRecords)
    .filter(([dateKey, dailyQuantity]) => dateKey.startsWith(`${monthKey}-`) && dailyQuantity > 0)
    .length;
  const salary = calculateSalary(quantity).total;
  const isActive = monthKey === selectedMonth;
  const card = document.createElement('article');
  card.className = `archive-card${isActive ? ' archive-card-active' : ''}`;

  const heading = document.createElement('div');
  heading.className = 'archive-card-heading';
  const title = document.createElement('h3');
  title.textContent = formatMonthTitle(monthKey);
  heading.append(title);
  if (isActive) {
    const badge = document.createElement('span');
    badge.className = 'archive-active-badge';
    badge.textContent = 'СЕЙЧАС ОТКРЫТ';
    heading.append(badge);
  }

  const metrics = document.createElement('div');
  metrics.className = 'archive-card-metrics';
  for (const [label, value] of [
    ['Объем', `${quantityFormat.format(quantity)} шт.`],
    ['Рабочих дней', quantityFormat.format(workedDays)],
    ['Зарплата', formatCurrency(salary)],
  ]) {
    const metric = document.createElement('div');
    const caption = document.createElement('span');
    caption.textContent = label;
    const result = document.createElement('strong');
    result.textContent = value;
    metric.append(caption, result);
    metrics.append(metric);
  }

  const openButton = document.createElement('button');
  openButton.type = 'button';
  openButton.className = 'archive-open-button';
  openButton.textContent = isActive ? 'Открыт' : 'Детализация';
  openButton.setAttribute('aria-pressed', String(isActive));
  openButton.addEventListener('click', () => {
    selectedMonth = monthKey;
    elements.archiveFeedback.textContent = '';
    renderMonth();
    document.querySelector('#journal-heading').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  card.append(heading, metrics, openButton);
  return card;
}

function pluralizeMonths(count) {
  const lastTwo = count % 100;
  const lastDigit = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return `${count} месяцев`;
  if (lastDigit === 1) return `${count} месяц`;
  if (lastDigit >= 2 && lastDigit <= 4) return `${count} месяца`;
  return `${count} месяцев`;
}

function renderArchive() {
  const months = [...new Set(Object.keys(productionRecords).map((dateKey) => dateKey.slice(0, 7)))]
    .sort((first, second) => second.localeCompare(first));
  elements.archiveCount.textContent = pluralizeMonths(months.length);
  elements.archiveEmpty.hidden = months.length > 0;
  elements.archiveGrid.replaceChildren(...months.map(createArchiveCard));
}

function renderMonth() {
  const [year, month] = selectedMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthQuantity = getMonthQuantity();
  const workedDays = Object.entries(productionRecords).filter(([dateKey, quantity]) => (
    dateKey.startsWith(`${selectedMonth}-`) && quantity > 0
  )).length;

  elements.monthPicker.value = selectedMonth;
  elements.monthHeading.textContent = formatMonthTitle(selectedMonth);
  elements.calendarDayCount.textContent = formatDayCount(daysInMonth);
  elements.resultPeriod.textContent = formatMonthTitle(selectedMonth).toLocaleUpperCase('ru-RU');
  elements.activeMonthBadge.textContent = `ПРОСМОТР: ${formatMonthTitle(selectedMonth).toLocaleUpperCase('ru-RU')}`;
  elements.monthProduction.innerHTML = `${quantityFormat.format(monthQuantity)} <small>шт.</small>`;
  elements.monthWorkdays.textContent = quantityFormat.format(workedDays);
  elements.monthAverage.innerHTML = `${formatNumber(workedDays ? monthQuantity / workedDays : 0)} <small>шт.</small>`;
  elements.quantity.value = String(monthQuantity);
  elements.journalRows.replaceChildren(...Array.from({ length: daysInMonth }, (_, index) => {
    const day = String(index + 1).padStart(2, '0');
    return createJournalRow(`${selectedMonth}-${day}`);
  }));
  calculate();
  renderArchive();
}

function persistProductionRecords(records = productionRecords) {
  try {
    localStorage.setItem(PRODUCTION_STORAGE_KEY, JSON.stringify(groupProductionRecords(records)));
    productionRecords = records;
    return true;
  } catch {
    elements.journalFeedback.textContent = 'Браузер не разрешил сохранить изменения журнала.';
    return false;
  }
}

function shiftMonth(offset) {
  const [year, month] = selectedMonth.split('-').map(Number);
  const next = new Date(year, month - 1 + offset, 1);
  selectedMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
  elements.journalFeedback.textContent = '';
  renderMonth();
}

function updateSettings() {
  const inputs = [elements.thresholdOne, elements.thresholdTwo, elements.rateOne, elements.rateTwo, elements.rateThree];
  const nextSettings = getSettingsFromInputs();

  elements.thresholdTwo.setCustomValidity(
    nextSettings.thresholdTwo <= nextSettings.thresholdOne ? 'Верхняя граница второго диапазона должна быть больше первой.' : '',
  );
  const isValid = inputs.every((input) => input.value !== '' && input.checkValidity()) && isValidSettings(nextSettings);
  inputs.forEach((input) => input.setAttribute('aria-invalid', String(!isValid && input.value !== '')));

  if (!isValid) {
    elements.settingsError.textContent = 'Укажите целые границы: вторая должна быть больше первой. Ставки не могут быть отрицательными.';
    return;
  }

  elements.settingsError.textContent = '';
  settings = nextSettings;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    elements.settingsError.textContent = 'Не удалось сохранить тарифы в этом браузере.';
  }
  renderFormula();
  calculate();
  renderArchive();
}

elements.entryForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const dateKey = elements.entryDate.value;
  const quantity = Number(elements.entryQuantity.value);
  if (!parseDateKey(dateKey) || !Number.isSafeInteger(quantity) || quantity < 0) {
    elements.journalFeedback.textContent = 'Укажите корректную дату и целое количество от 0 шт.';
    return;
  }

  const nextRecords = { ...productionRecords, [dateKey]: quantity };
  if (!persistProductionRecords(nextRecords)) return;
  selectedMonth = dateKey.slice(0, 7);
  elements.entryQuantity.value = '';
  if (!elements.journalFeedback.textContent.startsWith('Запись добавлена,')) {
    elements.journalFeedback.textContent = `Запись за ${dateFormat.format(parseDateKey(dateKey))} сохранена: ${quantityFormat.format(quantity)} шт.`;
  }
  renderMonth();
});

elements.monthPicker.addEventListener('change', () => {
  if (!/^\d{4}-\d{2}$/.test(elements.monthPicker.value)) return;
  selectedMonth = elements.monthPicker.value;
  elements.journalFeedback.textContent = '';
  renderMonth();
});

document.querySelector('#previous-month').addEventListener('click', () => shiftMonth(-1));
document.querySelector('#next-month').addEventListener('click', () => shiftMonth(1));

document.querySelectorAll('#tariff-settings input').forEach((input) => {
  input.addEventListener('input', updateSettings);
});

const mobileLayout = window.matchMedia('(max-width: 540px)');
function setMobileDisclosureState(event) {
  elements.calendarDisclosure.open = !event.matches;
  elements.settingsDisclosure.open = !event.matches;
}
setMobileDisclosureState(mobileLayout);
mobileLayout.addEventListener('change', setMobileDisclosureState);

elements.exportCsv.addEventListener('click', () => {
  const scope = elements.reportScope.value;
  const header = ['Дата', 'Выработка (шт.)', 'Расчетный тариф (руб./шт.)', 'Начислено (руб.)'];
  const csvRows = [header, ...createCsvRows(scope)];
  const csvContent = csvRows.map((row) => row.map(escapeCsvField).join(';')).join('\r\n');
  const blob = new Blob(['\uFEFF', csvContent], { type: 'text/csv;charset=utf-8' });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = `dasha_salary_report_${scope === 'all' ? 'all-time' : selectedMonth}.csv`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  elements.archiveFeedback.textContent = scope === 'all'
    ? `Отчет за все время подготовлен: ${quantityFormat.format(csvRows.length - 1)} записей.`
    : `Отчет за ${formatMonthTitle(selectedMonth)} подготовлен: ${quantityFormat.format(csvRows.length - 1)} записей.`;
});

document.querySelector('#export-data').addEventListener('click', () => {
  const backup = {
    format: 'dasha-salary-app',
    version: 2,
    exportedAt: new Date().toISOString(),
    data: {
      records: groupProductionRecords(productionRecords),
      settings,
      theme: document.documentElement.dataset.theme,
    },
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = `dasha-backup-${getTodayKey()}.json`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  elements.archiveFeedback.textContent = 'Бэкап подготовлен к скачиванию в формате JSON.';
});

document.querySelector('#import-data').addEventListener('click', () => elements.importFile.click());

elements.importFile.addEventListener('change', async () => {
  const [file] = elements.importFile.files;
  if (!file) return;

  try {
    const payload = JSON.parse(await file.text());
    const isFullBackup = payload.format === 'dasha-salary-app' && payload.version === 2;
    const source = isFullBackup ? payload.data?.records : payload.records ?? payload;
    if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('invalid');
    const importedRecords = normalizeProductionRecords(source);
    let importedSettings = settings;
    let importedTheme = document.documentElement.dataset.theme;

    if (isFullBackup) {
      const candidateSettings = { ...DEFAULT_SETTINGS, ...payload.data.settings };
      if (!isValidSettings(candidateSettings) || !Object.hasOwn(THEME_COLORS, payload.data.theme)) throw new Error('invalid');
      importedSettings = candidateSettings;
      importedTheme = payload.data.theme;
    }

    const storageKeys = [PRODUCTION_STORAGE_KEY];
    if (isFullBackup) storageKeys.push(STORAGE_KEY, THEME_STORAGE_KEY);
    const previousValues = storageKeys.map((key) => [key, localStorage.getItem(key)]);
    try {
      localStorage.setItem(PRODUCTION_STORAGE_KEY, JSON.stringify(groupProductionRecords(importedRecords)));
      if (isFullBackup) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(importedSettings));
        localStorage.setItem(THEME_STORAGE_KEY, importedTheme);
      }
    } catch {
      previousValues.forEach(([key, value]) => {
        try {
          if (value === null) localStorage.removeItem(key);
          else localStorage.setItem(key, value);
        } catch {
          return;
        }
      });
      throw new Error('storage');
    }

    productionRecords = importedRecords;
    if (isFullBackup) {
      settings = importedSettings;
      setSettingsInputs(settings);
      applyTheme(importedTheme, false);
      renderFormula();
    }
    elements.archiveFeedback.textContent = `Бэкап загружен. Записей: ${quantityFormat.format(Object.keys(importedRecords).length)}.`;
    renderMonth();
  } catch (error) {
    elements.archiveFeedback.textContent = error.message === 'storage'
      ? 'Не удалось сохранить бэкап в localStorage. Текущие данные не изменены.'
      : 'Не удалось прочитать файл. Выберите корректный JSON-бэкап журнала.';
  } finally {
    elements.importFile.value = '';
  }
});

elements.clearMonth.addEventListener('click', () => {
  const monthRecords = Object.keys(productionRecords).filter((dateKey) => dateKey.startsWith(`${selectedMonth}-`));
  if (!monthRecords.length) {
    elements.archiveFeedback.textContent = 'В выбранном месяце нет записей.';
    return;
  }
  if (!window.confirm(`Очистить все записи за ${formatMonthTitle(selectedMonth)}? Это действие нельзя отменить.`)) return;

  const nextRecords = { ...productionRecords };
  monthRecords.forEach((dateKey) => delete nextRecords[dateKey]);
  if (!persistProductionRecords(nextRecords)) {
    elements.archiveFeedback.textContent = elements.journalFeedback.textContent;
    return;
  }
  elements.archiveFeedback.textContent = `Записи за ${formatMonthTitle(selectedMonth)} удалены.`;
  renderMonth();
});

elements.resetJournal.addEventListener('click', () => {
  if (!Object.keys(productionRecords).length) {
    elements.archiveFeedback.textContent = 'Журнал уже пуст.';
    return;
  }
  if (!window.confirm('Сбросить весь журнал производства? Все записи за все месяцы будут удалены без возможности восстановления.')) return;
  if (!window.confirm('Последнее подтверждение: безвозвратно удалить записи всех месяцев?')) return;

  if (!persistProductionRecords({})) {
    elements.archiveFeedback.textContent = elements.journalFeedback.textContent;
    return;
  }
  elements.archiveFeedback.textContent = 'Весь журнал производства сброшен.';
  renderMonth();
});

elements.themeSelect.addEventListener('change', () => applyTheme(elements.themeSelect.value));
function initializeApp() {
  settings = loadSettings();
  productionRecords = loadProductionRecords();

  let savedTheme = 'dark';
  try {
    savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'dark';
  } catch {
    savedTheme = 'dark';
  }

  applyTheme(savedTheme, false);
  setSettingsInputs(settings);
  elements.entryDate.value = getTodayKey();
  renderFormula();
  renderMonth();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp, { once: true });
} else {
  initializeApp();
}
