using Microsoft.AspNetCore.Mvc;

namespace BloodLink.Controllers
{
    public class AdminController : Controller
    {
        // GET: /Admin/Index   (was admin.html)
        public IActionResult Index()
        {
            return View();
        }
    }
}
