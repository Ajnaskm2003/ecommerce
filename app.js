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

const app = express();
const server = http.createServer(app); 
const io = new Server(server); 
connectDB();


app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(nocache());

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, maxAge: 6000000 },
  })
);

app.use(flash());

app.use((req, res, next) => {
  res.locals.successMessage = req.flash("success");
  res.locals.errorMessage = req.flash("error");
  next();
});

app.use(passport.initialize());
app.use(passport.session());

app.set("io", io);


io.on("connection", (socket) => {
  socket.on("disconnect", () => {
    console.log("  ");
  });
});


app.set("view engine", "ejs");
app.set("views", [
  path.join(__dirname, "views/user"),
  path.join(__dirname, "views/admin"),
]);


app.use(express.static(path.join(__dirname, "public")));


app.use("/", userRouter);
app.use("/admin", adminRouter);


server.listen(process.env.PORT || 3000, () => {
  console.log(`Server running on http://localhost:${process.env.PORT || 3000}`);
});

module.exports = { app, io }; 