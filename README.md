# Stockroom Frontend

React product inventory client for the LavaLust API. The browser sends authenticated HTTP requests to the API; it does not connect to MySQL.

## Local development

Start the LavaLust API from `../backend` with `php lava serve`. Install dependencies, copy `.env.example` to `.env`, and set `VITE_API_URL` to the backend URL when using a non-default API address. The default Vite proxy targets `http://127.0.0.1:3000`.

```sh
npm install
npm run dev
```

The first visit offers administrator setup only while the API reports that its `users` table is empty. After setup, sign in to list, add, edit, and delete products.

## Deployment

Set `VITE_API_URL` to the deployed LavaLust service URL in the frontend host's build environment. Rebuild and deploy the static Vite output. Set the backend's `CORS_ORIGIN` to the frontend's exact origin.

```sh
npm run lint
npm run build
```
