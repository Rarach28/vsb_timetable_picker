export function getScraperScript(appUrl) {
  return `(function() {
  'use strict';

  const APP_URL = '${appUrl}';
  const NAMESPACE = 'ns_Z7_SHD09B1A084V90ITII3I3Q30P7_';
  const SCHEDULE_DIV_ID = NAMESPACE + ':subjectScheduleDiv';
  const SUBJECTS_TABLE_ID = NAMESPACE + ':subjectsTable';

  console.log('%c[Edison Scraper] Spouštím...', 'color: #4ade80; font-weight: bold');

  // --- 1. Intercept XHR responses ---
  let lastCapturedResponse = null;
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url) {
    this._scraperUrl = url;
    return origOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function() {
    this.addEventListener('load', function() {
      try {
        const json = JSON.parse(this.responseText);
        if (json && json.subjectScheduleTable) {
          lastCapturedResponse = json;
        }
      } catch(e) { /* not JSON, ignore */ }
    });
    return origSend.apply(this, arguments);
  };

  // --- 2. Parse subjects from the table ---
  function parseSubjects() {
    const table = document.getElementById(SUBJECTS_TABLE_ID);
    if (!table) {
      console.error('[Edison Scraper] Tabulka předmětů nenalezena! Jste na stránce Volba rozvrhu?');
      return [];
    }

    const subjects = [];
    const rows = table.querySelectorAll('tr');

    for (const row of rows) {
      const link = row.querySelector('a[onclick*="selectStudyYearObligation"]');
      if (!link) continue;

      const onclickStr = link.getAttribute('onclick');
      const match = onclickStr.match(/selectStudyYearObligation\\((\\d+)\\)/);
      if (!match) continue;

      const obligationId = match[1];
      const cells = row.querySelectorAll('td');
      const abbrev = cells.length >= 2 ? cells[1].textContent.trim() : 'UNKNOWN';

      subjects.push({ obligationId, abbrev, link });
    }

    return subjects;
  }

  // --- 3. Wait for schedule div to update ---
  function waitForScheduleUpdate() {
    return new Promise((resolve) => {
      lastCapturedResponse = null;
      const scheduleDiv = document.getElementById(SCHEDULE_DIV_ID);

      // Poll for XHR response (captured by our monkey-patch)
      const interval = setInterval(() => {
        if (lastCapturedResponse) {
          clearInterval(interval);
          clearTimeout(timeout);
          const data = lastCapturedResponse;
          lastCapturedResponse = null;
          resolve(data);
        }
      }, 100);

      // Timeout after 15s
      const timeout = setTimeout(() => {
        clearInterval(interval);
        resolve(null);
      }, 15000);
    });
  }

  // --- 4. Main scraping logic ---
  async function scrapeAll() {
    const subjects = parseSubjects();

    if (subjects.length === 0) {
      alert('[Edison Scraper] Žádné předměty nenalezeny. Ujistěte se, že jste na stránce Edison > Rozvrh > Volba rozvrhu a tabulka předmětů je viditelná.');
      return;
    }

    console.log('[Edison Scraper] Nalezeno ' + subjects.length + ' předmětů:', subjects.map(s => s.abbrev).join(', '));

    const collectedData = [];

    for (let i = 0; i < subjects.length; i++) {
      const subj = subjects[i];
      console.log('[Edison Scraper] (' + (i+1) + '/' + subjects.length + ') Načítám: ' + subj.abbrev + '...');

      // Click the subject link
      subj.link.click();

      // Wait for the AJAX response
      const data = await waitForScheduleUpdate();

      if (data) {
        collectedData.push({
          title: subj.abbrev,
          data: data
        });
        console.log('%c[Edison Scraper] ✓ ' + subj.abbrev + ' načten', 'color: #4ade80');
      } else {
        console.warn('[Edison Scraper] ✗ ' + subj.abbrev + ' - timeout, přeskakuji');
      }

      // Small delay between clicks
      await new Promise(r => setTimeout(r, 300));
    }

    if (collectedData.length === 0) {
      alert('[Edison Scraper] Nepodařilo se načíst žádná data.');
      return;
    }

    console.log('%c[Edison Scraper] Hotovo! Načteno ' + collectedData.length + '/' + subjects.length + ' předmětů.', 'color: #4ade80; font-weight: bold');
    console.log('[Edison Scraper] Otevírám Timetable Picker...');

    // --- 5. Open app and send data via postMessage ---
    const targetUrl = APP_URL + (APP_URL.includes('?') ? '&' : '?') + 'edison-import=1';
    const appWindow = window.open(targetUrl, '_blank');

    if (!appWindow) {
      // Popup blocked — fallback: copy to clipboard
      console.warn('[Edison Scraper] Popup blokován! Zkouším zkopírovat data do schránky...');
      try {
        await navigator.clipboard.writeText(JSON.stringify(collectedData));
        alert('[Edison Scraper] Data zkopírována do schránky (' + collectedData.length + ' předmětů).\\nOtevřete Timetable Picker a použijte tlačítko "Vložit ze schránky".');
      } catch(e) {
        // Last resort: download as file
        const blob = new Blob([JSON.stringify(collectedData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'edison_subjects.json';
        a.click();
        URL.revokeObjectURL(url);
        alert('[Edison Scraper] Data stažena jako edison_subjects.json (' + collectedData.length + ' předmětů).\\nNahrajte soubor v Timetable Pickeru.');
      }
      return;
    }

    // Wait for the app to signal it's ready, then send data
    function handleMessage(event) {
      if (event.data && event.data.type === 'ready-for-import') {
        window.removeEventListener('message', handleMessage);
        appWindow.postMessage({
          type: 'edison-data',
          subjects: collectedData
        }, '*');
        console.log('%c[Edison Scraper] Data odeslána do Timetable Pickeru!', 'color: #4ade80; font-weight: bold');
      }
    }
    window.addEventListener('message', handleMessage);

    // Also try periodically in case the ready message was missed
    let attempts = 0;
    const retryInterval = setInterval(() => {
      attempts++;
      if (attempts > 30) { // 15 seconds
        clearInterval(retryInterval);
        window.removeEventListener('message', handleMessage);
        console.warn('[Edison Scraper] Timeout při čekání na Timetable Picker.');
        return;
      }
      try {
        appWindow.postMessage({
          type: 'edison-data',
          subjects: collectedData
        }, '*');
      } catch(e) { /* cross-origin, expected */ }
    }, 500);

    // Clean up retry on success
    const origHandler = handleMessage;
    window.addEventListener('message', function cleanup(event) {
      if (event.data && event.data.type === 'import-success') {
        clearInterval(retryInterval);
        window.removeEventListener('message', cleanup);
        console.log('%c[Edison Scraper] Import úspěšný! ✓', 'color: #4ade80; font-size: 16px; font-weight: bold');
      }
    });
  }

  // --- Restore original XHR after scraping ---
  scrapeAll().finally(() => {
    XMLHttpRequest.prototype.open = origOpen;
    XMLHttpRequest.prototype.send = origSend;
  });

})();`;
}

export function getAppBaseUrl() {
  return window.location.origin + window.location.pathname;
}
