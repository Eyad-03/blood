using System.Diagnostics;
using BloodLink.Models;
using Microsoft.AspNetCore.Mvc;

namespace BloodLink.Controllers
{
    public class HomeController : Controller
    {
        // GET: /Home/Index   (was home.html)
        public IActionResult Index()
        {
            return View();
        }

        // GET: /Home/Ads   (was ads.html)
        public IActionResult Ads()
        {
            return View();
        }

        // GET: /Home/Report   (was report.html)
        public IActionResult Report()
        {
            return View();
        }

        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error()
        {
            return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
        }
    }
}
