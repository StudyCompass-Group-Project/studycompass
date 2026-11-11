import pool from "./index.js";

// Runs several queries as ONE all-or-nothing unit. Use it when a request writes to
// more than one table (e.g. a course AND its weekly schedule): if any query fails,
// ROLLBACK undoes all of them, so you never end up with a half-saved course.
//
//   await withTransaction(async (client) => {
//     await client.query("INSERT ...");
//     await client.query("INSERT ...");
//   });
//
// Inside the callback you MUST use `client`, not `pool`. A transaction lives on a
// single connection, and pool.query() may pick a different one.
export async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release(); // hand the connection back to the pool no matter what
  }
}