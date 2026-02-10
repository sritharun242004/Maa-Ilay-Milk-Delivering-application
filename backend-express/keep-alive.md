# Keep Render Instance Alive

## Option 1: Use a free service like Cron-Job.org
1. Go to https://cron-job.org
2. Create account and add a job
3. Set URL: https://your-backend.onrender.com/health
4. Set interval: Every 10 minutes
5. This keeps your instance awake

## Option 2: Render Cron Job (if available in your plan)
Add to render.yaml:
```yaml
services:
  - type: web
    name: maa-ilay-backend
    env: node
    buildCommand: npm install && npm run build
    startCommand: npm start
    
  - type: cron
    name: keep-alive
    schedule: "*/10 * * * *"  # Every 10 minutes
    command: curl https://your-backend.onrender.com/health
```

## Option 3: Upgrade to Paid Plan ($7/month)
- No cold starts
- Always online
- Better performance
