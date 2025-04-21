const dbName = 'BusScheduleDB';
const storeName = 'schedules';


function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}


function saveToDB(data) {
  return initDB().then(db => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put({ 
      id: 'current_schedule', 
      data: data,
      updatedAt: new Date().toISOString()
    });
    return tx.complete;
  });
}


function loadFromDB() {
  return initDB().then(db => {
    return new Promise(resolve => {
      const tx = db.transaction(storeName, 'readonly');
      const request = tx.objectStore(storeName).get('current_schedule');
      request.onsuccess = () => resolve(request.result?.data || null);
      request.onerror = () => resolve(null);
    });
  });
}

loadFromDB().then(cached => {
  if (cached) {
    Object.assign(busSchedules, cached);
    updateSchedule();
  }
});

const busSchedules = {
    "destination1": { 
        "to": ["07:35", "08:40", "09:05", "09:55", "10:35", "11:20", "11:50", "12:20", "13:20", "13:40", "14:10", "14:50", "15:30", "15:50", "16:10", "16:35", "17:05"], 
        "from": ["08:20", "08:45", "09:35", "10:15", "11:00", "11:30", "12:00", "12:30", "13:00", "13:20", "13:50", "14:30", "15:10", "15:30", "15:50", "16:15", "16:45", "17:40", "18:15", "19:10"] 
    },
    "destination2": { 
        "to": ["09:00", "11:00", "13:00", "14:00", "15:30"], 
        "from": ["09:35", "11:05", "12:30", "13:30"] 
    },
    "destination3": { 
        "to": ["07:35", "09:05", "10:35", "13:00", "15:00", "17:00"], 
        "from": ["08:45", "10:15", "12:35", "14:30", "16:15", "17:45", "19:10"] 
    },
  "destination4": { 
        "to": ["07:35", "09:05", "10:35", "12:20", "13:40", "14:50", "15:50", "16:35", "17:05"], 
        "from": ["08:45", "10:15", "12:00", "13:20", "14:30", "15:30", "16:15", "16:45", "17:40"] 
    }
};


let timerInterval;
let reminderTimeout;
let activeReminder = null;

const elements = {
    destinationSelect: document.getElementById('destination'),
    directionSelect: document.getElementById('direction'),
    scheduleDiv: document.getElementById('schedule'),
    timerDiv: document.getElementById('nextBusTimer'),
    loading: document.getElementById('loading'),
    reminderMinutes: document.getElementById('reminderMinutes'),
    setReminderBtn: document.getElementById('setReminderBtn'),
    clearReminderBtn: document.getElementById('clearReminderBtn')
};


function updateSchedule() {
    clearInterval(timerInterval);
    elements.loading.classList.remove('hidden');
  
    // ذخیره داده‌ها در DB
    saveToDB(busSchedules)
      .then(() => {
        const destination = elements.destinationSelect.value;
        const direction = elements.directionSelect.value;
        const times = busSchedules[destination][direction];
        
        displaySchedule(times);
        updateTimer(times);
        elements.loading.classList.add('hidden');
      })
      .catch(err => {
        console.error('خطا در ذخیره داده:', err);
        elements.loading.classList.add('hidden');
      });
  }

function displaySchedule(times) {
    const now = new Date();
    let closestTime = null;
    let minDiff = Infinity;

    times.forEach(time => {
        const [hour, minute] = time.split(':').map(Number);
        const busTime = new Date();
        busTime.setHours(hour, minute, 0, 0);
        
        const diff = busTime - now;
        if (diff > 0 && diff < minDiff) {
            minDiff = diff;
            closestTime = time;
        }
    });

    const scheduleItems = times.map(time => {
        const isClosest = time === closestTime;
        return `
            <span class="inline-block px-2 py-1 m-1 rounded-md transition-all 
                ${isClosest ? 
                    'bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold scale-105 shadow-lg' : 
                    'bg-gray-700 hover:bg-gray-600'}">
                ${time}
                ${isClosest ? ' 🚀' : ''}
            </span>
        `;
    }).join('');

    elements.scheduleDiv.innerHTML = `
        <h3 class="text-lg mb-2 font-semibold">⏰ زمان‌بندی اتوبوس:</h3>
        <div class="flex flex-wrap justify-center">${scheduleItems}</div>
    `;
}

