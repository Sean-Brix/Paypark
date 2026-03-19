
  # Pay-Park

  This is a code bundle for Pay-Park. The original project is available at https://www.figma.com/design/4R4kFnDbfg718bsumuO0g9/Pay-Park.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## PWA install (Windows 11)

  This app is configured as a Progressive Web App (PWA), so it can be installed from supported browsers.

  1. Start the app (`npm run dev`) for local testing, or deploy it over HTTPS.
  2. Open the app in Chrome or Edge.
  3. Use the browser install action (for example, the install icon in the address bar or menu) to install it as an app.

  Notes:
  - Install prompts generally require `https://` in production, but `http://localhost` works for local development.
  - PWA assets are generated during build by `vite-plugin-pwa`.
  