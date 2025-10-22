using System.ComponentModel.DataAnnotations;

namespace Canban.Models
{
    public class TaskItem
    {
        [Key]
        public string Id { get; set; } = string.Empty;

        [Required]
        public string Title { get; set; } = string.Empty;

        public string? Description { get; set; }

        public string Status { get; set; } = "todo";
    }
}

