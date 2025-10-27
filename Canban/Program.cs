using Canban.Data;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddRazorPages();
builder.Services.AddControllers();

// Configure DbContext: prefer Postgres (ConnectionStrings:Postgres or env POSTGRES_CONNECTION), fall back to SQLite
builder.Services.AddDbContext<CanbanContext>(options => options.UseNpgsql("Host=db;Port=5432;Database=canban;Username=canban;Password=canbanpw"));

var app = builder.Build();

// Apply migrations on startup (uses EF Core Migrations)
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<CanbanContext>();
    try
    {
        Console.WriteLine("Applying pending EF Core migrations (if any)...");
        db.Database.Migrate();
        Console.WriteLine("Database migrations applied.");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Failed to apply migrations: {ex.Message}");
    }
}

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseRouting();

app.UseAuthorization();

app.MapControllers();
app.MapRazorPages();

app.Run();