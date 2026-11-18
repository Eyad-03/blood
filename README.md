# BloodLink — ASP.NET Core MVC

The BloodLink front end as an ASP.NET Core MVC project (.NET 8), ready to open in Visual Studio.
The back end (database, login, APIs) is not built yet. All data is still the demo data in the JavaScript files.

## Run it

1. Open `BloodLink.sln` in Visual Studio 2022 (17.8 or newer) or Visual Studio 2026.
2. Press **F5** (or Ctrl+F5).

Or from a terminal:

```bash
dotnet run --project BloodLink
```

## Layout

```
BloodLink.sln
BloodLink/
  Controllers/      one controller per area (Home, Account, Donor, Recipient, Hall, Hospital, Admin)
  Views/            one .cshtml per page (full page, Layout = null, same HTML as before)
  Models/
  wwwroot/
    css/            the original stylesheets, unchanged
    js/             the original scripts (only the page links changed)
    images/
  Program.cs
```

## Old page → new URL

| Old file                 | New URL                | Controller / View                     |
|--------------------------|------------------------|---------------------------------------|
| home.html                | `/`                    | Home / Index                          |
| ads.html                 | `/Home/Ads`            | Home / Ads                            |
| report.html              | `/Home/Report`         | Home / Report                         |
| login.html               | `/Account/Login`       | Account / Login                       |
| register.html            | `/Account/Register`    | Account / Register                    |
| profile.html             | `/Account/Profile`     | Account / Profile                     |
| donorSearch.html         | `/Donor/Search`        | Donor / Search                        |
| donate.html              | `/Donor/Donate`        | Donor / Donate                        |
| donorRequests.html       | `/Donor/Requests`      | Donor / Requests                      |
| donorAppointments.html   | `/Donor/Appointments`  | Donor / Appointments                  |
| bloodRequests.html       | `/Recipient/Requests`  | Recipient / Requests                  |
| hall.html                | `/Hall`                | Hall / Index                          |
| hallRequests.html        | `/Hall/Requests`       | Hall / Requests                       |
| hospital.html            | `/Hospital`            | Hospital / Index                      |
| admin.html               | `/Admin`               | Admin / Index                         |

## Note on Razor

Inside `.cshtml` files the `@` sign is Razor syntax, so a literal `@` is written `@@`
(for example `you@@example.com`). It still shows as a single `@` in the browser.
