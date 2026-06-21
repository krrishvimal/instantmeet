# 🚀 InstantMeet - Production Deployment Guide

This guide provides step-by-step instructions for deploying **InstantMeet** to production using **Railway** (for the Node.js WebSocket backend) and **Vercel** (for the React Vite frontend).

---

## 🛰️ Step 1: Deploy the Backend on Railway

Railway is the recommended host for Node.js WebSocket servers because it natively supports persistent WebSocket connections and auto-assigns ports.

1. Go to [Railway.app](https://railway.app/) and log in (or create an account).
2. Click **New Project** -> **Deploy from GitHub repository**.
3. Select your `instantmeet` repository.
4. Under the repository configurations:
   * **Root Directory:** Select the `backend` folder.
5. Go to the project's **Variables** tab and click **New Variable**:
   * Add `CORS_ORIGIN` with the value `*` *(We will restrict this to your exact frontend domain in Step 3 for security).*
6. Click **Deploy**.
7. Once deployed, go to the **Settings** tab, scroll down to the **Environment** section, and click **Generate Domain**.
8. Copy the generated domain URL (it will look like `https://your-api.up.railway.app`).

---

## 💻 Step 2: Deploy the Frontend on Vercel

Vercel is the recommended host for React applications due to its global CDN, speed, and simple integration.

1. Go to [Vercel.com](https://vercel.com/) and log in.
2. Click **Add New** -> **Project**.
3. Select your `instantmeet` repository from the list.
4. In the configuration options:
   * **Framework Preset:** Vite
   * **Root Directory:** Select the `frontend` folder.
5. Expand the **Environment Variables** section and add:
   * **Name:** `VITE_SOCKET_URL`
   * **Value:** `https://your-api.up.railway.app` *(The backend URL you copied from Railway in Step 1)*
6. Click **Deploy**.
7. Once the build finishes, Vercel will give you a live production URL (e.g., `https://instantmeet.vercel.app`). **Copy this URL.**

---

## 🔒 Step 3: Secure CORS on the Backend

Now that your frontend is live, you should restrict backend CORS access to only allow your domain.

1. Open your **Railway** dashboard.
2. Go to the **Variables** tab of your backend service.
3. Edit the `CORS_ORIGIN` variable:
   * Change `*` to `https://instantmeet.vercel.app` *(Your Vercel production frontend URL)*.
4. Save the variable. Railway will automatically redeploy the backend in seconds.

---

## 💡 Linux VPS Self-Managed Deployment Tip

If you choose to host the backend on a self-managed Linux VPS (e.g., DigitalOcean, AWS EC2, or Linode) rather than Railway:

1. **Increase Open File Limits:** Linux defaults to `1024` open files per process. For 5,000+ concurrent WebSocket users, run:
   ```bash
   ulimit -n 65536
   ```
2. **Persistent Configuration:** Add these lines to `/etc/security/limits.conf`:
   ```text
   * soft nofile 65536
   * hard nofile 65536
   ```
3. **Systemd configuration:** If using systemd, add `LimitNOFILE=65536` under the `[Service]` block of your service file.
*(Note: The server has built-in diagnostics that will print a warning in your logs if you run on Linux with low limits).*

---

## 🧪 Post-Deployment Verification Checklist

Once deployed, verify the setup works correctly:
1. Open your production frontend URL.
2. Verify the server indicator dot in the top right shows **"Server Live"** (Green).
3. Open a second tab (or access the site from a mobile phone) and register.
4. Search nearby and verify both nodes show up on the discovery radar.
5. Connect an anonymous chat and verify messages send and receive in real-time.
