# AI Factory Deployment on Render.com

This repository contains a React application. The project is bundled into the `dist` directory and served with a small Express server. The following steps describe how to run the app locally and deploy it on [Render](https://render.com).

## Local development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Build the React project (replace the command with your actual build process if different):
   ```bash
   npm run build
   ```
3. Start the production server:
   ```bash
   npm start
   ```
   The application will be available at `http://localhost:3000`.

## Deploying to Render.com

Render can automatically build and run the project using the provided `render.yaml` configuration.

1. Push this repository to your own GitHub account.
2. Log in to [Render](https://dashboard.render.com/) and create a **New Web Service** from your repository.
3. Render will detect the `render.yaml` file and pre‑configure the service. Verify that the build command and start command match your setup (`npm run build` and `npm start`).
4. Click **Create Web Service**. Render will install dependencies, build the React app, and start the Express server.
5. Once the build is finished, Render will provide a public URL where the app is hosted.

If you need to change the build or start commands, edit `render.yaml` accordingly and commit the changes.
