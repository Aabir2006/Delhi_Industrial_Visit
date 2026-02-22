// ======= TRAIN DATABASE (simulated) =======
// In production this would be replaced by a live API call
const TRAIN_DB = {
  '12301': { name: 'Howrah Rajdhani', route: 'Howrah → New Delhi' },
  '12951': { name: 'Mumbai Rajdhani', route: 'Mumbai Central → New Delhi' },
  '12628': { name: 'Karnataka Exp', route: 'Bengaluru → New Delhi' },
  '12345': { name: 'Rajdhani Express', route: 'Patna → New Delhi' },
  '11057': { name: 'Devagiri Express', route: 'Mumbai CST → Manmad' },
  '22691': { name: 'Rajdhani Express', route: 'Bengaluru → Hazrat Nizamuddin' },
};

const COACHES = [
  { id: 'H1', label: 'H1 · AC 1st Class' },
  { id: 'A1', label: 'A1 · AC 2 Tier' },
  { id: 'A2', label: 'A2 · AC 2 Tier' },
  { id: 'B1', label: 'B1 · AC 3 Tier' },
  { id: 'B2', label: 'B2 · AC 3 Tier' },
  { id: 'B3', label: 'B3 · AC 3 Tier' },
  { id: 'S1', label: 'S1 · Sleeper' },
  { id: 'S2', label: 'S2 · Sleeper' },
  { id: 'S3', label: 'S3 · Sleeper' },
  { id: 'PAN', label: 'Pantry Car' },
];

// Each coach has 2 toilets (except PAN which has 1)
const TYPES = ['Western', 'Indian'];

