import React, { useState, useEffect } from "react";
import { copyPickScript } from "./lib/pickScript";

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
      return (i + 1) * 74 + slotProgress * 74; // Posun na správné místo v px
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
  const colors = ["bg-green-700", "bg-fuchsia-500", "bg-orange-500", "bg-yellow-500", "bg-purple-700", "bg-pink-900", "bg-indigo-500", "bg-violet-900"];
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

  //302358
  // item.dto.concreteActivityId

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
              activityId: item.dto.concreteActivityId
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

  console.log(timetableData)
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

  // Generate pick script from current selection
  const generatePickScript = () => {
    const subjects_array = {};
    const subject_map = [];
    
    // Extract selected entries and group by subject
    const selectedData = Array.from(selectedEntries).map(key => {
      return allEntries.find(entry => 
        `${entry.day}//${entry.startTime}//${entry.abbreviation}//${entry.isLecture}//${entry.teacher}` === key
      );
    }).filter(Boolean);

    // Build subjects_array and subject_map
    selectedData.forEach(entry => {
      // Extract subjectId from filename pattern: subjectId__*.json
      const matchingFile = timetableData.find(item => 
        item.title.includes(entry.abbreviation)
      );
      
      if (matchingFile) {
        const subjectId = matchingFile.title.split('__')[0];
        console.log(matchingFile,subjectId);
        const concreteActivityId = entry.activityId.toString();
        
        if (!subjects_array[subjectId]) {
          subjects_array[subjectId] = [];
          subject_map.push(subjectId);
        }
        
        if (!subjects_array[subjectId].includes(concreteActivityId)) {
          subjects_array[subjectId].push(concreteActivityId);
        }
      }
    });

    // Generate the script
    const scriptContent = `(function () {

    let current_subject_idx = 0;

    const readyToclickEvent = new Event('readyToClick');

    var subjects = $('#ns_Z7_SHD09B1A084V90ITII3I3Q30P7_\\\\:subjectsTable a');

    var subjects_array = ${JSON.stringify(subjects_array, null, 8).replace(/"/g, "'")};

    var subject_map = ${JSON.stringify(subject_map).replace(/"/g, "'")}

    function subjectClick(subjectId) {
        for (var subject = 0; subject < subjects.length; subject++) {
            if (subjects[subject].attributes.onclick.nodeValue === 'return ns_Z7_SHD09B1A084V90ITII3I3Q30P7_selectStudyYearObligation(' + subjectId + ');') {
                subjects[subject].click();
                console.log('Subject:', subjectId);
            }
        }
    }

    function timeClick(timeId) {
        var times = $('#ns_Z7_SHD09B1A084V90ITII3I3Q30P7_\\\\:subjectScheduleDiv a');
        for (var time = 0; time < times.length; time++) {
            if (times[time].attributes.onclick.nodeValue === 'return ns_Z7_SHD09B1A084V90ITII3I3Q30P7_selectConcreteActivity(' + timeId + ');') {
                times[time].click();
                console.log('Vybrano cviceni:', timeId);
            }
        }
    }

    function waitForElm(selector) {
        return new Promise(resolve => {
            if (document.querySelector(selector)) {
                return resolve(document.querySelector(selector));
            }
            const observer = new MutationObserver(mutations => {
                if (document.querySelector(selector)) {
                    resolve(document.querySelector(selector));
                    observer.disconnect();
                }
            });
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        });
    }

    document.body.addEventListener('readyToClick', (e) => {
        setTimeout(() => {
            subjectClick(subject_map[current_subject_idx]);
            waitForElm("a[onclick='return ns_Z7_SHD09B1A084V90ITII3I3Q30P7_selectConcreteActivity(" + subjects_array[subject_map[current_subject_idx]][0] + ");']")
                .then((elm) => {
                    setTimeout(() => {
                        timeClick(subjects_array[subject_map[current_subject_idx]][0]);
                        current_subject_idx++;
                        if (current_subject_idx < subject_map.length) {
                            document.body.dispatchEvent(readyToclickEvent);
                        }
                    }, 150);
                });
        }, 150);
    }, false);

    document.body.dispatchEvent(readyToclickEvent);

}());`;

    return scriptContent;
  }