function updateTimer(times) {
    const now = new Date();
    let nextBusTime = null;

    for (let time of times) {
        const [hour, minute] = time.split(':').map(Number);
        const busTime = new Date();
        busTime.setHours(hour, minute, 0, 0);

        if (busTime > now) {
            nextBusTime = busTime;
            break;
        }
    }

    if (nextBusTime) {
        startCountdown(nextBusTime, now);
    } else {
        elements.timerDiv.innerHTML = `
            <div class="text-center py-2 text-yellow-300">
                🚫 اتوبوس دیگری برای امروز وجود ندارد
            </div>
        `;
    }
}

function startCountdown(nextBusTime, now) {
    let countdown = Math.floor((nextBusTime - now) / 1000);
    
    updateTimerDisplay(countdown);
    
    timerInterval = setInterval(() => {
        countdown--;
        if (countdown <= 0) {
            clearInterval(timerInterval);
            showArrivalNotification();
            return;
        }
        updateTimerDisplay(countdown);
    }, 1000);
}

function updateTimerDisplay(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    let timerColor = "text-green-400";
    if (minutes < 5) timerColor = "text-yellow-400";
    if (minutes < 2) timerColor = "text-red-400";
    
    elements.timerDiv.innerHTML = `
        <div class="text-center">
            <div class="text-sm mb-1">⏳ اتوبوس بعدی:</div>
            <div class="text-2xl font-bold ${timerColor}">
                ${minutes} دقیقه و ${remainingSeconds} ثانیه
            </div>
            <div class="text-xs mt-2 opacity-70">به سمت ${getDestinationName()}</div>
        </div>
    `;
}

function setupReminderHandlers() {
    elements.setReminderBtn.addEventListener('click', setReminder);
    elements.clearReminderBtn.addEventListener('click', clearReminder);
}

function setReminder() {
    const minutes = parseInt(elements.reminderMinutes.value) || 10;
    const destination = elements.destinationSelect.value;
    const direction = elements.directionSelect.value;
    const times = busSchedules[destination][direction];
    
    const now = new Date();
    let nextBusTime = null;

    for (let time of times) {
        const [hour, minute] = time.split(':').map(Number);
        const busTime = new Date();
        busTime.setHours(hour, minute, 0, 0);

        if (busTime > now) {
            nextBusTime = busTime;
            break;
        }
    }

    if (nextBusTime) {
        clearReminder();
        
        const reminderTime = new Date(nextBusTime.getTime() - minutes * 60000);
        const timeUntilReminder = reminderTime - now;
        
        if (timeUntilReminder > 0) {
            activeReminder = {
                busTime: nextBusTime,
                reminderTime: reminderTime,
                destination: getDestinationName(),
                direction: elements.directionSelect.value === "to" ? "به دانشگاه" : "از دانشگاه"
            };
            
            reminderTimeout = setTimeout(triggerReminder, timeUntilReminder);
            
            elements.setReminderBtn.classList.add('hidden');
            elements.clearReminderBtn.classList.remove('hidden');
            
            localStorage.setItem('busReminder', JSON.stringify({
                destination: destination,
                direction: direction,
                minutes: minutes,
                busTime: nextBusTime.getTime()
            }));
            
            showToast(`یادآوری برای ${minutes} دقیقه قبل از حرکت تنظیم شد`);
        } else {
            showToast("زمان یادآوری گذشته است", "error");
        }
    } else {
        showToast("اتوبوسی برای یادآوری وجود ندارد", "error");
    }
}

