using Canban.Controllers;
using Canban.Data;
using Canban.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Canban.UnitTests.Controller;

[TestFixture]
public class BoardsControllerTests
{
    private CanbanContext _context = null!;
    private BoardsController _controller = null!;

    [SetUp]
    public void Setup()
    {
        var options = new DbContextOptionsBuilder<CanbanContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        _context = new CanbanContext(options);
        _controller = new BoardsController(_context);
    }

    [TearDown]
    public void TearDown()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
    }

    [Test]
    public async Task GetBoards_ReturnsEmptyList_WhenNoBoards()
    {
        var result = await _controller.GetBoards();
        Assert.That(result.Result, Is.TypeOf<OkObjectResult>());
        var okResult = (OkObjectResult)result.Result!;
        var boards = okResult.Value as IEnumerable<Board>;
        Assert.NotNull(boards);
        Assert.IsEmpty(boards!);
    }

    [Test]
    public async Task GetBoards_ReturnsBoardsOrderedByCreatedDateTimeDesc()
    {
        var board1 = new Board { Id = "1", Name = "First", CreatedDateTime = DateTime.UtcNow.AddDays(-1) };
        var board2 = new Board { Id = "2", Name = "Second", CreatedDateTime = DateTime.UtcNow };
        _context.Boards.AddRange(board1, board2);
        await _context.SaveChangesAsync();

        var result = await _controller.GetBoards();
        var okResult = (OkObjectResult)result.Result!;
        var boards = okResult.Value as List<Board>;

        Assert.That(boards!.Count, Is.EqualTo(2));
        Assert.That(boards[0].Id, Is.EqualTo("2"));
        Assert.That(boards[1].Id, Is.EqualTo("1"));
    }

    [Test]
    public async Task GetBoard_ReturnsBoard_WhenExists()
    {
        var board = new Board { Id = "1", Name = "Board1", CreatedDateTime = DateTime.UtcNow };
        _context.Boards.Add(board);
        await _context.SaveChangesAsync();

        var result = await _controller.GetBoard("1");
        var okResult = (OkObjectResult)result.Result!;
        var returnedBoard = okResult.Value as Board;

        Assert.NotNull(returnedBoard);
        Assert.That(returnedBoard!.Id, Is.EqualTo("1"));
    }

    [Test]
    public async Task GetBoard_ReturnsNotFound_WhenNotExists()
    {
        var result = await _controller.GetBoard("nonexistent");
        Assert.That(result.Result, Is.TypeOf<NotFoundResult>());
    }

    [Test]
    public async Task CreateBoard_CreatesBoard_WithValidData()
    {
        var newBoard = new Board { Name = "New Board" };

        var result = await _controller.CreateBoard(newBoard);
        var createdAtResult = (CreatedAtActionResult)result.Result!;
        var createdBoard = createdAtResult.Value as Board;

        Assert.NotNull(createdBoard);
        Assert.That(createdBoard!.Name, Is.EqualTo("New Board"));

        var inDb = await _context.Boards.FindAsync(createdBoard.Id);
        Assert.NotNull(inDb);
        Assert.That(inDb!.Order, Is.EqualTo(0));
        Assert.That(inDb.CreatedDateTime, Is.Not.EqualTo(default(DateTime)));
    }

    [Test]
    public async Task CreateBoard_ReturnsBadRequest_WhenNameIsEmpty()
    {
        var newBoard = new Board { Name = "" };

        var result = await _controller.CreateBoard(newBoard);
        Assert.That(result.Result, Is.TypeOf<BadRequestObjectResult>());
    }

    [Test]
    public async Task UpdateBoard_UpdatesBoard_WhenExists()
    {
        var board = new Board { Id = "1", Name = "Old Name" };
        _context.Boards.Add(board);
        await _context.SaveChangesAsync();

        var updatedBoard = new Board { Id = "1", Name = "New Name" };
        var result = await _controller.UpdateBoard("1", updatedBoard);

        Assert.That(result, Is.TypeOf<NoContentResult>());

        var dbBoard = await _context.Boards.FindAsync("1");
        Assert.That(dbBoard!.Name, Is.EqualTo("New Name"));
    }

    [Test]
    public async Task UpdateBoard_ReturnsBadRequest_WhenIdMismatch()
    {
        var board = new Board { Id = "1", Name = "Board" };
        var updatedBoard = new Board { Id = "2", Name = "New Name" };
        var result = await _controller.UpdateBoard("1", updatedBoard);
        Assert.That(result, Is.TypeOf<BadRequestResult>());
    }

    [Test]
    public async Task UpdateBoard_ReturnsNotFound_WhenNotExists()
    {
        var updatedBoard = new Board { Id = "nonexistent", Name = "New Name" };
        var result = await _controller.UpdateBoard("nonexistent", updatedBoard);
        Assert.That(result, Is.TypeOf<NotFoundResult>());
    }

    [Test]
    public async Task DeleteBoard_DeletesBoardAndTasks_WhenExists()
    {
        var board = new Board { Id = "1", Name = "Board" };
        var task1 = new TaskItem { Id = "t1", BoardId = "1", Title = "Task1" };
        var task2 = new TaskItem { Id = "t2", BoardId = "1", Title = "Task2" };
        _context.Boards.Add(board);
        _context.Tasks.AddRange(task1, task2);
        await _context.SaveChangesAsync();

        var result = await _controller.DeleteBoard("1");
        Assert.That(result, Is.TypeOf<NoContentResult>());

        var dbBoard = await _context.Boards.FindAsync("1");
        Assert.Null(dbBoard);

        var dbTasks = await _context.Tasks.Where(t => t.BoardId == "1").ToListAsync();
        Assert.IsEmpty(dbTasks);
    }

    [Test]
    public async Task DeleteBoard_ReturnsNotFound_WhenNotExists()
    {
        var result = await _controller.DeleteBoard("nonexistent");
        Assert.That(result, Is.TypeOf<NotFoundResult>());
    }
}