const handleCopyPickScript = async () => {
  const ok = await copyPickScript(selectedEntries, allEntries, timetableData);
  if (ok) alert('Pick script zkopírován do schránky!');
};

  return (
    <div className="flex-1 container mx-auto p-4">

      {/* Kopírovat Pick Script */}
      <div className="mb-4 w-[960px]">
        <button
          onClick={handleCopyPickScript}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
        >
          Zkopírovat Pick Script
        </button>
      </div>

      {/* Karty předmětů */}
      <div className="flex flex-wrap gap-2 mb-4 w-[960px] overflow-auto">
        {Object.entries(subjectTypesMap).map(([name, types]) => (
          <button
            key={name}
            onClick={() => toggleSubject(name)}
            className={`px-4 py-2 border rounded ${selectedSubjects.has(name) ? "bg-red-400" : "bg-zinc-700"}`}
          >
            <div className={`font-bold ${subjectColors[name]} rounded mb-2 py-1 px-2`}>{name}</div>
            <div className="flex justify-around gap-2 w-full">
              {types.map((type,i) => {
                const isSelected = Array.from(selectedEntries).some((el) => {
                  const split = el.split("//");
                  return split[2] === name && split[3] === (type === "C" ? "false" : "true");
                });
                return <div key={name+type+i} className={`inline-block px-2 py rounded ${type === "C" ? (isSelected ? "bg-blue-500" : "text-blue-500") + " border-1 border-blue-500" : (isSelected ? "bg-red-500" : "text-red-500") + " border-1 border-red-500"}`}>{type}</div>
              })}
            </div>
          </button>
        ))}
      </div>

      {/* Hodiny */}
      <div className="flex-col mb-1">
        <div className="grid grid-cols-15 w-[1100px]">
          <div className="col-start-1 col-span-1 w-[70px] row-start-1 bg-gray-700">
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
            <div key={slot} className={`w-[74px] h-full pt-5 text-center text-sm col-start-${index + 2} col-span-1 text-center ${index % 2 ? "bg-gray-700" : "bg-gray-800"}`}>
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
      <div className="relative flex flex-col gap-1">
        {/* Time Line */}
        {currentTimePosition && (
                <div
                  className="absolute h-full w-1 bg-red-500"
                  style={{
                    left: `${(currentTimePosition - 1) }px`,
                  }}
                />
              )}
        {["Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek"].map((day) => {
          const dayEntries = groupedByDay[day].filter((entry) =>
            (selectedSubjects.size === 0 || selectedSubjects.has(entry.abbreviation)) && (showUnusedClasses || !isEntryHidden(entry)) || selectedEntries.has(`${entry.day}//${entry.startTime}//${entry.abbreviation}//${entry.isLecture}//${entry.teacher}`)
          );

          return (
            <div key={day} className="grid grid-cols-15 grid-flow-row-dense bg-gray-800 w-[1100px]">
              <div className="col-start-1 col-span-1 text-center bg-sky-700 w-[70px] py-4 flex flex-col justify-center h-full" style={{gridRowStart:1, gridRowEnd: 100}}>{day.substring(0, 2)}</div>
              {dayEntries.map((subject, index) => {
                const key = `${subject.day}//${subject.startTime}//${subject.abbreviation}//${subject.isLecture}//${subject.teacher}`;
                const isSelected = selectedEntries.has(key);
                
                
                return <label
                  key={index}
                  className={`subject m-[3px] border-4 rounded-xl cursor-pointer overflow-hidden ${showUnusedClasses && "select-none"} ${subject.isLecture ? "border-red-600 bg-red-700 hover:!bg-red-500" : "border-sky-600 bg-sky-700 hover:bg-sky-500"} ${isSelected ? `!border-lime-500` : ""} ${isEntryHidden(subject) && "opacity-25"} ${isSelected && subject.isLecture ? "!bg-red-600" : ""} ${isSelected && !subject.isLecture ? "!bg-sky-600" : ""}`}

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
                    <span className={`font-bold w-fit px-[9px] py-[3px] mt-2 mb-1 rounded-full ${selectedSubjects.has(subject.abbreviation) ? "!bg-red-400" : subjectColors[subject.abbreviation]}`}>{subject.abbreviation}</span>
                    <span className="text-base my-1">{subject.teacher}</span>
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