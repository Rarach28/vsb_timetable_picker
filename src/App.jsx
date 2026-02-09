import React, { useState, useEffect, useCallback } from "react";
import { copyPickScript } from "./lib/pickScript";
import { openRoomMap } from "./lib/roomMapper";
import ImportPanel from "./components/ImportPanel";

const App = () => {
  const [timetableData, setTimetableData] = useState([]);
  const [selectedEntries, setSelectedEntries] = useState(() => {
    const savedEntries = localStorage.getItem("selectedEntries");
    return new Set(savedEntries ? JSON.parse(savedEntries) : []);
  });
  const [selectedSubjects, setSelectedSubjects] = useState(() => {
    const savedSubjects = localStorage.getItem("selectedSubjects");
    return new Set(savedSubjects ? JSON.parse(savedSubjects) : []);
  });

  const [importedData, setImportedData] = useState(() => {
    try {
      const saved = localStorage.getItem("importedSubjects");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [importNotification, setImportNotification] = useState(null);

  const [showUnusedClasses, setShowUnusedClasses] = useState(
    localStorage.getItem("showUnusedClasses") === "true"
  );

  const handleVisibilityOfUnusedClasses = () => {
    setShowUnusedClasses((prev) => {
      const newValue = !prev;
      localStorage.setItem("showUnusedClasses", newValue); // Save new state
      return newValue;
    });
  };

  const getCurrentTimePosition = () => {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (let i = 0; i < timeSlots.length; i++) {
    const [start, end] = timeSlots[i].split("-").map((t) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m; // Převod na minuty
    });

    if (currentMinutes >= start && currentMinutes < end) {
      const slotProgress = (currentMinutes - start) / (end - start); // Relativní pozice v slotu (0-1)
      return 90 + i * 100 + slotProgress * 100; // 90px první sloupec + pozice slotu (100px každý)
    }
  }
  return null;
};


  const timeSlots = [
    "07:15-08:00", "08:00-08:45", "09:00-09:45", "09:45-10:30", "10:45-11:30",
    "11:30-12:15", "12:30-13:15", "13:15-14:00", "14:15-15:00", "15:00-15:45",
    "16:00-16:45", "16:45-17:30", "17:45-18:30", "18:30-19:15",
  ];

  // Random barvy pro každý předmět viz https://tailwindcss.com/docs/colors
  const subjectColors = {};
  const colors = ["bg-green-600", "bg-fuchsia-500", "bg-orange-500", "bg-amber-500", "bg-purple-600", "bg-pink-600", "bg-indigo-500", "bg-violet-600"];
  // Uprava aktualizace time line
  const [currentTimePosition, setCurrentTimePosition] = useState(getCurrentTimePosition());
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTimePosition(getCurrentTimePosition());
    }, 60000);

    return () => clearInterval(interval);
  }, []);


  // Save selected entries to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("selectedEntries", JSON.stringify(Array.from(selectedEntries)));
  }, [selectedEntries]);

  // Save selected subjects to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("selectedSubjects", JSON.stringify(Array.from(selectedSubjects)));
  }, [selectedSubjects]);

  // Save imported data to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("importedSubjects", JSON.stringify(importedData));
  }, [importedData]);

  // --- postMessage listener for Edison scraper import ---
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data && event.data.type === 'edison-data' && Array.isArray(event.data.subjects)) {
        const subjects = event.data.subjects.filter(
          s => s.title && s.data && s.data.subjectScheduleTable && Array.isArray(s.data.subjectScheduleTable.days)
        );
        if (subjects.length > 0) {
          setImportedData(subjects);
          setSelectedEntries(new Set());
          setSelectedSubjects(new Set());
          setImportNotification(`Importováno ${subjects.length} předmět${subjects.length === 1 ? '' : subjects.length < 5 ? 'y' : 'ů'} z Edisonu`);
          setTimeout(() => setImportNotification(null), 5000);

          // Signal back to opener that import succeeded
          if (event.source) {
            event.source.postMessage({ type: 'import-success' }, '*');
          }
        }
      }
      // Handshake: if opener asks if we're ready
      if (event.data && event.data.type === 'ping-ready') {
        event.source?.postMessage({ type: 'ready-for-import' }, '*');
      }
    };

    window.addEventListener('message', handleMessage);

    // If opened via scraper (URL has edison-import param), signal readiness to opener
    const params = new URLSearchParams(window.location.search);
    if (params.has('edison-import') && window.opener) {
      window.opener.postMessage({ type: 'ready-for-import' }, '*');
      // Clean up URL
      const url = new URL(window.location);
      url.searchParams.delete('edison-import');
      window.history.replaceState({}, '', url);
    }

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // --- Load timetable data: imported data takes priority, otherwise demo files ---
  useEffect(() => {
    if (importedData.length > 0) {
      setTimetableData(importedData);
      return;
    }

    let cancelled = false;

    const loadTimetableData = async () => {
      const files = import.meta.glob("./assets/config/*.json");

      const loadedData = await Promise.all(
        Object.entries(files).map(async ([path, importer]) => {
          const data = await importer();
          const title = path.split("/").pop().replace(".json", "");
          return { title, data: data.default || data };
        })
      );

      if (!cancelled) {
        setTimetableData(loadedData);
      }
    };

    loadTimetableData();
    return () => { cancelled = true; };
  }, [importedData]);

  //302358
  // item.dto.concreteActivityId

  const formatSchedule = (scheduleTable) => {
    const formatted = [];

    scheduleTable.days.forEach((day) => {
      day.queues.forEach((queue) => {
        queue.items.forEach((item) => {
          if (item.used && item.dto) {
            formatted.push({
              title: item.dto.subjectTitle,
              day: day.title,
              startTime: item.dto.scheduleWindowBeginTime,
              endTime: item.dto.scheduleWindowEndTime,
              teacher: item.dto.teacherShortNamesString,
              abbreviation: item.dto.subjectAbbrev,
              isLecture: item.dto.lecture,
              duration: item.duration || 2,
              activityId: item.dto.concreteActivityId,
              room: item.dto.roomFullCodesString || null,
              educationWeekTitle: (item.dto.educationWeekTitle === "Lichý" || item.dto.educationWeekTitle === "Sudý") ? item.dto.educationWeekTitle : null,
            });
          }
        });
      });
    });

    return formatted;
  };


  // Předměty do dní
  const groupByDayAndSort = (entries) => {
    const grouped = {
      Pondělí: [],
      Úterý: [],
      Středa: [],
      Čtvrtek: [],
      Pátek: [],
    };

    entries.forEach((entry) => {
      grouped[entry.day].push(entry);
    });

    Object.keys(grouped).forEach((day) => {
      grouped[day].sort((a, b) => a.startTime.localeCompare(b.startTime));
    });

    return grouped;
  };

  const pickClass = (entry) => {
    setSelectedEntries((prev) => {
      const newSet = new Set(prev);
      const key = `${entry.day}//${entry.startTime}//${entry.abbreviation}//${entry.isLecture}//${entry.teacher}//${entry.educationWeekTitle}`;
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const toggleSubject = (subject) => {
    setSelectedSubjects((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(subject)) {
        newSet.delete(subject);
      } else {
        newSet.add(subject);
      }
      return newSet;
    });
  };

  // --- Import handlers ---
  const handleImport = useCallback((newSubjects) => {
    setImportedData(prev => {
      const existing = new Set(prev.map(s => s.title));
      const merged = [...prev];
      for (const subj of newSubjects) {
        if (existing.has(subj.title)) {
          const idx = merged.findIndex(s => s.title === subj.title);
          merged[idx] = subj;
        } else {
          merged.push(subj);
        }
      }
      // Also update timetableData immediately so the grid refreshes without waiting for useEffect
      setTimetableData(merged);
      return merged;
    });
    setSelectedEntries(new Set());
    setSelectedSubjects(new Set());
  }, []);

  const handleRemoveSubject = useCallback((title) => {
    setImportedData(prev => prev.filter(s => s.title !== title));
    setSelectedEntries(new Set());
    setSelectedSubjects(new Set());
  }, []);

  const handleClearAll = useCallback(() => {
    setImportedData([]);
    setSelectedEntries(new Set());
    setSelectedSubjects(new Set());
  }, []);

  // Zformátování dat a přidání barvy
  const allEntries = timetableData
    .map(({ data }) => formatSchedule(data.subjectScheduleTable))
    .flat();

  var pomI = 0;
  allEntries.forEach((entry, index) => {
    if (!subjectColors[entry.abbreviation]) {
      subjectColors[entry.abbreviation] = colors[pomI++];
    }
  });

  const groupedByDay = groupByDayAndSort(allEntries);


  // Vytvoření karet předmětů nad rozvrhem
  const uniqueSubjects = [...new Set(allEntries.map((entry) => `${entry.abbreviation}//${entry.isLecture ? "P" : "C"}`))];
  const subjectTypesMap = uniqueSubjects.reduce((acc, subject) => {
    const [name, type] = subject.split("//");
    if (!acc[name]) {
      acc[name] = [];
    }
    acc[name].push(type);
    return acc;
  }, {});


  // Hodina se schová pokud je vybrán jiný předmět ve stejnou dobu nebo stejný předmět v jiný čas/den
  const isEntryHidden = (entry) => {
    for (const selectedEntryKey of selectedEntries) {
      const selectedEntry = allEntries.find(e => `${e.day}//${e.startTime}//${e.abbreviation}//${e.isLecture}//${e.teacher}//${e.educationWeekTitle}` === selectedEntryKey);
      if (selectedEntry) {
        if (entry.abbreviation === selectedEntry.abbreviation && entry.isLecture === selectedEntry.isLecture && entry !== selectedEntry) return true;
        if (entry.startTime === selectedEntry.startTime && entry.day === selectedEntry.day && entry !== selectedEntry) return true;
      }
    }
    return false;
  };

  const getTimeSlotIndex = (time) => {
    return timeSlots.findIndex(slot => slot.startsWith(time)) + 2;
  }

  const handleCopyPickScript = async () => {
    const ok = await copyPickScript(selectedEntries, allEntries, timetableData);
    if (ok) alert('Pick script zkopírován do schránky!');
  };

  return (
    <div className="flex-1 container p-4">
      {/* Kopírovat Pick Script */}
      <div className="mb-4 w-[1470px]">
        <button
          onClick={handleCopyPickScript}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
        >
          Zkopírovat Pick Script
        </button>
      </div>

      {/* Import notification toast */}
      {importNotification && (
        <div className="fixed top-4 right-4 z-50 bg-sky-700 text-white px-4 py-3 rounded-lg shadow-lg">
          ✓ {importNotification}
        </div>
      )}

      {/* Import z Edisonu */}
      <div className="w-[1470px]">
        <ImportPanel
          importedData={importedData}
          onImport={handleImport}
          onRemove={handleRemoveSubject}
          onClearAll={handleClearAll}
          subjectColors={subjectColors}
        />
      </div>

      {/* Demo data banner */}
        {importedData.length === 0 && timetableData.length > 0 && (
          <div className="mb-4 w-fit p-3 bg-yellow-400 ring-3 ring-yellow-600 rounded-lg text-sm text-yellow-900 font-semibold">
            ⚠️ Zobrazují se ukázková data. Pro načtení vlastního rozvrhu použijte <b className="text-yellow-700">Import z Edisonu</b> výše.
          </div>
        )}

      {/* Karty předmětů */}
      <div className="flex flex-wrap gap-3 mb-4 w-[1470px]">
        {Object.entries(subjectTypesMap).map(([name, types]) => (
          <button
            key={name}
            onClick={() => toggleSubject(name)}
            className={`min-w-[105px] px-4 py-2 border rounded bg-zinc-700 ring-3 ${selectedSubjects.has(name) ? "ring-indigo-400" : "ring-gray-600"}`}
          >
            <div className={`font-bold ${subjectColors[name]} rounded my-2 py-1 px-2`}>{name}</div>
            <div className="flex justify-around gap-2 w-full mb-2">
              {types.map((type,i) => {
                const isSelected = Array.from(selectedEntries).some((el) => {
                  const split = el.split("//");
                  return split[2] === name && split[3] === (type === "C" ? "false" : "true");
                });
                return <div key={name+type+i} className={`inline-block font-bold w-[28px] rounded ${type === "C" ? (isSelected ? "bg-blue-600" : "text-blue-400") + " border-2 border-blue-600" : (isSelected ? "bg-rose-600" : "text-rose-400") + " border-2 border-rose-600"}`}>{type}</div>
              })}
            </div>
          </button>
        ))}
      </div>

      {/* Hodiny */}
      <div className="flex-col mb-2">
        <div className="grid grid-cols-15 w-[1470px] rounded-lg overflow-hidden">
          <div className="col-start-1 col-span-1 w-[90px] row-start-1 bg-gray-700">
            <label className="inline-flex items-center cursor-pointer flex-col justify-center items-center w-full mb-3">
              <input
                type="checkbox"
                onChange={handleVisibilityOfUnusedClasses}
                checked={showUnusedClasses}
                className="sr-only peer block"
              />
              <div className="mt-2 relative w-9 h-5 bg-amber-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-lime-300 dark:peer-focus:ring-lime-800 rounded-full peer dark:bg-amber-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-amber-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-amber-600 peer-checked:bg-lime-500 dark:peer-checked:bg-lime-500"></div>
              <div className="pt-1 text-sm font-medium text-gray-900 dark:text-gray-300 text-center">Show Unused</div>
            </label>
          </div>
          {timeSlots.map((slot, index) => (
            <div key={slot} className={`w-[100px] h-full pt-5 text-center text-sm font-semibold col-start-${index + 2} col-span-1 text-center ${index % 2 ? "bg-gray-700" : "bg-gray-800"}`}>
              {slot.split("-").map((part, i) => (
                <React.Fragment key={i}>
                  {part}
                  {i === 0 && <br />}
                </React.Fragment>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Rozvrh (OP) */}
      <div className="relative flex flex-col gap-2">
        {/* Time Line */}
        {currentTimePosition && (
                <div
                  className="absolute h-full w-1 bg-red-500"
                  style={{
                    left: `${currentTimePosition}px`,
                  }}
                />
              )}
        {["Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek"].map((day) => {
          const dayEntries = groupedByDay[day].filter((entry) =>
            (selectedSubjects.size === 0 || selectedSubjects.has(entry.abbreviation)) && (showUnusedClasses || !isEntryHidden(entry)) || selectedEntries.has(`${entry.day}//${entry.startTime}//${entry.abbreviation}//${entry.isLecture}//${entry.teacher}//${entry.educationWeekTitle}`)
          );

          return (
            <div key={day} className="grid grid-cols-15 grid-flow-row-dense bg-gray-800 w-[1470px] rounded-lg">
              <div className="col-start-1 col-span-1 text-center bg-sky-700 w-[70px] flex flex-col justify-center h-full rounded-l-lg text-xl font-bold" style={{gridRowStart:1, gridRowEnd: 100}}>{day.substring(0, 2)}</div>
              {dayEntries.map((subject, index) => {
                const key = `${subject.day}//${subject.startTime}//${subject.abbreviation}//${subject.isLecture}//${subject.teacher}//${subject.educationWeekTitle}`;
                const isSelected = selectedEntries.has(key);
                
                
                return <label
                  key={index}
                  className={`subject m-[3px] border-4 rounded-xl cursor-pointer overflow-hidden transition-colors duration-100 ${showUnusedClasses && "select-none"} ${subject.isLecture ? "border-rose-700 bg-linear-40 from-gray-800 from-45% to-rose-900 hover:from-rose-600" : "border-sky-700 bg-linear-40 from-gray-800 from-45% to-sky-900 hover:from-sky-600"} ${isEntryHidden(subject) && "opacity-25"} ${isSelected && subject.isLecture ? "from-rose-700" : ""} ${isSelected && !subject.isLecture ? "from-sky-700" : ""}`}

                  style={{
                    gridColumnStart: getTimeSlotIndex(subject.startTime.substring(0,5)),
                    gridColumnEnd: getTimeSlotIndex(subject.startTime.substring(0,5)) + subject.duration,
                  }}
                >
                  <div className="px-2 py flex flex-col">
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={isSelected}
                      onChange={() => pickClass(subject)}
                      disabled={isEntryHidden(subject)}
                    />
                    <span className="flex justify-between items-center mt-2 mb-1">
                      <span title={subject.title} className={`font-bold w-fit px-[9px] py-[3px] rounded-full ${subjectColors[subject.abbreviation]}`}>{subject.abbreviation}</span>
                      {subject.educationWeekTitle &&
                        <span className={`font-bold px-[11px] py-[3px] rounded-full ${subject.educationWeekTitle === "Lichý" ? "bg-rose-600" : "bg-emerald-600"}`} title={subject.educationWeekTitle}>{subject.educationWeekTitle.charAt(0)}</span>
                      }
                    </span>
                    <span className="text-base my-1 truncate" title={subject.teacher}>{subject.teacher}</span>
                    {subject.room && (
                      <span
                        className="text-xs w-fit font-bold hover:text-blue-300 hover:underline cursor-pointer truncate mb-1"
                        title={`Zobrazit ${subject.room} na mapě`}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); openRoomMap(subject.room); }}
                      >
                      {subject.room}
                      </span>
                    )}
                  </div>
                </label>
              })}
            </div>
          )
        })}
      </div>
    </div>
  );
};

export default App;