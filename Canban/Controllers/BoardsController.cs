using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Canban.Data;
using Canban.Models;
using Microsoft.Data.Sqlite;

namespace Canban.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class BoardsController : ControllerBase
    {
        private readonly CanbanContext _context;

        public BoardsController(CanbanContext context)
        {
            _context = context;
        }

        // GET: api/boards
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Board>>> GetBoards()
        {
            try
            {
                var boards = await _context.Boards
                    .Include(b => b.Tasks)
                    .OrderByDescending(b => EF.Property<DateTime>(b, nameof(Board.CreatedDateTime)))
                    .AsNoTracking()
                    .ToListAsync();
                return Ok(boards);
            }
            catch (SqliteException)
            {
                // Schema might not exist yet (developer will apply migrations manually)
                return Ok(new List<Board>());
            }
        }

        // GET api/boards/{id}
        [HttpGet("{id}")]
        public async Task<ActionResult<Board>> GetBoard(string id)
        {
            try
            {
                var board = await _context.Boards.Include(b => b.Tasks).FirstOrDefaultAsync(b => b.Id == id);
                if (board == null) return NotFound();
                return Ok(board);
            }
            catch (SqliteException)
            {
                return NotFound();
            }
        }

        // POST api/boards
        [HttpPost]
        public async Task<ActionResult<Board>> CreateBoard(Board board)
        {
            if (string.IsNullOrWhiteSpace(board.Id)) board.Id = Guid.NewGuid().ToString();
            if (string.IsNullOrWhiteSpace(board.Name)) return BadRequest("Name is required");

            // ensure CreatedDateTime is set
            if (board.CreatedDateTime == default) board.CreatedDateTime = DateTime.UtcNow;

            // set Order to end of list (kept for backward compatibility)
            var maxOrder = await _context.Boards.MaxAsync(b => (int?)EF.Property<int?>(b, nameof(Board.Order))) ?? -1;
            board.Order = maxOrder + 1;

            _context.Boards.Add(board);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetBoard), new { id = board.Id }, board);
        }

        // PUT api/boards/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateBoard(string id, Board board)
        {
            if (id != board.Id) return BadRequest();
            var existing = await _context.Boards.FirstOrDefaultAsync(b => b.Id == id);
            if (existing == null) return NotFound();

            if (!string.IsNullOrWhiteSpace(board.Name)) existing.Name = board.Name;

            await _context.SaveChangesAsync();
            return NoContent();
        }

        // DELETE api/boards/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteBoard(string id)
        {
            var board = await _context.Boards.Include(b => b.Tasks).FirstOrDefaultAsync(b => b.Id == id);
            if (board == null) return NotFound();
            // Remove related tasks if any
            if (board.Tasks != null && board.Tasks.Any())
            {
                _context.Tasks.RemoveRange(board.Tasks);
            }
            _context.Boards.Remove(board);
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}
