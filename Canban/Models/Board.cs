using System.ComponentModel.DataAnnotations;
using System.Collections.Generic;
using System;

namespace Canban.Models
{
    public class Board
    {
        [Key]
        public string Id { get; set; } = string.Empty;

        [Required]
        public string Name { get; set; } = string.Empty;

        // Order position for arranging boards
        public int Order { get; set; } = 0;

        // Creation timestamp
        public DateTime CreatedDateTime { get; set; } = DateTime.UtcNow;

        // Collection of tasks belonging to this board
        public ICollection<TaskItem> Tasks { get; set; } = new List<TaskItem>();
    }
}
