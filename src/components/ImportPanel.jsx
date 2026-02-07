import React, { useState, useRef } from "react";
import { getScraperScript, getAppBaseUrl } from "../lib/edisonScraper";

const ImportPanel = ({ importedData, onImport, onRemove, onClearAll, subjectColors = {} }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [importError, setImportError] = useState(null);
  const [importSuccess, setImportSuccess] = useState(null);
  const fileInputRef = useRef(null);

  const scraperScript = getScraperScript(getAppBaseUrl());

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(scraperScript);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      // Fallback
      const textArea = document.createElement("textarea");
      textArea.value = scraperScript;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const validateSubjectData = (data) => {
    if (!data || typeof data !== "object") return false;
    if (!data.subjectScheduleTable || !Array.isArray(data.subjectScheduleTable.days)) return false;
    return true;
  };

  const extractAbbrev = (data, filename) => {
    // Try to get abbreviation from the data first
    const days = data.subjectScheduleTable?.days || [];
    for (const day of days) {
      for (const queue of day.queues || []) {
        for (const item of queue.items || []) {
          if (item.dto?.subjectAbbrev) {
            return item.dto.subjectAbbrev;
          }
        }
      }
    }
    // Fallback: use filename
    return filename.replace(/\.json$/i, "");
  };

  const handleFileUpload = async (files) => {
    setImportError(null);
    setImportSuccess(null);

    const newSubjects = [];
    const errors = [];

    for (const file of files) {
      try {
        const text = await file.text();

        // Handle array format (from scraper clipboard fallback: [{title, data}, ...])
        let parsed;
        try {
          parsed = JSON.parse(text);
        } catch (e) {
          errors.push(`${file.name}: Neplatný JSON`);
          continue;
        }

        if (Array.isArray(parsed)) {
          // Array of subjects (exported by scraper)
          for (const item of parsed) {
            if (item.title && item.data && validateSubjectData(item.data)) {
              newSubjects.push({ title: item.title, data: item.data });
            } else {
              errors.push(`${file.name}: Obsahuje neplatný předmět`);
            }
          }
        } else if (validateSubjectData(parsed)) {
          // Single subject JSON
          const title = extractAbbrev(parsed, file.name);
          newSubjects.push({ title, data: parsed });
        } else {
          errors.push(`${file.name}: Chybí subjectScheduleTable.days`);
        }
      } catch (e) {
        errors.push(`${file.name}: ${e.message}`);
      }
    }

    if (errors.length > 0) {
      setImportError(errors.join("\n"));
    }

    if (newSubjects.length > 0) {
      onImport(newSubjects);
      setImportSuccess(`Importováno ${newSubjects.length} předmět${newSubjects.length === 1 ? "" : newSubjects.length < 5 ? "y" : "ů"}`);
      setTimeout(() => setImportSuccess(null), 3000);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files).filter(
      (f) => f.type === "application/json" || f.name.endsWith(".json")
    );
    if (files.length > 0) {
      handleFileUpload(files);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        const valid = parsed.filter(
          (item) => item.title && item.data && validateSubjectData(item.data)
        );
        if (valid.length > 0) {
          onImport(valid);
          setImportSuccess(`Importováno ${valid.length} předmět${valid.length === 1 ? "" : valid.length < 5 ? "y" : "ů"} ze schránky`);
          setTimeout(() => setImportSuccess(null), 3000);
          return;
        }
      } else if (validateSubjectData(parsed)) {
        const title = extractAbbrev(parsed, "clipboard");
        onImport([{ title, data: parsed }]);
        setImportSuccess("Importován 1 předmět ze schránky");
        setTimeout(() => setImportSuccess(null), 3000);
        return;
      }
      setImportError("Data ve schránce nemají správný formát");
    } catch (e) {
      setImportError("Nepodařilo se přečíst ze schránky");
    }
    setTimeout(() => setImportError(null), 3000);
  };

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`min-w-[105px] px-4 py-2 border rounded bg-zinc-700 ring-3 transition-colors ${
          isOpen ? "ring-indigo-400" : "ring-gray-600"
        }`}
      >
        <span className="font-bold">{isOpen ? "▾" : "▸"} Import z Edisonu</span>
        {importedData.length > 0 && (
          <span className="ml-2 bg-sky-700 text-white rounded-full px-2 py-0.5 text-xs font-bold">
            {importedData.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="mt-3 p-4 bg-gray-800 rounded-lg w-[960px]">
          {/* Imported subjects list */}
          {importedData.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-gray-300">
                  Importované předměty ({importedData.length})
                </span>
                <button
                  onClick={onClearAll}
                  className="text-xs px-2 py-1 bg-rose-700 hover:bg-rose-800 text-white rounded"
                >
                  Smazat vše
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {importedData.map((subject) => (
                  <div
                    key={subject.title}
                    className="flex items-center gap-1 bg-zinc-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm"
                  >
                    <span className={`font-bold rounded-full px-2 py-0.5 text-xs ${subjectColors[subject.title] || 'bg-sky-700'}`}>
                      {subject.title}
                    </span>
                    {subject.data.subjectTitle && (
                      <span className="text-gray-400 text-xs ml-1">
                        {subject.data.subjectTitle}
                      </span>
                    )}
                    <button
                      onClick={() => onRemove(subject.title)}
                      className="ml-1 text-gray-500 hover:text-rose-400 font-bold text-lg leading-none"
                      title="Odebrat"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Auto import section */}
          <div className="mb-4">
            <p className="text-md font-bold text-gray-300 mb-3">Automatický import (doporučeno)</p>
            <div className="p-4 bg-gray-700 rounded-lg">
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
                <li>
                  Otevřete{" "}
                  <a
                    href="https://edison.vsb.cz"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-400 hover:text-indigo-300 underline"
                  >
                    Edison
                  </a>{" "}
                  → Rozvrh → Volba rozvrhu
                </li>
                <li>
                  Otevřete konzoli (
                  <kbd className="bg-gray-800 px-1.5 py-0.5 rounded text-xs text-gray-300">
                    Ctrl+Shift+J
                  </kbd>{" "}
                  /{" "}
                  <kbd className="bg-gray-800 px-1.5 py-0.5 rounded text-xs text-gray-300">
                    Cmd+Option+J
                  </kbd>
                  )
                </li>
                <li>
                  <button
                    onClick={handleCopyScript}
                    className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                      copySuccess
                        ? "bg-sky-700 text-white"
                        : "bg-indigo-600 hover:bg-indigo-500 text-white"
                    }`}
                  >
                    {copySuccess ? "✓ Zkopírováno" : "Zkopírovat script"}
                  </button>{" "}
                  a vložte ho do konzole
                </li>
                <li>
                  Data se automaticky načtou a otevřou v této aplikaci
                </li>
              </ol>
            </div>
          </div>

          {/* Manual import section */}
          <div className="border-t border-gray-700 pt-3">
            <p className="text-sm font-bold text-gray-400 mb-2">
              Ruční import (záložní varianta)
            </p>

            <div className="flex gap-2 mb-2">
              {/* File upload */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 border-2 border-dashed border-gray-600 hover:border-indigo-400 rounded-lg p-4 text-center cursor-pointer transition-colors"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFileUpload(Array.from(e.target.files))}
                />
                <p className="text-sm text-gray-400">
                  Přetáhněte JSON soubory sem nebo klikněte pro výběr
                </p>
              </div>

              {/* Paste from clipboard */}
              <button
                onClick={handlePasteFromClipboard}
                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-sm whitespace-nowrap border border-gray-600"
                title="Vložit data ze schránky (záloha pokud popup blokován)"
              >
                Vložit ze schránky
              </button>
            </div>
          </div>

          {/* Status messages */}
          {importError && (
            <div className="mt-2 p-2 bg-rose-900/30 border border-rose-700 rounded-lg text-sm text-rose-300">
              {importError}
            </div>
          )}
          {importSuccess && (
            <div className="mt-2 p-2 bg-sky-900/30 border border-sky-700 rounded-lg text-sm text-sky-300">
              ✓ {importSuccess}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ImportPanel;
