using Canban.Controllers;
using Canban.Data;
using Canban.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Canban.UnitTests.Controller
{
    [TestFixture]
    public class TasksControllerTests
    {
        private CanbanContext _context = null!;
        private TasksController _controller = null!;

        [SetUp]
        public void Setup()
        {
            var options = new DbContextOptionsBuilder<CanbanContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options;

            _context = new CanbanContext(options);
            _controller = new TasksController(_context);
        }

        [TearDown]
        public void TearDown()
        {
            _context.Database.EnsureDeleted();
            _context.Dispose();
        }

        [Test]
        public async Task GetTasks_ReturnsAllTasks_WhenNoBoardId()
        {
            var task1 = new TaskItem { Id = "1", Title = "Task 1", BoardId = "1" };
            var task2 = new TaskItem { Id = "2", Title = "Task 2", BoardId = "2" };
            _context.Tasks.AddRange(task1, task2);
            await _context.SaveChangesAsync();

            var result = await _controller.GetTasks(null);
            var okResult = (OkObjectResult)result.Result!;
            var tasks = (List<TaskItem>)okResult.Value!;

            Assert.That(tasks.Count, Is.EqualTo(2));
        }

        [Test]
        public async Task GetTasks_ReturnsFilteredTasks_WhenBoardIdProvided()
        {
            var task1 = new TaskItem { Id = "1", Title = "Task 1", BoardId = "1" };
            var task2 = new TaskItem { Id = "2", Title = "Task 2", BoardId = "2" };
            _context.Tasks.AddRange(task1, task2);
            await _context.SaveChangesAsync();

            var result = await _controller.GetTasks("1");
            var okResult = (OkObjectResult)result.Result!;
            var tasks = (List<TaskItem>)okResult.Value!;

            Assert.That(tasks.Count, Is.EqualTo(1));
            Assert.That(tasks[0].BoardId, Is.EqualTo("1"));
        }

        [Test]
        public async Task GetTask_ReturnsTask_WhenExists()
        {
            var task = new TaskItem { Id = "1", Title = "Task 1" };
            _context.Tasks.Add(task);
            await _context.SaveChangesAsync();

            var result = await _controller.GetTask("1");
            var okResult = (OkObjectResult)result.Result!;
            var returnedTask = (TaskItem)okResult.Value!;

            Assert.That(returnedTask.Id, Is.EqualTo("1"));
            Assert.That(returnedTask.Title, Is.EqualTo("Task 1"));
        }

        [Test]
        public async Task GetTask_ReturnsNotFound_WhenNotExists()
        {
            var result = await _controller.GetTask("nonexistent");
            Assert.That(result.Result, Is.TypeOf<NotFoundResult>());
        }

        [Test]
        public async Task CreateTask_CreatesTask_WithValidData()
        {
            var newTask = new TaskItem { Title = "New Task", BoardId = "1" };

            var result = await _controller.CreateTask(newTask);
            var createdAtResult = (CreatedAtActionResult)result.Result!;
            var createdTask = (TaskItem)createdAtResult.Value!;

            Assert.NotNull(createdTask);
            Assert.That(createdTask.Title, Is.EqualTo("New Task"));

            var inDb = await _context.Tasks.FindAsync(createdTask.Id);
            Assert.NotNull(inDb);
        }

        [Test]
        public async Task CreateTask_ReturnsBadRequest_WhenTitleIsEmpty()
        {
            var newTask = new TaskItem { Title = "" };

            var result = await _controller.CreateTask(newTask);
            Assert.That(result.Result, Is.TypeOf<BadRequestObjectResult>());
        }

        [Test]
        public async Task UpdateTask_UpdatesTask_WhenExists()
        {
            var task = new TaskItem { Id = "1", Title = "Old Title", BoardId = "1" };
            _context.Tasks.Add(task);
            await _context.SaveChangesAsync();

            task.Title = "Updated Title";
            var result = await _controller.UpdateTask("1", task);

            Assert.That(result, Is.TypeOf<NoContentResult>());

            var dbTask = await _context.Tasks.FindAsync("1");
            Assert.That(dbTask!.Title, Is.EqualTo("Updated Title"));
        }

        [Test]
        public async Task UpdateTask_ReturnsBadRequest_WhenIdMismatch()
        {
            var updatedTask = new TaskItem { Id = "1", Title = "Updated Title" };
            var result = await _controller.UpdateTask("2", updatedTask);
            Assert.That(result, Is.TypeOf<BadRequestResult>());
        }

        [Test]
        public async Task UpdateTask_ReturnsNotFound_WhenNotExists()
        {
            var updatedTask = new TaskItem { Id = "nonexistent", Title = "Updated" };
            var result = await _controller.UpdateTask("nonexistent", updatedTask);
            Assert.That(result, Is.TypeOf<NotFoundResult>());
        }

        [Test]
        public async Task DeleteTask_DeletesTask_WhenExists()
        {
            var task = new TaskItem { Id = "1", Title = "Task" };
            _context.Tasks.Add(task);
            await _context.SaveChangesAsync();

            var result = await _controller.DeleteTask("1");
            Assert.That(result, Is.TypeOf<NoContentResult>());

            var dbTask = await _context.Tasks.FindAsync("1");
            Assert.Null(dbTask);
        }

        [Test]
        public async Task DeleteTask_ReturnsNotFound_WhenNotExists()
        {
            var result = await _controller.DeleteTask("nonexistent");
            Assert.That(result, Is.TypeOf<NotFoundResult>());
        }
    }
}
