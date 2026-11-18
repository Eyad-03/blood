using Microsoft.AspNetCore.Mvc;

namespace BloodLink.Controllers
{
    public class HallController : Controller
    {
        // GET: /Hall/Index   (was hall.html)
        public IActionResult Index()
        {
            return View();
        }

        // GET: /Hall/Requests   (was hallRequests.html)
        public IActionResult Requests()
        {
            return View();
        }
    }
}
