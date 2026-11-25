import mysql from "mysql2/promise";

const NAME_MAX = 24;
const TEXT_MIN = 2;
const TEXT_MAX = 280;

let pool;
function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.TIDB_HOST,
      port: Number(process.env.TIDB_PORT) || 4000,
      user: process.env.TIDB_USER,
      password: process.env.TIDB_PASSWORD,
      database: process.env.TIDB_DATABASE,
      ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true },
      charset: "utf8mb4",
      waitForConnections: true,
      connectionLimit: 3,
      maxIdle: 1,
      idleTimeout: 60000,
      enableKeepAlive: true,
      connectTimeout: 10000,
    });
  }
  return pool;
}

const RETRYABLE = new Set(["PROTOCOL_CONNECTION_LOST", "ECONNRESET", "EPIPE", "ETIMEDOUT"]);

// All SQL goes through prepared statements: values are sent separately from the SQL text.
async function run(sql, params = []) {
  try {
    const [rows] = await getPool().execute(sql, params);
    return rows;
  } catch (err) {
    // TiDB Cloud closes idle connections; retry once on a dropped socket.
    if (RETRYABLE.has(err && err.code)) {
      const [rows] = await getPool().execute(sql, params);
      return rows;
    }
    throw err;
  }
}

const HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: HEADERS });

const validVisitor = (v) => typeof v === "string" && /^[A-Za-z0-9]{16,40}$/.test(v);
// Count Unicode code points, the same way MySQL/TiDB VARCHAR(n) counts characters.
const charLen = (s) => Array.from(s).length;
const validId = (id) => Number.isSafeInteger(id) && id > 0;

async function list(req) {
  const v = new URL(req.url).searchParams.get("v");
  const vid = validVisitor(v) ? v : "";
  const rows = await run(
    `SELECT c.id, c.name, c.text,
            UNIX_TIMESTAMP(c.created_at) * 1000 AS ts,
            (c.visitor_id = ?) AS mine,
            (SELECT COUNT(*) FROM likes l WHERE l.comment_id = c.id) AS likes,
            EXISTS(SELECT 1 FROM likes l WHERE l.comment_id = c.id AND l.visitor_id = ?) AS liked
       FROM comments c
      ORDER BY c.created_at DESC, c.id DESC
      LIMIT 300`,
    [vid, vid]
  );
  const [p] = await run("SELECT COUNT(DISTINCT visitor_id) AS people FROM comments");
  return json(200, {
    people: Number(p && p.people) || 0,
    comments: rows.map((r) => ({
      id: Number(r.id),
      name: r.name,
      text: r.text,
      ts: Number(r.ts),
      mine: !!Number(r.mine),
      likes: Number(r.likes),
      liked: !!Number(r.liked),
    })),
  });
}

async function add(vid, body) {
  if (body.name != null && typeof body.name !== "string") return json(400, { error: "bad_name" });
  if (typeof body.text !== "string") return json(400, { error: "bad_text" });

  const name = (body.name || "").trim() || "Mehmon";
  const text = body.text.trim();
  if (charLen(name) > NAME_MAX) return json(400, { error: "name_too_long", max: NAME_MAX });
  const tl = charLen(text);
  if (tl < TEXT_MIN) return json(400, { error: "text_too_short", min: TEXT_MIN });
  if (tl > TEXT_MAX) return json(400, { error: "text_too_long", max: TEXT_MAX });

  const [recent] = await run(
    "SELECT COUNT(*) AS n FROM comments WHERE visitor_id = ? AND created_at > (NOW() - INTERVAL 10 SECOND)",
    [vid]
  );
  if (Number(recent.n) > 0) return json(429, { error: "too_fast" });

  await run("INSERT INTO comments (visitor_id, name, text) VALUES (?, ?, ?)", [vid, name, text]);
  return json(200, { ok: true });
}

async function toggleLike(vid, body) {
  const id = Number(body.id);
  if (!validId(id)) return json(400, { error: "bad_id" });
  const del = await run("DELETE FROM likes WHERE comment_id = ? AND visitor_id = ?", [id, vid]);
  if (!del.affectedRows) {
    await run("INSERT IGNORE INTO likes (comment_id, visitor_id) SELECT id, ? FROM comments WHERE id = ?", [vid, id]);
  }
  return json(200, { ok: true });
}

async function remove(req, vid, body) {
  const id = Number(body.id);
  if (!validId(id)) return json(400, { error: "bad_id" });
  const adminKey = process.env.ADMIN_KEY;
  const isAdmin = !!adminKey && req.headers.get("x-admin-key") === adminKey;
  if (!isAdmin) {
    const owned = await run("SELECT 1 AS ok FROM comments WHERE id = ? AND visitor_id = ?", [id, vid]);
    if (!owned.length) return json(200, { ok: true });
  }
  // Likes are removed first so this works whether or not the table has an ON DELETE CASCADE foreign key.
  await run("DELETE FROM likes WHERE comment_id = ?", [id]);
  await run("DELETE FROM comments WHERE id = ?", [id]);
  return json(200, { ok: true });
}

export default async (req) => {
  try {
    if (req.method === "GET") return await list(req);

    if (req.method === "POST") {
      let body;
      try {
        body = await req.json();
      } catch {
        return json(400, { error: "bad_json" });
      }
      if (!body || typeof body !== "object") return json(400, { error: "bad_json" });
      const vid = body.v;
      if (!validVisitor(vid)) return json(400, { error: "bad_visitor" });

      if (body.action === "add") return await add(vid, body);
      if (body.action === "like") return await toggleLike(vid, body);
      if (body.action === "delete") return await remove(req, vid, body);
      return json(400, { error: "bad_action" });
    }

    return json(405, { error: "method" });
  } catch (err) {
    console.error("api error:", err && (err.code || err.message));
    return json(500, { error: "server" });
  }
};

export const config = {
  path: "/api",
};
