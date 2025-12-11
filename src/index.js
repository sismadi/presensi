// src/index.js

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const db = env.DB;

    // CORS preflight
    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    try {
      // ------------------------------
      // GET /attendance -> list data
      // ------------------------------
      if (path === "/attendance" && method === "GET") {
        const result = await db
          .prepare("SELECT id, name, ts, note, labels FROM attendance ORDER BY id DESC LIMIT 200")
          .all();
        // result: { results: [ {id, name, ts, note, labels}, ...] }
        return jsonResponse({ results: result.results || [] });
      }

      // ------------------------------
      // POST /attendance -> create
      // body: { name, ts, note, labels }
      // labels: string JSON (embedding)
      // ------------------------------
      if (path === "/attendance" && method === "POST") {
        const body = await request.json();
        const name = body.name;
        const ts = body.ts || new Date().toISOString();
        const note = body.note || "";
        const labels = body.labels || "";

        if (!name || !labels) {
          return jsonResponse(
            { error: "Field 'name' dan 'labels' wajib diisi." },
            400
          );
        }

        const res = await db
          .prepare(
            "INSERT INTO attendance (name, ts, note, labels) VALUES (?1, ?2, ?3, ?4)"
          )
          .bind(name, ts, note, labels)
          .run();

        const newId = res.meta?.last_row_id;

        return jsonResponse({ ok: true, id: newId }, 201);
      }

      // ------------------------------
      // /attendance/:id -> ambil id dari path
      // ------------------------------
      const attendanceIdMatch = path.match(/^\/attendance\/(\d+)$/);
      if (attendanceIdMatch) {
        const id = Number(attendanceIdMatch[1]);

        // GET /attendance/:id (opsional, kalau mau)
        if (method === "GET") {
          const result = await db
            .prepare(
              "SELECT id, name, ts, note, labels FROM attendance WHERE id = ?1"
            )
            .bind(id)
            .all();

          if (!result.results.length) {
            return jsonResponse({ error: "Data tidak ditemukan" }, 404);
          }
          return jsonResponse(result.results[0]);
        }

        // PUT /attendance/:id -> update
        if (method === "PUT") {
          const body = await request.json();
          const name = body.name;
          const ts = body.ts || new Date().toISOString();
          const note = body.note || "";
          const labels = body.labels || "";

          if (!name || !labels) {
            return jsonResponse(
              { error: "Field 'name' dan 'labels' wajib diisi." },
              400
            );
          }

          const res = await db
            .prepare(
              "UPDATE attendance SET name = ?1, ts = ?2, note = ?3, labels = ?4 WHERE id = ?5"
            )
            .bind(name, ts, note, labels, id)
            .run();

          if (res.meta.changes === 0) {
            return jsonResponse({ error: "Data tidak ditemukan" }, 404);
          }

          return jsonResponse({ ok: true, id });
        }

        // DELETE /attendance/:id -> hapus
        if (method === "DELETE") {
          const res = await db
            .prepare("DELETE FROM attendance WHERE id = ?1")
            .bind(id)
            .run();

          if (res.meta.changes === 0) {
            return jsonResponse({ error: "Data tidak ditemukan" }, 404);
          }

          return jsonResponse({ ok: true, id });
        }
      }

      // ------------------------------
      // Fallback 404
      // ------------------------------
      return jsonResponse({ error: "Not Found" }, 404);
    } catch (err) {
      return jsonResponse(
        { error: "Internal error", detail: String(err) },
        500
      );
    }
  },
};
