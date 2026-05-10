import { Router } from "express";
import { getPool } from "../db.js";
import { nanoid } from "../utils.js";

const router = Router();

const BLOG_PASSWORD = process.env.BLOG_PASSWORD || "TriTech1122@$%";

function requireBlogAuth(req, res, next) {
  const key = req.headers["x-blog-password"] || req.query.blogPassword;
  if (key !== BLOG_PASSWORD) return res.status(401).json({ success: false, error: "Unauthorized" });
  next();
}

function formatPost(p) {
  return {
    id: p.id, title: p.title, slug: p.slug, excerpt: p.excerpt,
    content: p.content, category: p.category, author: p.author,
    published: p.published, coverColor: p.cover_color,
    imageUrl: p.image_url, publishedAt: p.published_at,
    readingTime: p.reading_time, createdAt: p.created_at,
  };
}

// GET /api/blog — public
router.get("/", async (req, res) => {
  const pool = getPool();
  const { rows } = await pool.query("SELECT * FROM blog_posts WHERE published = TRUE ORDER BY published_at DESC");
  res.json({ success: true, posts: rows.map(formatPost) });
});

// GET /api/blog/all — admin
router.get("/all", requireBlogAuth, async (req, res) => {
  const pool = getPool();
  const { rows } = await pool.query("SELECT * FROM blog_posts ORDER BY created_at DESC");
  res.json({ success: true, posts: rows.map(formatPost) });
});

// GET /api/blog/:slug — public
router.get("/:slug", async (req, res) => {
  const pool = getPool();
  const { rows } = await pool.query("SELECT * FROM blog_posts WHERE slug = $1", [req.params.slug]);
  if (!rows[0]) return res.status(404).json({ success: false, error: "Post not found" });
  res.json({ success: true, post: formatPost(rows[0]) });
});

// POST /api/blog — admin
router.post("/", requireBlogAuth, async (req, res) => {
  const { title, slug, excerpt, content, category, author, published, coverColor, imageUrl, publishedAt, readingTime } = req.body;
  if (!title?.trim() || !content?.trim()) return res.status(400).json({ success: false, error: "Title and content required" });

  const pool = getPool();
  const id = nanoid();
  const words = content.trim().split(/\s+/).length;
  const rt = readingTime || Math.max(1, Math.round(words / 200));

  await pool.query(
    "INSERT INTO blog_posts (id, title, slug, excerpt, content, category, author, published, cover_color, image_url, published_at, reading_time) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
    [id, title.trim(), slug || title.toLowerCase().replace(/[^a-z0-9]+/g, "-"), excerpt || "", content.trim(), category || "General", author || "TriTech Forge Team", !!published, coverColor || "from-blue-600 to-indigo-800", imageUrl || null, publishedAt || new Date().toISOString().slice(0, 10), rt]
  );

  const { rows } = await pool.query("SELECT * FROM blog_posts WHERE id = $1", [id]);
  res.status(201).json({ success: true, post: formatPost(rows[0]) });
});

// PUT /api/blog/:id — admin
router.put("/:id", requireBlogAuth, async (req, res) => {
  const pool = getPool();
  const { rows: existing } = await pool.query("SELECT * FROM blog_posts WHERE id = $1", [req.params.id]);
  if (!existing[0]) return res.status(404).json({ success: false, error: "Post not found" });

  const p = existing[0];
  const { title, slug, excerpt, content, category, author, published, coverColor, imageUrl, publishedAt, readingTime } = req.body;
  const newContent = content ?? p.content;
  const words = newContent.trim().split(/\s+/).length;
  const rt = readingTime ?? Math.max(1, Math.round(words / 200));

  await pool.query(
    "UPDATE blog_posts SET title=$1, slug=$2, excerpt=$3, content=$4, category=$5, author=$6, published=$7, cover_color=$8, image_url=$9, published_at=$10, reading_time=$11, updated_at=NOW() WHERE id=$12",
    [title ?? p.title, slug ?? p.slug, excerpt ?? p.excerpt, newContent, category ?? p.category, author ?? p.author, published !== undefined ? !!published : p.published, coverColor ?? p.cover_color, imageUrl !== undefined ? imageUrl : p.image_url, publishedAt ?? p.published_at, rt, req.params.id]
  );

  const { rows } = await pool.query("SELECT * FROM blog_posts WHERE id = $1", [req.params.id]);
  res.json({ success: true, post: formatPost(rows[0]) });
});

// DELETE /api/blog/:id — admin
router.delete("/:id", requireBlogAuth, async (req, res) => {
  const pool = getPool();
  const { rows } = await pool.query("SELECT id FROM blog_posts WHERE id = $1", [req.params.id]);
  if (!rows[0]) return res.status(404).json({ success: false, error: "Post not found" });
  await pool.query("DELETE FROM blog_posts WHERE id = $1", [req.params.id]);
  res.json({ success: true, message: "Post deleted" });
});

export default router;