function clearReminder() {
    if (reminderTimeout) clearTimeout(reminderTimeout);
    activeReminder = null;
    elements.setReminderBtn.classList.remove('hidden');
    elements.clearReminderBtn.classList.add('hidden');
    localStorage.removeItem('busReminder');
    showToast("یادآوری غیرفعال شد");
}

function triggerReminder() {
    if (!activeReminder) return;
    
    const busTimeStr = activeReminder.busTime.toLocaleTimeString('fa-IR', {hour: '2-digit', minute:'2-digit'});
    const message = `اتوبوس به سمت ${activeReminder.destination} (${activeReminder.direction}) ساعت ${busTimeStr} حرکت خواهد کرد`;
    
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification("⏰ یادآوری اتوبوس", {
            body: message,
            icon: "./icons/icon-192.png",
            vibrate: [200, 100, 200]
        });
    }
    
    showToast(message, "reminder");
    playReminderSound();
    clearReminder();
}

// توابع کمکی
function getDestinationName() {
    const options = elements.destinationSelect.options;
    return options[options.selectedIndex].text;
}

function showArrivalNotification() {
    elements.timerDiv.innerHTML = `
        <div class="animate-pulse text-center py-3 text-green-400 font-bold">
            🚌 اتوبوس در حال رسیدن است!
        </div>
    `;
    
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification("اتوبوس در راه است!", {
            body: `اتوبوس به سمت ${getDestinationName()} در حال رسیدن است`,
            icon: "./icons/icon-192.png"
        });
    }
}

function playReminderSound() {
    const audio = new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU...");
    audio.volume = 0.3;
    audio.play().catch(e => console.log("خطا در پخش صدا:", e));
}

function showToast(message, type = "success") {
    const toast = document.createElement('div');
    toast.className = `toast fixed bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg ${
        type === "error" ? "bg-red-500" : 
        type === "reminder" ? "bg-blue-500" : "bg-green-500"
    } text-white z-50`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.remove(), 3000);
}

function checkSavedReminders() {
    const saved = localStorage.getItem('busReminder');
    if (saved) {
        try {
            const reminder = JSON.parse(saved);
            const now = new Date();
            const reminderTime = new Date(reminder.busTime - reminder.minutes * 60000);
            
            if (reminderTime > now) {
                elements.destinationSelect.value = reminder.destination;
                elements.directionSelect.value = reminder.direction;
                elements.reminderMinutes.value = reminder.minutes;
                
                const timeUntilReminder = reminderTime - now;
                reminderTimeout = setTimeout(triggerReminder, timeUntilReminder);
                
                elements.setReminderBtn.classList.add('hidden');
                elements.clearReminderBtn.classList.remove('hidden');
                
                activeReminder = {
                    busTime: new Date(reminder.busTime),
                    reminderTime: reminderTime,
                    destination: getDestinationName(),
                    direction: reminder.direction === "to" ? "به دانشگاه" : "از دانشگاه"
                };
            } else {
                localStorage.removeItem('busReminder');
            }
        } catch (e) {
            localStorage.removeItem('busReminder');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setupReminderHandlers();
    checkSavedReminders();
    
    elements.destinationSelect.addEventListener('change', updateSchedule);
    elements.directionSelect.addEventListener('change', updateSchedule);
    
    if ("Notification" in window) {
        Notification.requestPermission();
    }
    
    updateSchedule();
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => {
                console.log('ServiceWorker با موفقیت ثبت شد');
                setInterval(() => reg.update(), 3600000);
            })
            .catch(err => console.error('خطا در ثبت ServiceWorker:', err));
    });
}
// ثبت sync
function registerBackgroundSync() {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready
        .then(reg => reg.sync.register('sync-data'))
        .catch(err => console.log('خطا در ثبت Background Sync:', err));
    }
  }
  
  // فراخوانی پس از آنلاین شدن
  window.addEventListener('online', registerBackgroundSync);
