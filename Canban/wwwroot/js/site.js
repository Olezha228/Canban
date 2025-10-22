// Please see documentation at https://learn.microsoft.com/aspnet/core/client-side/bundling-and-minification
// for details on configuring this project to bundle and minify static web assets.

// Write your JavaScript code.
(function () {
    const STORAGE_KEY = 'kanban.tasks.v1';

    function uid() {
        return 't-' + Math.random().toString(36).slice(2, 9);
    }

    function loadTasks() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.error('Failed to parse tasks from storage', e);
            return [];
        }
    }

    function saveTasks(tasks) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    }

    let editModalInstance = null;
    let currentEditId = null;

    function openEditModal(id) {
        const tasks = loadTasks();
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
                // focus title input when modal is shown
                modalEl.addEventListener('shown.bs.modal', () => {
                    const titleEl = document.getElementById('editTaskTitle');
                    if (titleEl) titleEl.focus();
                });
            }
        }
        if (editModalInstance) editModalInstance.show();
    }

    function saveEdit() {
        if (!currentEditId) return;
        const titleEl = document.getElementById('editTaskTitle');
        const descEl = document.getElementById('editTaskDesc');
        const title = titleEl ? titleEl.value : '';
        const desc = descEl ? descEl.value : '';
        if (!title || !title.trim()) return;
        const tasks = loadTasks();
        const idx = tasks.findIndex(t => t.id === currentEditId);
        if (idx === -1) return;
        tasks[idx].title = title.trim();
        tasks[idx].description = desc ? desc.trim() : '';
        saveTasks(tasks);
        render();
        if (editModalInstance) editModalInstance.hide();
        currentEditId = null;
    }

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
        card.addEventListener('dragend', (e) => onDragEnd(e));
        card.addEventListener('dblclick', () => openEditModal(task.id));
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Delete') removeTask(task.id);
            if (e.key === 'Enter') openEditModal(task.id);
        });

        return card;
    }

    function render() {
        const tasks = loadTasks();
        const columns = document.querySelectorAll('.kanban-column');
        columns.forEach(col => col.innerHTML = '');

        tasks.forEach(task => {
            const col = document.querySelector(`.kanban-column[data-status="${task.status}"]`);
            if (col) col.appendChild(createCardElement(task));
        });
    }

    function addTask(title, description) {
        if (!title || !title.trim()) return;
        const tasks = loadTasks();
        const task = { id: uid(), title: title.trim(), description: description ? description.trim() : '', status: 'todo' };
        tasks.push(task);
        saveTasks(tasks);
        render();
    }

    function removeTask(id) {
        let tasks = loadTasks();
        tasks = tasks.filter(t => t.id !== id);
        saveTasks(tasks);
        render();
    }

    function onDragStart(e, id) {
        e.dataTransfer.setData('text/plain', id);
        e.dataTransfer.effectAllowed = 'move';
        e.currentTarget.classList.add('dragging');
    }

    function onDragEnd(e) {
        e.currentTarget.classList.remove('dragging');
    }

    function onDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        e.currentTarget.classList.add('drag-over');
    }

    function onDragLeave(e) {
        e.currentTarget.classList.remove('drag-over');
    }

    function onDrop(e) {
        e.preventDefault();
        const id = e.dataTransfer.getData('text/plain');
        const column = e.currentTarget;
        const status = column.dataset.status;
        if (!id || !status) return;
        const tasks = loadTasks();
        const idx = tasks.findIndex(t => t.id === id);
        if (idx === -1) return;
        tasks[idx].status = status;
        saveTasks(tasks);
        column.classList.remove('drag-over');
        render();
    }

    function wire() {
        const addBtn = document.getElementById('addTaskBtn');
        const input = document.getElementById('newTaskInput');
        const descInput = document.getElementById('newTaskDesc');
        const saveBtn = document.getElementById('saveTaskBtn');
        addBtn.addEventListener('click', () => {
            addTask(input.value, descInput ? descInput.value : '');
            input.value = '';
            if (descInput) descInput.value = '';
            input.focus();
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                addTask(input.value, descInput ? descInput.value : '');
                input.value = '';
                if (descInput) descInput.value = '';
            }
        });

        if (saveBtn) saveBtn.addEventListener('click', saveEdit);

        const columns = document.querySelectorAll('.kanban-column');
        columns.forEach(col => {
            col.addEventListener('dragover', onDragOver);
            col.addEventListener('dragleave', onDragLeave);
            col.addEventListener('drop', onDrop);
            col.addEventListener('dragend', (e) => onDragEnd(e));
        });

        // Delegate dragend from document to ensure class removed when dropped outside
        document.addEventListener('dragend', () => {
            const dragging = document.querySelector('.dragging');
            if (dragging) dragging.classList.remove('dragging');
        });
    }

    // Initialize on DOM ready
    document.addEventListener('DOMContentLoaded', () => {
        wire();
        render();
    });
})();
