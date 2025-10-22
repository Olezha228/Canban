// Please see documentation at https://learn.microsoft.com/aspnet/core/client-side/bundling-and-minification
// for details on configuring this project to bundle and minify static web assets.

// Write your JavaScript code.
(function () {
    const STORAGE_KEY = 'kanban.tasks.v1';
    const API_BASE = '/api/tasks';

    function uid() {
        return 't-' + Math.random().toString(36).slice(2, 9);
    }

    // Local storage helpers
    function saveLocalTasks(tasks) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); } catch (e) { console.error(e); }
    }
    function loadLocalTasks() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.error('Failed to parse local tasks', e);
            return [];
        }
    }

    // Server API helpers
    async function fetchServerTasks() {
        try {
            const res = await fetch(API_BASE, { cache: 'no-store' });
            if (!res.ok) throw new Error('Network response was not ok');
            return await res.json();
        } catch (e) {
            console.warn('Could not fetch tasks from server, falling back to local', e);
            return null;
        }
    }

    async function createServerTask(task) {
        try {
            const res = await fetch(API_BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(task)
            });
            if (!res.ok) throw new Error('Create failed');
            return await res.json();
        } catch (e) {
            console.warn('Create on server failed', e);
            return null;
        }
    }

    async function updateServerTask(task) {
        try {
            const res = await fetch(`${API_BASE}/${encodeURIComponent(task.id)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(task)
            });
            if (!res.ok) throw new Error('Update failed');
            return true;
        } catch (e) {
            console.warn('Update on server failed', e);
            return false;
        }
    }

    async function deleteServerTask(id) {
        try {
            const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Delete failed');
            return true;
        } catch (e) {
            console.warn('Delete on server failed', e);
            return false;
        }
    }

    // Unified load: try server, otherwise local cache
    async function loadTasks() {
        const local = loadLocalTasks();
        const server = await fetchServerTasks();
        if (server && Array.isArray(server)) {
            // normalize property names in case server returns PascalCase
            const normalized = server.map(s => ({ id: s.id || s.Id, title: s.title || s.Title || '', description: s.description || s.Description || '', status: s.status || s.Status || 'todo' }));

            // If server is empty but we have local tasks, push them to server (initial migration)
            if (normalized.length === 0 && local.length > 0) {
                for (const t of local) {
                    try {
                        // let server assign id; send title/description/status
                        await createServerTask({ title: t.title, description: t.description, status: t.status });
                    } catch (e) {
                        console.warn('Failed to migrate task to server', e);
                    }
                }
                const refreshed = await fetchServerTasks();
                if (refreshed && Array.isArray(refreshed)) {
                    const refreshedNorm = refreshed.map(s => ({ id: s.id || s.Id, title: s.title || s.Title || '', description: s.description || s.Description || '', status: s.status || s.Status || 'todo' }));
                    saveLocalTasks(refreshedNorm);
                    return refreshedNorm;
                }
            }

            saveLocalTasks(normalized);
            return normalized;
        }
        return local;
    }

    // local write helper used when server unavailable
    function saveTasksLocalOnly(tasks) {
        saveLocalTasks(tasks);
    }

    // Create task (try server, fallback local)
    async function addTask(title, description) {
        if (!title || !title.trim()) return;
        const newTask = { id: '', title: title.trim(), description: description ? description.trim() : '', status: 'todo' };
        const created = await createServerTask(newTask);
        if (created && created.id) {
            // use server-provided id
            const tasks = loadLocalTasks();
            tasks.push({ id: created.id, title: created.title || title.trim(), description: created.description || description || '', status: created.status || 'todo' });
            saveLocalTasks(tasks);
            await render();
            return;
        }
        // fallback: create locally
        const tasks = loadLocalTasks();
        const localTask = { id: uid(), title: newTask.title, description: newTask.description, status: newTask.status };
        tasks.push(localTask);
        saveLocalTasks(tasks);
        await render();
    }

    // Remove task (try server then local)
    async function removeTask(id) {
        const ok = await deleteServerTask(id);
        let tasks = loadLocalTasks();
        tasks = tasks.filter(t => t.id !== id);
        saveLocalTasks(tasks);
        if (ok) {
            // server removed too
        }
        await render();
    }

    // Update task (try server then local)
    async function saveEdit() {
        if (!currentEditId) return;
        const titleEl = document.getElementById('editTaskTitle');
        const descEl = document.getElementById('editTaskDesc');
        const title = titleEl ? titleEl.value : '';
        const desc = descEl ? descEl.value : '';
        if (!title || !title.trim()) return;
        const tasks = loadLocalTasks();
        const idx = tasks.findIndex(t => t.id === currentEditId);
        if (idx === -1) return;
        const updated = { ...tasks[idx], title: title.trim(), description: desc ? desc.trim() : '' };
        const ok = await updateServerTask({ id: updated.id, title: updated.title, description: updated.description, status: updated.status });
        // persist locally regardless
        tasks[idx] = updated;
        saveLocalTasks(tasks);
        await render();
        if (ok && editModalInstance) editModalInstance.hide();
        currentEditId = null;
    }

    // when dropping, update status and sync
    async function onDrop(e) {
        e.preventDefault();
        const id = e.dataTransfer.getData('text/plain');
        const column = e.currentTarget;
        const status = column.dataset.status;
        if (!id || !status) return;
        const tasks = loadLocalTasks();
        const idx = tasks.findIndex(t => t.id === id);
        if (idx === -1) return;
        tasks[idx].status = status;
        // try server update
        await updateServerTask({ id: tasks[idx].id, title: tasks[idx].title, description: tasks[idx].description, status: status });
        saveLocalTasks(tasks);
        column.classList.remove('drag-over');
        await render();
    }

    // Rendering
    function createCardElement(task) {
        const card = document.createElement('div');
        card.className = 'kanban-card mb-2 p-2 bg-white border rounded d-flex align-items-start justify-content-between';
        card.draggable = true;
        card.dataset.id = task.id;
        card.tabIndex = 0; // make focusable for keyboard actions

        const left = document.createElement('div');
        left.className = 'kanban-card-left';

        const title = document.createElement('div');
        title.textContent = task.title;
        title.className = 'kanban-card-title';

        left.appendChild(title);

        if (task.description) {
            const desc = document.createElement('div');
            desc.textContent = task.description;
            desc.className = 'kanban-card-desc text-muted';
            left.appendChild(desc);
        }

        const actions = document.createElement('div');
        actions.className = 'kanban-card-actions ms-2';

        const edit = document.createElement('button');
        edit.className = 'btn btn-sm btn-outline-secondary me-2';
        edit.type = 'button';
        edit.textContent = 'Edit';
        edit.addEventListener('click', (e) => {
            e.stopPropagation();
            openEditModal(task.id);
        });

        const del = document.createElement('button');
        del.className = 'btn btn-sm btn-outline-danger';
        del.type = 'button';
        del.textContent = 'Delete';
        del.addEventListener('click', (e) => {
            e.stopPropagation();
            removeTask(task.id);
        });

        actions.appendChild(edit);
        actions.appendChild(del);

        card.appendChild(left);
        card.appendChild(actions);

        card.addEventListener('dragstart', (e) => onDragStart(e, task.id));
        card.addEventListener('dragend', () => { card.classList.remove('dragging'); });
        card.addEventListener('dblclick', () => openEditModal(task.id));
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Delete') removeTask(task.id);
            if (e.key === 'Enter') openEditModal(task.id);
        });

        return card;
    }

    async function render() {
        const tasks = await loadTasks();
        const columns = document.querySelectorAll('.kanban-column');
        columns.forEach(col => col.innerHTML = '');

        tasks.forEach(task => {
            const col = document.querySelector(`.kanban-column[data-status="${task.status}"]`);
            if (col) col.appendChild(createCardElement(task));
        });
    }

    // modal helpers (existing)
    let editModalInstance = null;
    let currentEditId = null;

    function openEditModal(id) {
        const tasks = loadLocalTasks();
        const task = tasks.find(t => t.id === id);
        if (!task) return;
        const titleEl = document.getElementById('editTaskTitle');
        const descEl = document.getElementById('editTaskDesc');
        if (titleEl) titleEl.value = task.title;
        if (descEl) descEl.value = task.description || '';
        currentEditId = id;
        if (!editModalInstance) {
            const modalEl = document.getElementById('editTaskModal');
            if (modalEl && window.bootstrap && typeof window.bootstrap.Modal === 'function') {
                editModalInstance = new bootstrap.Modal(modalEl);
                modalEl.addEventListener('shown.bs.modal', () => {
                    const titleEl = document.getElementById('editTaskTitle');
                    if (titleEl) titleEl.focus();
                });
            }
        }
        if (editModalInstance) editModalInstance.show();
    }

    // drag handlers
    function onDragStart(e, id) {
        e.dataTransfer.setData('text/plain', id);
        e.dataTransfer.effectAllowed = 'move';
        e.currentTarget.classList.add('dragging');
    }

    function onDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        e.currentTarget.classList.add('drag-over');
    }

    function onDragLeave(e) {
        e.currentTarget.classList.remove('drag-over');
    }

    // initialization and wiring
    function wire() {
        const addBtn = document.getElementById('addTaskBtn');
        const input = document.getElementById('newTaskInput');
        const descInput = document.getElementById('newTaskDesc');
        const saveBtn = document.getElementById('saveTaskBtn');
        addBtn.addEventListener('click', async () => {
            await addTask(input.value, descInput ? descInput.value : '');
            input.value = '';
            if (descInput) descInput.value = '';
            input.focus();
        });
        input.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
                await addTask(input.value, descInput ? descInput.value : '');
                input.value = '';
                if (descInput) descInput.value = '';
            }
        });

        if (saveBtn) saveBtn.addEventListener('click', async () => await saveEdit());

        const columns = document.querySelectorAll('.kanban-column');
        columns.forEach(col => {
            col.addEventListener('dragover', onDragOver);
            col.addEventListener('dragleave', onDragLeave);
            col.addEventListener('drop', (e) => onDrop(e));
            col.addEventListener('dragend', () => {});
        });

        // Delegate dragend from document to ensure class removed when dropped outside
        document.addEventListener('dragend', () => {
            const dragging = document.querySelector('.dragging');
            if (dragging) dragging.classList.remove('dragging');
        });

        // try initial sync in background
        render();
    }

    // Initialize on DOM ready
    document.addEventListener('DOMContentLoaded', () => {
        wire();
    });
})();
