const server = Bun.serve({
  port: process.env.PORT ? Number(process.env.PORT) : 49152,
  routes: {
    "/": () => fileResponse("./index.html", "text/html; charset=utf-8"),
    "/index.html": () => fileResponse("./index.html", "text/html; charset=utf-8"),
    "/src/styles.css": () => fileResponse("./src/styles.css", "text/css; charset=utf-8"),
    "/src/app.js": () => fileResponse("./src/app.bundle.js", "text/javascript; charset=utf-8"),
  },
});

function fileResponse(path: string, contentType: string) {
  return new Response(Bun.file(path), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
    },
  });
}

console.log(`Calorimetria demo: ${server.url}`);
