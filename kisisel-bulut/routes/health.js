"use strict";

const express = require("express");

const router = express.Router();

router.get("/", (_request, response) => {
  response.status(200).type("text/plain").send("ok");
});

module.exports = router;
