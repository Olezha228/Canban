using Microsoft.EntityFrameworkCore;
using Canban.Models;

namespace Canban.Data
{
    public class CanbanContext : DbContext
    {
        public CanbanContext(DbContextOptions<CanbanContext> options) : base(options)
        {
        }

        public DbSet<TaskItem> Tasks { get; set; } = null!;
        public DbSet<Board> Boards { get; set; } = null!;
    }
}
