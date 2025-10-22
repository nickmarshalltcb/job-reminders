# Flycast Marketing - Reminder Dashboard

A professional reminder dashboard for tracking job production deadlines and sending automated email reminders.

## Features

- 🔐 Secure authentication with Supabase
- 📊 Job tracking with deadline monitoring
- 📧 Automated email reminders (9:00 AM PKT)
- ⏰ Smart snooze functionality
- 📱 Responsive dark mode design
- 🎨 Enterprise-grade UI/UX
- 📤 Import/Export job data
- 🔍 Advanced search and filtering
- 📈 Real-time statistics dashboard

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```bash
cp .env.example .env
```

Edit `.env` and add your Supabase project details:
```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Supabase Database Setup

Create a table named `jobs` with the following schema:

```sql
CREATE TABLE jobs (
  id BIGSERIAL PRIMARY KEY,
  job_number TEXT NOT NULL UNIQUE,
  client_name TEXT NOT NULL,
  forwarding_date DATE NOT NULL,
  production_deadline DATE NOT NULL,
  status TEXT NOT NULL,
  reminder_sent BOOLEAN DEFAULT FALSE,
  snoozed_until DATE,
  last_reminder_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Enable all access for authenticated users" ON jobs
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
```

### 4. Run Development Server

```bash
npm run dev
```

The app will open at `http://localhost:3000`

## Building for Production

```bash
npm run build
```

The production-ready files will be in the `dist/` folder.

## Deployment

This project is configured for Netlify deployment. The `netlify.toml` file is already set up.

### Deploy to Netlify:

1. Push your code to a Git repository
2. Connect your repository to Netlify
3. Add environment variables in Netlify dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy!

## Email Configuration

To enable email reminders:

1. Click "Settings" in the top navigation
2. Fill in the email configuration:
   - **To**: Recipient email address
   - **From**: Your Gmail address
   - **Password**: Gmail App Password ([Generate here](https://support.google.com/accounts/answer/185833))
3. Enable automated reminders
4. Save configuration

Reminders are sent daily at 9:00 AM Pakistan Time (PKT).

## Tech Stack

- ⚡ Vite
- ⚛️ React 18
- 🎨 Tailwind CSS
- 🗄️ Supabase (Auth + Database)
- 🔔 React Icons
- 📱 Responsive Design

## Security

- ✅ Environment variables for sensitive data
- ✅ Row Level Security (RLS) enabled
- ✅ Secure authentication
- ✅ No credentials in source code

## Support

For issues or questions, contact Flycast Marketing support.

---

**Version:** 1.0.0  
**Last Updated:** 2025

