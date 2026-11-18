using Microsoft.AspNetCore.Mvc;

namespace BloodLink.Controllers
{
    public class HospitalController : Controller
    {
        // GET: /Hospital/Index   (was hospital.html)
        public IActionResult Index()
        {
            return View();
        }
    }
}
