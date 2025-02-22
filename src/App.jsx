import React, { useState, useEffect } from "react";

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

  const timeSlots = [
    "07:15-08:00", "08:00-08:45", "09:00-09:45", "09:45-10:30", "10:45-11:30",
    "11:30-12:15", "12:30-13:15", "13:15-14:00", "14:15-15:00", "15:00-15:45",
    "16:00-16:45", "16:45-17:30", "17:45-18:30", "18:30-19:15",
  ];

  // Random barvy pro každý předmět viz https://tailwindcss.com/docs/colors
  const subjectColors = {};
  const colors = ["bg-green-800", "bg-fuchsia-500", "bg-orange-500", "bg-yellow-500", "bg-purple-500", "bg-pink-500", "bg-indigo-500", "bg-teal-500"];

  // Save selected entries to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("selectedEntries", JSON.stringify(Array.from(selectedEntries)));
  }, [selectedEntries]);

  // Save selected subjects to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("selectedSubjects", JSON.stringify(Array.from(selectedSubjects)));
  }, [selectedSubjects]);
  

  // Načíst předměty ze složky
  useEffect(() => {
    const loadTimetableData = async () => {
      const files = import.meta.glob("./assets/config/*.json");

      const loadedData = await Promise.all(
        Object.entries(files).map(async ([path, importer]) => {
          const data = await importer();
          const title = path.split("/").pop().replace(".json", "");
          return { title, data: data.default || data };
        })
      );

      setTimetableData(loadedData);
    };

    loadTimetableData();
  }, []);


  const formatSchedule = (scheduleTable) => {
    const formatted = [];

    scheduleTable.days.forEach((day) => {
      day.queues.forEach((queue) => {
        queue.items.forEach((item) => {
          if (item.used && item.dto) {
            formatted.push({
              day: day.title,
              startTime: item.dto.scheduleWindowBeginTime,
              endTime: item.dto.scheduleWindowEndTime,
              teacher: item.dto.teacherShortNamesString,
              abbreviation: item.dto.subjectAbbrev,
              isLecture: item.dto.lecture,
              duration: item.duration || 2,
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
      const key = `${entry.day}//${entry.startTime}//${entry.abbreviation}//${entry.isLecture}//${entry.teacher}`;
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
      const selectedEntry = allEntries.find(e => `${e.day}//${e.startTime}//${e.abbreviation}//${e.isLecture}//${e.teacher}` === selectedEntryKey);
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

  return (
    <div className="flex-1 container mx-auto p-4">

      {/* Karty předmětů */}
      <div className="flex flex-wrap gap-2 mb-4">
        {Object.entries(subjectTypesMap).map(([name, types]) => (
          <button
            key={name}
            onClick={() => toggleSubject(name)}
            className={`px-4 py-2 borderrounded ${selectedSubjects.has(name) ? "bg-red-400" : "bg-zinc-700"}`}
          >
            {name}
            <div className="flex justify-around gap-2 w-full">
              {types.map((type,i) => {
                const isSelected = Array.from(selectedEntries).some((el) => {
                  const split = el.split("//");
                  return split[2] === name && split[3] === (type === "C" ? "false" : "true");
                });
                return <div key={name+type+i} className={`inline-block px-2 py ${isSelected ? "bg-lime-500" : "bg-amber-500"}`}>{type}</div>
              })}
            </div>
          </button>
        ))}
      </div>

      {/* Hodiny */}
      <div className="flex-col mb-1 border-b-2 border-gray-400">
        <div className="grid grid-cols-15 w-[960px]">
          <div className="col-start-1 col-span-1 w-[64px] row-start-1 bg-gray-700">
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
            <div key={slot} className={`w-[64px] h-full pt-5 text-center text-sm col-start-${index + 2} col-span-1 text-center ${index % 2 ? "bg-gray-700" : "bg-gray-800"}`}>
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
      <div className="flex flex-col gap-4">
        {["Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek"].map((day, dayIndex) => {
          const dayEntries = groupedByDay[day].filter((entry) =>
            (selectedSubjects.size === 0 || selectedSubjects.has(entry.abbreviation)) && (showUnusedClasses || !isEntryHidden(entry)) || selectedEntries.has(`${entry.day}//${entry.startTime}//${entry.abbreviation}//${entry.isLecture}//${entry.teacher}`)
          );

          return (
            <div key={day} className="grid grid-cols-15 grid-flow-row-dense bg-gray-800 w-[960px]">
              <div className="col-start-1 col-span-1 text-center bg-sky-700 w-[64px] py-4 flex flex-col justify-center h-full" style={{gridRowStart:1, gridRowEnd: 100}}>{day.substring(0, 2)}</div>
              {dayEntries.map((subject, index) => {
                const key = `${subject.day}//${subject.startTime}//${subject.abbreviation}//${subject.isLecture}//${subject.teacher}`;
                const isSelected = selectedEntries.has(key);
                
                
                return <label
                  key={index}
                  className={`subject border-4 rounded mb-2 ${showUnusedClasses && "select-none"} ${subject.isLecture ? "border-red-600" : "border-sky-600"} ${isSelected ? "!bg-lime-500" : ( selectedSubjects.has(subject.abbreviation) ? "!bg-red-400" : subjectColors[subject.abbreviation] )} ${isEntryHidden(subject) && "opacity-25"} `}
                  
                  style={{
                    gridColumnStart: getTimeSlotIndex(subject.startTime.substring(0,5)),
                    gridColumnEnd: getTimeSlotIndex(subject.startTime.substring(0,5)) + subject.duration,
                  }}
                >
                  <div className="px-2 py">
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={isSelected}
                      onChange={() => pickClass(subject)}
                      disabled={isEntryHidden(subject)}
                    />
                    <b>{subject.abbreviation}</b> - {subject.teacher}
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