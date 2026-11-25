const mysql = require("mysql2/promise");

let pool;
function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: process.env.DB_SSL === "false" ? undefined : { rejectUnauthorized: false },
      charset: "utf8mb4",
      waitForConnections: true,
      connectionLimit: 3,
      connectTimeout: 8000,
    });
  }
  return pool;
}

const HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
function json(status, body) {
  return { statusCode: status, headers: HEADERS, body: JSON.stringify(body) };
}
function validVisitor(v) {
  return typeof v === "string" && /^[A-Za-z0-9]{16,40}$/.test(v);
}

exports.handler = async (event) => {
  try {
    const db = getPool();

    if (event.httpMethod === "GET") {
      const v = (event.queryStringParameters || {}).v;
      const vid = validVisitor(v) ? v : "";
      const [rows] = await db.query(
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
      const [[p]] = await db.query("SELECT COUNT(DISTINCT visitor_id) AS people FROM comments");
      return json(200, {
        people: Number(p.people) || 0,
        comments: rows.map((r) => ({
          id: r.id,
          name: r.name,
          text: r.text,
          ts: Number(r.ts),
          mine: !!Number(r.mine),
          likes: Number(r.likes),
          liked: !!Number(r.liked),
        })),
      });
    }

    if (event.httpMethod === "POST") {
      let body;
      try { body = JSON.parse(event.body || "{}"); } catch (e) { return json(400, { error: "bad_json" }); }
      const vid = body.v;
      if (!validVisitor(vid)) return json(400, { error: "bad_visitor" });

      if (body.action === "add") {
        const name = String(body.name || "").trim().slice(0, 24) || "Mehmon";
        const text = String(body.text || "").trim();
        if (text.length < 2 || text.length > 280) return json(400, { error: "bad_text" });
        const [[recent]] = await db.query(
          "SELECT COUNT(*) AS n FROM comments WHERE visitor_id = ? AND created_at > (NOW() - INTERVAL 10 SECOND)",
          [vid]
        );
        if (Number(recent.n) > 0) return json(429, { error: "too_fast" });
        await db.query("INSERT INTO comments (visitor_id, name, text) VALUES (?, ?, ?)", [vid, name, text]);
        return json(200, { ok: true });
      }

      if (body.action === "like") {
        const id = Number(body.id);
        if (!Number.isInteger(id) || id < 1) return json(400, { error: "bad_id" });
        const [del] = await db.query("DELETE FROM likes WHERE comment_id = ? AND visitor_id = ?", [id, vid]);
        if (!del.affectedRows) {
          await db.query(
            "INSERT IGNORE INTO likes (comment_id, visitor_id) SELECT id, ? FROM comments WHERE id = ?",
            [vid, id]
          );
        }
        return json(200, { ok: true });
      }

      if (body.action === "delete") {
        const id = Number(body.id);
        if (!Number.isInteger(id) || id < 1) return json(400, { error: "bad_id" });
        const adminKey = process.env.ADMIN_KEY;
        const isAdmin = adminKey && event.headers && event.headers["x-admin-key"] === adminKey;
        if (isAdmin) await db.query("DELETE FROM comments WHERE id = ?", [id]);
        else await db.query("DELETE FROM comments WHERE id = ? AND visitor_id = ?", [id, vid]);
        return json(200, { ok: true });
      }

      return json(400, { error: "bad_action" });
    }

    return json(405, { error: "method" });
  } catch (err) {
    console.error(err);
    return json(500, { error: "server" });
  }
};
