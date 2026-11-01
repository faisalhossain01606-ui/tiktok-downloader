import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

const app = express();
const port = process.env.PORT || 3000;

app.use(helmet());
app.use(express.json({ limit: "2kb" }));
app.use(express.static("public"));

app.use("/api/", rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false
}));

function validateTikTokUrl(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  const allowedHosts = new Set(["tiktok.com", "www.tiktok.com", "m.tiktok.com"]);

  if (url.protocol !== "https:" || !allowedHosts.has(host)) return null;
  if (!/^\/@[^/]+\/video\/\d+\/?$/.test(url.pathname)) return null;

  return `https://www.tiktok.com${url.pathname}`;
}

app.post("/api/preview", async (req, res) => {
  const videoUrl = validateTikTokUrl(req.body?.url);
  if (!videoUrl) {
    return res.status(400).json({ error: "Enter a valid public TikTok video URL." });
  }

  try {
    const endpoint = new URL("https://www.tiktok.com/oembed");
    endpoint.searchParams.set("url", videoUrl);

    const response = await fetch(endpoint, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000)
    });

    if (!response.ok) {
      return res.status(502).json({
        error: "TikTok could not provide a preview for this video."
      });
    }

    const data = await response.json();

    res.json({
      title: data.title || "TikTok video",
      author: data.author_name || "",
      thumbnail: data.thumbnail_url || "",
      embedHtml: data.html || ""
    });
  } catch {
    res.status(502).json({ error: "Preview request failed. Try again later." });
  }
});

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
