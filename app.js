const express = require("express");
const path = require("path");
const env = require("dotenv").config();
const connectDB = require("./config/db");
const userRouter = require("./routes/userRouter");
const adminRouter = require("./routes/adminRouter");
const session = require("express-session");
const passport = require("passport");
require("./config/passport.js");
const cookieParser = require("cookie-parser");
const flash = require("connect-flash");
const nocache = require("nocache");
const http = require("http");
const { Server } = require("socket.io");
const { checkSession, isLogin, checkBlockStatus } = require('./middlewares/auhtMiddleware');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
connectDB();

// Basic middlewares
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(nocache());

// 1. Session middleware FIRST
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false, // Changed to false for security
    cookie: { 
      secure: process.env.NODE_ENV === 'production', 
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    },
  })
);

// 2. Flash middleware
app.use(flash());

// 3. Pass flash to locals
app.use((req, res, next) => {
  res.locals.successMessage = req.flash("success");
  res.locals.errorMessage = req.flash("error");
  next();
});

// 4. NOW apply checkBlockStatus (after session)
app.use(checkBlockStatus);

// 5. Passport
app.use(passport.initialize());
app.use(passport.session());

// Socket.io
app.set("io", io);
io.on("connection", (socket) => {
  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

// View engine
app.set("view engine", "ejs");
app.set("views", [
  path.join(__dirname, "views/user"),
  path.join(__dirname, "views/admin"),
]);

// Static files
app.use(express.static(path.join(__dirname, "public")));

// Routes
app.use("/", userRouter);
app.use("/admin", adminRouter);

// Start server
server.listen(process.env.PORT || 3000, () => {
  console.log(`Server running on http://localhost:${process.env.PORT || 3000}`);
});

module.exports = { app, io };