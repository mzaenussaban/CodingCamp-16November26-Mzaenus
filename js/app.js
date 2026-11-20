(function () {
  'use strict';

  // ── Storage ──────────────────────────────────────────────────────────────
  var Storage = {
    available: false,

    init: function () {
      try {
        var testKey = '__storage_test__';
        localStorage.setItem(testKey, '1');
        localStorage.getItem(testKey);
        localStorage.removeItem(testKey);
        Storage.available = true;
      } catch (e) {
        Storage.available = false;
      }
    },

    get: function (key) {
      if (!Storage.available) { return null; }
      try {
        var raw = localStorage.getItem(key);
        if (raw === null) { return null; }
        try {
          return JSON.parse(raw);
        } catch (parseErr) {
          return raw;
        }
      } catch (e) {
        return null;
      }
    },

    set: function (key, value) {
      if (!Storage.available) { return; }
      try {
        var serialised = (typeof value === 'object' && value !== null) || Array.isArray(value)
          ? JSON.stringify(value)
          : String(value);
        localStorage.setItem(key, serialised);
      } catch (e) {
        // no-op on write failure (e.g. quota exceeded)
      }
    },

    remove: function (key) {
      if (!Storage.available) { return; }
      try {
        localStorage.removeItem(key);
      } catch (e) {
        // no-op
      }
    }
  };

  // ── Theme ─────────────────────────────────────────────────────────────────
  var Theme = {
    apply: function (value) {
      document.documentElement.setAttribute('data-theme', value);
      Storage.set('dashboard_theme', value);

      var btn = document.getElementById('theme-toggle');
      if (btn) {
        if (value === 'dark') {
          btn.textContent = '☀️ Light';
        } else {
          btn.textContent = '🌙 Dark';
        }
      }
    },

    init: function () {
      var stored = Storage.get('dashboard_theme');
      if (stored === 'light' || stored === 'dark') {
        Theme.apply(stored);
      } else {
        var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        Theme.apply(prefersDark ? 'dark' : 'light');
      }

      var btn = document.getElementById('theme-toggle');
      if (btn) {
        btn.addEventListener('click', function () {
          var current = document.documentElement.getAttribute('data-theme');
          Theme.apply(current === 'dark' ? 'light' : 'dark');
        });
      }
    }
  };

  // ── Greeting ──────────────────────────────────────────────────────────────

  // Named helpers inside the IIFE so property tests can reference them directly.

  function getGreetingPrefix(hour) {
    if (hour >= 5 && hour <= 11)  { return 'Good morning'; }
    if (hour >= 12 && hour <= 17) { return 'Good afternoon'; }
    if (hour >= 18 && hour <= 20) { return 'Good evening'; }
    return 'Good night'; // 21-23 and 0-4
  }

  function formatDate(date) {
    var days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    var months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
    var dayName   = days[date.getDay()];
    var dayNum    = date.getDate();
    var monthName = months[date.getMonth()];
    var year      = date.getFullYear();
    return dayName + ', ' + dayNum + ' ' + monthName + ' ' + year;
  }

  var Greeting = {
    init: function () {
      function tick() {
        var clockEl    = document.getElementById('clock');
        var dateEl     = document.getElementById('date-display');
        var greetingEl = document.getElementById('greeting-text');

        try {
          var now     = new Date();
          var hours   = now.getHours();
          var minutes = now.getMinutes();

          // HH:MM zero-padded
          var hh = (hours   < 10 ? '0' : '') + hours;
          var mm = (minutes < 10 ? '0' : '') + minutes;

          if (clockEl)    { clockEl.textContent    = hh + ':' + mm; }
          if (dateEl)     { dateEl.textContent     = formatDate(now); }

          if (greetingEl) {
            var prefix = getGreetingPrefix(hours);
            var name   = Storage.get('dashboard_user_name');
            greetingEl.textContent = name ? prefix + ', ' + name : prefix;
          }
        } catch (e) {
          if (clockEl)    { clockEl.textContent    = 'Time unavailable'; }
          if (dateEl)     { dateEl.textContent     = 'Date unavailable'; }
          if (greetingEl) { greetingEl.textContent = 'Greeting unavailable'; }
        }
      }

      tick();
      setInterval(tick, 1000);

      // Load saved name on startup
      var savedName  = Storage.get('dashboard_user_name');
      var nameInput  = document.getElementById('name-input');
      if (savedName && nameInput) {
        nameInput.value = savedName;
      }

      // Name form submit handler (task 4.3 completes this, but wire up the form here)
      var nameForm = document.getElementById('name-form');
      if (nameForm) {
        nameForm.addEventListener('submit', function (e) {
          e.preventDefault();
          var input = document.getElementById('name-input');
          var greetingEl = document.getElementById('greeting-text');
          if (!input) { return; }
          var name = input.value.trim();
          if (name) {
            Storage.set('dashboard_user_name', name);
          } else {
            Storage.remove('dashboard_user_name');
          }
          // Update greeting text immediately
          if (greetingEl) {
            var now    = new Date();
            var prefix = getGreetingPrefix(now.getHours());
            greetingEl.textContent = name ? prefix + ', ' + name : prefix;
          }
        });
      }
    }
  };

  // ── Timer ─────────────────────────────────────────────────────────────────

  // Named IIFE-level helper so property tests can import and call it directly.
  function validateDuration(value) {
    return Number.isInteger(value) && value >= 1 && value <= 120;
  }

  // Named IIFE-level function so property tests can import and call it directly.
  function formatTimer(seconds) {
    var mins = Math.floor(seconds / 60);
    var secs = seconds % 60;
    return (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs;
  }

  var Timer = {
    // Internal state
    remainingSeconds: 1500,
    intervalId: null,
    running: false,
    originalTitle: '',
    pomodoroSeconds: 1500,

    render: function () {
      var display = document.getElementById('timer-display');
      var startBtn = document.getElementById('timer-start');
      var stopBtn  = document.getElementById('timer-stop');

      if (display) {
        display.textContent = formatTimer(Timer.remainingSeconds);
      }
      if (Timer.running) {
        if (startBtn) { startBtn.disabled = true; }
        if (stopBtn)  { stopBtn.disabled  = false; }
      } else {
        if (startBtn) { startBtn.disabled = false; }
        if (stopBtn)  { stopBtn.disabled  = true; }
      }
    },

    init: function () {
      Timer.originalTitle = document.title;

      // Load persisted duration
      var storedDuration = Storage.get('dashboard_pomodoro_duration');
      var parsedDuration = parseInt(storedDuration, 10);
      if (validateDuration(parsedDuration)) {
        Timer.pomodoroSeconds = parsedDuration * 60;
        Timer.remainingSeconds = Timer.pomodoroSeconds;
      } else {
        Timer.pomodoroSeconds = 1500;
        Timer.remainingSeconds = Timer.pomodoroSeconds;
      }

      var startBtn = document.getElementById('timer-start');
      var stopBtn  = document.getElementById('timer-stop');
      var resetBtn = document.getElementById('timer-reset');

      if (startBtn) {
        startBtn.addEventListener('click', function () {
          Timer.start();
        });
      }
      if (stopBtn) {
        stopBtn.addEventListener('click', function () {
          Timer.stop();
        });
      }
      if (resetBtn) {
        resetBtn.addEventListener('click', function () {
          Timer.reset();
        });
      }

      // Duration form submit handler
      var durationForm = document.getElementById('duration-form');
      if (durationForm) {
        durationForm.addEventListener('submit', function (e) {
          e.preventDefault();
          var input = document.getElementById('duration-input');
          var errorEl = document.getElementById('duration-error');
          if (!input) { return; }
          var value = parseInt(input.value, 10);
          if (!validateDuration(value)) {
            if (errorEl) {
              errorEl.textContent = 'Please enter a duration between 1 and 120 minutes.';
            }
            return;
          }
          if (errorEl) { errorEl.textContent = ''; }
          Timer.pomodoroSeconds = value * 60;
          Storage.set('dashboard_pomodoro_duration', value);
          Timer.reset();
        });
      }

      Timer.render();
    },

    start: function () {
      Timer.intervalId = setInterval(function tick() {
        Timer.remainingSeconds -= 1;
        Timer.render();
        document.title = formatTimer(Timer.remainingSeconds) + ' ' + Timer.originalTitle;
        if (Timer.remainingSeconds === 0) {
          Timer.complete();
        }
      }, 1000);
      Timer.running = true;
      document.title = formatTimer(Timer.remainingSeconds) + ' ' + Timer.originalTitle;
      Timer.render();
    },

    stop: function () {
      clearInterval(Timer.intervalId);
      Timer.running = false;
      document.title = Timer.originalTitle;
      Timer.render();
    },

    reset: function () {
      Timer.stop();
      Timer.remainingSeconds = Timer.pomodoroSeconds;
      Timer.render();
    },

    complete: function () {
      Timer.stop();

      // Attempt browser Notification; fall back to inline banner
      var showBanner = false;
      if (typeof Notification === 'undefined') {
        showBanner = true;
      } else if (Notification.permission === 'granted') {
        try {
          new Notification('Focus session complete!');
        } catch (e) {
          showBanner = true;
        }
      } else {
        showBanner = true;
      }

      if (showBanner) {
        var banner = document.getElementById('timer-banner');
        if (banner) {
          banner.textContent = 'Session complete!';
          banner.style.display = 'block';

          // Auto-hide after 10 seconds
          var autoHide = setTimeout(function () {
            banner.style.display = 'none';
          }, 10000);

          // Dismiss on click
          banner.addEventListener('click', function dismissBanner() {
            clearTimeout(autoHide);
            banner.style.display = 'none';
            banner.removeEventListener('click', dismissBanner);
          }, { once: true });
        }
      }
    }
  };

  // Wire up the dismiss click handler on #timer-banner (also covers manual show)
  document.addEventListener('DOMContentLoaded', function () {
    var banner = document.getElementById('timer-banner');
    if (banner) {
      banner.addEventListener('click', function () {
        banner.style.display = 'none';
      });
    }
  });

  // ── isDuplicate ───────────────────────────────────────────────────────────
  /**
   * Returns true if any task in `tasks` (excluding the task with `excludeId`,
   * if provided) has the same normalised text as `text`.
   * Normalisation: trim + toLowerCase.
   *
   * @param {Array}  tasks     - The current task array
   * @param {string} text      - The candidate text to check
   * @param {string} [excludeId] - Optional task id to exclude from comparison
   * @returns {boolean}
   */
  function isDuplicate(tasks, text, excludeId) {
    var normalised = (text || '').trim().toLowerCase();
    for (var i = 0; i < tasks.length; i++) {
      if (excludeId !== undefined && tasks[i].id === excludeId) { continue; }
      if (tasks[i].text.trim().toLowerCase() === normalised) { return true; }
    }
    return false;
  }

  // ── Tasks ─────────────────────────────────────────────────────────────────
  var Tasks = {
    // Internal state
    tasks: [],
    taskCounter: 0,

    generateId: function () {
      return 't_' + Date.now() + '_' + Tasks.taskCounter++;
    },

    persist: function () {
      Storage.set('dashboard_tasks', Tasks.tasks);
    },

    load: function () {
      var result = Storage.get('dashboard_tasks');
      if (Array.isArray(result)) {
        Tasks.tasks = result;
      } else {
        Tasks.tasks = [];
      }
    },

    addTask: function (text) {
      var errorEl = document.getElementById('task-error');
      var trimmedText = (text || '').trim();

      if (trimmedText.length === 0) {
        if (errorEl) { errorEl.textContent = 'Task description cannot be empty.'; }
        return;
      }
      if (trimmedText.length > 200) {
        if (errorEl) { errorEl.textContent = 'Task description must be 200 characters or fewer.'; }
        return;
      }

      // Duplicate check
      if (isDuplicate(Tasks.tasks, trimmedText)) {
        if (errorEl) { errorEl.textContent = 'A task with this description already exists.'; }
        return;
      }

      if (errorEl) { errorEl.textContent = ''; }

      Tasks.tasks.push({ id: Tasks.generateId(), text: trimmedText, done: false });
      Tasks.persist();
      Tasks.renderList();
    },

    renderList: function () {
      var listEl = document.getElementById('task-list');
      if (!listEl) { return; }
      listEl.innerHTML = '';

      Tasks.tasks.forEach(function (task) {
        var li = document.createElement('li');
        li.setAttribute('data-task-id', task.id);

        // Toggle complete button
        var toggleBtn = document.createElement('button');
        toggleBtn.textContent = '✓';
        toggleBtn.setAttribute('type', 'button');
        toggleBtn.setAttribute('aria-label', task.done ? 'Mark incomplete' : 'Mark complete');
        toggleBtn.addEventListener('click', function () {
          Tasks.toggleComplete(task.id);
        });

        // Task text span
        var span = document.createElement('span');
        span.textContent = task.text;
        if (task.done) {
          span.style.textDecoration = 'line-through';
        }

        // Edit button
        var editBtn = document.createElement('button');
        editBtn.textContent = 'Edit';
        editBtn.setAttribute('type', 'button');
        editBtn.addEventListener('click', function () {
          Tasks.startEdit(task.id);
        });

        // Delete button
        var deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.setAttribute('type', 'button');
        deleteBtn.addEventListener('click', function () {
          Tasks.deleteTask(task.id);
        });

        li.appendChild(toggleBtn);
        li.appendChild(span);
        li.appendChild(editBtn);
        li.appendChild(deleteBtn);
        listEl.appendChild(li);
      });
    },

    startEdit: function (id) {
      var listEl = document.getElementById('task-list');
      if (!listEl) { return; }

      // Find the task object
      var task = null;
      for (var i = 0; i < Tasks.tasks.length; i++) {
        if (Tasks.tasks[i].id === id) { task = Tasks.tasks[i]; break; }
      }
      if (!task) { return; }

      // Find the <li>
      var li = listEl.querySelector('[data-task-id="' + id + '"]');
      if (!li) { return; }

      // Replace the <span> with an <input>
      var span = li.querySelector('span');
      if (!span) { return; }

      var editInput = document.createElement('input');
      editInput.setAttribute('type', 'text');
      editInput.value = task.text;

      // Clear #task-error when the edit input changes — only if no longer a duplicate of another task
      editInput.addEventListener('input', function () {
        var errorEl = document.getElementById('task-error');
        if (errorEl && !isDuplicate(Tasks.tasks, editInput.value, id)) {
          errorEl.textContent = '';
        }
      });

      li.replaceChild(editInput, span);

      // Re-query all buttons by position: [0]=toggle, [1]=edit, [2]=delete
      var buttons = li.querySelectorAll('button');
      // buttons[0] = toggle, buttons[1] = edit, buttons[2] = delete
      var editBtnEl   = buttons[1];
      var deleteBtnEl = buttons[2];

      // Hide the Edit button
      editBtnEl.style.display = 'none';

      // Create Confirm button
      var confirmBtn = document.createElement('button');
      confirmBtn.textContent = 'Confirm';
      confirmBtn.setAttribute('type', 'button');
      confirmBtn.addEventListener('click', function () {
        Tasks.confirmEdit(id, editInput.value);
      });

      // Create Cancel button
      var cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'Cancel';
      cancelBtn.setAttribute('type', 'button');
      cancelBtn.addEventListener('click', function () {
        Tasks.cancelEdit(id);
      });

      // Insert Confirm and Cancel before the Delete button
      li.insertBefore(confirmBtn, deleteBtnEl);
      li.insertBefore(cancelBtn, deleteBtnEl);
    },

    confirmEdit: function (id, newText) {
      var errorEl = document.getElementById('task-error');
      var trimmedText = (newText || '').trim();

      if (trimmedText.length === 0 || trimmedText.length > 200) {
        if (errorEl) {
          errorEl.textContent = trimmedText.length === 0
            ? 'Task description cannot be empty.'
            : 'Task description must be 200 characters or fewer.';
        }
        Tasks.renderList();
        return;
      }

      // Duplicate check — exclude the task being edited (pass id as third arg)
      if (isDuplicate(Tasks.tasks, trimmedText, id)) {
        if (errorEl) { errorEl.textContent = 'A task with this description already exists.'; }
        Tasks.renderList();
        return;
      }

      // Find task and update
      for (var i = 0; i < Tasks.tasks.length; i++) {
        if (Tasks.tasks[i].id === id) {
          Tasks.tasks[i].text = trimmedText;
          break;
        }
      }

      if (errorEl) { errorEl.textContent = ''; }
      Tasks.persist();
      Tasks.renderList();
    },

    cancelEdit: function (id) {
      Tasks.renderList();
    },

    deleteTask: function (id) {
      for (var i = 0; i < Tasks.tasks.length; i++) {
        if (Tasks.tasks[i].id === id) {
          Tasks.tasks.splice(i, 1);
          break;
        }
      }
      Tasks.persist();

      // Remove the <li> directly from the DOM
      var listEl = document.getElementById('task-list');
      if (listEl) {
        var li = listEl.querySelector('[data-task-id="' + id + '"]');
        if (li) { listEl.removeChild(li); }
      }
    },

    toggleComplete: function (id) {
      var task = null;
      for (var i = 0; i < Tasks.tasks.length; i++) {
        if (Tasks.tasks[i].id === id) {
          task = Tasks.tasks[i];
          break;
        }
      }
      if (!task) { return; }
      task.done = !task.done;
      Tasks.persist();
      Tasks.renderList();
    },

    init: function () {
      Tasks.load();
      Tasks.renderList();

      // Form submit handler
      var taskForm = document.getElementById('task-form');
      if (taskForm) {
        taskForm.addEventListener('submit', function (e) {
          e.preventDefault();
          var input = document.getElementById('task-input');
          if (!input) { return; }
          Tasks.addTask(input.value);
          input.value = '';
        });
      }

      // Clear error when user modifies the input — only if the new value is not a duplicate
      var taskInput = document.getElementById('task-input');
      if (taskInput) {
        taskInput.addEventListener('input', function () {
          var errorEl = document.getElementById('task-error');
          if (errorEl && !isDuplicate(Tasks.tasks, taskInput.value)) {
            errorEl.textContent = '';
          }
        });
      }
    }
  };

  // ── QuickLinks helpers ────────────────────────────────────────────────────

  /**
   * If `url` does not already start with "http://" or "https://", prepend "https://".
   * Returns the string unchanged otherwise.
   *
   * @param {string} url
   * @returns {string}
   */
  function normaliseUrl(url) {
    if (typeof url === 'string' && (url.indexOf('http://') === 0 || url.indexOf('https://') === 0)) {
      return url;
    }
    return 'https://' + url;
  }

  /**
   * Returns true if `url` can be parsed by the URL constructor and has a non-empty hostname.
   * Returns false on parse error or empty hostname.
   *
   * @param {string} url
   * @returns {boolean}
   */
  function hasValidHost(url) {
    try {
      var parsed = new URL(url);
      return parsed.hostname.length > 0;
    } catch (e) {
      return false;
    }
  }

  // ── QuickLinks ────────────────────────────────────────────────────────────
  var QuickLinks = {
    // Internal state
    links: [],
    linkCounter: 0,

    generateId: function () {
      return 'l_' + Date.now() + '_' + QuickLinks.linkCounter++;
    },

    persist: function () {
      Storage.set('dashboard_quick_links', QuickLinks.links);
    },

    load: function () {
      var result = Storage.get('dashboard_quick_links');
      if (Array.isArray(result)) {
        QuickLinks.links = result;
      } else {
        QuickLinks.links = [];
      }
    },

    addLink: function (label, url) {
      var errorEl = document.getElementById('link-error');

      var trimmedLabel = (label || '').trim();
      var trimmedUrl   = (url   || '').trim();

      // Field-specific length validation
      if (trimmedLabel.length < 1 || trimmedLabel.length > 50) {
        if (errorEl) { errorEl.textContent = 'Label must be between 1 and 50 characters.'; }
        return;
      }
      if (trimmedUrl.length < 1 || trimmedUrl.length > 2048) {
        if (errorEl) { errorEl.textContent = 'URL must be between 1 and 2048 characters.'; }
        return;
      }

      // Normalise and host-validate
      var normalisedUrl = normaliseUrl(trimmedUrl);
      if (!hasValidHost(normalisedUrl)) {
        if (errorEl) { errorEl.textContent = 'URL must contain a valid host.'; }
        return;
      }

      // Cap at 50 links
      if (QuickLinks.links.length >= 50) {
        if (errorEl) { errorEl.textContent = 'Maximum of 50 links reached.'; }
        return;
      }

      if (errorEl) { errorEl.textContent = ''; }

      QuickLinks.links.push({
        id:    QuickLinks.generateId(),
        label: trimmedLabel,
        url:   normalisedUrl
      });
      QuickLinks.persist();
      QuickLinks.renderList();
    },

    renderList: function () {
      var listEl = document.getElementById('link-list');
      if (!listEl) { return; }
      listEl.innerHTML = '';

      QuickLinks.links.forEach(function (link) {
        var li = document.createElement('li');
        li.setAttribute('data-link-id', link.id);

        var a = document.createElement('a');
        a.href = link.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = link.label;

        var deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.setAttribute('type', 'button');
        (function (id) {
          deleteBtn.addEventListener('click', function () {
            QuickLinks.deleteLink(id);
          });
        }(link.id));

        li.appendChild(a);
        li.appendChild(deleteBtn);
        listEl.appendChild(li);
      });
    },

    deleteLink: function (id) {
      for (var i = 0; i < QuickLinks.links.length; i++) {
        if (QuickLinks.links[i].id === id) {
          QuickLinks.links.splice(i, 1);
          break;
        }
      }
      QuickLinks.persist();

      // Remove the <li> directly from the DOM
      var listEl = document.getElementById('link-list');
      if (listEl) {
        var li = listEl.querySelector('[data-link-id="' + id + '"]');
        if (li) { listEl.removeChild(li); }
      }
    },

    init: function () {
      QuickLinks.load();
      QuickLinks.renderList();

      // Form submit handler
      var linkForm = document.getElementById('link-form');
      if (linkForm) {
        linkForm.addEventListener('submit', function (e) {
          e.preventDefault();
          var labelInput = document.getElementById('link-label-input');
          var urlInput   = document.getElementById('link-url-input');
          if (!labelInput || !urlInput) { return; }
          QuickLinks.addLink(labelInput.value, urlInput.value);
          labelInput.value = '';
          urlInput.value   = '';
        });
      }
    }
  };

  // ── App ───────────────────────────────────────────────────────────────────
  var App = {
    init: function () {
      Storage.init();
      Theme.init();
      Greeting.init();
      Timer.init();
      Tasks.init();
      QuickLinks.init();
    }
  };

  document.addEventListener('DOMContentLoaded', App.init);
})();
