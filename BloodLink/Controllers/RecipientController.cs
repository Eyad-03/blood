using Microsoft.AspNetCore.Mvc;

namespace BloodLink.Controllers
{
    public class RecipientController : Controller
    {
        // GET: /Recipient/Requests   (was bloodRequests.html)
        public IActionResult Requests()
        {
            return View();
        }
    }
}
