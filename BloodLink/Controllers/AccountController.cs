using Microsoft.AspNetCore.Mvc;

namespace BloodLink.Controllers
{
    public class AccountController : Controller
    {
        // GET: /Account/Login   (was login.html)
        public IActionResult Login()
        {
            return View();
        }

        // GET: /Account/Register   (was register.html)
        public IActionResult Register()
        {
            return View();
        }

        // GET: /Account/Profile   (was profile.html)
        public IActionResult Profile()
        {
            return View();
        }
    }
}
