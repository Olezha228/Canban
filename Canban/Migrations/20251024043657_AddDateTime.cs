using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Canban.Migrations
{
    /// <inheritdoc />
    public partial class AddDateTime : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedDateTime",
                table: "Boards",
                type: "TEXT",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<int>(
                name: "Order",
                table: "Boards",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);
            
            migrationBuilder.Sql("UPDATE Boards SET CreatedDateTime = CURRENT_TIMESTAMP");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CreatedDateTime",
                table: "Boards");

            migrationBuilder.DropColumn(
                name: "Order",
                table: "Boards");
        }
    }
}
