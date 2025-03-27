const express = require("express");
const path = require("path");
const env = require("dotenv").config();
const db = require("./config/db");
const userRouter = require("./routes/userRouter");
const adminRouter = require("./routes/adminRouter");
const session = require("express-session");
const passport = require ("passport")
require("./config/passport.js");
require("dotenv").config();
const cookieParser = require("cookie-parser");
const flash = require("connect-flash");
const connectDB = require("./config/db");
const nocache=require('nocache')
const app = express();
const cors = require('cors');


connectDB();
db();

app.use(cookieParser());
app.use(cors());

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, maxAge: 6000000 }
}));



app.use(flash());

app.use((req, res, next) => {
    res.locals.successMessage = req.flash("success");
    res.locals.errorMessage = req.flash("error");
    next();
});


app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(nocache())


app.set("view engine", "ejs");
app.set("views", [
    path.join(__dirname, "views/user"),
    path.join(__dirname, "views/admin")
]);



app.use(express.static(path.join(__dirname, "public")));

app.use(passport.initialize());
app.use(passport.session());

app.use("/", userRouter); 
app.use("/admin", adminRouter);


app.listen(process.env.PORT, () => {
    console.log(`Server running on http://localhost:${process.env.PORT} `);
});

module.exports = app;
