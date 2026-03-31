const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>CI/CD DevOps App</title>
      <style>
        body {
          margin: 0;
          font-family: Arial, sans-serif;
          background: linear-gradient(135deg, #0f2027, #203a43, #2c5364);
          color: white;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
        }
        .container {
          text-align: center;
          padding: 40px;
          border-radius: 15px;
          background: rgba(0,0,0,0.4);
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }
        h1 {
          font-size: 2.5rem;
          margin-bottom: 10px;
        }
        p {
          font-size: 1.2rem;
          opacity: 0.8;
        }
        .badge {
          margin-top: 20px;
          display: inline-block;
          padding: 10px 20px;
          border-radius: 20px;
          background: #00c9ff;
          color: black;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🚀 CI/CD Pipeline Live</h1>
        <p>Docker + GitHub Actions + Node.js</p>
        <div class="badge">Build Successful ✅</div>
      </div>
    </body>
    </html>
  `);
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});