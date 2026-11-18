using Microsoft.AspNetCore.Mvc;

namespace BloodLink.Controllers
{
    public class DonorController : Controller
    {
        // GET: /Donor/Search   (was donorSearch.html)
        public IActionResult Search()
        {
            return View();
        }

        // GET: /Donor/Donate   (was donate.html)
        public IActionResult Donate()
        {
            return View();
        }

        // GET: /Donor/Requests   (was donorRequests.html)
        public IActionResult Requests()
        {
            return View();
        }

        // GET: /Donor/Appointments   (was donorAppointments.html)
        public IActionResult Appointments()
        {
            return View();
        }
    }
}
