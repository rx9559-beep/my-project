let currentEventId = null;

function openForm(eventObj = null) {
  document.getElementById("event-modal").classList.remove("hidden");
  if (eventObj) {
    document.getElementById("modal-title").textContent = "Edit Event";
    document.getElementById("event-name").value = eventObj.title || '';
    document.getElementById("event-category").value = eventObj.category || '';
    document.getElementById("event-description").value = eventObj.description || '';
    document.getElementById("event-location").value = eventObj.location || '';
    document.getElementById("event-date").value = eventObj.date || '';
    document.getElementById("event-price").value = eventObj.price || 0;
    document.getElementById("event-seats").value = eventObj.capacity || '';
    currentEventId = eventObj.id;
  } else {
    document.getElementById("modal-title").textContent = "Add Event";
    document.querySelectorAll('#event-modal input, #event-modal textarea, #event-modal select').forEach(input => input.value = "");
    currentEventId = null;
  }
}

function closeForm() { document.getElementById("event-modal").classList.add("hidden"); }

async function saveEvent() {
  const title = document.getElementById("event-name").value.trim();
  const category = document.getElementById("event-category").value;
  const description = document.getElementById("event-description").value.trim();
  const location = document.getElementById("event-location").value.trim();
  const date = document.getElementById("event-date").value;
  const price = Number(document.getElementById("event-price").value) || 0;
  const capacity = Number(document.getElementById("event-seats").value) || 0;
  
  // Validation
  if (!title || !category || !description || !location || !date || capacity <= 0) {
    alert('Please fill in all required fields with valid values.');
    return;
  }
  
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Please log in to create events.');
    return;
  }
  
  try {
    const fd = new FormData();
    fd.append('title', title);
    fd.append('category', category);
    fd.append('description', description);
    fd.append('location', location);
    fd.append('date', date);
    fd.append('price', price);
    fd.append('capacity', capacity);
    
    const fileInput = document.getElementById('event-image');
    if (fileInput && fileInput.files && fileInput.files[0]) {
      fd.append('image', fileInput.files[0]);
    }

    if (currentEventId) {
      const res = await fetch('http://localhost:4000/api/events/' + currentEventId, {
        method: 'PUT', 
        headers: { 'Authorization': 'Bearer ' + token }, 
        body: fd
      });
      const data = await res.json(); 
      if (!res.ok) throw new Error(data.error || 'Update failed');
      alert('Event updated successfully!');
    } else {
      const res = await fetch('http://localhost:4000/api/events', { 
        method: 'POST', 
        headers: { 'Authorization': 'Bearer ' + token }, 
        body: fd 
      });
      const data = await res.json(); 
      if (!res.ok) throw new Error(data.error || 'Create failed');
      alert('Event created successfully! It will now be visible to users on the website.');
    }
    await loadEvents();
    closeForm();
  } catch (err) { 
    console.error(err); 
    alert(err.message || 'Request failed'); 
  }
}

async function renderEvents(list) {
  const ul = document.getElementById('events-list'); 
  ul.innerHTML = '';
  
  if (list.length === 0) {
    ul.innerHTML = '<li class="no-events">No events created yet. Click the + button to add your first event!</li>';
    return;
  }
  
  list.forEach(ev => {
    const li = document.createElement('li');
    li.className = 'event-item';
    
    const eventDate = ev.date ? new Date(ev.date).toLocaleDateString('en-US', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }) : 'Date not set';
    
    const priceText = ev.price > 0 ? `${ev.price} SAR` : 'Free';
    const categoryText = ev.category ? ev.category.charAt(0).toUpperCase() + ev.category.slice(1) : 'Uncategorized';
    
    li.innerHTML = `
      <div class="event-info">
        <h4>${ev.title}</h4>
        <p class="event-meta">
          <span class="category">${categoryText}</span> • 
          <span class="location">${ev.location}</span> • 
          <span class="date">${eventDate}</span>
        </p>
        <p class="event-details">
          <span class="price">${priceText}</span> • 
          <span class="capacity">${ev.capacity} seats</span>
        </p>
        <p class="event-description">${ev.description ? ev.description.substring(0, 100) + (ev.description.length > 100 ? '...' : '') : 'No description'}</p>
      </div>
      <div class="event-actions">
        <button class="edit-btn" onclick="openForm(${JSON.stringify(ev).replace(/"/g, '&quot;')})">Edit</button>
        <button class="delete-btn" onclick="deleteEvent(${ev.id})">Delete</button>
      </div>
    `;
    
    ul.appendChild(li);
  });
}

async function deleteEvent(id) { const token = localStorage.getItem('token'); try { const res = await fetch('http://localhost:4000/api/events/' + id, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } }); const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Delete failed'); await loadEvents(); } catch (e) { console.error(e); alert(e.message || 'Delete failed'); } }

async function loadEvents() {
  try {
    const token = localStorage.getItem('token');
    const headers = token ? { 'Authorization': 'Bearer ' + token } : {};
    // request only events belonging to the logged-in org
    const res = await fetch('http://localhost:4000/api/events?mine=true', { headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch');
    renderEvents(data.events || []);
    // show org name if available
    const orgName = localStorage.getItem('orgName');
    if (orgName) {
      const title = document.querySelector('.company-info h2');
      if (title) title.textContent = orgName;
    }
  } catch (e) { console.error(e); alert('Could not load events'); }
}

// Initialize
document.addEventListener('DOMContentLoaded', loadEvents);

// Image preview handling
const fileInput = document.getElementById('event-image');
if (fileInput) {
  fileInput.addEventListener('change', (e) => {
    const preview = document.getElementById('event-image-preview');
    if (!preview) return;
    const f = e.target.files[0];
    if (!f) { preview.innerHTML = ''; return; }
    const url = URL.createObjectURL(f);
    preview.innerHTML = `<img src="${url}" style="max-width:150px;max-height:100px;border-radius:8px;"/>`;
  });
}