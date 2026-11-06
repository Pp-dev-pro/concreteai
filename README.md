# ConcreteAI Web (yellow/black)

client/            index.html, style.css, script.js, images/   -> Catalyst Web Client Hosting
functions_java/    ConcreteProxy.java                          -> Catalyst Advanced I/O function (Java) named `concrete_proxy`

## Why a proxy?
Your QuickML endpoint needs a secret key and an OAuth token that expires every hour. If these are placed in
HTML/JS, anyone can copy them, and the browser would also be blocked by CORS. The Java function holds them as
environment variables and the page only calls /server/concrete_proxy/predict.

## Steps
1. catalyst init, then add an Advanced I/O Java function named `concrete_proxy` and paste ConcreteProxy.java
   (main class: ConcreteProxy). Set the environment variables listed at the top of the file.
2. Create a Self Client in api-console.zoho.in, scope QuickML.deployment.READ, generate a refresh token.
3. Put the `client` folder contents in your Catalyst client directory.
4. catalyst deploy. Open the client URL and press PREDICT.
5. Photos: edit the TEAM array at the top of script.js to swap names/photos.

IMPORTANT: the endpoint key was visible in your screenshot. Regenerate it in QuickML before deploying.
