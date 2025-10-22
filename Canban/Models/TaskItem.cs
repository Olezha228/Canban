using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

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

        // Board relationship (nullable for backward-compatibility until you create a migration)
        public string? BoardId { get; set; }
        
        [JsonIgnore]
        public Board? Board { get; set; }
    }
}