function rand(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

// ======= GENERATE TOILET DATA =======
function generateToilets() {
  const data = {};
  COACHES.forEach(coach => {
    const count = coach.id === 'PAN' ? 1 : 2;
    data[coach.id] = Array.from({ length: count }, (_, i) => ({
      id: `${coach.id}-T${i + 1}`,
      type: TYPES[i % TYPES.length],
      // ~60% vacant, ~40% occupied  
      status: Math.random() < 0.6 ? 'vacant' : 'occupied',
    }));
  });
  return data;
}

// ======= STATE =======
let toiletData = {};
let currentTrain = null;
let countdownVal = 30;
let countdownTimer = null;

// ======= DOM REFS =======
const screenEntry = document.getElementById('screenEntry');
const screenStatus = document.getElementById('screenStatus');
const trainInput = document.getElementById('trainInput');
const inputHint = document.getElementById('inputHint');
const btnSearch = document.getElementById('btnSearch');
const btnBack = document.getElementById('btnBack');
const headerTrainName = document.getElementById('headerTrainName');
const headerTime = document.getElementById('headerTime');
const summaryVacant = document.getElementById('summaryVacant');
const summaryOccupied = document.getElementById('summaryOccupied');
const coachesScroll = document.getElementById('coachesScroll');
const countdownEl = document.getElementById('countdown');
const toast = document.getElementById('toast');
const fabReport = document.getElementById('fabReport');

// ======= CLOCK =======
function startClock() {
  function tick() {
    const now = new Date();
    headerTime.textContent = now.toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
  }
  tick();
  setInterval(tick, 1000);
}

// ======= TOAST =======
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ======= RENDER STATUS SCREEN =======
function renderStatus() {
  // Summary counts
  let vacantCount = 0, occupiedCount = 0;
  COACHES.forEach(coach => {
    (toiletData[coach.id] || []).forEach(t => {
      if (t.status === 'vacant') vacantCount++;
      else occupiedCount++;
    });
  });
  summaryVacant.textContent = vacantCount;
  summaryOccupied.textContent = occupiedCount;

  // Coach sections
  coachesScroll.innerHTML = '';
  COACHES.forEach(coach => {
    const toilets = toiletData[coach.id] || [];
    if (!toilets.length) return;

    const section = document.createElement('div');
    section.className = 'coach-section';

    const label = document.createElement('div');
    label.className = 'coach-label';
    label.textContent = coach.label;

    const tiles = document.createElement('div');
    tiles.className = 'toilet-tiles';

    toilets.forEach(t => {
      const tile = document.createElement('div');
      tile.className = `toilet-tile ${t.status}`;
      tile.innerHTML = `
        <div class="tile-led"></div>
        <div class="tile-icon">${t.type === 'Western' ? '🚽' : '🪣'}</div>
        <div class="tile-info">
          <div class="tile-id">${t.id}</div>
          <div class="tile-type">${t.type}</div>
        </div>
        <div class="tile-badge">${t.status === 'vacant' ? 'Vacant' : 'Occupied'}</div>
      `;
      tiles.appendChild(tile);
    });

    section.appendChild(label);
    section.appendChild(tiles);
    coachesScroll.appendChild(section);
  });
}

// ======= AUTO REFRESH =======
function refreshStatuses() {
  // Simulate sensor update: randomly flip a few toilets
  COACHES.forEach(coach => {
    (toiletData[coach.id] || []).forEach(t => {
      if (Math.random() < 0.2) {
        t.status = t.status === 'vacant' ? 'occupied' : 'vacant';
      }
    });
  });
  renderStatus();
  showToast('📡 Status updated from sensors');
}

function startCountdown() {
  if (countdownTimer) clearInterval(countdownTimer);
  countdownVal = 30;
  countdownEl.textContent = countdownVal;
  countdownTimer = setInterval(() => {
    countdownVal--;
    countdownEl.textContent = countdownVal;
    if (countdownVal <= 0) {
      countdownVal = 30;
      refreshStatuses();
    }
  }, 1000);
}

function stopCountdown() {
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = null;
}

// ======= NAVIGATION =======
function goToStatus(trainNo) {
  const info = TRAIN_DB[trainNo] || { name: `Train ${trainNo}`, route: '' };
  currentTrain = { no: trainNo, ...info };

  // Generate fresh toilet data
  toiletData = generateToilets();

  // Update header
  headerTrainName.textContent = `${trainNo} · ${info.name}`;

  // Show status screen
  screenEntry.classList.add('hidden');
  screenStatus.classList.remove('hidden');
  window.scrollTo(0, 0);

  renderStatus();
  startClock();
  startCountdown();
  showToast(`✅ Loaded live status for Train ${trainNo}`);
}

function goBack() {
  screenStatus.classList.add('hidden');
  screenEntry.classList.remove('hidden');
  stopCountdown();
  trainInput.value = '';
  inputHint.textContent = '';
  trainInput.classList.remove('error');
}

// ======= VALIDATE & SEARCH =======
function handleSearch() {
  const val = trainInput.value.trim();
  if (!val) {
    inputHint.textContent = 'Please enter a train number.';
    trainInput.classList.add('error');
    trainInput.focus();
    return;
  }
  if (!/^\d{4,5}$/.test(val)) {
    inputHint.textContent = 'Train number must be 4–5 digits.';
    trainInput.classList.add('error');
    trainInput.focus();
    return;
  }
  inputHint.textContent = '';
  trainInput.classList.remove('error');
  goToStatus(val);
}

// ======= EVENT LISTENERS =======
btnSearch.addEventListener('click', handleSearch);

trainInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') handleSearch();
  // clear error on type
  inputHint.textContent = '';
  trainInput.classList.remove('error');
});

btnBack.addEventListener('click', goBack);

fabReport.addEventListener('click', () => {
  const prefix = [9, 8, 7][Math.floor(Math.random() * 3)];
  const staffNo = prefix + '' + Math.floor(100000000 + Math.random() * 900000000);
  showToast(`🔔 Staff alerted! Contact: ${staffNo}`);
});

// Preset chips
document.querySelectorAll('.preset-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const trainNo = chip.dataset.train;
    trainInput.value = trainNo;
    goToStatus(trainNo);
  });
});
