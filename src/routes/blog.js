import { Router } from "express";
import { getDb } from "../db.js";
import { nanoid } from "../utils.js";

const router = Router();

// ─── Simple blog admin auth middleware ───────────────────
const BLOG_PASSWORD = process.env.BLOG_PASSWORD || "TriTech1122@$%";

function requireBlogAuth(req, res, next) {
  const key = req.headers["x-blog-password"] || req.query.blogPassword;
  if (key !== BLOG_PASSWORD) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  next();
}

// GET /api/blog — get all published posts (public)
router.get("/", (req, res) => {
  const db = getDb();
  const posts = (db.data.blogPosts || [])
    .filter(p => p.published)
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  res.json({ success: true, posts });
});

// GET /api/blog/all — get all posts including drafts (admin only)
router.get("/all", requireBlogAuth, (req, res) => {
  const db = getDb();
  const posts = (db.data.blogPosts || [])
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  res.json({ success: true, posts });
});

// GET /api/blog/:slug — get single post by slug (public)
router.get("/:slug", (req, res) => {
  const db = getDb();
  const post = (db.data.blogPosts || []).find(p => p.slug === req.params.slug);
  if (!post) return res.status(404).json({ success: false, error: "Post not found" });
  res.json({ success: true, post });
});

// POST /api/blog — create new post (admin only)
router.post("/", requireBlogAuth, async (req, res) => {
  const { title, slug, excerpt, content, category, author, published, coverColor, imageUrl, publishedAt, readingTime } = req.body;

  if (!title?.trim() || !content?.trim()) {
    return res.status(400).json({ success: false, error: "Title and content are required" });
  }

  const db = getDb();
  if (!db.data.blogPosts) db.data.blogPosts = [];

  // Check slug uniqueness
  const existing = db.data.blogPosts.find(p => p.slug === slug);
  if (existing) {
    return res.status(400).json({ success: false, error: "A post with this slug already exists" });
  }

  const post = {
    id: nanoid(),
    title: title.trim(),
    slug: slug || title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    excerpt: excerpt || "",
    content: content.trim(),
    category: category || "General",
    author: author || "TriTech Forge Team",
    published: !!published,
    coverColor: coverColor || "from-blue-600 to-indigo-800",
    imageUrl: imageUrl || null,
    publishedAt: publishedAt || new Date().toISOString().split("T")[0],
    readingTime: readingTime || Math.max(1, Math.round(content.trim().split(/\s+/).length / 200)),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.data.blogPosts.push(post);
  await db.write();

  res.status(201).json({ success: true, post });
});

// PUT /api/blog/:id — update post (admin only)
router.put("/:id", requireBlogAuth, async (req, res) => {
  const db = getDb();
  if (!db.data.blogPosts) db.data.blogPosts = [];

  const post = db.data.blogPosts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ success: false, error: "Post not found" });

  const { title, slug, excerpt, content, category, author, published, coverColor, imageUrl, publishedAt, readingTime } = req.body;

  if (title !== undefined) post.title = title;
  if (slug !== undefined) post.slug = slug;
  if (excerpt !== undefined) post.excerpt = excerpt;
  if (content !== undefined) {
    post.content = content;
    post.readingTime = Math.max(1, Math.round(content.trim().split(/\s+/).length / 200));
  }
  if (category !== undefined) post.category = category;
  if (author !== undefined) post.author = author;
  if (published !== undefined) post.published = published;
  if (coverColor !== undefined) post.coverColor = coverColor;
  if (imageUrl !== undefined) post.imageUrl = imageUrl;
  if (publishedAt !== undefined) post.publishedAt = publishedAt;
  if (readingTime !== undefined) post.readingTime = readingTime;
  post.updatedAt = new Date().toISOString();

  await db.write();
  res.json({ success: true, post });
});

// DELETE /api/blog/:id — delete post (admin only)
router.delete("/:id", requireBlogAuth, async (req, res) => {
  const db = getDb();
  if (!db.data.blogPosts) db.data.blogPosts = [];

  const idx = db.data.blogPosts.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: "Post not found" });

  db.data.blogPosts.splice(idx, 1);
  await db.write();
  res.json({ success: true, message: "Post deleted" });
});

export default router;
