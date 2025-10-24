// Please see documentation at https://learn.microsoft.com/aspnet/core/client-side/bundling-and-minification
// for details on configuring this project to bundle and minify static web assets.

// Write your JavaScript code.
(function () {
    const BOARDS_KEY = 'kanban.boards.v1';
    const SELECTED_BOARD_KEY = 'kanban.selectedBoardId.v1';
    const API_BOARDS = '/api/boards';
    const API_TASKS = '/api/tasks';

    function uid() { return 't-' + Math.random().toString(36).slice(2, 9); }

    // Local storage helpers
    function saveLocalBoards(boards) { try { localStorage.setItem(BOARDS_KEY, JSON.stringify(boards)); } catch (e) { console.error(e); } }
    function loadLocalBoards() { try { const raw = localStorage.getItem(BOARDS_KEY); return raw ? JSON.parse(raw) : []; } catch (e) { console.error(e); return []; } }
    function getSelectedBoardId() { try { return localStorage.getItem(SELECTED_BOARD_KEY); } catch (e) { return null; } }
    function setSelectedBoardId(id) { try { if (id) localStorage.setItem(SELECTED_BOARD_KEY, id); else localStorage.removeItem(SELECTED_BOARD_KEY); } catch (e) { } }

    // Server helpers
    async function fetchServerBoards() { try { const res = await fetch(API_BOARDS); if (!res.ok) throw new Error('Network'); return await res.json(); } catch (e) { console.warn('fetchServerBoards failed', e); return null; } }
    async function createServerBoard(board) { try { const res = await fetch(API_BOARDS, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(board) }); if (!res.ok) throw new Error('Create board failed'); return await res.json(); } catch (e) { console.warn(e); return null; } }
    async function updateServerBoard(board) { try { const res = await fetch(`${API_BOARDS}/${encodeURIComponent(board.id)}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(board) }); return res.ok; } catch (e) { console.warn(e); return false; } }
    async function deleteServerBoard(id) { try { const res = await fetch(`${API_BOARDS}/${encodeURIComponent(id)}`, { method: 'DELETE' }); return res.ok; } catch (e) { console.warn(e); return false; } }

    async function createServerTask(task) { try { const res = await fetch(API_TASKS, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(task) }); if (!res.ok) throw new Error('Create task failed'); return await res.json(); } catch (e) { console.warn(e); return null; } }
    async function updateServerTask(task) { try { const res = await fetch(`${API_TASKS}/${encodeURIComponent(task.id)}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(task) }); return res.ok; } catch (e) { console.warn(e); return false; } }
    async function deleteServerTask(id) { try { const res = await fetch(`${API_TASKS}/${encodeURIComponent(id)}`, { method: 'DELETE' }); return res.ok; } catch (e) { console.warn(e); return false; } }

    // Load boards (try server first, else local)
    async function loadBoards() {
        const local = loadLocalBoards();
        const server = await fetchServerBoards();
        if (server && Array.isArray(server)) {
            // normalize server shape and ensure CreatedDateTime parsed
            const normalized = server.map(b => ({ id: b.id || b.Id, name: b.name || b.Name || '', created: b.createdDateTime || b.CreatedDateTime || b.created || b.Created || null, tasks: (b.tasks || b.Tasks || []).map(t => ({ id: t.id || t.Id, title: t.title || t.Title || '', description: t.description || t.Description || '', status: t.status || t.Status || 'todo', priority: t.priority || t.Priority || 'Medium', boardId: b.id || b.Id })) }));

            // parse created into Date
            normalized.forEach(nb => { nb.created = nb.created ? new Date(nb.created) : new Date(); });

            // if server empty and local has data, migrate local to server (best-effort)
            if (normalized.length === 0 && local.length > 0) {
                for (const lb of local) {
                    const created = await createServerBoard({ name: lb.name });
                    if (created && created.id) {
                        for (const t of lb.tasks || []) {
                            await createServerTask({ title: t.title, description: t.description, status: t.status, priority: t.priority || 'Medium', boardId: created.id });
                        }
                    }
                }
                const refreshed = await fetchServerBoards();
                if (refreshed && Array.isArray(refreshed)) {
                    const refNorm = refreshed.map(b => ({ id: b.id || b.Id, name: b.name || b.Name || '', created: b.createdDateTime || b.CreatedDateTime || b.created || b.Created || null, tasks: (b.tasks || b.Tasks || []).map(t => ({ id: t.id || t.Id, title: t.title || t.Title || '', description: t.description || t.Description || '', status: t.status || t.Status || 'todo', priority: t.priority || t.Priority || 'Medium', boardId: b.id || b.Id })) }));
                    refNorm.forEach(nb => { nb.created = nb.created ? new Date(nb.created) : new Date(); });
                    saveLocalBoards(refNorm);
                    return refNorm;
                }
            }
            saveLocalBoards(normalized);
            return normalized;
        }
        // ensure local boards have created field and tasks have priority
        local.forEach(lb => { if (!lb.created) lb.created = new Date(); else lb.created = new Date(lb.created); (lb.tasks||[]).forEach(t => { if (!t.priority) t.priority = 'Medium'; }); });
        return local;
    }

    // Sidebar population
    function populateBoardsList(boards) {
        const list = document.getElementById('boardsList'); if (!list) return;
        list.innerHTML = '';
        if (!boards || boards.length === 0) { list.innerHTML = '<div class="text-muted">No boards</div>'; return; }

        // sort by created desc (newest first)
        boards.sort((a,b) => new Date(b.created) - new Date(a.created));

        const selected = getSelectedBoardId();

        boards.forEach(b => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
            item.dataset.id = b.id;
            item.textContent = b.name;

            if (selected === b.id) item.classList.add('active');

            item.addEventListener('click', async () => {
                setSelectedBoardId(b.id);
                // re-render UI showing only selected board
                await refreshAndRender();
            });

            // meta (created date)
            const meta = document.createElement('small'); meta.className = 'text-muted ms-2';
            const d = new Date(b.created);
            meta.textContent = d.toLocaleString();
            item.appendChild(meta);

            list.appendChild(item);
        });
    }

    // Rendering of main board area (renders only selected board if provided)
    function createCardElement(task) {
        const card = document.createElement('div');
        card.className = 'kanban-card mb-2 p-2 bg-white border rounded d-flex align-items-start justify-content-between';
        card.draggable = true; card.dataset.id = task.id; card.tabIndex = 0;

        const left = document.createElement('div'); left.className = 'kanban-card-left';

        // priority badge
        const priority = (task.priority || task.Priority || 'Medium').toString();
        const badge = document.createElement('span');
        badge.className = 'badge me-2 ' + (priority === 'High' ? 'bg-danger' : (priority === 'Low' ? 'bg-secondary' : 'bg-warning text-dark'));
        badge.textContent = priority;
        left.appendChild(badge);

        const title = document.createElement('div'); title.textContent = task.title; title.className = 'kanban-card-title'; left.appendChild(title);
        if (task.description) { const desc = document.createElement('div'); desc.textContent = task.description; desc.className = 'kanban-card-desc text-muted'; left.appendChild(desc); }

        const actions = document.createElement('div'); actions.className = 'kanban-card-actions ms-2';
        const edit = document.createElement('button'); edit.className = 'btn btn-sm btn-outline-secondary me-2'; edit.type='button'; edit.textContent='Edit'; edit.addEventListener('click', (e)=>{e.stopPropagation(); openEditModal(task.id);});
        const del = document.createElement('button'); del.className='btn btn-sm btn-outline-danger'; del.type='button'; del.textContent='Delete'; del.addEventListener('click', (e)=>{ e.stopPropagation(); removeTask(task.id); });
        actions.appendChild(edit); actions.appendChild(del);

        card.appendChild(left); card.appendChild(actions);

        card.addEventListener('dragstart', (e)=> onDragStart(e, task.id));
        card.addEventListener('dragend', ()=> card.classList.remove('dragging'));
        card.addEventListener('dblclick', ()=> openEditModal(task.id));
        card.addEventListener('keydown', (e)=>{ if (e.key==='Delete') removeTask(task.id); if (e.key==='Enter') openEditModal(task.id); });
        return card;
    }

    function createColumnElement(boardId, status) {
        const col = document.createElement('div'); col.className='kanban-column'; col.dataset.status=status; col.dataset.board=boardId;
        col.addEventListener('dragover', onDragOver); col.addEventListener('dragleave', onDragLeave); col.addEventListener('drop', (e)=> onDrop(e));
        return col;
    }

    function renderBoards(boards) {
        const container = document.getElementById('boardsContainer'); if (!container) return; container.innerHTML='';
        if (!boards || boards.length === 0) { container.textContent = 'No boards yet.'; return; }

        const selected = getSelectedBoardId();
        let toRender = boards;
        if (selected) {
            const b = boards.find(x => x.id === selected);
            if (b) toRender = [b]; else toRender = [];
        }

        toRender.forEach(board=>{
            const boardEl = document.createElement('div'); boardEl.className='mb-4 board';
            const header = document.createElement('div'); header.className='d-flex align-items-center mb-2';
            const title = document.createElement('h4'); title.textContent=board.name; title.className='me-3';
            const renameBtn = document.createElement('button'); renameBtn.className='btn btn-sm btn-outline-secondary me-2'; renameBtn.textContent='Rename'; renameBtn.addEventListener('click', ()=> renameBoardPrompt(board.id));
            const delBoardBtn = document.createElement('button'); delBoardBtn.className='btn btn-sm btn-outline-danger'; delBoardBtn.textContent='Delete board'; delBoardBtn.addEventListener('click', ()=> deleteBoard(board.id));
            header.appendChild(title); header.appendChild(renameBtn); header.appendChild(delBoardBtn);

            const addRow = document.createElement('div'); addRow.className='d-flex gap-2 mb-2';
            const newTaskInput = document.createElement('input'); newTaskInput.className='form-control'; newTaskInput.placeholder='New task title';
            const newTaskDesc = document.createElement('input'); newTaskDesc.className='form-control'; newTaskDesc.placeholder='Optional description';
            // priority select for new task
            const newTaskPriority = document.createElement('select'); newTaskPriority.className = 'form-select';
            ['Low','Medium','High'].forEach(p=>{ const o = document.createElement('option'); o.value = p; o.textContent = p; if (p === 'Medium') o.selected = true; newTaskPriority.appendChild(o); });
            const addTaskBtn = document.createElement('button'); addTaskBtn.className='btn btn-primary'; addTaskBtn.textContent='Add'; addTaskBtn.addEventListener('click', async ()=>{ await addTaskToBoard(board.id, newTaskInput.value, newTaskDesc.value, newTaskPriority.value); newTaskInput.value=''; newTaskDesc.value=''; newTaskPriority.value='Medium'; });
            addRow.appendChild(newTaskInput); addRow.appendChild(newTaskDesc); addRow.appendChild(newTaskPriority); addRow.appendChild(addTaskBtn);

            const colsWrap = document.createElement('div'); colsWrap.className='row kanban-board';
            ['todo','inprogress','done'].forEach(status=>{
                const colWrap = document.createElement('div'); colWrap.className='col-12 col-md-4 mb-3';
                const h = document.createElement('h5'); h.textContent = status==='todo'?'To Do': status==='inprogress'?'In Progress':'Done';
                const col = createColumnElement(board.id, status); col.id = `col-${board.id}-${status}`; colWrap.appendChild(h); colWrap.appendChild(col); colsWrap.appendChild(colWrap);
            });

            boardEl.appendChild(header); boardEl.appendChild(addRow); boardEl.appendChild(colsWrap); container.appendChild(boardEl);
            (board.tasks||[]).forEach(task=>{ const col = document.querySelector(`.kanban-column[data-board="${board.id}"][data-status="${task.status}"]`); if (col) col.appendChild(createCardElement(task)); });
        });
    }

    // Board operations
    async function addBoard(name) {
        if (!name||!name.trim()) return;
        const created = await createServerBoard({ name: name.trim() });
        const boards = loadLocalBoards();
        if (created && created.id) {
            // server returns created board including CreatedDateTime when available
            boards.push({ id: created.id, name: created.name||name.trim(), created: created.createdDateTime || created.CreatedDateTime || new Date(), tasks: (created.tasks||[]).map(t=>({ id: t.id||t.Id, title: t.title||t.Title, description: t.description||t.Description, status: t.status||t.Status||'todo', priority: t.priority || t.Priority || 'Medium', boardId: created.id })) });
            saveLocalBoards(boards);
            setSelectedBoardId(created.id);
            await refreshAndRender();
            return;
        }
        const localBoard = { id: uid(), name: name.trim(), created: new Date(), tasks: [] };
        boards.push(localBoard);
        saveLocalBoards(boards);
        setSelectedBoardId(localBoard.id);
        await refreshAndRender();
    }

    async function deleteBoard(id) { if (!confirm('Delete this board and all its tasks?')) return; await deleteServerBoard(id); let boards = loadLocalBoards(); boards = boards.filter(b=>b.id!==id); saveLocalBoards(boards); // adjust selected if needed
        const sel = getSelectedBoardId(); if (sel === id) { if (boards.length) setSelectedBoardId(boards[0].id); else setSelectedBoardId(null); }
        await refreshAndRender(); }
    async function renameBoardPrompt(id) { const boards = loadLocalBoards(); const b = boards.find(x=>x.id===id); if(!b) return; const newName = prompt('New board name', b.name); if(!newName) return; b.name = newName.trim(); await updateServerBoard({ id: b.id, name: b.name }); saveLocalBoards(boards); await refreshAndRender(); }

    // Task operations
    async function addTaskToBoard(boardId, title, description, priority) {
        if (!title||!title.trim()) return;
        const created = await createServerTask({ id:'', title: title.trim(), description: description?description.trim():'', status: 'todo', priority: priority || 'Medium', boardId });
        const boards = loadLocalBoards(); const board = boards.find(b=>b.id===boardId); if(!board) return;
        if (created && created.id) { board.tasks.push({ id: created.id, title: created.title||title.trim(), description: created.description||description||'', status: created.status||'todo', priority: created.priority || created.Priority || 'Medium', boardId }); saveLocalBoards(boards); await refreshAndRender(); return; }
        const localTask = { id: uid(), title: title.trim(), description: description?description.trim():'', status: 'todo', priority: priority || 'Medium', boardId }; board.tasks.push(localTask); saveLocalBoards(boards); await refreshAndRender();
    }

    async function deleteBoard(id) { if (!confirm('Delete this board and all its tasks?')) return; await deleteServerBoard(id); let boards = loadLocalBoards(); boards = boards.filter(b=>b.id!==id); saveLocalBoards(boards); // adjust selected if needed
        const sel = getSelectedBoardId(); if (sel === id) { if (boards.length) setSelectedBoardId(boards[0].id); else setSelectedBoardId(null); }
        await refreshAndRender(); }
    async function renameBoardPrompt(id) { const boards = loadLocalBoards(); const b = boards.find(x=>x.id===id); if(!b) return; const newName = prompt('New board name', b.name); if(!newName) return; b.name = newName.trim(); await updateServerBoard({ id: b.id, name: b.name }); saveLocalBoards(boards); await refreshAndRender(); }

    async function updateTaskInLocal(task) { const boards = loadLocalBoards(); for (const b of boards) { const idx = (b.tasks||[]).findIndex(t=>t.id===task.id); if (idx !== -1) { b.tasks[idx] = task; saveLocalBoards(boards); return; } } }

    async function removeTask(id) { await deleteServerTask(id); const boards = loadLocalBoards(); for (const b of boards) b.tasks = (b.tasks||[]).filter(t=>t.id!==id); saveLocalBoards(boards); await refreshAndRender(); }

    // Edit modal
    let editModalInstance = null; let currentEditId = null;
    function openEditModal(id) { const boards = loadLocalBoards(); let found=null; for(const b of boards){ const t=(b.tasks||[]).find(x=>x.id===id); if(t){ found=t; break; } } if(!found) return; const titleEl=document.getElementById('editTaskTitle'); const descEl=document.getElementById('editTaskDesc'); const prEl=document.getElementById('editTaskPriority'); if(titleEl) titleEl.value=found.title; if(descEl) descEl.value=found.description||''; if(prEl) prEl.value = found.priority || found.Priority || 'Medium'; currentEditId=id; if(!editModalInstance){ const modalEl=document.getElementById('editTaskModal'); if(modalEl && window.bootstrap && typeof window.bootstrap.Modal==='function'){ editModalInstance = new bootstrap.Modal(modalEl); modalEl.addEventListener('shown.bs.modal', ()=>{ const t=document.getElementById('editTaskTitle'); if(t) t.focus(); }); } } if(editModalInstance) editModalInstance.show(); }

    async function saveEdit() { if(!currentEditId) return; const titleEl=document.getElementById('editTaskTitle'); const descEl=document.getElementById('editTaskDesc'); const prEl=document.getElementById('editTaskPriority'); const title = titleEl?titleEl.value:''; const desc = descEl?descEl.value:''; const priority = prEl?prEl.value:'Medium'; if(!title||!title.trim()) return; const boards = loadLocalBoards(); let updated=null; for(const b of boards){ const idx = (b.tasks||[]).findIndex(t=>t.id===currentEditId); if(idx!==-1){ b.tasks[idx].title = title.trim(); b.tasks[idx].description = desc.trim(); b.tasks[idx].priority = priority; updated = b.tasks[idx]; break; } } if(!updated) return; await updateServerTask({ id: updated.id, title: updated.title, description: updated.description, status: updated.status, priority: updated.priority, boardId: updated.boardId }); saveLocalBoards(boards); if(editModalInstance) editModalInstance.hide(); currentEditId=null; await refreshAndRender(); }

    // Drag & drop
    function onDragStart(e, id){ e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed='move'; e.currentTarget.classList.add('dragging'); }
    function onDragOver(e){ e.preventDefault(); e.dataTransfer.dropEffect='move'; e.currentTarget.classList.add('drag-over'); }
    function onDragLeave(e){ e.currentTarget.classList.remove('drag-over'); }
    async function onDrop(e){ e.preventDefault(); const taskId = e.dataTransfer.getData('text/plain'); const col = e.currentTarget; const newStatus = col.dataset.status; const targetBoard = col.dataset.board; if(!taskId||!newStatus) return; const boards = loadLocalBoards(); let moved=null; for(const b of boards){ const idx=(b.tasks||[]).findIndex(t=>t.id===taskId); if(idx!==-1){ moved = b.tasks.splice(idx,1)[0]; break; } } if(!moved) return; moved.status=newStatus; moved.boardId = targetBoard || moved.boardId; const dest = boards.find(b=>b.id===moved.boardId); if(dest) dest.tasks.push(moved); await updateServerTask({ id: moved.id, title: moved.title, description: moved.description, status: moved.status, priority: moved.priority || 'Medium', boardId: moved.boardId }); saveLocalBoards(boards); col.classList.remove('drag-over'); await refreshAndRender(); }

    // Refresh
    async function refreshAndRender(){ const boards = await loadBoards(); populateBoardsList(boards); const selected = getSelectedBoardId() || (boards.length ? boards[0].id : null); if (!getSelectedBoardId() && selected) setSelectedBoardId(selected); renderBoards(boards); }

    // Wire UI
    function wire(){ const addBoardBtn = document.getElementById('addBoardBtn'); const newBoardName = document.getElementById('newBoardName'); if(addBoardBtn) addBoardBtn.addEventListener('click', async ()=>{ await addBoard(newBoardName.value); newBoardName.value=''; }); const saveBtn = document.getElementById('saveTaskBtn'); if(saveBtn) saveBtn.addEventListener('click', async ()=> await saveEdit()); refreshAndRender(); }

    document.addEventListener('DOMContentLoaded', ()=> wire());
})();
