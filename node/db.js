import mysql from "mysql2/promise.js";

export const pool = mysql.createPool({
  host: "127.0.0.1",
  user: "node1",
  password: "poggers",
  database: "test1",
  waitForConnections: true,
  connectionLimit: 10,
});
