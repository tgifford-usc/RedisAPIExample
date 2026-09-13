# Exercise: a key/value API on Express + Redis

This exercise demonstrates creating a simple REST API with a database backend, and deploying it to Vercel.
```
Browser / curl ──GET /api/greeting──────────────▶ Express on Vercel ──GET──▶ Redis
Browser / curl ──PUT /api/greeting {value: "hi"}─▶ Express on Vercel ──SET──▶ Redis
```

**Why a database?** Vercel does not have any persistent memory. If you want to have any data that remains after your web request (for example messages to send between people) you need to attach it to a database. We will use Redis. Think of Redis as a big JavaScript object that lives on the internet: if you run `redis.set('greeting', 'hi')` and then you (or someone else) runs `redis.get('greeting')`, it should respond with `'hi'`.

## The API

| Request | What it does | Response |
|---|---|---|
| `GET /api/greeting` | Reads whatever is stored under the key `greeting` | `{ "key": "greeting", "value": "hi" }`, or `404` with `{ "error": "…" }` if nothing is stored |
| `PUT /api/greeting` with JSON body `{ "value": "hi" }` | Stores `"hi"` under the key `greeting` (overwriting anything already there) | `{ "key": "greeting", "value": "hi" }` |

`greeting` can be any word; the key name is taken from the URL. The value can be any JSON: a string, a number, an object, a list.

## What's in this repository

| File | What it is |
|---|---|
| `index.js` | The whole app: an Express server with the two routes above |
| `test.http` | Ready-made requests for testing the API from VS Code |
| `package.json` | Lists the two dependencies (`express`, `@upstash/redis`) and the `npm run dev` command |
| `.gitignore` | Keeps `node_modules/` and `.env.local` out of git |
| `.env.local` | **You create this** (Step 2). Holds your database credentials. Never committed. |

## Step 1: Create the database

