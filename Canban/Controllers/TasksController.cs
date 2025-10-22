using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Canban.Data;
using Canban.Models;

namespace Canban.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TasksController : ControllerBase
    {
        private readonly CanbanContext _context;

        public TasksController(CanbanContext context)
        {
            _context = context;
        }

        // GET: api/tasks?boardId=...
        [HttpGet]
        public async Task<ActionResult<IEnumerable<TaskItem>>> GetTasks([FromQuery] string? boardId)
        {
            if (string.IsNullOrEmpty(boardId))
            {
                var tasks = await _context.Tasks.AsNoTracking().ToListAsync();
                return Ok(tasks);
            }
            var filtered = await _context.Tasks.AsNoTracking().Where(t => t.BoardId == boardId).ToListAsync();
            return Ok(filtered);
        }

        // GET: api/tasks/{id}
        [HttpGet("{id}")]
        public async Task<ActionResult<TaskItem>> GetTask(string id)
        {
            var task = await _context.Tasks.FindAsync(id);
            if (task == null) return NotFound();
            return Ok(task);
        }

        // POST: api/tasks
        [HttpPost]
        public async Task<ActionResult<TaskItem>> CreateTask(TaskItem item)
        {
            if (string.IsNullOrWhiteSpace(item.Id)) item.Id = Guid.NewGuid().ToString();
            if (string.IsNullOrWhiteSpace(item.Title)) return BadRequest("Title is required");
            // BoardId may be null if task not associated yet
            _context.Tasks.Add(item);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetTask), new { id = item.Id }, item);
        }

        // PUT: api/tasks/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateTask(string id, TaskItem item)
        {
            if (id != item.Id) return BadRequest();
            var exists = await _context.Tasks.AnyAsync(t => t.Id == id);
            if (!exists) return NotFound();
            // Attach and mark modified to preserve BoardId/title/description/status
            _context.Entry(item).State = EntityState.Modified;
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // DELETE: api/tasks/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteTask(string id)
        {
            var task = await _context.Tasks.FindAsync(id);
            if (task == null) return NotFound();
            _context.Tasks.Remove(task);
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}
