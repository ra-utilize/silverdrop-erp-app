# Silver Drop ERP — web pages

Front end only (GitHub Pages). All data and security live in Supabase
(row level security); nothing secret is stored here.

- `js/config.js` holds the Supabase project URL and the **publishable** key
  (safe to be public). Never put the service_role / secret key here.
- Database migrations are kept separately (not in this repo).
