const SUPABASE_URL = 'https://eoxoiyikeipminztkkpl.supabase.co'; // Replace with yours
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVveG9peWlrZWlwbWluenRra3BsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMzM5MzIsImV4cCI6MjA4NjgwOTkzMn0.lkmzO4ILu_79AzcsLam8HnxoBB87K6LySKQ0M2Wa7C4'; // Replace with yours
const supabase = Supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let currentJobId = null;

// Handle hash routing
function navigateTo(section, id = null) {
  window.location.hash = id ? `${section}:${id}` : section;
  updateView();
}

function updateView() {
  const hash = window.location.hash.slice(1);
  document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
  if (!currentUser) {
    document.getElementById('login').classList.add('active');
    return;
  }
  if (hash.startsWith('view:')) {
    currentJobId = hash.split(':')[1];
    document.getElementById('view').classList.add('active');
    loadJobDetails(currentJobId);
  } else if (hash === 'list') {
    document.getElementById('list').classList.add('active');
    loadJobList();
  } else {
    document.getElementById('create').classList.add('active');
  }
}

// Auth
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) alert(error.message);
  else {
    currentUser = data.user;
    navigateTo('create');
  }
});

document.getElementById('signupBtn').addEventListener('click', async () => {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) alert(error.message);
  else alert('Signed up! Now log in.');
});

// Append to app.js
document.getElementById('createForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {
    date: document.getElementById('date').value,
    shift: document.getElementById('shift').value,
    product: document.getElementById('product').value,
    target_quantity: parseInt(document.getElementById('target').value),
    wo_number: document.getElementById('wo').value,
    created_by: currentUser.id
  };
  const { error } = await supabase.from('job_cards').insert([data]);
  if (error) alert(error.message);
  else {
    alert('Job Card created!');
    document.getElementById('createForm').reset();
  }
});

document.getElementById('viewBtn').addEventListener('click', () => navigateTo('list'));
document.getElementById('backToCreate').addEventListener('click', () => navigateTo('create'));
window.addEventListener('hashchange', updateView);
updateView();

// Append
async function loadJobList() {
  const { data, error } = await supabase.from('job_cards').select('*').eq('status', 'open').order('created_at', { ascending: false });
  if (error) alert(error.message);
  else {
    const list = document.getElementById('jobList');
    list.innerHTML = '';
    data.forEach(card => {
      const li = document.createElement('li');
      li.innerHTML = `${card.wo_number} - ${card.product} (${card.date})`;
      li.addEventListener('click', () => navigateTo('view', card.id));
      list.appendChild(li);
    });
  }
}

document.getElementById('backToList').addEventListener('click', () => navigateTo('list'));

// Append
async function loadJobDetails(id) {
  const { data: card } = await supabase.from('job_cards').select('*').eq('id', id).single();
  if (card) {
    document.getElementById('cardDetails').innerHTML = `
      <p>WO: ${card.wo_number}</p>
      <p>Product: ${card.product}</p>
      <p>Target: ${card.target_quantity}</p>
      <p>Status: ${card.status}</p>
    `;
  }
  await loadUpdates(id);

  // Realtime subscription
  supabase.channel('hourly_updates').on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'hourly_updates',
    filter: `job_card_id=eq.${id}`
  }, () => loadUpdates(id)).subscribe();
}

async function loadUpdates(id) {
  const { data } = await supabase.from('hourly_updates').select('*').eq('job_card_id', id).order('hour_number');
  const list = document.getElementById('updatesList');
  list.innerHTML = '';
  data.forEach(update => {
    const li = document.createElement('li');
    li.textContent = `Hour ${update.hour_number}: Output ${update.output}, Remarks: ${update.remarks}`;
    list.appendChild(li);
  });
}

document.getElementById('updateForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {
    job_card_id: currentJobId,
    hour_number: parseInt(document.getElementById('hour').value),
    output: parseInt(document.getElementById('output').value),
    remarks: document.getElementById('remarks').value
  };
  const { error } = await supabase.from('hourly_updates').insert([data]);
  if (error) alert(error.message);
  else {
    document.getElementById('updateForm').reset();
    loadUpdates(currentJobId); // Manual refresh, realtime handles others
  }
});

// Append
document.getElementById('closeBtn').addEventListener('click', async () => {
  const { error } = await supabase.from('job_cards').update({ status: 'closed' }).eq('id', currentJobId);
  if (error) alert(error.message);
  else {
    alert('Closed!');
    navigateTo('list');
  }
});