1. Sign up at [upstash.com](https://upstash.com) (free, GitHub login works).
2. **Create Database**. Give it a name, pick the region closest to you (Sydney), leave everything else at its default.
3. On the database's Details page, under **Connect → REST**, copy the two values, `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

The token is a password. Don't commit it to git!

## Step 2: Run it on your laptop

Start by cloning or downloading this repository (**Code → Download ZIP** on GitHub is simplest: in Step 4 you'll be pushing it to a repository of your own, and a downloaded copy isn't tied to this one). Then in the repository root folder run

```
npm install
```

This reads `package.json` and installs `express` and `@upstash/redis` into `node_modules/`.

Create `.env.local` in the project folder, containing the two lines you copied from Upstash:

```
UPSTASH_REDIS_REST_URL=https://…
UPSTASH_REDIS_REST_TOKEN=…
```

`.gitignore` already lists `node_modules/` and `.env.local`, so neither can be committed by accident.

Now start the server:

```
npm run dev
```

Open <http://localhost:3000/api/greeting>. You should get a `404` with `{"error":"Nothing stored under \"greeting\""}`. That's correct: the database is empty.

A browser's address bar can only do `GET`, so to store something you need another tool. The easiest is the **REST Client** extension in VS Code (by Huachao Mao). Open [test.http](test.http): it contains a ready-made request for every route, including the `PUT`. Leave the server running, click **Send Request** above the first `PUT`, and the response opens beside it.

If you'd rather not use VS Code for this, the browser console works too (visit `localhost:3000` and then open developer tools, and type the following into the console):

```js
await fetch('/api/greeting', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ value: 'hello' })
}).then(r => r.json())
```

Either way, now reload <http://localhost:3000/api/greeting> and the value is there. Stop the server, start it again, reload: still there. It's in the database, not in your program. You can also see it in the **Data Browser** tab on Upstash.

Work down the rest of `test.http`: it stores an object instead of a string, reads a key that doesn't exist, and sends two badly-formed `PUT`s. Look at the status code and error message each one gives back.

## Step 3: Read the code

Everything is in [index.js](index.js); it's about 50 lines. Compared with the Hello World Express app, the new parts are:

```js
import { Redis } from '@upstash/redis'
const redis = Redis.fromEnv()   // reads the two UPSTASH_ variables from the environment

app.use(express.json())          // turns a JSON request body into req.body

app.get('/api/:key', async (req, res) => {
  const value = await redis.get(req.params.key)   // :key in the route → req.params.key
  …
})

app.put('/api/:key', async (req, res) => {
  await redis.set(req.params.key, req.body.value)
  …
})
```

Things to notice:

- `:key` in a route is a **placeholder**. `/api/greeting` and `/api/score` both match it, and Express puts the actual word in `req.params.key`. (You don't type the colon in a URL; it's only in the route definition.)
- Talking to the database takes time, so the handlers are `async` and `await` each Redis call.
- The routes check their input and reply with an error code (`404` when there's nothing stored, `400` when the body is wrong) rather than crashing. Whoever calls your API can see what went wrong.
- The last `app.use(…)` is an error handler. Anything that throws (a malformed JSON body, the database being unreachable) ends up there and comes back as JSON.

`package.json` defines the command you ran in Step 2:

```json
"scripts": {
  "dev": "node --env-file=.env.local index.js"
}
```

`--env-file` is built into Node (20.6 and later): it loads `.env.local` into `process.env`, which is where `Redis.fromEnv()` looks. On Vercel there is no `.env.local`; the same two variables come from the project settings instead, which is the extra step in deploying.

## Step 4: Deploy

1. Create a new, empty repository on GitHub under your own account, and push this folder to it, the same way you did for your Express app. Before you push, check that `.env.local` is **not** in the list of files being committed.
2. On [vercel.com](https://vercel.com), **Add New → Project**, import the repo, and deploy.
3. Open your `https://YOUR-PROJECT.vercel.app/api/greeting`. It will fail with a `500` error, because Vercel doesn't have your database credentials: `.env.local` is only on your laptop.
4. In the Vercel project, go to **Settings → Environment Variables** and add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` with the same values as your `.env.local`.
5. **Redeploy** (Deployments → ⋯ on the latest one → Redeploy). Environment variables only take effect on a fresh deployment; this is the step everyone forgets.
6. Open `/api/greeting` again. If you stored a value in Step 2, it's there: same database.

To test the `PUT` on the deployed version, change the `@host` line at the top of `test.http` to your Vercel address and send the requests again.

## If it doesn't work

| Symptom | Cause |
|---|---|
| `{"error":"Failed to parse URL from /pipeline"}` | The app can't see `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`. Locally: is `.env.local` in the project folder, and did you start with `npm run dev`? On Vercel: did you add both variables **and redeploy**? The server log (your terminal, or Vercel → Deployments → the deployment → Logs) says which variable is missing. |
| `{"error":"WRONGPASS invalid or missing auth token…"}` | The token is wrong or incomplete. Copy it again from Upstash. |
| `Cannot GET /api` or an HTML 404 page | The URL doesn't match a route. Routes are `/api/` followed by a single word. |
| `PUT` gives `400` "Send a JSON body like…" | The body isn't `{ "value": … }`, or the `Content-Type: application/json` header is missing. |
| `npm run dev` says `Cannot find package 'express'` | You skipped `npm install`, or ran it in the wrong folder. |

## Going further

Each of these is a few lines:

- **Delete.** Add `app.delete('/api/:key', …)` using `redis.del(key)`. What should it return if the key didn't exist?
- **List.** Add `GET /api` that returns all the keys, using `redis.keys('*')`. (Fine for an exercise; not something you'd do on a database with a million keys.)
- **A counter.** `redis.incr('visits')` adds one and returns the new number, safely even if two people hit it at once. Add a route that counts how many times it's been called.
- **Expiry.** `redis.set(key, value, { ex: 60 })` makes the value disappear after 60 seconds. Useful for anything temporary.
- **A page that uses it.** Serve an HTML page from `/` with a text box that `PUT`s to the API on a button press and `GET`s on load. You've now built the smallest possible web app with a backend.
