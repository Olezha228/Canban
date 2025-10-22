using System.ComponentModel.DataAnnotations;
using System.Collections.Generic;

namespace Canban.Models
{
    public class Board
    {
        [Key]
        public string Id { get; set; } = string.Empty;

        [Required]
        public string Name { get; set; } = string.Empty;

        // Collection of tasks belonging to this board
        public ICollection<TaskItem> Tasks { get; set; } = new List<TaskItem>();
    }
}
